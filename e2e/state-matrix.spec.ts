import type {Locator, Page, Route} from '@playwright/test';
import {expect, test} from './fixtures';

const room = {capacity: 6, floor: 1, id: 'state-room', name: 'Стан'};
const initialWeek = '2026-08-03';
const selectedDay = '2026-08-04';

type MatrixBooking = {
  author: {id: string; name: string};
  endsAt: string;
  id: string;
  isOwn: boolean;
  startsAt: string;
  title: string;
};

function booking(
  title: string,
  options: Partial<MatrixBooking> = {},
): MatrixBooking {
  return {
    author: {id: 'organizer', name: 'Demo Organizer'},
    endsAt: `${selectedDay}T09:30:00+03:00`,
    id: title.toLowerCase().replaceAll(' ', '-'),
    isOwn: true,
    startsAt: `${selectedDay}T09:00:00+03:00`,
    title,
    ...options,
  };
}

function schedule(
  weekStart: string,
  bookings: readonly MatrixBooking[] = [],
) {
  const rangeStart = new Date(`${weekStart}T00:00:00+03:00`);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 7);
  return {
    data: {
      bookings,
      officeTimeZone: 'Europe/Kyiv',
      officeWeekStart: weekStart,
      range: {
        endsAt: rangeEnd.toISOString(),
        startsAt: rangeStart.toISOString(),
      },
      room,
    },
  };
}

function historyItem(title: string) {
  return {
    endsAt: `${selectedDay}T10:30:00+03:00`,
    id: title.toLowerCase().replaceAll(' ', '-'),
    room: {id: room.id, name: room.name},
    startsAt: `${selectedDay}T10:00:00+03:00`,
    status: 'upcoming',
    title,
  };
}

async function fulfill(
  route: Route,
  body: unknown,
  status = 200,
): Promise<void> {
  await route.fulfill({
    contentType: 'application/json',
    json: body,
    status,
  });
}

async function tabTo(page: Page, target: Locator, limit = 80): Promise<void> {
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }
  throw new Error('Keyboard traversal did not reach the requested state control.');
}

async function mockCommon(page: Page): Promise<void> {
  await page.route('**/api/rooms', (route) => fulfill(route, {data: [room]}));
  await page.route('**/api/notifications', (route) =>
    fulfill(route, {data: []}));
}

function scheduleUrl(weekStart = initialWeek, day = selectedDay): string {
  return `/schedule?roomId=${room.id}&weekStart=${weekStart}&day=${day}`;
}

test('@schedule first load, empty, retry and malformed states are atomic', async ({
  page,
}) => {
  await mockCommon(page);
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let requests = 0;
  await page.route(`**/api/rooms/${room.id}/schedule?*`, async (route) => {
    requests += 1;
    const url = new URL(route.request().url());
    const weekStart = url.searchParams.get('weekStart') ?? initialWeek;
    if (requests === 1) {
      await firstGate;
      await fulfill(route, schedule(weekStart));
    } else if (requests === 2) {
      await fulfill(route, {
        error: {code: 'SERVICE_UNAVAILABLE', message: 'Schedule unavailable'},
      }, 503);
    } else if (requests === 3) {
      await fulfill(route, schedule(weekStart, [booking('Відновлений розклад')]));
    } else {
      await fulfill(route, schedule(weekStart, [booking('Partial data', {
        startsAt: 'malformed',
      })]));
    }
  });

  await page.goto(scheduleUrl());
  const loading = page.getByRole('status', {name: 'Завантажуємо розклад'});
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute('aria-live', 'polite');
  releaseFirst?.();
  const empty = page.locator('.empty-schedule-note');
  await expect(empty).toHaveAttribute('role', 'status');
  await expect(empty).toContainText('Немає бронювань цього дня');

  await page.getByRole('button', {name: 'Наступний тиждень'}).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText(
    'Сервіс тимчасово недоступний. Спробуйте ще раз.',
  );
  await expect(page.getByLabel('Переговорна')).toHaveValue(room.id);
  await expect(page.getByText('Schedule unavailable')).toHaveCount(0);
  const retry = page.getByRole('button', {
    name: 'Повторити завантаження розкладу',
  });
  await tabTo(page, retry);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Відновлений розклад')).toBeVisible();
  await expect(alert).toHaveCount(0);

  await page.getByRole('button', {name: 'Наступний тиждень'}).click();
  await expect(page.getByRole('alert')).toHaveText('Розклад недоступний.');
  await expect(page.getByText('Partial data')).toHaveCount(0);
  await expect(page.getByRole('list', {name: /Розклад на/})).toHaveCount(0);
});

test('@schedule preserved refresh retains data and announces progress', async ({
  page,
}) => {
  await mockCommon(page);
  const retainedTitle = 'Збережене бронювання';
  let releaseRefresh: (() => void) | undefined;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  let requests = 0;
  await page.route(`**/api/rooms/${room.id}/schedule?*`, async (route) => {
    requests += 1;
    if (requests === 1) {
      await fulfill(route, schedule(initialWeek, [booking(retainedTitle)]));
    } else {
      await refreshGate;
      await fulfill(route, schedule(initialWeek));
    }
  });
  await page.route('**/api/bookings/*', (route) =>
    route.request().method() === 'DELETE' ?
      route.fulfill({status: 204}) :
      route.continue());

  await page.goto(scheduleUrl());
  const cancel = page.getByRole('button', {name: 'Скасувати'});
  await expect(cancel).toBeVisible();
  await cancel.click();
  const dialog = page.getByRole('dialog', {name: 'Скасувати бронювання'});
  await dialog.getByRole('button', {name: 'Скасувати бронювання'}).click();

  const overlay = page.getByRole('status', {name: 'Завантажуємо розклад'});
  await expect(overlay).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByText(retainedTitle)).toBeVisible();
  await expect(page.getByRole('main')).toBeFocused();
  releaseRefresh?.();
  await expect(page.getByText(retainedTitle)).toHaveCount(0);
  await expect(overlay).toHaveCount(0);
});

test('@booking conflict retry retains the draft and recovers independently', async ({
  page,
}) => {
  await mockCommon(page);
  let requests = 0;
  await page.route(`**/api/rooms/${room.id}/schedule?*`, async (route) => {
    requests += 1;
    if (requests === 1 || requests === 3) {
      await fulfill(route, schedule(initialWeek));
    } else {
      await fulfill(route, {
        error: {code: 'SERVICE_UNAVAILABLE', message: 'Refresh failed'},
      }, 503);
    }
  });
  await page.route('**/api/bookings', (route) => fulfill(route, {
    error: {code: 'BOOKING_CONFLICT', message: 'Conflict'},
  }, 409));

  await page.goto(scheduleUrl());
  await page.locator('.day-agenda-slot-button:not([disabled])').first().click();
  const dialog = page.getByRole('dialog', {name: /Бронювання:/});
  const title = dialog.getByLabel('Назва');
  await title.fill('Чернетка конфлікту');
  await dialog.getByRole('button', {name: 'Забронювати'}).click();

  await expect(dialog.getByRole('alert')).toHaveText(
    'Не вдалося оновити доступність.',
  );
  await expect(title).toHaveValue('Чернетка конфлікту');
  await expect(page.getByText('Refresh failed')).toHaveCount(0);
  const retry = dialog.getByRole('button', {name: 'Оновити доступність'});
  await tabTo(page, retry);
  await page.keyboard.press('Enter');
  await expect(retry).toHaveCount(0);
  await expect(title).toHaveValue('Чернетка конфлікту');
  await expect(dialog.getByRole('button', {name: 'Забронювати'})).toBeEnabled();
});

test('@booking conflict marks the selected start unavailable atomically', async ({
  page,
}) => {
  await mockCommon(page);
  let requests = 0;
  await page.route(`**/api/rooms/${room.id}/schedule?*`, async (route) => {
    requests += 1;
    await fulfill(
      route,
      requests === 1 ?
        schedule(initialWeek) :
        schedule(initialWeek, [booking('Вже зайнято', {
          author: {id: 'other', name: 'Інший користувач'},
          isOwn: false,
        })]),
    );
  });
  await page.route('**/api/bookings', (route) => fulfill(route, {
    error: {code: 'BOOKING_CONFLICT', message: 'Conflict'},
  }, 409));

  await page.goto(scheduleUrl());
  await page.locator('.day-agenda-slot-button:not([disabled])').first().click();
  const dialog = page.getByRole('dialog', {name: /Бронювання:/});
  const title = dialog.getByLabel('Назва');
  await title.fill('Чернетка недоступного старту');
  await dialog.getByRole('button', {name: 'Забронювати'}).click();

  await expect(dialog.getByRole('alert')).toHaveText(
    'Цей час початку більше недоступний. Оберіть інший слот.',
  );
  await expect(title).toHaveValue('Чернетка недоступного старту');
  await expect(dialog.getByLabel('Час завершення')).toBeDisabled();
  await expect(page.getByText('Conflict')).toHaveCount(0);
});

test('@booking cancellation error stays localized and restores exact focus', async ({
  page,
}) => {
  await mockCommon(page);
  const title = 'Помилка скасування';
  await page.route(`**/api/rooms/${room.id}/schedule?*`, (route) =>
    fulfill(route, schedule(initialWeek, [booking(title)])));
  await page.route('**/api/bookings/*', (route) => fulfill(route, {
    error: {code: 'UNRECOGNIZED', message: 'Cancellation failed'},
  }, 503));

  await page.goto(scheduleUrl());
  const cancel = page.getByRole('button', {name: 'Скасувати'});
  await cancel.click();
  const dialog = page.getByRole('dialog', {name: 'Скасувати бронювання'});
  await dialog.getByRole('button', {name: 'Скасувати бронювання'}).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Не вдалося скасувати бронювання. Спробуйте ще раз.',
  );
  await expect(page.getByText('Cancellation failed')).toHaveCount(0);
  await expect(dialog.getByRole('button', {
    name: 'Залишити бронювання',
  })).toBeFocused();
  await dialog.getByRole('button', {name: 'Закрити діалог'}).press('Enter');
  await expect(cancel).toBeFocused();
});

test('@notifications empty state owns the mobile modal without a toast', async ({
  page,
}) => {
  await mockCommon(page);
  await page.route(`**/api/rooms/${room.id}/schedule?*`, (route) =>
    fulfill(route, schedule(initialWeek)));
  await page.goto(scheduleUrl());

  const bell = page.getByRole('button', {name: 'Сповіщення, 0 нових'});
  await tabTo(page, bell);
  await page.keyboard.press('Enter');
  const center = page.getByRole('dialog', {name: 'Сповіщення'});
  await expect(center).toHaveAttribute('aria-modal', 'true');
  await expect(center).toContainText('Нових сповіщень немає.');
  await expect(center.getByRole('button', {
    name: 'Закрити сповіщення',
  })).toBeFocused();
  await expect(page.locator('.notification-toast')).toHaveCount(0);
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
});

test('@booking history loading, error and retry remain section-independent', async ({
  page,
}) => {
  await page.route('**/api/notifications', (route) =>
    fulfill(route, {data: []}));
  let releaseFuture: (() => void) | undefined;
  const futureGate = new Promise<void>((resolve) => {
    releaseFuture = resolve;
  });
  let futureRequests = 0;
  let pastRequests = 0;
  await page.route('**/api/me/bookings?*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('scope') === 'past') {
      pastRequests += 1;
      await fulfill(route, {data: {items: [], nextCursor: null}});
      return;
    }
    futureRequests += 1;
    if (futureRequests === 1) {
      await futureGate;
      await fulfill(route, {
        error: {code: 'SERVICE_UNAVAILABLE', message: 'History unavailable'},
      }, 503);
    } else {
      await fulfill(route, {
        data: {items: [historyItem('Історію відновлено')], nextCursor: null},
      });
    }
  });

  await page.goto('/my-bookings');
  const future = page.getByRole('region', {name: 'Майбутні'});
  const past = page.getByRole('region', {name: 'Минулі'});
  await expect(future.getByRole('status')).toContainText(
    'Завантажуємо майбутні бронювання',
  );
  await expect(future.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  await expect(past.getByRole('status')).toContainText(
    'Історія бронювань порожня',
  );
  releaseFuture?.();
  await expect(future.getByRole('alert')).toContainText(
    'Сервіс тимчасово недоступний. Спробуйте ще раз.',
  );
  await expect(page.getByText('History unavailable')).toHaveCount(0);
  const retry = future.getByRole('button', {name: 'Повторити майбутні'});
  await tabTo(page, retry);
  await page.keyboard.press('Enter');
  await expect(future).toContainText('Історію відновлено');
  await expect(future.getByRole('alert')).toHaveCount(0);
  expect(futureRequests).toBe(2);
  expect(pastRequests).toBe(1);
});
