import {expect, test} from '@playwright/test';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';

const testEmailPrefix = 'task-5-e2e-';
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL must be set for Playwright tests');
}

const testDb = new PrismaClient({
  adapter: new PrismaPg({connectionString: testDatabaseUrl}),
});

test.afterEach(async ({}, testInfo) => {
  await testDb.user.deleteMany({
    where: {
      normalizedEmail: {
        startsWith: `${testEmailPrefix}${testInfo.project.name}-`,
      },
    },
  });
});

test.afterAll(async () => {
  await testDb.$disconnect();
});

test('redirects signed-out users from the root to login', async ({page}) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Meeting Room Booking');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', {name: 'Sign in'})).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(
    page.getByRole('link', {name: 'Create an account'}),
  ).toBeVisible();
});

test('registers, persists the session, and logs out', async ({page}, testInfo) => {
  const email = `${testEmailPrefix}${testInfo.project.name}-${Date.now()}@example.test`;

  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', {name: 'Create an account'}).click();
  await expect(
    page.getByRole('heading', {name: 'Create your account'}),
  ).toBeVisible();

  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page.getByText('Name is required')).toBeVisible();

  await page.getByLabel('Name').fill('Browser Ada');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct password');
  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole('heading', {name: 'Schedule'})).toBeVisible();

  await page.reload();
  await expect(page.getByText('Browser Ada', {exact: true})).toBeVisible();

  await page.getByRole('button', {name: 'Log out'}).click();
  await expect(page).toHaveURL(/\/login$/);
});
