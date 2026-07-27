import {expect, test} from '@playwright/test';

test('displays the meeting room booking home page', async ({page}) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Meeting Room Booking');
  await expect(
    page.getByRole('heading', {level: 1, name: 'Meeting Room Booking'}),
  ).toBeVisible();
});
