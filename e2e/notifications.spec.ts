import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {expect, roomByName, test} from './fixtures';

const taskPrefix = 'task-14-e2e-';
const artifactsDirectory = resolve(
  '.superpowers/sdd/2026-07-27-meeting-room-booking-implementation/' +
  'task-14-artifacts',
);

test.beforeAll(async () => {
  await mkdir(artifactsDirectory, {recursive: true});
});

test('@notifications shows one booking handoff without layout overlap', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const currentUser = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: 'organizer@example.test'},
  });
  const nextUser = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: 'guest@example.test'},
  });
  const now = new Date();
  now.setMilliseconds(0);
  const endsAt = new Date(now.getTime() + 5 * 60_000);
  await database.booking.createMany({
    data: [{
      id: `${taskPrefix}current`,
      roomId: room.id,
      userId: currentUser.id,
      title: `${taskPrefix}planning`,
      startsAt: new Date(now.getTime() - 30 * 60_000),
      endsAt,
    }, {
      id: `${taskPrefix}next`,
      roomId: room.id,
      userId: nextUser.id,
      title: `${taskPrefix}review`,
      startsAt: endsAt,
      endsAt: new Date(endsAt.getTime() + 30 * 60_000),
    }],
  });

  await page.goto('/schedule');

  const toast = page.getByRole('status').filter({
    hasText: `${taskPrefix}planning ends soon in Oak. Demo Guest is next.`,
  });
  await expect(toast).toBeVisible();
  await expect(
    page.getByRole('button', {name: 'Notifications, 1 unread'}),
  ).toBeVisible();
  const layout = await page.evaluate(() => {
    const header = document.querySelector('.app-header');
    const toast = document.querySelector('.notification-toast');
    const headerRect = header?.getBoundingClientRect();
    const toastRect = toast?.getBoundingClientRect();
    return {
      horizontalOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      toastContained: Boolean(
        toastRect &&
        toastRect.left >= 0 &&
        toastRect.right <= window.innerWidth &&
        toastRect.bottom <= window.innerHeight,
      ),
      toastBelowHeader: Boolean(
        toastRect &&
        headerRect &&
        toastRect.top >= headerRect.bottom,
      ),
    };
  });
  expect(layout).toEqual({
    horizontalOverflow: 0,
    toastContained: true,
    toastBelowHeader: true,
  });
  await page.screenshot({
    path: resolve(
      artifactsDirectory,
      `handoff-${testInfo.project.name}.png`,
    ),
  });

  await page.reload();
  await expect(page.getByRole('status').filter({
    hasText: `${taskPrefix}planning`,
  })).toHaveCount(0);
});
