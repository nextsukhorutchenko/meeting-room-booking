import type {Booking, Room, User} from '@prisma/client';
import {normalizeEmail} from '../../src/modules/auth/email';
import {hashPassword} from '../../src/modules/auth/password';
import type {CreateBookingInput} from '../../src/modules/bookings/booking.types';
import {testDb} from './database';

let bookingSequence = 0;
let roomSequence = 0;
let userSequence = 0;

export async function createBookingFixture(
  input: Pick<CreateBookingInput, 'roomId' | 'userId'> &
    Partial<Omit<CreateBookingInput, 'roomId' | 'userId'>> & {
      cancelledAt?: Date | null;
    },
): Promise<Booking> {
  bookingSequence += 1;

  return testDb.booking.create({
    data: {
      roomId: input.roomId,
      userId: input.userId,
      title: input.title ?? `Test booking ${bookingSequence}`,
      startsAt: input.startsAt ?? new Date('2026-07-28T06:00:00.000Z'),
      endsAt: input.endsAt ?? new Date('2026-07-28T07:00:00.000Z'),
      cancelledAt: input.cancelledAt,
    },
  });
}

export async function createRoomFixture(
  overrides: Partial<{name: string; floor: number; capacity: number}> = {},
): Promise<Room> {
  roomSequence += 1;

  return testDb.room.create({
    data: {
      name: `Test room ${roomSequence}`,
      floor: 1,
      capacity: 4,
      sortOrder: 1_000 + roomSequence,
      ...overrides,
    },
  });
}

export async function createVerifiedUser(
  overrides: Partial<{name: string; email: string; password: string}> = {},
): Promise<User> {
  userSequence += 1;
  const email = overrides.email ?? `verified-user-${userSequence}@example.test`;

  return testDb.user.create({
    data: {
      name: overrides.name ?? `Verified user ${userSequence}`,
      email,
      normalizedEmail: normalizeEmail(email),
      passwordHash: await hashPassword(
        overrides.password ?? 'test-password',
      ),
      emailVerifiedAt: new Date('2026-07-27T06:00:00.000Z'),
    },
  });
}
