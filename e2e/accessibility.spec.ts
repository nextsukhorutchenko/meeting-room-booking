import {
  expect,
  officeMonday,
  roomByName,
  test,
} from './fixtures';
import type {Locator, Page} from '@playwright/test';

async function tabTo(page: Page, target: Locator, limit = 80): Promise<number> {
  for (let index = 1; index <= limit; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) {
      return index;
    }
  }
  throw new Error(`Keyboard traversal did not reach ${await target.toString()}`);
}

test('@schedule keyboard entry and schedule semantics remain deterministic', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);
  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}&day=${weekStart}`,
  );

  await page.keyboard.press('Tab');
  const mainSkip = page.getByRole('link', {
    name: 'Перейти до основного вмісту',
  });
  await expect(mainSkip).toBeFocused();
  await mainSkip.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();

  const scheduleSkip = page.getByRole('link', {name: 'До пошуку часу'});
  await page.keyboard.press('Tab');
  await expect(scheduleSkip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('День', {exact: true})).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Час', {exact: true})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', {name: 'Перейти'})).toBeFocused();

  await expect(page.getByRole('grid')).toHaveCount(0);
  if (['expanded', 'medium', 'tablet'].includes(testInfo.project.name)) {
    await expect(page.getByRole('table')).toHaveCount(1);
    await expect(page.getByRole('rowheader')).toHaveCount(20);
  } else {
    await expect(page.getByRole('list', {name: /Розклад на/})).toHaveCount(1);
  }
});

test('@booking visible targets, modal containment and restoration are stable', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);
  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}&day=${weekStart}`,
  );
  const slot = page.locator(
    '.free-slot-button:not([disabled]), .day-agenda-slot-button:not([disabled])',
  ).first();
  await expect(slot).toBeVisible();

  const compact = ['tablet', 'mobile-lg', 'mobile', 'reflow']
    .includes(testInfo.project.name);
  const targetSizes = await page.locator(
    '.schedule-navigation button:visible, ' +
    '.schedule-navigation select:visible, ' +
    '.room-filter-trigger:visible',
  ).evaluateAll((controls) => controls.map((control) => {
    const box = control.getBoundingClientRect();
    return {height: box.height, width: box.width};
  }));
  expect(targetSizes.length).toBeGreaterThan(0);
  for (const size of targetSizes) {
    expect(size.height).toBeGreaterThanOrEqual(44);
    expect(size.width).toBeGreaterThanOrEqual(44);
  }

  const traversalCount = await tabTo(page, slot);
  expect(traversalCount).toBeGreaterThan(3);
  await page.keyboard.press('Enter');
  if (compact) {
    const dialog = page.getByRole('dialog', {name: /Бронювання:/});
    await expect(dialog).toBeVisible();
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
    await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
    const focusable = dialog.locator(
      'button:not([disabled]), input:not([disabled]), select:not([disabled])',
    );
    await expect(focusable).toHaveCount(4);
    await expect(focusable.nth(0)).toBeFocused();
    for (let index = 1; index < 4; index += 1) {
      await page.keyboard.press('Tab');
      await expect(focusable.nth(index)).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expect(focusable.nth(0)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(focusable.nth(3)).toBeFocused();
    await page.keyboard.press('Escape');
  } else {
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const close = page.getByRole('button', {
      name: 'Закрити панель бронювання',
    });
    await expect(close).toBeFocused();
    await close.press('Enter');
  }
  await expect(slot).toBeFocused();
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
});

test('@schedule independent error retry preserves focus and live-region priority', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);
  let scheduleRequests = 0;
  let releaseError: (() => void) | undefined;
  const errorGate = new Promise<void>((resolve) => {
    releaseError = resolve;
  });
  await page.route(`**/api/rooms/${room.id}/schedule?*`, async (route) => {
    scheduleRequests += 1;
    if (scheduleRequests === 1) {
      await errorGate;
      await route.fulfill({
        contentType: 'application/json',
        json: {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Schedule unavailable',
          },
        },
        status: 503,
      });
      return;
    }
    await route.continue();
  });

  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}&day=${weekStart}`,
  );
  const today = page.getByRole('button', {name: 'Сьогодні'});
  await tabTo(page, today);
  await expect(today).toBeFocused();
  releaseError?.();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText(
    'Сервіс тимчасово недоступний. Спробуйте ще раз.',
  );
  await expect(alert).toHaveAttribute('aria-live', 'assertive');
  await expect(today).toBeFocused();
  await expect(page.getByText('Schedule unavailable')).toHaveCount(0);
  const retry = page.getByRole('button', {
    name: 'Повторити завантаження розкладу',
  });
  await tabTo(page, retry);
  await expect(retry).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.schedule-viewport')).not.toHaveAttribute(
    'aria-busy',
    'true',
  );
  await expect(alert).toHaveCount(0);
  expect(scheduleRequests).toBe(2);
  await expect(page.locator('[role="status"][aria-live="assertive"]'))
    .toHaveCount(0);
});
