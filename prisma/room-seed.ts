import type {PrismaClient} from '@prisma/client';

type RoomSeedDatabase = Pick<PrismaClient, 'room'>;

const rooms = [
  {name: 'Maple', floor: 1, capacity: 4, sortOrder: 1},
  {name: 'Oak', floor: 1, capacity: 6, sortOrder: 2},
  {name: 'Pine', floor: 2, capacity: 8, sortOrder: 3},
  {name: 'Spruce', floor: 2, capacity: 10, sortOrder: 4},
  {name: 'Willow', floor: 3, capacity: 12, sortOrder: 5},
  {name: 'Yew', floor: 3, capacity: 16, sortOrder: 6},
];

export async function seedRooms(database: RoomSeedDatabase): Promise<void> {
  await Promise.all(
    rooms.map((room) =>
      database.room.upsert({
        where: {name: room.name},
        update: room,
        create: room,
      }),
    ),
  );
}
