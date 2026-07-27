import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {DateTime} from 'luxon';
import {expect, officeMonday, roomByName, test} from './fixtures';

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
  const room = await roomByName(database, 'Oak');
  const scheduleResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/rooms/${room.id}/schedule`) &&
    response.status() === 200,
  );

  await page.goto(`/schedule?roomId=${room.id}&weekStart=${officeMonday()}`);
  await scheduleResponse;

  await expect(page.getByRole('heading', {name: 'Schedule'})).toBeVisible();
  await expect(page.getByTestId('schedule-day-column')).toHaveCount(7);
  await expect(page.getByTestId('schedule-time-row')).toHaveCount(20);
  await expect(page.getByText('09:00', {exact: true})).toBeVisible();
  await expect(page.getByText('10:00', {exact: true})).toBeVisible();
  await expect(page.getByText('19:00', {exact: true})).toBeVisible();
  await expect(page.getByText('Invalid DateTime')).toHaveCount(0);
  await expect(page.getByText('Oak', {exact: true})).toBeVisible();
  await expect(page.getByText('Floor 1', {exact: true})).toBeVisible();
  await expect(page.getByText('6 people', {exact: true})).toBeVisible();

  const today = DateTime.now().toFormat('ccc, LLL d');
  await expect(
    page.getByRole('columnheader', {name: new RegExp(today, 'i')}),
  ).toHaveAttribute('aria-current', 'date');

  const layout = await page.evaluate(() => {
    const navigation = document.querySelector('.app-nav');
    const account = document.querySelector('.app-account');
    const booking = document.querySelector('.booking-block');
    const bookingTitle = booking?.querySelector('strong');
    const bookingMeta = booking?.querySelector('.booking-block-meta');
    const navRect = navigation?.getBoundingClientRect();
    const accountRect = account?.getBoundingClientRect();
    const bookingRect = booking?.getBoundingClientRect();
    const titleRect = bookingTitle?.getBoundingClientRect();
    const metaRect = bookingMeta?.getBoundingClientRect();

    return {
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
    };
  });
  expect(layout).toEqual({
    bookingContentContained: true,
    headerControlsOverlap: false,
    horizontalOverflow: 0,
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
