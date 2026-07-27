import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient, type Room} from '@prisma/client';
import {
  expect,
  test as base,
  type Page,
} from '@playwright/test';

export {officeMonday, officeSlot, officeTodayLabel} from './office-time';

export const DEMO_USER = {
  email: 'organizer@example.test',
  name: 'Demo Organizer',
  password: 'demo-booking-password',
} as const;

export const TASK_9_BOOKING_PREFIX = 'task-9-e2e-';
export const TASK_10_BOOKING_PREFIX = 'task-10-e2e-';

function readTestDatabaseUrl(): string {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL must be set for Playwright tests');
  }
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing to use non-test database: ${databaseName}`);
  }
  return databaseUrl;
}

export function createE2eDatabase(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({connectionString: readTestDatabaseUrl()}),
  });
}

export async function loginAsDemoUser(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(DEMO_USER.email);
  await page.getByLabel('Password').fill(DEMO_USER.password);
  await page.getByRole('button', {name: 'Sign in'}).click();
  await expect(page).toHaveURL(/\/schedule(?:\?.*)?$/);
}

export async function roomByName(
  database: PrismaClient,
  name: string,
): Promise<Room> {
  return database.room.findUniqueOrThrow({where: {name}});
}

export async function clearTaskBookings(
  database: PrismaClient,
): Promise<void> {
  await database.booking.deleteMany({
    where: {
      OR: [
        {title: {startsWith: TASK_9_BOOKING_PREFIX}},
        {title: {startsWith: TASK_10_BOOKING_PREFIX}},
        {id: {startsWith: TASK_10_BOOKING_PREFIX}},
      ],
    },
  });
}

type Fixtures = {
  database: PrismaClient;
};

export const test = base.extend<Fixtures>({
  database: async ({}, run) => {
    const database = createE2eDatabase();
    await clearTaskBookings(database);
    await run(database);
    await clearTaskBookings(database);
    await database.$disconnect();
  },
});

export {expect};
