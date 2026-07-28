import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {expect, officeMonday, officeSlot, roomByName, test} from './fixtures';

const artifactsDirectory = resolve(
  '.superpowers/sdd/2026-07-27-meeting-room-booking-implementation/' +
  'task-9-artifacts',
);

test.beforeAll(async () => {
  await mkdir(artifactsDirectory, {recursive: true});
});

test('@booking @critical free slot -> prefilled dialog -> create', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);
  await page.goto(`/schedule?roomId=${room.id}&weekStart=${weekStart}`);

  await page.getByRole('button', {
    name: /Book Tuesday.*10:00/i,
  }).click();
  const dialog = page.getByRole('dialog', {name: 'Book Oak'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Tuesday', {exact: false})).toBeVisible();
  await expect(dialog.getByText('10:00-10:30', {exact: false})).toBeVisible();
  await dialog.getByLabel('End time').selectOption({
    label: '12:00 (2 hours)',
  });
  await expect(dialog.getByText('10:00-12:00', {exact: false})).toBeVisible();
  await expect(dialog.getByLabel('Title')).toBeFocused();
  const openDialogLayout = await page.evaluate(() => {
    const dialog = document.querySelector('.dialog-panel');
    const emptyState = document.querySelector('.empty-schedule-note');
    const dayHeaders = document.querySelector('.schedule-day-headers');
    const dialogRect = dialog?.getBoundingClientRect();
    const emptyRect = emptyState?.getBoundingClientRect();
    const headersRect = dayHeaders?.getBoundingClientRect();
    return {
      dialogContained: Boolean(
        dialogRect &&
        dialogRect.left >= 0 &&
        dialogRect.top >= 0 &&
        dialogRect.right <= window.innerWidth &&
        dialogRect.bottom <= window.innerHeight,
      ),
      emptyStateSeparated: Boolean(
        emptyRect &&
        headersRect &&
        emptyRect.bottom <= headersRect.top + 0.5,
      ),
      horizontalOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });
  expect(openDialogLayout).toEqual({
    dialogContained: true,
    emptyStateSeparated: true,
    horizontalOverflow: 0,
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(artifactsDirectory, 'booking-dialog.png'),
  });

  const title = 'task-9-e2e-created-booking';
  await dialog.getByLabel('Title').fill(title);
  const createRequest = page.waitForRequest((request) =>
    request.url().endsWith('/api/bookings') &&
    request.method() === 'POST',
  );
  const createResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/bookings') &&
    response.request().method() === 'POST' &&
    response.status() === 201,
  );
  await dialog.getByRole('button', {name: 'Create booking'}).click();
  const createPayload = (await createRequest).postDataJSON() as {
    endsAt: string;
    startsAt: string;
  };
  expect(createPayload.startsAt).toBe(
    officeSlot(weekStart, 1, 10).toUTC().toISO(),
  );
  expect(createPayload.endsAt).toBe(
    officeSlot(weekStart, 1, 12).toUTC().toISO(),
  );
  await createResponse;

  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('status').filter({hasText: 'Booking created'}),
  ).toBeVisible();
  const bookingBlock = page.getByRole('article', {name: new RegExp(title)});
  await expect(bookingBlock).toBeVisible();
  await expect(bookingBlock).toContainText('10:00-12:00');
  await expect(bookingBlock).toHaveCSS('height', '172px');
  await expect(database.booking.count({where: {title}})).resolves.toBe(1);
  const persistedBooking = await database.booking.findFirstOrThrow({
    where: {title},
  });
  expect(persistedBooking.endsAt.toISOString()).toBe(
    officeSlot(weekStart, 1, 12).toUTC().toISO(),
  );
  const createdBlockContained = await bookingBlock.evaluate((booking) => {
    const bookingRect = booking.getBoundingClientRect();
    const titleRect = booking.querySelector('strong')?.getBoundingClientRect();
    const metaRect = booking
      .querySelector('.booking-block-meta')
      ?.getBoundingClientRect();
    return Boolean(
      titleRect &&
      metaRect &&
      titleRect.top >= bookingRect.top &&
      metaRect.bottom <= bookingRect.bottom + 0.5 &&
      titleRect.bottom <= metaRect.top + 0.5,
    );
  });
  expect(createdBlockContained).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(artifactsDirectory, 'booking-created.png'),
  });
});

test('@booking occupied slot -> visible conflict, dialog remains open', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: 'organizer@example.test'},
  });
  const weekStart = officeMonday(1);
  await page.goto(`/schedule?roomId=${room.id}&weekStart=${weekStart}`);
  await page.getByRole('button', {
    name: /Book Wednesday.*11:00/i,
  }).click();

  const startsAt = officeSlot(weekStart, 2, 11);
  await database.booking.create({
    data: {
      roomId: room.id,
      userId: organizer.id,
      title: 'task-9-e2e-conflict-fixture',
      startsAt: startsAt.toUTC().toJSDate(),
      endsAt: startsAt.plus({minutes: 30}).toUTC().toJSDate(),
    },
  });

  const dialog = page.getByRole('dialog', {name: 'Book Oak'});
  await dialog.getByLabel('Title').fill('task-9-e2e-conflicting-attempt');
  await dialog.getByRole('button', {name: 'Create booking'}).click();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveText(
    'This time is already booked. Choose another slot.',
  );
});

test('@booking pending disabled, duplicate clicks create exactly one', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);
  await page.goto(`/schedule?roomId=${room.id}&weekStart=${weekStart}`);
  await page.getByRole('button', {
    name: /Book Thursday.*14:00/i,
  }).click();

  const title = 'task-9-e2e-single-submit';
  const submit = page.getByRole('button', {name: 'Create booking'});
  await page.getByLabel('Title').fill(title);
  let createRequests = 0;
  await page.route('**/api/bookings', async (route) => {
    createRequests += 1;
    await route.continue();
  });

  await submit.dblclick();
  await expect(submit).toBeDisabled();
  await expect(page.getByRole('dialog', {name: 'Book Oak'})).toBeHidden();
  expect(createRequests).toBe(1);
  await expect(database.booking.count({where: {title}})).resolves.toBe(1);
});
