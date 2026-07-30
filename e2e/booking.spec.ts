import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {Locator, Page} from '@playwright/test';
import {expect, officeMonday, officeSlot, roomByName, test} from './fixtures';

const artifactsDirectory = resolve(
  '.superpowers/sdd/2026-07-27-meeting-room-booking-implementation/' +
  'task-9-artifacts',
);
const nonModalBookingProjects = new Set(['expanded', 'medium']);

function bookingSurface(
  page: Page,
  projectName: string,
  name: string | RegExp,
): Locator {
  return nonModalBookingProjects.has(projectName) ?
    page.getByRole('region', {name}) :
    page.getByRole('dialog', {name});
}

test.beforeAll(async () => {
  await mkdir(artifactsDirectory, {recursive: true});
});

test('@booking @critical free slot -> prefilled dialog -> create', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);
  const selectedDay = officeSlot(weekStart, 1, 9).toISODate();
  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}&day=${selectedDay}`,
  );

  const slotTrigger = page.getByRole('button', {
    name: /Забронювати вівторок.*10:00/i,
  });
  await slotTrigger.click();
  const composer = bookingSurface(
    page,
    testInfo.project.name,
    'Бронювання: Oak',
  );
  await expect(composer).toBeVisible();
  await expect(composer.getByLabel('Назва')).toBeFocused();
  if (nonModalBookingProjects.has(testInfo.project.name)) {
    await expect(composer).not.toHaveAttribute('aria-modal');
  } else {
    await expect(composer).toHaveAttribute('aria-modal', 'true');
  }
  await expect(composer.getByText('вівторок', {exact: false})).toBeVisible();
  await expect(composer.getByText('10:00-10:30', {exact: false})).toBeVisible();
  await composer.getByLabel('Час завершення').selectOption({
    label: '12:00 (2 год)',
  });
  await expect(composer.getByText('10:00-12:00', {exact: false})).toBeVisible();
  const openDialogLayout = await page.evaluate(() => {
    const dialog = document.querySelector('.booking-surface-panel');
    const emptyState = document.querySelector('.empty-schedule-note');
    const dayHeaders = document.querySelector('.timetable thead');
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
  expect(openDialogLayout.dialogContained).toBe(true);
  expect(openDialogLayout.horizontalOverflow).toBe(0);
  if (nonModalBookingProjects.has(testInfo.project.name)) {
    expect(openDialogLayout.emptyStateSeparated).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(artifactsDirectory, 'booking-dialog.png'),
  });

  const title = 'task-9-e2e-created-booking';
  await composer.getByLabel('Назва').fill(title);
  const createRequest = page.waitForRequest((request) =>
    request.url().endsWith('/api/bookings') &&
    request.method() === 'POST',
  );
  const createResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/bookings') &&
    response.request().method() === 'POST' &&
    response.status() === 201,
  );
  await composer.getByRole('button', {name: 'Забронювати'}).click();
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

  await expect(composer.locator('[name="title"]')).toBeHidden();
  const successToast = page.locator('.app-toast').filter({
    hasText: 'Бронювання створено',
  });
  await expect(successToast).toBeVisible();
  await expect(successToast).toHaveAttribute('role', 'status');
  await expect(database.booking.count({where: {title}})).resolves.toBe(1);
  const persistedBooking = await database.booking.findFirstOrThrow({
    where: {title},
  });
  expect(persistedBooking.endsAt.toISOString()).toBe(
    officeSlot(weekStart, 1, 12).toUTC().toISO(),
  );
  const bookingBlock = page.locator(
    `[data-booking-id="${persistedBooking.id}"]`,
  );
  const agendaProject = ['mobile-lg', 'mobile', 'reflow']
    .includes(testInfo.project.name);
  await expect(bookingBlock).toBeVisible();
  await expect(bookingBlock).toContainText(
    agendaProject ? '10:00-12:00' : '10:00–12:00',
  );
  const createdBookingFocus = agendaProject ?
    bookingBlock.getByRole('button').first() :
    bookingBlock;
  await expect(createdBookingFocus).toBeFocused();
  const createdBlockLayout = await bookingBlock.evaluate((booking) => {
    const dayCell = booking.closest('td, li');
    const bookingRect = booking.getBoundingClientRect();
    const dayCellRect = dayCell?.getBoundingClientRect();
    const contentRects = Array.from(booking.children).map(
      (child) => child.getBoundingClientRect(),
    );
    return {
      bookingContainedInDayColumn: Boolean(
        dayCellRect &&
        bookingRect.left >= dayCellRect.left &&
        bookingRect.right <= dayCellRect.right + 0.5 &&
        bookingRect.top >= dayCellRect.top &&
        bookingRect.bottom <= dayCellRect.bottom + 0.5,
      ),
      bookingContentContained: contentRects.every((rect) =>
        rect.left >= bookingRect.left &&
        rect.right <= bookingRect.right + 0.5 &&
        rect.top >= bookingRect.top &&
        rect.bottom <= bookingRect.bottom + 0.5),
      bookingHeight: bookingRect.height,
      bookingSpanHeight: dayCellRect?.height ?? bookingRect.height,
      horizontalOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });
  expect(createdBlockLayout).toEqual({
    bookingContainedInDayColumn: true,
    bookingContentContained: true,
    bookingHeight: expect.any(Number),
    bookingSpanHeight: expect.any(Number),
    horizontalOverflow: 0,
  });
  if (agendaProject) {
    expect(createdBlockLayout.bookingHeight).toBeGreaterThanOrEqual(44);
  } else {
    expect(createdBlockLayout.bookingSpanHeight).toBeGreaterThanOrEqual(192);
    expect(Math.abs(
      createdBlockLayout.bookingHeight -
      createdBlockLayout.bookingSpanHeight,
    )).toBeLessThanOrEqual(2);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(artifactsDirectory, 'booking-created.png'),
  });
});

test('@booking occupied slot -> visible conflict, surface remains open', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: 'organizer@example.test'},
  });
  const weekStart = officeMonday(1);
  const startsAt = officeSlot(weekStart, 2, 11);
  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}` +
    `&day=${startsAt.toISODate()}`,
  );
  await page.getByRole('button', {
    name: /Забронювати середа.*11:00/i,
  }).click();

  await database.booking.create({
    data: {
      roomId: room.id,
      userId: organizer.id,
      title: 'task-9-e2e-conflict-fixture',
      startsAt: startsAt.toUTC().toJSDate(),
      endsAt: startsAt.plus({minutes: 30}).toUTC().toJSDate(),
    },
  });

  const surface = bookingSurface(
    page,
    testInfo.project.name,
    'Бронювання: Oak',
  );
  await surface.getByLabel('Назва').fill('task-9-e2e-conflicting-attempt');
  await surface.getByRole('button', {
    exact: true,
    name: 'Забронювати',
  }).click();

  await expect(surface).toBeVisible();
  await expect(surface.getByRole('alert')).toHaveText(
    'Цей час початку більше недоступний. Оберіть інший слот.',
  );
  await expect(surface.getByLabel('Назва'))
    .toHaveValue('task-9-e2e-conflicting-attempt');
  await expect(surface.getByLabel('Час завершення')).toBeDisabled();
});

test('@booking pending disabled, duplicate clicks create exactly one', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);
  const startsAt = officeSlot(weekStart, 3, 14);
  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}` +
    `&day=${startsAt.toISODate()}`,
  );
  await page.getByRole('button', {
    name: /Забронювати четвер.*14:00/i,
  }).click();

  const surface = bookingSurface(
    page,
    testInfo.project.name,
    'Бронювання: Oak',
  );
  const title = 'task-9-e2e-single-submit';
  const submit = surface.getByRole('button', {
    exact: true,
    name: 'Забронювати',
  });
  await surface.getByLabel('Назва').fill(title);
  let createRequests = 0;
  await page.route('**/api/bookings', async (route) => {
    createRequests += 1;
    await route.continue();
  });

  await submit.dblclick();
  await expect(submit).toBeDisabled();
  await expect(surface.locator('[name="title"]')).toBeHidden();
  expect(createRequests).toBe(1);
  await expect(database.booking.count({where: {title}})).resolves.toBe(1);
});
