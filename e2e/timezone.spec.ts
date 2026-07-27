import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  DEMO_USER,
  expect,
  officeMonday,
  officeSlot,
  roomByName,
  TASK_12_BOOKING_PREFIX,
  test,
} from './fixtures';

const artifactsDirectory = resolve(
  '.superpowers/sdd/2026-07-27-meeting-room-booking-implementation/' +
  'task-12-artifacts',
);

test.beforeAll(async () => {
  await mkdir(artifactsDirectory, {recursive: true});
});

test('@timezone @critical booking clock values use the browser timezone', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: DEMO_USER.email},
  });
  const weekStart = officeMonday(1);
  const day = officeSlot(weekStart, 1, 10);
  const title = `${TASK_12_BOOKING_PREFIX}timezone-display`;
  await database.booking.create({
    data: {
      endsAt: day.plus({minutes: 30}).toUTC().toJSDate(),
      roomId: room.id,
      startsAt: day.toUTC().toJSDate(),
      title,
      userId: organizer.id,
    },
  });

  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}` +
    `&day=${day.toISODate()}`,
  );
  await expect(page.getByLabel('Day', {exact: true})).toBeHidden();
  const browserTimeZone = await page.evaluate(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  if (testInfo.project.name === 'desktop-new-york') {
    expect(browserTimeZone).toBe('America/New_York');
  } else {
    expect(['Europe/Kyiv', 'Europe/Kiev']).toContain(browserTimeZone);
  }

  const expectedStart = day.setZone(browserTimeZone).toFormat('HH:mm');
  const expectedEnd = day
    .plus({minutes: 30})
    .setZone(browserTimeZone)
    .toFormat('HH:mm');
  const booking = page.getByRole('article', {name: new RegExp(title)});
  await expect(booking).toContainText(`${expectedStart}-${expectedEnd}`);

  const nextSlot = day.plus({hours: 1});
  const nextSlotLabel = nextSlot.setZone(browserTimeZone).toFormat('HH:mm');
  await page.getByRole('button', {
    name: new RegExp(`Book Tuesday.*${nextSlotLabel}`, 'i'),
  }).click();
  const dialog = page.getByRole('dialog', {name: 'Book Oak'});
  await expect(dialog).toContainText(
    `${nextSlotLabel}-` +
    nextSlot.plus({minutes: 30}).setZone(browserTimeZone).toFormat('HH:mm'),
  );
  await dialog.getByRole('button', {name: 'Close dialog'}).click();
  await page.screenshot({
    fullPage: true,
    path: resolve(
      artifactsDirectory,
      `${testInfo.project.name}-schedule.png`,
    ),
  });

  await page.getByRole('link', {name: 'My Bookings'}).click();
  const row = page.locator(`[data-booking-id]`, {hasText: title});
  await expect(row).toContainText(`${expectedStart}-${expectedEnd}`);

  await page.screenshot({
    fullPage: true,
    path: resolve(
      artifactsDirectory,
      `${testInfo.project.name}-my-bookings.png`,
    ),
  });
});

test('@timezone office-hours label follows browser/office zone difference', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);
  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}` +
    `&day=${weekStart}`,
  );

  const officeHours = page.getByText(
    'Office hours: 09:00–19:00 Europe/Kyiv',
    {exact: true},
  );
  if (testInfo.project.name === 'desktop-new-york') {
    await expect(officeHours).toBeVisible();
  } else {
    await expect(officeHours).toHaveCount(0);
  }
});

test('@timezone server rejects an instant outside Kyiv office hours', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const startsAt = officeSlot(officeMonday(1), 2, 8);
  await page.goto('/schedule');

  const response = await page.request.post('/api/bookings', {
    data: {
      endsAt: startsAt.plus({minutes: 30}).toUTC().toISO(),
      roomId: room.id,
      startsAt: startsAt.toUTC().toISO(),
      title: `${TASK_12_BOOKING_PREFIX}outside-office-hours`,
    },
    headers: {origin: 'http://127.0.0.1:3105'},
  });

  expect(response.status()).toBe(422);
  await expect(response.json()).resolves.toMatchObject({
    error: {
      code: 'BOOKING_OUTSIDE_OFFICE_HOURS',
      message: 'Booking must be within office hours',
    },
  });
});
