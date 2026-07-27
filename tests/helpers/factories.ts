import type {Room} from '@prisma/client';
import {testDb} from './database';

let roomSequence = 0;

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
