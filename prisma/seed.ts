import 'dotenv/config';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {readAppEnv} from '../src/lib/config/env';
import {seedDemoData} from './demo-seed';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set to seed the development database');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({connectionString: databaseUrl}),
});
const appEnv = readAppEnv();

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
