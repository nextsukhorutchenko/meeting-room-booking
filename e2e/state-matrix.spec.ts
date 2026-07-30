import type {Locator, Page, Route} from '@playwright/test';
import {DateTime} from 'luxon';
import {expect, test} from './fixtures';

const room = {capacity: 6, floor: 1, id: 'state-room', name: 'Стан'};
const initialWeek = '2026-08-03';
const selectedDay = '2026-08-09';

type MatrixBooking = {
  author: {id: string; name: string};
  endsAt: string;
  id: string;
  isOwn: boolean;
  startsAt: string;
  title: string;
};

function officeInstant(
  officeDay: string,
  hour: number,
  minute = 0,
): string {
  const instant = DateTime.fromISO(officeDay, {zone: 'Europe/Kyiv'})
    .set({hour, minute, second: 0, millisecond: 0})
    .toUTC()
    .toISO();
  if (!instant) throw new Error(`Invalid office day: ${officeDay}`);
  return instant;
}

function booking(
  title: string,
  options: Partial<MatrixBooking> = {},
  officeDay = selectedDay,
): MatrixBooking {
  return {
    author: {id: 'organizer', name: 'Demo Organizer'},
    endsAt: officeInstant(officeDay, 9, 30),
    id: title.toLowerCase().replaceAll(' ', '-'),
    isOwn: true,
    startsAt: officeInstant(officeDay, 9),
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
    endsAt: officeInstant(selectedDay, 10, 30),
    id: title.toLowerCase().replaceAll(' ', '-'),
    room: {id: room.id, name: room.name},
    startsAt: officeInstant(selectedDay, 10),
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

function scheduleMessage(page: Page, heading: string): Locator {
  return page.locator('.schedule-message[role="alert"]')
    .filter({hasText: heading});
}

function firstAvailableSlot(page: Page): Locator {
  return page.getByRole('list', {name: `Розклад на ${room.name}`})
    .getByRole('button', {name: /^Забронювати/})
    .first();
}

test('@schedule first load, empty, retry and malformed states are atomic', async ({
  page,
}) => {
  await mockCommon(page);
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let phase: 'initial' | 'error' | 'recovered' | 'malformed' = 'initial';
  await page.route(`**/api/rooms/${room.id}/schedule?*`, async (route) => {
    const url = new URL(route.request().url());
    const weekStart = url.searchParams.get('weekStart') ?? initialWeek;
    if (phase === 'initial') {
      await firstGate;
      await fulfill(route, schedule(weekStart));
    } else if (phase === 'error') {
      await fulfill(route, {
        error: {code: 'SERVICE_UNAVAILABLE', message: 'Schedule unavailable'},
      }, 503);
    } else if (phase === 'recovered') {
      await fulfill(route, schedule(weekStart, [
        booking('Відновлений розклад', {}, weekStart),
      ]));
    } else {
      await fulfill(route, schedule(weekStart, [booking('Partial data', {
        startsAt: 'malformed',
      }, weekStart)]));
    }
  });

  await page.goto(scheduleUrl());
  const loading = page.locator('.schedule-loading-overlay')
    .getByRole('status', {name: 'Завантажуємо розклад'});
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute('aria-live', 'polite');
  releaseFirst?.();
  const empty = page.locator('.empty-schedule-note');
  await expect(empty).toHaveAttribute('role', 'status');
  await expect(empty).toContainText('Немає бронювань цього дня');

  phase = 'error';
  await page.getByRole('button', {name: 'Наступний день'}).click();
  const alert = scheduleMessage(page, 'Розклад недоступний');
  await expect(alert).toContainText(
    'Сервіс тимчасово недоступний. Спробуйте ще раз.',
  );
  await expect(page.locator('.room-meta strong')).toHaveText(room.name);
  await expect(page.getByText('Schedule unavailable')).toHaveCount(0);
  const retry = page.getByRole('button', {
    name: 'Повторити завантаження розкладу',
  });
  phase = 'recovered';
  await tabTo(page, retry);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Відновлений розклад')).toBeVisible();
  await expect(alert).toHaveCount(0);

  phase = 'malformed';
  const recoveredWeek = DateTime.fromISO(initialWeek).plus({weeks: 1});
  const recoveredSunday = recoveredWeek.plus({days: 6}).toISODate() ?? '';
  await page.getByRole('combobox', {name: 'День'})
    .selectOption(recoveredSunday);
  await page.getByRole('button', {name: 'Наступний день'}).click();
  await expect(page.locator('.day-agenda-error[role="alert"]'))
    .toHaveText('Розклад недоступний.');
  await expect(page.getByText('Partial data')).toHaveCount(0);
  await expect(page.getByRole('list', {name: /Розклад на/})).toHaveCount(0);
});

test('@schedule room retry preserves usable schedule state independently', async ({
  page,
}) => {
  let roomRequests = 0;
  let scheduleRequests = 0;
  let releaseRooms: (() => void) | undefined;
  const roomsGate = new Promise<void>((resolve) => {
    releaseRooms = resolve;
  });
  await page.route('**/api/notifications', (route) =>
    fulfill(route, {data: []}));
  await page.route('**/api/rooms', async (route) => {
    roomRequests += 1;
    if (roomRequests === 1) {
      await fulfill(route, {
        error: {code: 'SERVICE_UNAVAILABLE', message: 'Rooms unavailable'},
      }, 503);
      return;
    }
    await roomsGate;
    await fulfill(route, {data: [room]});
  });
  await page.route(`**/api/rooms/${room.id}/schedule?*`, (route) => {
    scheduleRequests += 1;
    return fulfill(
      route,
      schedule(initialWeek, [booking('Збережений розклад кімнати')]),
    );
  });

  await page.goto(scheduleUrl());
  const alert = scheduleMessage(page, 'Переговорні недоступні');
  await expect(alert).toHaveAttribute('aria-live', 'assertive');
  await expect(alert).toContainText(
    'Сервіс тимчасово недоступний. Спробуйте ще раз.',
  );
  await expect(page.getByText('Rooms unavailable')).toHaveCount(0);
  await expect(page.getByText('Збережений розклад кімнати')).toBeVisible();

  const retry = page.getByRole('button', {
    name: 'Повторити завантаження переговорних',
  });
  const roomRequestsBeforeRetry = roomRequests;
  const scheduleRequestsBeforeRetry = scheduleRequests;
  await tabTo(page, retry);
  await page.keyboard.press('Enter');
  const loading = page.getByRole('status', {name: 'Завантажуємо переговорні'});
  await expect(loading).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.schedule-loading-overlay')
    .getByRole('status', {name: 'Завантажуємо розклад'}))
    .toHaveCount(0);
  await expect(page.getByText('Збережений розклад кімнати')).toBeVisible();
  expect(roomRequests).toBe(roomRequestsBeforeRetry + 1);
  expect(scheduleRequests).toBe(scheduleRequestsBeforeRetry);

  releaseRooms?.();
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('button', {
    name: 'Відкрити фільтри переговорних',
  })).toBeFocused();
  await expect(page.getByText('Збережений розклад кімнати')).toBeVisible();
  expect(roomRequests).toBe(roomRequestsBeforeRetry + 1);
  expect(scheduleRequests).toBe(scheduleRequestsBeforeRetry);
});

test('@schedule preserved conflict refresh exposes progress', async ({page}) => {
  await mockCommon(page);
  const retainedTitle = 'Збережене бронювання';
  let releaseRefresh: (() => void) | undefined;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  let markRefreshRequested: (() => void) | undefined;
  const refreshRequested = new Promise<void>((resolve) => {
    markRefreshRequested = resolve;
  });
  let conflictReturned = false;
  await page.route(`**/api/rooms/${room.id}/schedule?*`, async (route) => {
    if (!conflictReturned) {
      await fulfill(route, schedule(initialWeek, [booking(retainedTitle)]));
    } else {
      markRefreshRequested?.();
      await refreshGate;
      await fulfill(route, schedule(initialWeek));
    }
  });
  await page.route('**/api/bookings', (route) => {
    conflictReturned = true;
    return fulfill(route, {
      error: {code: 'BOOKING_CONFLICT', message: 'Conflict'},
    }, 409);
  });

  await page.goto(scheduleUrl());
  await expect(page.getByText(retainedTitle)).toBeVisible();
  await firstAvailableSlot(page).click();
  const dialog = page.getByRole('dialog', {name: /Бронювання:/});
  const title = dialog.getByLabel('Назва');
  await title.fill('Чернетка під час оновлення');
  await dialog.getByRole('button', {name: 'Забронювати'}).click();
  await refreshRequested;

  const overlay = page.locator('.schedule-loading-overlay');
  const loadingStatus = overlay.locator('.spinner[role="status"]');
  await expect(overlay).toBeVisible();
  await expect(loadingStatus).toHaveAttribute(
    'aria-label',
    'Завантажуємо розклад',
  );
  await expect(loadingStatus).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByText(retainedTitle)).toBeVisible();
  await expect(dialog.locator('form')).toHaveAttribute('aria-busy', 'true');
  await expect(title).toHaveValue('Чернетка під час оновлення');
  releaseRefresh?.();
  await expect(page.getByText(retainedTitle)).toHaveCount(0);
  await expect(loadingStatus).toHaveCount(0);
  await expect(dialog.locator('form')).not.toHaveAttribute('aria-busy', 'true');
  await expect(title).toHaveValue('Чернетка під час оновлення');
  await expect(dialog.getByRole('button', {name: 'Забронювати'})).toBeEnabled();
});

test('@booking conflict retry retains the draft and recovers independently', async ({
  page,
}) => {
  await mockCommon(page);
  let refreshPhase: 'initial' | 'failed' | 'recovered' = 'initial';
  await page.route(`**/api/rooms/${room.id}/schedule?*`, async (route) => {
    if (refreshPhase === 'initial' || refreshPhase === 'recovered') {
      await fulfill(route, schedule(initialWeek));
    } else {
      await fulfill(route, {
        error: {code: 'SERVICE_UNAVAILABLE', message: 'Refresh failed'},
      }, 503);
    }
  });
  await page.route('**/api/bookings', (route) => {
    refreshPhase = 'failed';
    return fulfill(route, {
      error: {code: 'BOOKING_CONFLICT', message: 'Conflict'},
    }, 409);
  });

  await page.goto(scheduleUrl());
  await firstAvailableSlot(page).click();
  const dialog = page.getByRole('dialog', {name: /Бронювання:/});
  await expect(dialog).toBeVisible();
  const title = dialog.getByLabel('Назва');
  await title.fill('Чернетка конфлікту');
  await dialog.getByRole('button', {name: 'Забронювати'}).click();

  await expect(dialog.getByRole('alert')).toHaveText(
    'Не вдалося оновити доступність.',
  );
  await expect(title).toHaveValue('Чернетка конфлікту');
  await expect(page.getByText('Refresh failed')).toHaveCount(0);
  const retry = dialog.getByRole('button', {name: 'Оновити доступність'});
  refreshPhase = 'recovered';
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
  let conflictReturned = false;
  await page.route(`**/api/rooms/${room.id}/schedule?*`, async (route) => {
    await fulfill(
      route,
      !conflictReturned ?
        schedule(initialWeek) :
        schedule(initialWeek, [booking('Вже зайнято', {
          author: {id: 'other', name: 'Інший користувач'},
          isOwn: false,
      })]),
    );
  });
  await page.route('**/api/bookings', (route) => {
    conflictReturned = true;
    return fulfill(route, {
      error: {code: 'BOOKING_CONFLICT', message: 'Conflict'},
    }, 409);
  });

  await page.goto(scheduleUrl());
  await firstAvailableSlot(page).click();
  const dialog = page.getByRole('dialog', {name: /Бронювання:/});
  await expect(dialog).toBeVisible();
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
  const failedCancellation = booking(title);
  const cancel = page.locator(
    `[data-booking-id="${failedCancellation.id}"]`,
  ).getByRole('button', {name: 'Скасувати'});
  await expect(cancel).toBeVisible();
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

test('@notifications mobile modal contains focus and restores its bell', async ({
  page,
}) => {
  await page.route('**/api/rooms', (route) =>
    fulfill(route, {data: [room]}));
  await page.route(`**/api/rooms/${room.id}/schedule?*`, (route) =>
    fulfill(route, schedule(initialWeek)));
  await page.route('**/api/notifications', (route) =>
    route.request().method() === 'POST' ?
      route.fulfill({status: 204}) :
      fulfill(route, {
        data: [{
          currentTitle: 'Планування',
          endsAt: `${selectedDay}T10:00:00+03:00`,
          id: 'notification-focus',
          nextAuthorName: 'Олена',
          roomName: room.name,
        }],
      }));
  await page.goto(scheduleUrl());

  const bell = page.getByRole('button', {name: /Сповіщення, \d+ нових/});
  await tabTo(page, bell);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', {name: 'Сповіщення'});
  const close = dialog.getByRole('button', {name: 'Закрити сповіщення'});
  const dismiss = dialog.getByRole('button', {
    name: 'Відхилити сповіщення',
  });
  await expect(close).toBeFocused();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
  await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'aria-hidden',
    'true',
  );

  await page.keyboard.press('Tab');
  await expect(dismiss).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dismiss).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(dialog).toHaveCount(0);
  await expect(bell).toBeFocused();
  await expect(page.locator('.app-shell')).not.toHaveAttribute('inert', '');
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
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
