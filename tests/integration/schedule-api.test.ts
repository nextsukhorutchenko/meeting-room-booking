import {afterAll, describe, expect, it} from 'vitest';
import {seedDemoData} from '../../prisma/demo-seed';
import {assertTestDatabaseUrl} from '../../scripts/reset-test-db';
import {readAppEnv} from '../../src/lib/config/env';
import {disconnectTestDatabase, testDb} from '../helpers/database';

afterAll(async () => {
  await disconnectTestDatabase();
});

describe('test database guard', () => {
  it('rejects a database that is not suffixed with _test', () => {
    expect(() =>
      assertTestDatabaseUrl('postgresql://localhost/meeting_room_booking'),
    ).toThrow('Refusing to reset non-test database: meeting_room_booking');
  });
});

describe('room seed', () => {
  it('creates six usable rooms in display order', async () => {
    const rooms = await testDb.room.findMany({
      orderBy: {sortOrder: 'asc'},
    });

    expect(rooms).toHaveLength(6);
    expect(rooms.map((room) => room.capacity)).toEqual([4, 6, 8, 10, 12, 16]);
    expect(new Set(rooms.map((room) => room.name)).size).toBe(6);
  });

  it('creates idempotent verified users and useful demo bookings', async () => {
    const now = new Date('2026-07-27T06:00:00.000Z');
    const appEnv = readAppEnv();

    await seedDemoData(testDb, {
      now,
      officeTimeZone: appEnv.officeTimeZone,
      officeOpenHour: appEnv.officeOpenHour,
    });
    await seedDemoData(testDb, {
      now,
      officeTimeZone: appEnv.officeTimeZone,
      officeOpenHour: appEnv.officeOpenHour,
    });

    const users = await testDb.user.findMany({
      orderBy: {normalizedEmail: 'asc'},
    });
    const bookings = await testDb.booking.findMany({
      orderBy: {startsAt: 'asc'},
    });

    expect(users).toHaveLength(2);
    expect(users.every((user) => user.emailVerifiedAt)).toBe(true);
    expect(bookings.some((booking) => booking.endsAt < now)).toBe(true);
    expect(bookings.some((booking) => booking.startsAt > now)).toBe(true);
  });
});
