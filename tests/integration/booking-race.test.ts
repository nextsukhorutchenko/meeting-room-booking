import {afterAll, afterEach, beforeEach, expect, it} from 'vitest';
import {readAppEnv} from '../../src/lib/config/env';
import {DomainError} from '../../src/lib/http/domain-error';
import {TestClock} from '../helpers/test-clock';
import {
  DefaultBookingService,
  PrismaBookingRepository,
} from '../../src/modules/bookings/booking.service';
import {
  createRoomFixture,
  createVerifiedUser,
} from '../helpers/factories';
import {disconnectTestDatabase, testDb} from '../helpers/database';

const raceRoomName = 'Atomic booking race room';
const raceUserEmail = 'atomic-booking-race@example.test';

async function removeRaceFixtures(): Promise<void> {
  await testDb.booking.deleteMany({
    where: {
      OR: [
        {room: {name: raceRoomName}},
        {user: {normalizedEmail: raceUserEmail}},
      ],
    },
  });
  await testDb.room.deleteMany({where: {name: raceRoomName}});
  await testDb.user.deleteMany({
    where: {normalizedEmail: raceUserEmail},
  });
}

beforeEach(removeRaceFixtures);
afterEach(removeRaceFixtures);

afterAll(async () => {
  await disconnectTestDatabase();
});

it('allows exactly one of two concurrent identical reservations', async () => {
  const room = await createRoomFixture({name: raceRoomName});
  const user = await createVerifiedUser({email: raceUserEmail});
  const bookingService = new DefaultBookingService({
    repository: new PrismaBookingRepository(testDb),
    clock: new TestClock(new Date('2026-07-27T06:00:00.000Z')),
    env: readAppEnv(),
  });
  const input = {
    userId: user.id,
    roomId: room.id,
    title: 'Race reservation',
    startsAt: new Date('2026-07-28T10:00:00.000Z'),
    endsAt: new Date('2026-07-28T11:00:00.000Z'),
  };

  const attempts = await Promise.allSettled([
    bookingService.create(input),
    bookingService.create(input),
  ]);

  const fulfilled = attempts.filter((result) => result.status === 'fulfilled');
  const rejected = attempts.filter((result) => result.status === 'rejected');
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect(rejected[0]).toMatchObject({
    reason: expect.objectContaining({
      code: 'BOOKING_CONFLICT',
      status: 409,
    }),
  });
  expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
    DomainError,
  );
  expect(
    await testDb.booking.count({
      where: {roomId: input.roomId, cancelledAt: null},
    }),
  ).toBe(1);
});
