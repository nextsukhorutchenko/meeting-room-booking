import {expect} from '@playwright/test';
import {
  loginAsDemoUser,
  officeMonday,
  roomByName,
} from '../fixtures';
import {
  exploratoryMobileSchedulePath,
  exploratoryTuesday,
} from './mobile-booking-date';
import {test} from './fixture';

test.use({
  deviceScaleFactor: 2.75,
  hasTouch: true,
  isMobile: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  viewport: {height: 844, width: 390},
});

test('mobile booking controls and dialogs remain visually usable', async ({
  agentForPage,
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);
  const selectedDay = exploratoryTuesday(weekStart);
  await loginAsDemoUser(page);
  await page.goto(exploratoryMobileSchedulePath(room.id, weekStart));
  await expect(page.getByRole('list', {name: /Розклад на Oak/}))
    .toBeVisible();
  await expect(page.getByLabel('День', {exact: true})).toHaveValue(selectedDay);
  const agent = await agentForPage(page);

  await agent.aiAssert(
    'The previous-day button, day picker, and next-day button are visible, ' +
    'comfortably reachable, and do not overlap on this mobile screen.',
  );

  await page.getByRole('button', {name: /Забронювати.*10:00/i}).click();
  const bookingDialog = page.getByRole('dialog', {name: 'Бронювання: Oak'});
  await expect(bookingDialog).toBeVisible();
  await agent.aiAssert(
    'The mobile booking dialog is fully readable within the viewport. Its ' +
    'room, date, time, title field, and action buttons are not clipped or ' +
    'overlapping.',
  );

  await bookingDialog.getByRole('button', {name: 'Забронювати'}).click();
  await expect(bookingDialog.getByText(/Назва/)).toBeVisible();
  await expect(bookingDialog.getByLabel('Назва'))
    .toHaveAttribute('aria-invalid', 'true');
  await agent.aiAssert(
    'The required-title error is visually associated with the title field, ' +
    'easy to read, and does not crowd or obscure the dialog actions.',
  );
  await bookingDialog.getByRole('button', {name: 'Закрити'}).click();

  await page.getByRole('link', {name: 'Мої бронювання'}).click();
  const seededBooking = page.locator(
    '[data-booking-id="demo-future-planning"]',
  );
  await expect(seededBooking).toBeVisible();
  await seededBooking
    .getByRole('button', {name: 'Скасувати Demo planning'})
    .click();
  const cancellationDialog =
    page.getByRole('dialog', {name: 'Скасувати бронювання'});
  await expect(cancellationDialog).toBeVisible();
  await agent.aiAssert(
    'The cancellation confirmation is clear on mobile. The booking title, ' +
    'consequence and both cancellation actions ' +
    'are readable, distinct, and fully inside the viewport.',
  );
  await cancellationDialog
    .getByRole('button', {name: 'Залишити бронювання'})
    .click();
});
