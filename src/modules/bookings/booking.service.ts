import {
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import type {ZodError} from 'zod';
import {
  type AppEnv,
  readAppEnv,
} from '../../lib/config/env';
import {
  DomainError,
  type DomainErrorFields,
} from '../../lib/http/domain-error';
import type {Clock} from '../../lib/time/office-time';
import {createBookingSchema} from './booking.schemas';
import type {
  BookingService,
  BookingView,
  CancelBookingInput,
  CreatedBooking,
  CreateBookingInput,
} from './booking.types';
import {validateBookingInterval} from './interval';

export interface BookingTransaction {
  cancelOwnedActive(input: CancelBookingInput): Promise<number>;
  findCancellationMetadata(
    bookingId: string,
  ): Promise<{userId: string; cancelledAt: Date | null} | null>;
  lockRoom(roomId: string): Promise<boolean>;
  findActiveOverlap(input: {
    roomId: string;
    startsAt: Date;
    endsAt: Date;
  }): Promise<{id: string} | null>;
  create(input: CreateBookingInput): Promise<CreatedBooking>;
}

export interface BookingRepository {
  withTransaction<T>(
    operation: (transaction: BookingTransaction) => Promise<T>,
  ): Promise<T>;
}

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

function serviceUnavailableError(): DomainError {
  return new DomainError({
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service unavailable',
    status: 503,
  });
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

  async cancel(input: CancelBookingInput): Promise<void> {
    try {
      await this.dependencies.repository.withTransaction(
        async (transaction) => {
          const updated = await transaction.cancelOwnedActive(input);
          if (updated > 0) {
            return;
          }

          const booking = await transaction.findCancellationMetadata(
            input.bookingId,
          );
          if (!booking) {
            throw bookingNotFoundError();
          }
          if (booking.userId !== input.userId) {
            throw bookingForbiddenError();
          }
          if (booking.cancelledAt !== null) {
            return;
          }

          const retried = await transaction.cancelOwnedActive(input);
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
  '$queryRaw' | 'booking'
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

type BookingPrismaClient = Pick<PrismaClient, '$transaction'>;

export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly database: BookingPrismaClient) {}

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
