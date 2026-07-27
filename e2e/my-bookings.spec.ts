import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  DEMO_USER,
  expect,
  officeMonday,
  officeSlot,
  roomByName,
  TASK_11_BOOKING_PREFIX,
  test,
} from './fixtures';

const artifactsDirectory = resolve(
  '.superpowers/sdd/2026-07-27-meeting-room-booking-implementation/' +
  'task-11-artifacts',
);

test.beforeAll(async () => {
  await mkdir(artifactsDirectory, {recursive: true});
});

test('@booking future and past sections render their empty states', async ({
  database,
  page,
}) => {
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: DEMO_USER.email},
  });
  const existing = await database.booking.findMany({
    where: {userId: organizer.id},
  });
  await database.booking.deleteMany({where: {userId: organizer.id}});

  try {
    await page.goto('/my-bookings');

    await expect(page.getByRole('heading', {name: 'My Bookings'})).toBeVisible();
    await expect(page.getByText('No upcoming bookings')).toBeVisible();
    await expect(page.getByText('No past bookings')).toBeVisible();
  } finally {
    if (existing.length > 0) {
      await database.booking.createMany({data: existing});
    }
  }
});

test('@booking Load more appends equal-time past records without duplicates', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: DEMO_USER.email},
  });
  const pastEnd = new Date(Date.now() - 60_000);
  const pastStart = new Date(pastEnd.getTime() - 30 * 60_000);
  const expectedIds = Array.from(
    {length: 22},
    (_, index) =>
      `${TASK_11_BOOKING_PREFIX}past-${index.toString().padStart(2, '0')}`,
  ).reverse();
  await database.booking.createMany({
    data: Array.from({length: 22}, (_, index) => ({
      id: `${TASK_11_BOOKING_PREFIX}past-${index.toString().padStart(2, '0')}`,
      roomId: room.id,
      userId: organizer.id,
      title: index === 21 ?
        'X'.repeat(100) :
        `${TASK_11_BOOKING_PREFIX}past-${index.toString().padStart(2, '0')}`,
      startsAt: pastStart,
      endsAt: pastEnd,
    })),
  });

  await page.goto('/my-bookings');
  const past = page.getByRole('region', {name: 'Past bookings'});
  const taskRows = past.locator(
    `[data-booking-id^="${TASK_11_BOOKING_PREFIX}"]`,
  );
  await expect(taskRows).toHaveCount(20);
  const firstPageIds = await taskRows.evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-booking-id')),
  );
  expect(firstPageIds).toEqual(expectedIds.slice(0, 20));

  await past.getByRole('button', {name: 'Load more past bookings'}).click();

  await expect(taskRows).toHaveCount(22);
  const ids = await taskRows.evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-booking-id')),
  );
  expect(ids).toEqual(expectedIds);
  expect(new Set(ids).size).toBe(22);

  await page.screenshot({
    path: resolve(artifactsDirectory, 'my-bookings-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({width: 390, height: 844});
  const layout = await page.evaluate(() => ({
    horizontalOverflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    rowsContained: Array.from(
      document.querySelectorAll<HTMLElement>('.booking-list-row'),
    ).every((row) => {
      const rect = row.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= window.innerWidth + 0.5;
    }),
    titlesContained: Array.from(
      document.querySelectorAll<HTMLElement>('.booking-list-details a'),
    ).every((title) => title.scrollWidth <= title.clientWidth + 1),
  }));
  expect(layout).toEqual({
    horizontalOverflow: 0,
    rowsContained: true,
    titlesContained: true,
  });
  await page.screenshot({
    path: resolve(artifactsDirectory, 'my-bookings-mobile.png'),
    fullPage: true,
  });
});

test('@booking a history row opens and highlights the correct schedule booking', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Pine');
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: DEMO_USER.email},
  });
  const weekStart = officeMonday(1);
  const startsAt = officeSlot(weekStart, 2, 11);
  const id = `${TASK_11_BOOKING_PREFIX}deep-link`;
  const title = `${TASK_11_BOOKING_PREFIX}deep-link`;
  await database.booking.create({
    data: {
      id,
      roomId: room.id,
      userId: organizer.id,
      title,
      startsAt: startsAt.toUTC().toJSDate(),
      endsAt: startsAt.plus({minutes: 30}).toUTC().toJSDate(),
    },
  });

  await page.goto('/my-bookings');
  await page.getByRole('link', {name: title}).click();

  await expect(page).toHaveURL(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}` +
    `&day=${startsAt.toISODate()}&bookingId=${id}`,
  );
  await expect(page.getByRole('article', {name: new RegExp(title)}))
    .toHaveAttribute('data-highlighted', 'true');
});

test('@booking a future history row cancels through the shared dialog', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: DEMO_USER.email},
  });
  const startsAt = officeSlot(officeMonday(1), 3, 14);
  const id = `${TASK_11_BOOKING_PREFIX}cancel`;
  const title = `${TASK_11_BOOKING_PREFIX}cancel`;
  await database.booking.create({
    data: {
      id,
      roomId: room.id,
      userId: organizer.id,
      title,
      startsAt: startsAt.toUTC().toJSDate(),
      endsAt: startsAt.plus({minutes: 30}).toUTC().toJSDate(),
    },
  });

  await page.goto('/my-bookings');
  await page.getByRole('button', {name: `Cancel ${title}`}).click();
  const dialog = page.getByRole('dialog', {name: 'Cancel booking'});
  await expect(dialog).toBeVisible();

  const cancellationResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/bookings/${id}`) &&
    response.request().method() === 'DELETE' &&
    response.status() === 204,
  );
  await dialog.getByRole('button', {name: 'Cancel booking'}).click();
  await cancellationResponse;

  await expect(page.getByText(title)).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({hasText: 'Booking cancelled'}),
  ).toBeVisible();
  await expect(database.booking.findUniqueOrThrow({where: {id}}))
    .resolves.toMatchObject({cancelledAt: expect.any(Date)});
});
