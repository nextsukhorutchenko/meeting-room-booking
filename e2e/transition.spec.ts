import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  DEMO_USER,
  expect,
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

const transitionCases = [
  {
    bookingTime: '03:00-03:30',
    mondayHours: '02:00-12:00 EST',
    name: 'us-only',
    sundayHours: '03:00-13:00 EDT',
    weekStart: '2026-03-02',
  },
  {
    bookingTime: '02:00-02:30',
    mondayHours: '03:00-13:00 EDT',
    name: 'kyiv-only',
    sundayHours: '02:00-12:00 EDT',
    weekStart: '2026-03-23',
  },
] as const;

for (const transition of transitionCases) {
  test(`@timezone ${transition.name} DST week has per-day clocks`, async ({
    database,
    page,
  }) => {
    const room = await roomByName(database, 'Oak');
    const organizer = await database.user.findUniqueOrThrow({
      where: {normalizedEmail: DEMO_USER.email},
    });
    const sunday = officeSlot(transition.weekStart, 6, 9);
    const title =
      `${TASK_12_BOOKING_PREFIX}${transition.name}-transition-sunday`;
    const booking = await database.booking.create({
      data: {
        roomId: room.id,
        userId: organizer.id,
        title,
        startsAt: sunday.toUTC().toJSDate(),
        endsAt: sunday.plus({minutes: 30}).toUTC().toJSDate(),
      },
    });

    await page.goto(
      `/schedule?roomId=${room.id}&weekStart=${transition.weekStart}` +
      `&day=${sunday.toISODate()}&bookingId=${booking.id}`,
    );
    await expect(page.getByTestId(
      `day-user-hours-${transition.weekStart}`,
    )).toHaveText(transition.mondayHours);
    await expect(page.getByTestId(
      `day-user-hours-${sunday.toISODate()}`,
    )).toHaveText(transition.sundayHours);
    await expect(page.getByRole('article', {name: new RegExp(title)}))
      .toContainText(transition.bookingTime);
    await expect(page.getByRole('article', {name: new RegExp(title)}))
      .toHaveAttribute('data-highlighted', 'true');

    await page.screenshot({
      fullPage: true,
      path: resolve(
        artifactsDirectory,
        `desktop-new-york-${transition.name}-transition.png`,
      ),
    });

    await page.getByRole('link', {name: 'My Bookings'}).click();
    await expect(page.locator(`[data-booking-id="${booking.id}"]`))
      .toContainText(transition.bookingTime);
  });
}
