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
}, testInfo) => {
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

  await expect(page.getByRole('heading', {name: 'Розклад'})).toBeVisible();
  const timetable = page.getByRole('table', {
    name: 'Розклад переговорної Oak',
  });
  const expectedDays = testInfo.project.name === 'expanded' ? 7 :
    testInfo.project.name === 'medium' ? 3 : 2;
  await expect(timetable.getByRole('columnheader'))
    .toHaveCount(expectedDays + 1);
  await expect(timetable.getByRole('rowheader')).toHaveCount(20);
  await expect(timetable.getByRole('rowheader').first()).toContainText('09:00');
  await expect(timetable.getByRole('rowheader').nth(2)).toContainText('10:00');
  await expect(page.getByRole('grid')).toHaveCount(0);
  await expect(page.getByText('Invalid DateTime')).toHaveCount(0);
  await expect(page.getByText('Oak', {exact: true})).toBeVisible();
  await expect(page.getByText('Поверх 1', {exact: true})).toBeVisible();
  await expect(page.getByText('6 місць', {exact: true})).toBeVisible();

  const today = officeTodayLabel();
  await expect(
    page.getByRole('columnheader', {name: new RegExp(today, 'i')}),
  ).toHaveAttribute('aria-current', 'date');

  const booking = page.getByRole('button', {name: new RegExp(layoutBookingTitle)});
  await expect(booking).toBeVisible();
  const layout = await booking.evaluate((bookingElement) => {
    const navigation = document.querySelector('.app-nav');
    const account = document.querySelector('.app-account');
    const bookingTitle =
      bookingElement.querySelector('[data-booking-title]');
    const bookingMeta = bookingElement.querySelector('.booking-block-meta');
    const navRect = navigation?.getBoundingClientRect();
    const accountRect = account?.getBoundingClientRect();
    const bookingRect = bookingElement.getBoundingClientRect();
    const bookingColumnRect =
      bookingElement.parentElement?.getBoundingClientRect();
    const titleRect = bookingTitle?.getBoundingClientRect();
    const metaRect = bookingMeta?.getBoundingClientRect();
    const timeGutter = document.querySelector<HTMLElement>(
      '.timetable thead th:first-child',
    );
    const timeGutterRect = timeGutter?.getBoundingClientRect();
    const timeLabels = Array.from(document.querySelectorAll<HTMLElement>(
      '.timetable tbody th[scope="row"]',
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
          timeLabels.length === 20 &&
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
  await expect(page.getByRole('table', {name: /Розклад переговорної Oak/}))
    .toBeVisible();

  const nextResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === `/api/rooms/${room.id}/schedule` &&
      url.searchParams.get('weekStart') === officeMonday(1);
  });
  await page.getByRole('button', {name: 'Наступний тиждень'}).click();
  await expect(page).toHaveURL(new RegExp(`weekStart=${officeMonday(1)}`));
  await nextResponse;

  const previousResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === `/api/rooms/${room.id}/schedule` &&
      url.searchParams.get('weekStart') === currentWeek;
  });
  await page.getByRole('button', {name: 'Попередній тиждень'}).click();
  await expect(page).toHaveURL(new RegExp(`weekStart=${currentWeek}`));
  await previousResponse;

  await page.getByRole('button', {name: 'Наступний тиждень'}).click();
  const todayResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === `/api/rooms/${room.id}/schedule` &&
      url.searchParams.get('weekStart') === currentWeek;
  });
  await page.getByRole('button', {name: 'Сьогодні'}).click();
  await expect(page).toHaveURL(new RegExp(`weekStart=${currentWeek}`));
  await todayResponse;
});
