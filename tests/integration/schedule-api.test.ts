import {afterAll, describe, expect, it} from 'vitest';
import {assertTestDatabaseUrl} from '../../scripts/reset-test-db';
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
});
