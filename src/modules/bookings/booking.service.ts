import {
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import {z, type ZodError} from 'zod';
import {
  type AppEnv,
  readAppEnv,
} from '../../lib/config/env';
import {
  DomainError,
  type DomainErrorFields,
} from '../../lib/http/domain-error';
import type {Clock} from '../../lib/time/office-time';
import {
  cancelBookingSchema,
  createBookingSchema,
} from './booking.schemas';
import type {
  BookingListItem,
  BookingPage,
  BookingService,
  BookingView,
  CancelBookingInput,
  CreatedBooking,
  CreateBookingInput,
  ListUserBookingsInput,
} from './booking.types';
import {validateBookingInterval} from './interval';

type BookingHistoryCursor = {
  startsAt: Date;
  id: string;
};

type BookingHistoryRecord = {
  id: string;
  room: {id: string; name: string};
  title: string;
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
};

type BookingHistoryQuery = {
  userId: string;
  scope: 'future' | 'past';
  cursor?: BookingHistoryCursor;
  limit: number;
  now: Date;
};

export interface BookingTransaction {
  cancelOwnedActive(input: CancelBookingInput): Promise<number>;
  findCancellationMetadata(
    bookingId: string,
  ): Promise<{userId: string; cancelledAt: Date | null} | null>;
  isUserEmailVerified(userId: string): Promise<boolean>;
  lockRoom(roomId: string): Promise<boolean>;
  findActiveOverlap(input: {
    roomId: string;
    startsAt: Date;
    endsAt: Date;
  }): Promise<{id: string} | null>;
  create(input: CreateBookingInput): Promise<CreatedBooking>;
}

export interface BookingRepository {
  listUserBookings(input: BookingHistoryQuery): Promise<BookingHistoryRecord[]>;
  withTransaction<T>(
    operation: (transaction: BookingTransaction) => Promise<T>,
  ): Promise<T>;
}

const cursorTextSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);

const bookingHistoryInputSchema = z.strictObject({
  userId: z.string().trim().min(1),
  scope: z.enum(['future', 'past']),
  cursor: cursorTextSchema.optional(),
  limit: z.number().int().positive().transform((limit) => Math.min(limit, 50)),
  now: z.date(),
});

const decodedCursorSchema = z.strictObject({
  startsAt: z.iso.datetime({offset: true}),
  id: z.string().trim().min(1).max(255),
});

function validationError(error: ZodError): DomainError {
  const fields: DomainErrorFields = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !fields[field]) {
      fields[field] = issue.message;
    }
  }

  return new DomainError({
    code: 'VALIDATION_FAILED',
    message: 'Please correct the highlighted fields',
    status: 400,
    fields,
  });
}

function roomNotFoundError(): DomainError {
  return new DomainError({
    code: 'ROOM_NOT_FOUND',
    message: 'Room not found.',
    status: 404,
  });
}

function bookingConflictError(): DomainError {
  return new DomainError({
    code: 'BOOKING_CONFLICT',
    message: 'This time is already booked. Choose another slot.',
    status: 409,
  });
}

function emailNotVerifiedError(): DomainError {
  return new DomainError({
    code: 'EMAIL_NOT_VERIFIED',
    message: 'Verify your email before booking a room.',
    status: 403,
  });
}

function bookingForbiddenError(): DomainError {
  return new DomainError({
    code: 'BOOKING_FORBIDDEN',
    message: 'You can only cancel your own bookings.',
    status: 403,
  });
}

function bookingNotFoundError(): DomainError {
  return new DomainError({
    code: 'BOOKING_NOT_FOUND',
    message: 'Booking not found.',
    status: 404,
  });
}

function invalidCancellationInputError(): DomainError {
  return new DomainError({
    code: 'VALIDATION_FAILED',
    message: 'Invalid cancellation input.',
    status: 400,
  });
}

function invalidBookingHistoryQueryError(): DomainError {
  return new DomainError({
    code: 'VALIDATION_FAILED',
    message: 'Invalid booking history query.',
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

function decodeBookingCursor(cursor: string): BookingHistoryCursor {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = decodedCursorSchema.safeParse(JSON.parse(decoded));
    if (!parsed.success) {
      throw invalidBookingHistoryQueryError();
    }
    return {
      startsAt: new Date(parsed.data.startsAt),
      id: parsed.data.id,
    };
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }
    throw invalidBookingHistoryQueryError();
  }
}

function encodeBookingCursor(booking: BookingHistoryRecord): string {
  return Buffer.from(JSON.stringify({
    startsAt: booking.startsAt.toISOString(),
    id: booking.id,
  }), 'utf8').toString('base64url');
}

function toBookingListItem(
  booking: BookingHistoryRecord,
  scope: 'future' | 'past',
): BookingListItem {
  return {
    id: booking.id,
    room: booking.room,
    title: booking.title,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    status: booking.cancelledAt !== null ?
      'cancelled' :
      scope === 'future' ? 'upcoming' : 'completed',
  };
}

function toBookingView(
  booking: CreatedBooking,
  userId: string,
): BookingView {
  return {
    id: booking.id,
    roomId: booking.roomId,
    title: booking.title,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    author: booking.author,
    isOwn: booking.author.id === userId,
  };
}

export class DefaultBookingService implements BookingService {
  constructor(
    private readonly dependencies: {
      repository: BookingRepository;
      clock: Clock;
      env: AppEnv;
    },
  ) {}

  async listUserBookings(input: ListUserBookingsInput): Promise<BookingPage> {
    const parsed = bookingHistoryInputSchema.safeParse(input);
    if (!parsed.success) {
      throw invalidBookingHistoryQueryError();
    }
    const {cursor, ...validatedInput} = parsed.data;
    const query: BookingHistoryQuery = {
      ...validatedInput,
      ...(cursor ? {
        cursor: decodeBookingCursor(cursor),
      } : {}),
    };

    let records: BookingHistoryRecord[];
    try {
      records = await this.dependencies.repository.listUserBookings(query);
    } catch {
      throw serviceUnavailableError();
    }

    const pageRecords = records.slice(0, query.limit);
    return {
      items: pageRecords.map((booking) =>
        toBookingListItem(booking, query.scope),
      ),
      nextCursor: records.length > query.limit && pageRecords.length > 0 ?
        encodeBookingCursor(pageRecords[pageRecords.length - 1]) :
        null,
    };
  }

  async cancel(input: CancelBookingInput): Promise<void> {
    const bookingId = (
      input &&
      typeof input === 'object' &&
      typeof (input as {bookingId?: unknown}).bookingId === 'string'
    ) ? (input as {bookingId: string}).bookingId.trim() : '';
    if (!bookingId) {
      throw bookingNotFoundError();
    }
    const parsed = cancelBookingSchema.safeParse(input);
    if (!parsed.success) {
      throw invalidCancellationInputError();
    }
    const validatedInput = parsed.data;

    try {
      await this.dependencies.repository.withTransaction(
        async (transaction) => {
          const updated = await transaction.cancelOwnedActive(validatedInput);
          if (updated > 0) {
            return;
          }

          const booking = await transaction.findCancellationMetadata(
            validatedInput.bookingId,
          );
          if (!booking) {
            throw bookingNotFoundError();
          }
          if (booking.userId !== validatedInput.userId) {
            throw bookingForbiddenError();
          }
          if (booking.cancelledAt !== null) {
            return;
          }

          const retried = await transaction.cancelOwnedActive(validatedInput);
          if (retried === 0) {
            throw serviceUnavailableError();
          }
        },
      );
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw serviceUnavailableError();
    }
  }

  async create(input: CreateBookingInput): Promise<BookingView> {
    const parsed = createBookingSchema.safeParse(input);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const interval = validateBookingInterval({
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      now: this.dependencies.clock.now(),
      officeTimeZone: this.dependencies.env.officeTimeZone,
      officeOpenHour: this.dependencies.env.officeOpenHour,
      officeCloseHour: this.dependencies.env.officeCloseHour,
    });
    const validatedInput: CreateBookingInput = {
      ...parsed.data,
      startsAt: interval.startsAt,
      endsAt: interval.endsAt,
    };

    let booking: CreatedBooking;
    try {
      booking = await this.dependencies.repository.withTransaction(
        async (transaction) => {
          const emailVerified = await transaction.isUserEmailVerified(
            validatedInput.userId,
          );
          if (!emailVerified) {
            throw emailNotVerifiedError();
          }

          const roomExists = await transaction.lockRoom(validatedInput.roomId);
          if (!roomExists) {
            throw roomNotFoundError();
          }

          const conflict = await transaction.findActiveOverlap({
            roomId: validatedInput.roomId,
            startsAt: validatedInput.startsAt,
            endsAt: validatedInput.endsAt,
          });
          if (conflict) {
            throw bookingConflictError();
          }

          return transaction.create(validatedInput);
        },
      );
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw serviceUnavailableError();
    }

    return toBookingView(booking, validatedInput.userId);
  }
}

type TransactionDatabase = Pick<
  Prisma.TransactionClient,
  '$queryRaw' | 'booking' | 'user'
>;

class PrismaBookingTransaction implements BookingTransaction {
  constructor(private readonly transaction: TransactionDatabase) {}

  async cancelOwnedActive(input: CancelBookingInput): Promise<number> {
    const result = await this.transaction.booking.updateMany({
      where: {
        id: input.bookingId,
        userId: input.userId,
        cancelledAt: null,
      },
      data: {cancelledAt: input.cancelledAt},
    });
    return result.count;
  }

  async findCancellationMetadata(
    bookingId: string,
  ): Promise<{userId: string; cancelledAt: Date | null} | null> {
    return this.transaction.booking.findUnique({
      where: {id: bookingId},
      select: {
        userId: true,
        cancelledAt: true,
      },
    });
  }

  async isUserEmailVerified(userId: string): Promise<boolean> {
    const user = await this.transaction.user.findUnique({
      where: {id: userId},
      select: {emailVerifiedAt: true},
    });
    return user !== null && user.emailVerifiedAt !== null;
  }

  async lockRoom(roomId: string): Promise<boolean> {
    const lockedRooms = await this.transaction.$queryRaw<Array<{id: string}>>`
      SELECT "id"
      FROM "Room"
      WHERE "id" = ${roomId}
      FOR UPDATE
    `;
    return lockedRooms.length !== 0;
  }

  async findActiveOverlap(input: {
    roomId: string;
    startsAt: Date;
    endsAt: Date;
  }): Promise<{id: string} | null> {
    return this.transaction.booking.findFirst({
      where: {
        roomId: input.roomId,
        cancelledAt: null,
        startsAt: {lt: input.endsAt},
        endsAt: {gt: input.startsAt},
      },
      select: {id: true},
    });
  }

  async create(input: CreateBookingInput): Promise<CreatedBooking> {
    const booking = await this.transaction.booking.create({
      data: input,
      select: {
        id: true,
        roomId: true,
        title: true,
        startsAt: true,
        endsAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return {
      id: booking.id,
      roomId: booking.roomId,
      title: booking.title,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      author: booking.user,
    };
  }
}

type BookingPrismaClient = Pick<PrismaClient, '$transaction' | 'booking'>;

export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly database: BookingPrismaClient) {}

  async listUserBookings(
    input: BookingHistoryQuery,
  ): Promise<BookingHistoryRecord[]> {
    const direction = input.scope === 'future' ? 'asc' : 'desc';
    const cursorBoundary = input.cursor ? {
      OR: [
        {startsAt: {[input.scope === 'future' ? 'gt' : 'lt']: input.cursor.startsAt}},
        {
          startsAt: input.cursor.startsAt,
          id: {[input.scope === 'future' ? 'gt' : 'lt']: input.cursor.id},
        },
      ],
    } : {};
    return this.database.booking.findMany({
      where: {
        userId: input.userId,
        startsAt: input.scope === 'future' ?
          {gte: input.now} :
          {lt: input.now},
        ...(input.scope === 'future' ? {cancelledAt: null} : {}),
        ...cursorBoundary,
      },
      orderBy: [
        {startsAt: direction},
        {id: direction},
      ],
      take: input.limit + 1,
      select: {
        id: true,
        room: {
          select: {
            id: true,
            name: true,
          },
        },
        title: true,
        startsAt: true,
        endsAt: true,
        cancelledAt: true,
      },
    });
  }

  async withTransaction<T>(
    operation: (transaction: BookingTransaction) => Promise<T>,
  ): Promise<T> {
    return this.database.$transaction(async (transaction) =>
      operation(new PrismaBookingTransaction(transaction)),
    );
  }
}

const systemClock: Clock = {
  now: () => new Date(),
};

let defaultService: Promise<BookingService> | undefined;

async function getDefaultService(): Promise<BookingService> {
  if (!defaultService) {
    defaultService = import('../../lib/db/prisma').then(({prisma}) =>
      new DefaultBookingService({
        repository: new PrismaBookingRepository(prisma),
        clock: systemClock,
        env: readAppEnv(),
      }),
    );
  }
  return defaultService;
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<BookingView> {
  return (await getDefaultService()).create(input);
}

export async function cancelBooking(
  input: CancelBookingInput,
): Promise<void> {
  return (await getDefaultService()).cancel(input);
}

export async function listUserBookings(
  input: ListUserBookingsInput,
): Promise<BookingPage> {
  return (await getDefaultService()).listUserBookings(input);
}

export type {
  BookingListItem,
  BookingPage,
} from './booking.types';
