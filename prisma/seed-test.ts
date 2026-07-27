import 'dotenv/config';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {readAppEnv} from '../src/lib/config/env';
import {seedDemoData} from './demo-seed';
import {readTestSeedDatabaseUrl} from './test-seed-url';

const databaseUrl = readTestSeedDatabaseUrl();
const prisma = new PrismaClient({
  adapter: new PrismaPg({connectionString: databaseUrl}),
});
const appEnv = readAppEnv({...process.env, DATABASE_URL: databaseUrl});

seedDemoData(prisma, {
  now: new Date(),
  officeTimeZone: appEnv.officeTimeZone,
  officeOpenHour: appEnv.officeOpenHour,
})
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
