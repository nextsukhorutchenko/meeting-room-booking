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
    name: 'us-only',
    weekStart: '2026-03-02',
  },
  {
    name: 'kyiv-only',
    weekStart: '2026-03-23',
  },
] as const;

for (const transition of transitionCases) {
  test(`@timezone ${transition.name} DST week has per-day clocks`, async ({
    database,
    page,
  }, testInfo) => {
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
    const browserTimeZone = await page.evaluate(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    const bookingTime = `${sunday.setZone(browserTimeZone).toFormat('HH:mm')}-` +
      sunday.plus({minutes: 30}).setZone(browserTimeZone).toFormat('HH:mm');
    if (browserTimeZone !== 'Europe/Kyiv' &&
        browserTimeZone !== 'Europe/Kiev') {
      await expect(page.getByTestId('timezone-notice'))
        .toContainText(browserTimeZone);
      await expect(page.getByTestId('timezone-notice'))
        .toContainText('Europe/Kyiv');
    }
    await expect(page.locator('body'))
      .not.toContainText(/GMT[+-]/);
    const bookingTrigger = page.getByRole('button', {
      name: new RegExp(title),
    });
    await expect(bookingTrigger).toContainText(bookingTime);
    const table = page.getByRole('table');
    if (testInfo.project.name === 'mobile-lg') {
      await expect(table).toHaveCount(0);
      await expect(page.getByRole('list', {name: /Розклад на Oak/}))
        .toHaveCount(1);
      await expect(bookingTrigger.locator('..'))
        .toHaveClass(/day-agenda-highlighted/);
    } else {
      const dayCount = testInfo.project.name === 'tablet' ? 2 : 7;
      await expect(table.getByRole('columnheader')).toHaveCount(dayCount + 1);
      await expect(table.getByRole('rowheader')).toHaveCount(20);
      await expect(bookingTrigger)
        .toHaveAttribute('data-highlighted', 'true');
    }
    const geometry = await page.evaluate(() => {
      const booking = document.querySelector<HTMLElement>(
        '[data-highlighted="true"]',
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
        horizontalOverflow:
          document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(geometry).toEqual({
      bookingContained: true,
      horizontalOverflow: 0,
    });

    await page.screenshot({
      fullPage: true,
      path: resolve(
        artifactsDirectory,
        `desktop-new-york-${transition.name}-transition.png`,
      ),
    });

    const navigationLabel = testInfo.project.name === 'mobile-lg' ?
      'Нижня навігація' :
      'Основна навігація';
    const bookingsLink = page.locator(
      `nav[aria-label="${navigationLabel}"] a[href="/my-bookings"]`,
    );
    await expect(bookingsLink).toBeVisible();

    const scheduleCancelTrigger = bookingTrigger;
    await scheduleCancelTrigger.click();
    await expect(page.getByRole('dialog', {name: 'Скасувати бронювання'}))
      .toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
    await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');

    await bookingsLink.evaluate((link: HTMLAnchorElement) => link.click());
    await expect(page).toHaveURL('/my-bookings');
    await expect(page.getByRole('dialog', {
      name: 'Скасувати бронювання',
    })).toHaveCount(0);
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
    await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');

    const historyRow = page.locator(`[data-booking-id="${booking.id}"]`);
    const historyCancelTrigger = historyRow.getByRole('button', {
      name: `Скасувати ${title}`,
    });
    await expect(historyRow).toContainText(bookingTime);
    await historyCancelTrigger.click();
    const historyDialog = page.getByRole('dialog', {
      name: 'Скасувати бронювання',
    });
    await expect(historyDialog).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
    await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
    await historyDialog.getByRole('button', {
      name: 'Залишити бронювання',
    }).click();
    await expect(historyCancelTrigger).toBeFocused();
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
    await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');
  });
}
