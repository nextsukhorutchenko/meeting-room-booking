import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  DEMO_USER,
  expect,
  officeMonday,
  officeSlot,
  officeTodayLabel,
  roomByName,
  TASK_9_BOOKING_PREFIX,
  test,
} from './fixtures';

const artifactsDirectory = resolve(
  '.superpowers/sdd/2026-07-27-meeting-room-booking-implementation/' +
  'task-9-artifacts',
);

test.beforeAll(async () => {
  await mkdir(artifactsDirectory, {recursive: true});
});

test('@schedule user sees seven columns, 09:00-19:00 slots, current day and room metadata', async ({
  database,
  page,
}) => {
  await page.setViewportSize({width: 1296, height: 900});
  const room = await roomByName(database, 'Oak');
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: DEMO_USER.email},
  });
  const weekStart = officeMonday();
  const layoutBookingTitle = `${TASK_9_BOOKING_PREFIX}layout-booking`;
  const layoutBookingStart = officeSlot(weekStart, 0, 10);
  await database.booking.create({
    data: {
      endsAt: layoutBookingStart.plus({minutes: 30}).toJSDate(),
      roomId: room.id,
      startsAt: layoutBookingStart.toJSDate(),
      title: layoutBookingTitle,
      userId: organizer.id,
    },
  });
  const scheduleResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/rooms/${room.id}/schedule`) &&
    response.status() === 200,
  );

  await page.goto(`/schedule?roomId=${room.id}&weekStart=${weekStart}`);
  await scheduleResponse;

  await expect(page.getByRole('heading', {name: 'Schedule'})).toBeVisible();
  const weeklyGrid = page.getByRole('grid', {name: 'Weekly room schedule'});
  await expect(page.getByTestId('schedule-day-column')).toHaveCount(7);
  await expect(page.getByTestId('schedule-time-row')).toHaveCount(20);
  await expect(page.getByTestId('schedule-time-row').first())
    .toHaveText('09:00');
  await expect(page.getByTestId('schedule-time-row').nth(2))
    .toHaveText('10:00');
  await expect(page.getByTestId('schedule-end-time')).toHaveText('19:00');
  await expect(weeklyGrid.getByTestId(`day-row-clock-${weekStart}`))
    .toHaveCount(0);
  await expect(page.getByText('Invalid DateTime')).toHaveCount(0);
  await expect(page.getByText('Oak', {exact: true})).toBeVisible();
  await expect(page.getByText('Floor 1', {exact: true})).toBeVisible();
  await expect(page.getByText('6 people', {exact: true})).toBeVisible();

  const today = officeTodayLabel();
  await expect(
    page.getByRole('columnheader', {name: new RegExp(today, 'i')}),
  ).toHaveAttribute('aria-current', 'date');

  const booking = page.getByRole('article', {name: layoutBookingTitle});
  await expect(booking).toBeVisible();
  const layout = await booking.evaluate((bookingElement) => {
    const navigation = document.querySelector('.app-nav');
    const account = document.querySelector('.app-account');
    const bookingTitle = bookingElement.querySelector('strong');
    const bookingMeta = bookingElement.querySelector('.booking-block-meta');
    const navRect = navigation?.getBoundingClientRect();
    const accountRect = account?.getBoundingClientRect();
    const bookingRect = bookingElement.getBoundingClientRect();
    const bookingColumnRect =
      bookingElement.parentElement?.getBoundingClientRect();
    const titleRect = bookingTitle?.getBoundingClientRect();
    const metaRect = bookingMeta?.getBoundingClientRect();
    const timeGutter = document.querySelector<HTMLElement>(
      '.week-grid .schedule-time-gutter',
    );
    const timeGutterRect = timeGutter?.getBoundingClientRect();
    const timeLabels = Array.from(document.querySelectorAll<HTMLElement>(
      '.week-grid .schedule-time-row:not(:empty), ' +
      '.week-grid .schedule-end-time',
    ));

    return {
      bookingStartsAtColumnEdge: Boolean(
        bookingColumnRect &&
        bookingRect.left - bookingColumnRect.left <= 8,
      ),
      bookingContentContained: Boolean(
        bookingRect &&
        titleRect &&
        metaRect &&
        titleRect.top >= bookingRect.top &&
        metaRect.bottom <= bookingRect.bottom + 0.5 &&
        titleRect.bottom <= metaRect.top + 0.5,
      ),
      headerControlsOverlap: Boolean(
        navRect &&
        accountRect &&
        navRect.right > accountRect.left &&
        navRect.left < accountRect.right &&
        navRect.bottom > accountRect.top &&
        navRect.top < accountRect.bottom,
      ),
      horizontalOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      timeLabelsContained: Boolean(
        timeGutterRect &&
        timeLabels.length === 11 &&
        timeLabels.every((label) => {
          const labelRect = label.getBoundingClientRect();
          return labelRect.left >= timeGutterRect.left - 0.5 &&
            labelRect.right <= timeGutterRect.right + 0.5;
        }),
      ),
    };
  });
  expect(layout).toEqual({
    bookingStartsAtColumnEdge: true,
    bookingContentContained: true,
    headerControlsOverlap: false,
    horizontalOverflow: 0,
    timeLabelsContained: true,
  });

  await page.screenshot({
    path: resolve(artifactsDirectory, 'schedule-loaded.png'),
  });
});

test('@schedule previous/next/today changes URL and schedule request', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const currentWeek = officeMonday();
  await page.goto(`/schedule?roomId=${room.id}&weekStart=${currentWeek}`);
  await expect(page.getByRole('grid', {name: 'Weekly room schedule'}))
    .toBeVisible();

  const nextResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === `/api/rooms/${room.id}/schedule` &&
      url.searchParams.get('weekStart') === officeMonday(1);
  });
  await page.getByRole('button', {name: 'Next week'}).click();
  await expect(page).toHaveURL(new RegExp(`weekStart=${officeMonday(1)}`));
  await nextResponse;

  const previousResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === `/api/rooms/${room.id}/schedule` &&
      url.searchParams.get('weekStart') === currentWeek;
  });
  await page.getByRole('button', {name: 'Previous week'}).click();
  await expect(page).toHaveURL(new RegExp(`weekStart=${currentWeek}`));
  await previousResponse;

  await page.getByRole('button', {name: 'Next week'}).click();
  const todayResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === `/api/rooms/${room.id}/schedule` &&
      url.searchParams.get('weekStart') === currentWeek;
  });
  await page.getByRole('button', {name: 'Today'}).click();
  await expect(page).toHaveURL(new RegExp(`weekStart=${currentWeek}`));
  await todayResponse;
});
