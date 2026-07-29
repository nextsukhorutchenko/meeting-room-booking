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
    await expect(page.getByTestId('schedule-office-zone'))
      .toHaveText('Europe/Kyiv');
    await expect(page.getByTestId('schedule-office-zone'))
      .not.toContainText(/GMT[+-]/);
    const mondayClocks =
      page.getByTestId(`day-row-clock-${transition.weekStart}`);
    const sundayClocks =
      page.getByTestId(`day-row-clock-${sunday.toISODate()}`);
    await expect(mondayClocks).toHaveCount(11);
    await expect(sundayClocks).toHaveCount(11);
    await expect(mondayClocks.first())
      .toHaveText(transition.mondayHours.slice(0, 5));
    await expect(sundayClocks.first())
      .toHaveText(transition.sundayHours.slice(0, 5));
    await expect(page.getByRole('article', {name: new RegExp(title)}))
      .toContainText(transition.bookingTime);
    await expect(page.getByRole('article', {name: new RegExp(title)}))
      .toHaveAttribute('data-highlighted', 'true');
    const geometry = await page.evaluate(() => {
      const columns = Array.from(document.querySelectorAll<HTMLElement>(
        '.week-grid [data-testid="schedule-day-column"]',
      ));
      const widths = columns.map(
        (column) => column.getBoundingClientRect().width,
      );
      const booking = document.querySelector<HTMLElement>(
        '.week-grid [data-highlighted="true"]',
      );
      const bookingRect = booking?.getBoundingClientRect();
      const bookingColumnRect =
        booking?.parentElement?.getBoundingClientRect();
      return {
        bookingContained: Boolean(
          bookingRect &&
          bookingColumnRect &&
          bookingRect.left >= bookingColumnRect.left &&
          bookingRect.right <= bookingColumnRect.right + 0.5,
        ),
        columns: columns.length,
        equalColumnWidths:
          widths.length === 7 &&
          widths.every((width) => Math.abs(width - widths[0]) < 0.5),
        rowsPerColumn: columns.map(
          (column) => column.querySelectorAll('.schedule-slot').length,
        ),
      };
    });
    expect(geometry).toEqual({
      bookingContained: true,
      columns: 7,
      equalColumnWidths: true,
      rowsPerColumn: Array.from({length: 7}, () => 20),
    });

    await page.screenshot({
      fullPage: true,
      path: resolve(
        artifactsDirectory,
        `desktop-new-york-${transition.name}-transition.png`,
      ),
    });

    const scheduleCancelTrigger = page.getByRole('article', {
      name: new RegExp(title),
    }).getByRole('button', {name: `Cancel ${title}`});
    await scheduleCancelTrigger.click();
    await expect(page.getByRole('dialog', {name: 'Cancel booking'}))
      .toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
    await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');

    await page.goto('/my-bookings');
    await expect(page.getByRole('dialog', {name: 'Cancel booking'})).toHaveCount(0);
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
    await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');

    const historyRow = page.locator(`[data-booking-id="${booking.id}"]`);
    const historyCancelTrigger = historyRow.getByRole('button', {
      name: `Cancel ${title}`,
    });
    await expect(historyRow).toContainText(transition.bookingTime);
    await historyCancelTrigger.click();
    const historyDialog = page.getByRole('dialog', {name: 'Cancel booking'});
    await expect(historyDialog).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
    await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
    await historyDialog.getByRole('button', {name: 'Keep booking'}).click();
    await expect(historyCancelTrigger).toBeFocused();
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
    await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');
  });
}
