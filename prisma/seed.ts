import 'dotenv/config';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL must be set to seed the test database');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({connectionString: databaseUrl}),
});

const rooms = [
  {name: 'Maple', floor: 1, capacity: 4, sortOrder: 1},
  {name: 'Oak', floor: 1, capacity: 6, sortOrder: 2},
  {name: 'Pine', floor: 2, capacity: 8, sortOrder: 3},
  {name: 'Spruce', floor: 2, capacity: 10, sortOrder: 4},
  {name: 'Willow', floor: 3, capacity: 12, sortOrder: 5},
  {name: 'Yew', floor: 3, capacity: 16, sortOrder: 6},
];

async function main(): Promise<void> {
  await Promise.all(
    rooms.map((room) =>
      prisma.room.upsert({
        where: {name: room.name},
        update: room,
        create: room,
      }),
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
