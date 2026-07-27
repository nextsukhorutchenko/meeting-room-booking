import {describe, expect, it} from 'vitest';
import type {AppEnv} from '../../src/lib/config/env';
import {DomainError} from '../../src/lib/http/domain-error';
import {overlaps} from '../../src/modules/bookings/interval';
import {
  DefaultBookingService,
  type BookingRepository,
  type BookingTransaction,
} from '../../src/modules/bookings/booking.service';
import type {CreateBookingInput} from '../../src/modules/bookings/booking.types';
import {TestClock} from '../helpers/test-clock';

const now = new Date('2026-07-27T06:00:00.000Z');
const appEnv: AppEnv = {
  databaseUrl: 'postgresql://localhost/meeting_room_booking_test',
  appUrl: 'http://localhost:3000',
  officeTimeZone: 'Europe/Kyiv',
  officeOpenHour: 9,
  officeCloseHour: 19,
  sessionDays: 7,
  notifyBeforeMinutes: 10,
};

const baseInput: CreateBookingInput = {
  userId: 'user-1',
  roomId: 'room-1',
  title: 'Planning',
  startsAt: new Date('2026-07-28T06:00:00.000Z'),
  endsAt: new Date('2026-07-28T07:00:00.000Z'),
};

type ExistingBooking = {
  roomId: string;
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
};

type CancellationBooking = {
  userId: string;
  cancelledAt: Date | null;
};

class InMemoryBookingRepository implements BookingRepository {
  readonly createdInputs: CreateBookingInput[] = [];
  readonly events: string[] = [];
  readonly rooms = new Set(['room-1']);
  readonly existingBookings: ExistingBooking[] = [];
  readonly cancellationBookings = new Map<string, CancellationBooking>();
  cancelOwnedActiveOverride?: (
    input: {bookingId: string; userId: string; cancelledAt: Date},
    attempt: number,
  ) => number;
  transactionCalls = 0;
  private bookingSequence = 0;
  private cancelAttempt = 0;

  async withTransaction<T>(
    operation: (transaction: BookingTransaction) => Promise<T>,
  ): Promise<T> {
    this.transactionCalls += 1;
    this.events.push('transaction');
    return operation({
      lockRoom: async (roomId) => {
        this.events.push('lock-room');
        return this.rooms.has(roomId);
      },
      findActiveOverlap: async ({roomId, startsAt, endsAt}) => {
        this.events.push('find-overlap');
        const match = this.existingBookings.find((booking) =>
          booking.roomId === roomId &&
          booking.cancelledAt === null &&
          overlaps(
            startsAt,
            endsAt,
            booking.startsAt,
            booking.endsAt,
          ),
        );
        return match ? {id: 'existing-booking'} : null;
      },
      create: async (input) => {
        this.events.push('create');
        this.bookingSequence += 1;
        this.createdInputs.push(input);
        this.existingBookings.push({...input, cancelledAt: null});
        return {
          id: `booking-${this.bookingSequence}`,
          roomId: input.roomId,
          title: input.title,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          author: {id: input.userId, name: 'Ada'},
        };
      },
      cancelOwnedActive: async (input) => {
        this.events.push('cancel-owned-active');
        this.cancelAttempt += 1;
        if (this.cancelOwnedActiveOverride) {
          return this.cancelOwnedActiveOverride(input, this.cancelAttempt);
        }
        const booking = this.cancellationBookings.get(input.bookingId);
        if (
          !booking ||
          booking.userId !== input.userId ||
          booking.cancelledAt !== null
        ) {
          return 0;
        }
        booking.cancelledAt = input.cancelledAt;
        return 1;
      },
      findCancellationMetadata: async (bookingId) => {
        this.events.push('find-cancellation-metadata');
        const booking = this.cancellationBookings.get(bookingId);
        return booking ? {...booking} : null;
      },
    });
  }
}

class RejectingBookingRepository extends InMemoryBookingRepository {
  constructor(private readonly error: unknown) {
    super();
  }

  override async withTransaction<T>(): Promise<T> {
    throw this.error;
  }
}

function createService(
  options: {
    repository?: InMemoryBookingRepository;
    env?: AppEnv;
    clock?: TestClock;
  } = {},
): {
  repository: InMemoryBookingRepository;
  service: DefaultBookingService;
} {
  const repository = options.repository ?? new InMemoryBookingRepository();
  const service = new DefaultBookingService({
    repository,
    env: options.env ?? appEnv,
    clock: options.clock ?? new TestClock(now),
  });
  return {repository, service};
}

async function expectDomainError(
  promise: Promise<unknown>,
): Promise<DomainError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return error as DomainError;
  }

  throw new Error('Expected a DomainError');
}

describe('DefaultBookingService', () => {
  describe('cancel', () => {
    const cancelledAt = new Date('2026-07-27T08:30:00.000Z');

    it('soft-cancels an active booking owned by the caller', async () => {
      const {repository, service} = createService();
      repository.cancellationBookings.set('booking-1', {
        userId: 'user-1',
        cancelledAt: null,
      });

      await expect(service.cancel({
        bookingId: 'booking-1',
        userId: 'user-1',
        cancelledAt,
      })).resolves.toBeUndefined();

      expect(repository.cancellationBookings.get('booking-1')).toEqual({
        userId: 'user-1',
        cancelledAt,
      });
      expect(repository.events).toEqual([
        'transaction',
        'cancel-owned-active',
      ]);
    });

    it('returns a stable not-found error after one metadata lookup', async () => {
      const {repository, service} = createService();

      await expect(service.cancel({
        bookingId: 'missing-booking',
        userId: 'user-1',
        cancelledAt,
      })).rejects.toMatchObject({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found.',
        status: 404,
      });
      expect(repository.events).toEqual([
        'transaction',
        'cancel-owned-active',
        'find-cancellation-metadata',
      ]);
    });

    it('forbids cancellation owned by another user', async () => {
      const {repository, service} = createService();
      repository.cancellationBookings.set('booking-1', {
        userId: 'user-2',
        cancelledAt: null,
      });

      await expect(service.cancel({
        bookingId: 'booking-1',
        userId: 'user-1',
        cancelledAt,
      })).rejects.toMatchObject({
        code: 'BOOKING_FORBIDDEN',
        message: 'You can only cancel your own bookings.',
        status: 403,
      });
      expect(repository.cancellationBookings.get('booking-1')).toEqual({
        userId: 'user-2',
        cancelledAt: null,
      });
      expect(repository.events).toEqual([
        'transaction',
        'cancel-owned-active',
        'find-cancellation-metadata',
      ]);
    });

    it('treats repeated owner cancellation as idempotent success', async () => {
      const originalCancellation = new Date('2026-07-27T08:00:00.000Z');
      const {repository, service} = createService();
      repository.cancellationBookings.set('booking-1', {
        userId: 'user-1',
        cancelledAt: originalCancellation,
      });

      await expect(service.cancel({
        bookingId: 'booking-1',
        userId: 'user-1',
        cancelledAt,
      })).resolves.toBeUndefined();

      expect(repository.cancellationBookings.get('booking-1')?.cancelledAt)
        .toBe(originalCancellation);
      expect(repository.events).toEqual([
        'transaction',
        'cancel-owned-active',
        'find-cancellation-metadata',
      ]);
    });

    it('retries one owned-active race outcome without a second lookup', async () => {
      const {repository, service} = createService();
      repository.cancellationBookings.set('booking-1', {
        userId: 'user-1',
        cancelledAt: null,
      });
      repository.cancelOwnedActiveOverride = (input, attempt) => {
        if (attempt === 1) {
          return 0;
        }
        const booking = repository.cancellationBookings.get(input.bookingId);
        if (booking) {
          booking.cancelledAt = input.cancelledAt;
        }
        return 1;
      };

      await expect(service.cancel({
        bookingId: 'booking-1',
        userId: 'user-1',
        cancelledAt,
      })).resolves.toBeUndefined();

      expect(repository.events).toEqual([
        'transaction',
        'cancel-owned-active',
        'find-cancellation-metadata',
        'cancel-owned-active',
      ]);
    });

    it('returns a stable failure when an owned-active retry loses again', async () => {
      const {repository, service} = createService();
      repository.cancellationBookings.set('booking-1', {
        userId: 'user-1',
        cancelledAt: null,
      });
      repository.cancelOwnedActiveOverride = () => 0;

      await expect(service.cancel({
        bookingId: 'booking-1',
        userId: 'user-1',
        cancelledAt,
      })).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service unavailable',
        status: 503,
      });
      expect(repository.events).toEqual([
        'transaction',
        'cancel-owned-active',
        'find-cancellation-metadata',
        'cancel-owned-active',
      ]);
    });

    it('preserves DomainError identity from the cancellation transaction', async () => {
      const expected = new DomainError({
        code: 'BOOKING_FORBIDDEN',
        message: 'Stable forbidden',
        status: 403,
      });
      const {service} = createService({
        repository: new RejectingBookingRepository(expected),
      });

      const actual = await expectDomainError(service.cancel({
        bookingId: 'booking-1',
        userId: 'user-1',
        cancelledAt,
      }));

      expect(actual).toBe(expected);
    });

    it('sanitizes cancellation infrastructure failures', async () => {
      const infrastructureError = Object.assign(
        new Error('database private-host failed; password=secret'),
        {detail: 'private-driver-detail'},
      );
      const {service} = createService({
        repository: new RejectingBookingRepository(infrastructureError),
      });

      const error = await expectDomainError(service.cancel({
        bookingId: 'booking-1',
        userId: 'user-1',
        cancelledAt,
      }));

      expect(error).not.toBe(infrastructureError);
      expect(error).toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service unavailable',
        status: 503,
        fields: undefined,
      });
      expect(error).not.toHaveProperty('cause');
      expect(JSON.stringify(error)).not.toMatch(
        /private-host|password=secret|private-driver-detail/,
      );
    });
  });

  it('trims the title before the atomic insert and returns a booking view', async () => {
    const {repository, service} = createService();

    const booking = await service.create({
      ...baseInput,
      title: '  Roadmap review 😀  ',
    });

    expect(booking).toEqual({
      id: 'booking-1',
      roomId: 'room-1',
      title: 'Roadmap review 😀',
      startsAt: '2026-07-28T06:00:00.000Z',
      endsAt: '2026-07-28T07:00:00.000Z',
      author: {id: 'user-1', name: 'Ada'},
      isOwn: true,
    });
    expect(repository.createdInputs[0]?.title).toBe('Roadmap review 😀');
    expect(repository.events).toEqual([
      'transaction',
      'lock-room',
      'find-overlap',
      'create',
    ]);
  });

  it('accepts a title containing exactly 100 Unicode code points', async () => {
    const {service} = createService();
    const title = '😀'.repeat(100);

    await expect(service.create({...baseInput, title})).resolves.toMatchObject({
      title,
    });
  });

  it.each([
    ['blank', '   '],
    ['101 Unicode code points', '😀'.repeat(101)],
  ])('rejects a %s title before opening a transaction', async (_name, title) => {
    const {repository, service} = createService();

    await expect(service.create({...baseInput, title})).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 400,
      fields: {title: 'Title must contain 1 to 100 Unicode characters'},
    });
    expect(repository.transactionCalls).toBe(0);
  });

  it('rejects a blank room identifier before opening a transaction', async () => {
    const {repository, service} = createService();

    await expect(service.create({...baseInput, roomId: ' '})).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 400,
      fields: {roomId: 'Room is required'},
    });
    expect(repository.transactionCalls).toBe(0);
  });

  it.each([
    [
      'invalid start date',
      {startsAt: new Date(Number.NaN)},
      appEnv,
      new TestClock(now),
      'VALIDATION_FAILED',
      'startsAt',
    ],
    [
      'invalid end date',
      {endsAt: new Date(Number.NaN)},
      appEnv,
      new TestClock(now),
      'VALIDATION_FAILED',
      'endsAt',
    ],
    [
      'invalid clock date',
      {},
      appEnv,
      new TestClock(new Date(Number.NaN)),
      'VALIDATION_FAILED',
      'now',
    ],
    [
      'invalid office time zone',
      {},
      {...appEnv, officeTimeZone: 'Not/A-Time-Zone'},
      new TestClock(now),
      'VALIDATION_FAILED',
      'officeTimeZone',
    ],
    [
      'unaligned start',
      {startsAt: new Date('2026-07-28T06:15:00.000Z')},
      appEnv,
      new TestClock(now),
      'VALIDATION_FAILED',
      'startsAt',
    ],
    [
      'unaligned end',
      {endsAt: new Date('2026-07-28T06:45:00.000Z')},
      appEnv,
      new TestClock(now),
      'VALIDATION_FAILED',
      'endsAt',
    ],
    [
      'duration below 30 minutes',
      {endsAt: new Date('2026-07-28T06:00:00.000Z')},
      appEnv,
      new TestClock(now),
      'VALIDATION_FAILED',
      'endsAt',
    ],
    [
      'duration above four hours',
      {endsAt: new Date('2026-07-28T10:30:00.000Z')},
      appEnv,
      new TestClock(now),
      'VALIDATION_FAILED',
      'endsAt',
    ],
    [
      'start that is not in the future',
      {
        startsAt: new Date('2026-07-27T06:00:00.000Z'),
        endsAt: new Date('2026-07-27T06:30:00.000Z'),
      },
      appEnv,
      new TestClock(now),
      'BOOKING_IN_PAST',
      'startsAt',
    ],
    [
      'start before office hours',
      {
        startsAt: new Date('2026-07-28T05:30:00.000Z'),
        endsAt: new Date('2026-07-28T06:00:00.000Z'),
      },
      appEnv,
      new TestClock(now),
      'BOOKING_OUTSIDE_OFFICE_HOURS',
      'startsAt',
    ],
    [
      'end after office hours',
      {
        startsAt: new Date('2026-07-28T15:30:00.000Z'),
        endsAt: new Date('2026-07-28T16:30:00.000Z'),
      },
      appEnv,
      new TestClock(now),
      'BOOKING_OUTSIDE_OFFICE_HOURS',
      'endsAt',
    ],
  ] as const)(
    'rejects %s before opening a transaction',
    async (_name, input, env, clock, code, field) => {
      const {repository, service} = createService({env, clock});

      const error = await expectDomainError(
        service.create({...baseInput, ...input}),
      );

      expect(error).toMatchObject({
        code,
        fields: {[field]: expect.any(String)},
      });
      expect(repository.transactionCalls).toBe(0);
    },
  );

  it('returns a stable not-found error while holding the room transaction', async () => {
    const {repository, service} = createService();
    repository.rooms.clear();

    await expect(service.create(baseInput)).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
      message: 'Room not found.',
      status: 404,
    });
    expect(repository.events).toEqual(['transaction', 'lock-room']);
  });

  it('returns a stable conflict error for an active overlap', async () => {
    const {repository, service} = createService();
    repository.existingBookings.push({
      roomId: 'room-1',
      startsAt: new Date('2026-07-28T06:30:00.000Z'),
      endsAt: new Date('2026-07-28T07:30:00.000Z'),
      cancelledAt: null,
    });

    await expect(service.create(baseInput)).rejects.toMatchObject({
      code: 'BOOKING_CONFLICT',
      message: 'This time is already booked. Choose another slot.',
      status: 409,
    });
    expect(repository.events).toEqual([
      'transaction',
      'lock-room',
      'find-overlap',
    ]);
  });

  it('preserves DomainError instances from the repository exactly', async () => {
    const expected = new DomainError({
      code: 'BOOKING_CONFLICT',
      message: 'Stable conflict',
      status: 409,
    });
    const {service} = createService({
      repository: new RejectingBookingRepository(expected),
    });

    const actual = await expectDomainError(service.create(baseInput));

    expect(actual).toBe(expected);
  });

  it('replaces infrastructure failures with a value-free stable error', async () => {
    const infrastructureError = Object.assign(
      new Error('connection refused at postgres.internal; password=secret'),
      {
        code: '57P01',
        detail: 'database host and credential metadata',
        requestId: 'private-request-id',
      },
    );
    infrastructureError.stack =
      'Error: connection refused at postgres.internal; password=secret\n' +
      '    at private-driver-file.ts:42:1';
    const {service} = createService({
      repository: new RejectingBookingRepository(infrastructureError),
    });

    const error = await expectDomainError(service.create(baseInput));
    const serialized = JSON.stringify(error);

    expect(error).not.toBe(infrastructureError);
    expect(error).toMatchObject({
      name: 'DomainError',
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service unavailable',
      status: 503,
      fields: undefined,
    });
    expect(error).not.toHaveProperty('cause');
    expect(error).not.toHaveProperty('detail');
    expect(error).not.toHaveProperty('requestId');
    expect(error.stack).not.toMatch(
      /postgres\.internal|password=secret|private-driver-file|57P01/,
    );
    expect(serialized).not.toMatch(
      /postgres\.internal|password=secret|private-request-id|57P01/,
    );
  });

  it('ignores cancelled overlaps', async () => {
    const {repository, service} = createService();
    repository.existingBookings.push({
      roomId: 'room-1',
      startsAt: new Date('2026-07-28T06:30:00.000Z'),
      endsAt: new Date('2026-07-28T07:30:00.000Z'),
      cancelledAt: new Date('2026-07-27T07:00:00.000Z'),
    });

    await expect(service.create(baseInput)).resolves.toMatchObject({
      id: 'booking-1',
    });
  });

  it.each([
    [
      'before',
      new Date('2026-07-28T07:00:00.000Z'),
      new Date('2026-07-28T08:00:00.000Z'),
    ],
    [
      'after',
      new Date('2026-07-28T05:00:00.000Z'),
      new Date('2026-07-28T06:00:00.000Z'),
    ],
  ])('allows a booking adjacent %s an active booking', async (
    _name,
    startsAt,
    endsAt,
  ) => {
    const {repository, service} = createService();
    repository.existingBookings.push({
      roomId: 'room-1',
      startsAt,
      endsAt,
      cancelledAt: null,
    });

    await expect(service.create(baseInput)).resolves.toMatchObject({
      id: 'booking-1',
    });
  });
});
