import {createHash, randomBytes} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {expect, test} from '@playwright/test';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {officeMonday} from './office-time';

const testEmailPrefix = 'task-5-e2e-';
const artifactsDirectory = resolve(
  '.superpowers/sdd/2026-07-27-meeting-room-booking-implementation/' +
  'task-13-artifacts',
);
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL must be set for Playwright tests');
}

const testDb = new PrismaClient({
  adapter: new PrismaPg({connectionString: testDatabaseUrl}),
});

test.beforeAll(async () => {
  await mkdir(artifactsDirectory, {recursive: true});
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

async function createUnverifiedUser(email: string) {
  return testDb.user.create({
    data: {
      name: 'Verification Browser User',
      email,
      normalizedEmail: email,
      passwordHash: 'unused-browser-test-hash',
      emailVerifiedAt: null,
    },
  });
}

async function createVerificationUrl(
  userId: string,
  expiresAt: Date,
): Promise<string> {
  const rawToken = randomBytes(32).toString('base64url');
  await testDb.verificationToken.create({
    data: {
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      userId,
      expiresAt,
    },
  });
  return `/verify?token=${encodeURIComponent(rawToken)}`;
}

test('@auth redirects signed-out users from the root to login', async ({page}) => {
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

test('@auth registers, persists the session, and logs out', async ({
  page,
}, testInfo) => {
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

  const room = await testDb.room.findUniqueOrThrow({where: {name: 'Maple'}});
  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${officeMonday(1)}`,
  );
  await page.getByRole('button', {name: /^Book /}).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('Unverified booking attempt');
  await dialog.getByRole('button', {name: 'Create booking'}).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Verify your email before booking a room.',
  );
  await page.screenshot({
    path: resolve(
      artifactsDirectory,
      `booking-verification-required-${testInfo.project.name}.png`,
    ),
  });

  await dialog.getByRole('button', {name: 'Cancel'}).click();
  await page.getByRole('button', {name: 'Log out'}).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('@auth shows pending and success verification states', async ({
  page,
}, testInfo) => {
  const email =
    `${testEmailPrefix}${testInfo.project.name}-verify-success@example.test`;
  const user = await createUnverifiedUser(email);
  const verificationUrl = await createVerificationUrl(
    user.id,
    new Date(Date.now() + 24 * 60 * 60 * 1_000),
  );
  let releaseRequest!: () => void;
  let markRequestStarted!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    markRequestStarted = resolve;
  });
  const requestRelease = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route('**/api/auth/verify', async (route) => {
    markRequestStarted();
    await requestRelease;
    await route.continue();
  });

  await page.goto(verificationUrl);
  await requestStarted;
  await expect(
    page.getByRole('heading', {name: 'Verifying your email'}),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(
      artifactsDirectory,
      `verification-pending-${testInfo.project.name}.png`,
    ),
  });

  releaseRequest();
  await expect(
    page.getByRole('heading', {name: 'Email verified'}),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(
      artifactsDirectory,
      `verification-success-${testInfo.project.name}.png`,
    ),
  });
  await expect(testDb.user.findUniqueOrThrow({
    where: {id: user.id},
    select: {emailVerifiedAt: true},
  })).resolves.toEqual({emailVerifiedAt: expect.any(Date)});
});

test('@auth shows the expired verification state', async ({page}, testInfo) => {
  const email =
    `${testEmailPrefix}${testInfo.project.name}-verify-expired@example.test`;
  const user = await createUnverifiedUser(email);
  const verificationUrl = await createVerificationUrl(
    user.id,
    new Date('2000-01-01T00:00:00.000Z'),
  );

  await page.goto(verificationUrl);

  await expect(
    page.getByRole('heading', {name: 'Verification link expired'}),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(
      artifactsDirectory,
      `verification-expired-${testInfo.project.name}.png`,
    ),
  });
});

test('@auth shows a sanitized verification error state', async ({
  page,
}, testInfo) => {
  const email =
    `${testEmailPrefix}${testInfo.project.name}-verify-error@example.test`;
  const user = await createUnverifiedUser(email);
  const verificationUrl = await createVerificationUrl(
    user.id,
    new Date(Date.now() + 24 * 60 * 60 * 1_000),
  );
  await page.route('**/api/auth/verify', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong',
        },
      }),
    });
  });

  await page.goto(verificationUrl);

  await expect(
    page.getByRole('heading', {name: 'Verification unavailable'}),
  ).toBeVisible();
  await expect(page.getByText(
    'We could not verify your email. Try the development link again.',
  )).toBeVisible();
  await page.screenshot({
    path: resolve(
      artifactsDirectory,
      `verification-error-${testInfo.project.name}.png`,
    ),
  });
});
