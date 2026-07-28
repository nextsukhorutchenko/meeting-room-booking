import {
  NotificationType,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import {z} from 'zod';
import {DomainError} from '../../lib/http/domain-error';

export type DueNotification = {
  id: string;
  roomName: string;
  currentTitle: string;
  endsAt: string;
  nextAuthorName: string;
};

export type HandoffCandidate = {
  currentBookingId: string;
  currentEndsAt: Date;
  nextBookingId: string;
};

export interface NotificationTransaction {
  findDueHandoffs(input: {
    recipientId: string;
    now: Date;
    windowEndsAt: Date;
  }): Promise<HandoffCandidate[]>;
  upsertHandoff(input: {
    recipientId: string;
    currentBookingId: string;
    nextBookingId: string;
    deliverAt: Date;
  }): Promise<void>;
  claimActive(input: {
    recipientId: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<DueNotification[]>;
  acknowledge(input: {
    recipientId: string;
    notificationId: string;
    acknowledgedAt: Date;
  }): Promise<void>;
}

export interface NotificationRepository {
  withTransaction<T>(
    operation: (transaction: NotificationTransaction) => Promise<T>,
  ): Promise<T>;
}

const claimInputSchema = z.strictObject({
  recipientId: z.string().trim().min(1),
  now: z.date(),
  leadMinutes: z.number().int().positive(),
  leaseSeconds: z.number().int().min(5).max(300),
});

const acknowledgementInputSchema = z.strictObject({
  recipientId: z.string().trim().min(1),
  notificationId: z.string().trim().min(1),
  now: z.date(),
});

function invalidInputError(): DomainError {
  return new DomainError({
    code: 'VALIDATION_FAILED',
    message: 'Invalid notification claim input.',
    status: 400,
  });
}

function serviceUnavailableError(): DomainError {
  return new DomainError({
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service unavailable',
    status: 503,
  });
}

export class DefaultNotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  async claimDueNotifications(input: {
    recipientId: string;
    now: Date;
    leadMinutes: number;
    leaseSeconds: number;
  }): Promise<DueNotification[]> {
    const parsed = claimInputSchema.safeParse(input);
    if (!parsed.success) {
      throw invalidInputError();
    }

    const windowEndsAt = new Date(
      parsed.data.now.getTime() + parsed.data.leadMinutes * 60_000,
    );
    try {
      return await this.repository.withTransaction(async (transaction) => {
        const candidates = await transaction.findDueHandoffs({
          recipientId: parsed.data.recipientId,
          now: parsed.data.now,
          windowEndsAt,
        });
        for (const candidate of candidates) {
          await transaction.upsertHandoff({
            recipientId: parsed.data.recipientId,
            currentBookingId: candidate.currentBookingId,
            nextBookingId: candidate.nextBookingId,
            deliverAt: new Date(
              candidate.currentEndsAt.getTime() -
              parsed.data.leadMinutes * 60_000,
            ),
          });
        }
        return transaction.claimActive({
          recipientId: parsed.data.recipientId,
          now: parsed.data.now,
          leaseExpiresAt: new Date(
            parsed.data.now.getTime() + parsed.data.leaseSeconds * 1_000,
          ),
        });
      });
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw serviceUnavailableError();
    }
  }

  async acknowledge(input: {
    recipientId: string;
    notificationId: string;
    now: Date;
  }): Promise<void> {
    const parsed = acknowledgementInputSchema.safeParse(input);
    if (!parsed.success) {
      throw invalidInputError();
    }
    try {
      await this.repository.withTransaction((transaction) =>
        transaction.acknowledge({
          recipientId: parsed.data.recipientId,
          notificationId: parsed.data.notificationId,
          acknowledgedAt: parsed.data.now,
        }),
      );
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw serviceUnavailableError();
    }
  }
}

type TransactionDatabase = Pick<
  Prisma.TransactionClient,
  '$executeRaw' | '$queryRaw' | 'notification'
>;

type DueHandoffRow = {
  currentBookingId: string;
  currentEndsAt: Date;
  nextBookingId: string;
};

type ClaimedNotificationRow = {
  id: string;
  roomName: string;
  currentTitle: string;
  endsAt: Date;
  nextAuthorName: string;
};

class PrismaNotificationTransaction implements NotificationTransaction {
  constructor(private readonly transaction: TransactionDatabase) {}

  async findDueHandoffs(input: {
    recipientId: string;
    now: Date;
    windowEndsAt: Date;
  }): Promise<HandoffCandidate[]> {
    return this.transaction.$queryRaw<DueHandoffRow[]>`
      SELECT
        current_booking."id" AS "currentBookingId",
        current_booking."endsAt" AS "currentEndsAt",
        next_booking."id" AS "nextBookingId"
      FROM "Booking" AS current_booking
      INNER JOIN "Booking" AS next_booking
        ON next_booking."roomId" = current_booking."roomId"
        AND next_booking."startsAt" = current_booking."endsAt"
        AND next_booking."cancelledAt" IS NULL
      WHERE current_booking."userId" = ${input.recipientId}
        AND current_booking."cancelledAt" IS NULL
        AND current_booking."startsAt" <= ${input.now}
        AND current_booking."endsAt" > ${input.now}
        AND current_booking."endsAt" <= ${input.windowEndsAt}
      ORDER BY
        current_booking."endsAt" ASC,
        current_booking."id" ASC,
        next_booking."id" ASC
      FOR UPDATE OF current_booking, next_booking
    `;
  }

  async upsertHandoff(input: {
    recipientId: string;
    currentBookingId: string;
    nextBookingId: string;
    deliverAt: Date;
  }): Promise<void> {
    await this.transaction.notification.upsert({
      where: {
        type_recipientId_currentBookingId_nextBookingId: {
          type: NotificationType.BOOKING_END_HANDOFF,
          recipientId: input.recipientId,
          currentBookingId: input.currentBookingId,
          nextBookingId: input.nextBookingId,
        },
      },
      update: {},
      create: {
        type: NotificationType.BOOKING_END_HANDOFF,
        ...input,
      },
    });
  }

  async claimActive(input: {
    recipientId: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<DueNotification[]> {
    const rows = await this.transaction.$queryRaw<ClaimedNotificationRow[]>`
      WITH claimable AS (
        SELECT notification."id"
        FROM "Notification" AS notification
        INNER JOIN "Booking" AS current_booking
          ON current_booking."id" = notification."currentBookingId"
        INNER JOIN "Booking" AS next_booking
          ON next_booking."id" = notification."nextBookingId"
        WHERE notification."recipientId" = ${input.recipientId}
          AND notification."type" =
            CAST('BOOKING_END_HANDOFF' AS "NotificationType")
          AND notification."acknowledgedAt" IS NULL
          AND (
            notification."leaseExpiresAt" IS NULL
            OR notification."leaseExpiresAt" <= ${input.now}
          )
          AND notification."deliverAt" <= ${input.now}
          AND current_booking."cancelledAt" IS NULL
          AND next_booking."cancelledAt" IS NULL
        ORDER BY notification."deliverAt" ASC, notification."id" ASC
        FOR UPDATE OF notification, current_booking, next_booking SKIP LOCKED
      ),
      claimed AS (
        UPDATE "Notification" AS notification
        SET "leaseExpiresAt" = ${input.leaseExpiresAt}
        FROM claimable
        WHERE notification."id" = claimable."id"
          AND notification."acknowledgedAt" IS NULL
          AND (
            notification."leaseExpiresAt" IS NULL
            OR notification."leaseExpiresAt" <= ${input.now}
          )
        RETURNING
          notification."id",
          notification."currentBookingId",
          notification."nextBookingId"
      )
      SELECT
        claimed."id",
        room."name" AS "roomName",
        current_booking."title" AS "currentTitle",
        current_booking."endsAt" AS "endsAt",
        next_author."name" AS "nextAuthorName"
      FROM claimed
      INNER JOIN "Booking" AS current_booking
        ON current_booking."id" = claimed."currentBookingId"
      INNER JOIN "Room" AS room
        ON room."id" = current_booking."roomId"
      INNER JOIN "Booking" AS next_booking
        ON next_booking."id" = claimed."nextBookingId"
      INNER JOIN "User" AS next_author
        ON next_author."id" = next_booking."userId"
      ORDER BY claimed."id" ASC
    `;

    return rows.map((row) => ({
      id: row.id,
      roomName: row.roomName,
      currentTitle: row.currentTitle,
      endsAt: row.endsAt.toISOString(),
      nextAuthorName: row.nextAuthorName,
    }));
  }

  async acknowledge(input: {
    recipientId: string;
    notificationId: string;
    acknowledgedAt: Date;
  }): Promise<void> {
    await this.transaction.$executeRaw`
      UPDATE "Notification"
      SET
        "acknowledgedAt" = COALESCE(
          "acknowledgedAt",
          ${input.acknowledgedAt}
        ),
        "leaseExpiresAt" = NULL
      WHERE "id" = ${input.notificationId}
        AND "recipientId" = ${input.recipientId}
    `;
  }
}

type NotificationPrismaClient = Pick<PrismaClient, '$transaction'>;

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly database: NotificationPrismaClient) {}

  async withTransaction<T>(
    operation: (transaction: NotificationTransaction) => Promise<T>,
  ): Promise<T> {
    return this.database.$transaction(async (transaction) =>
      operation(new PrismaNotificationTransaction(transaction)),
    );
  }
}

let defaultService: Promise<DefaultNotificationService> | undefined;

async function getDefaultService(): Promise<DefaultNotificationService> {
  if (!defaultService) {
    defaultService = import('../../lib/db/prisma').then(({prisma}) =>
      new DefaultNotificationService(
        new PrismaNotificationRepository(prisma),
      ),
    );
  }
  return defaultService;
}

export async function claimDueNotifications(input: {
  recipientId: string;
  now: Date;
  leadMinutes: number;
  leaseSeconds: number;
}): Promise<DueNotification[]> {
  return (await getDefaultService()).claimDueNotifications(input);
}

export async function acknowledgeNotification(input: {
  recipientId: string;
  notificationId: string;
  now: Date;
}): Promise<void> {
  await (await getDefaultService()).acknowledge(input);
}
