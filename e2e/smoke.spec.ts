import {expect, test} from '@playwright/test';

test('redirects signed-out users from the root to login', async ({page}) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Meeting Room Booking');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', {name: 'Sign in'})).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(
    page.getByRole('link', {name: 'Create an account'}),
  ).toBeVisible();
});
