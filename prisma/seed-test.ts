import 'dotenv/config';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {seedRooms} from './room-seed';
import {readTestSeedDatabaseUrl} from './test-seed-url';

const databaseUrl = readTestSeedDatabaseUrl();
const prisma = new PrismaClient({
  adapter: new PrismaPg({connectionString: databaseUrl}),
});

seedRooms(prisma)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
