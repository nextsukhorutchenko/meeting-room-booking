import {afterAll, describe, expect, it} from 'vitest';
import {seedRooms} from '../../prisma/room-seed';
import {readTestSeedDatabaseUrl} from '../../prisma/test-seed-url';
import {disconnectTestDatabase, testDb} from '../helpers/database';

afterAll(async () => {
  await disconnectTestDatabase();
});

describe('test room seed', () => {
  it('rejects a non-test database before creating a seed client', () => {
    expect(() =>
      readTestSeedDatabaseUrl({
        TEST_DATABASE_URL: 'postgresql://localhost/meeting_room_booking',
      }),
    ).toThrow('Refusing to reset non-test database: meeting_room_booking');
  });

  it('keeps the room seed idempotent', async () => {
    await seedRooms(testDb);
    await seedRooms(testDb);

    const rooms = await testDb.room.findMany({
      orderBy: {sortOrder: 'asc'},
    });

    expect(rooms).toHaveLength(6);
    expect(rooms.map((room) => room.capacity)).toEqual([4, 6, 8, 10, 12, 16]);
  });
});
