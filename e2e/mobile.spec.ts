import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {DateTime} from 'luxon';
import {
  DEMO_USER,
  expect,
  officeMonday,
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

test('@mobile @critical creates and cancels a booking in the daily workflow', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Pine');
  const weekStart = officeMonday(1);
  const selectedDay = DateTime.fromISO(weekStart).plus({days: 1});
  const title = `${TASK_12_BOOKING_PREFIX}mobile-flow`;

  await page.goto('/schedule');
  await page.getByRole('button', {
    name: 'Відкрити фільтри переговорних',
  }).click();
  const roomFilters = page.getByRole('dialog', {
    name: 'Фільтри переговорних',
  });
  await roomFilters.getByRole('combobox', {name: 'Переговорна'})
    .selectOption({label: 'Pine, 8 місць'});
  await roomFilters.getByRole('button', {name: 'Закрити діалог'}).click();
  await page.getByLabel('День', {exact: true})
    .selectOption(selectedDay.toISODate() ?? '');
  await expect(page).toHaveURL(new RegExp(
    `roomId=${room.id}.*weekStart=${weekStart}.*day=` +
    `${selectedDay.toISODate()}`,
  ));

  await page.getByRole('button', {
    name: /Забронювати.*10:00/i,
  }).click();
  const dialog = page.getByRole('dialog', {name: 'Бронювання: Pine'});
  await expect(dialog.getByText('10:00-10:30', {exact: false})).toBeVisible();
  await dialog.getByLabel('Час завершення').selectOption({index: 3});
  await expect(dialog.getByText('10:00-12:00', {exact: false})).toBeVisible();
  await dialog.getByLabel('Назва').fill(title);
  const createRequest = page.waitForRequest((request) =>
    request.url().endsWith('/api/bookings') &&
    request.method() === 'POST',
  );
  await dialog.getByRole('button', {name: 'Забронювати'}).click();
  const createPayload = (await createRequest).postDataJSON() as {
    endsAt: string;
    startsAt: string;
  };
  expect(createPayload.startsAt).toBe(
    officeSlot(weekStart, 1, 10).toUTC().toISO(),
  );
  expect(createPayload.endsAt).toBe(
    officeSlot(weekStart, 1, 12).toUTC().toISO(),
  );

  await expect(
    page.getByRole('status').filter({hasText: 'Бронювання створено'}),
  ).toBeVisible();
  const bookingBlock = page.locator('li[data-booking-id]', {hasText: title});
  await expect(bookingBlock).toBeVisible();
  await expect(bookingBlock).toContainText('10:00-12:00');
  const booking = await database.booking.findFirstOrThrow({where: {title}});
  expect(booking.endsAt.toISOString()).toBe(
    officeSlot(weekStart, 1, 12).toUTC().toISO(),
  );
  const createdBlockLayout = await bookingBlock.evaluate((bookingElement) => {
    const bookingRect = bookingElement.getBoundingClientRect();
    const detailsRect = bookingElement
      .querySelector('.day-agenda-details')
      ?.getBoundingClientRect();
    const cancelRect = bookingElement
      .querySelector('.day-agenda-cancel')
      ?.getBoundingClientRect();
    return {
      bookingContainedInViewport:
        bookingRect.left >= 0 &&
        bookingRect.right <= window.innerWidth + 0.5,
      bookingContentContained: Boolean(
        detailsRect &&
        cancelRect &&
        detailsRect.left >= bookingRect.left &&
        detailsRect.right <= bookingRect.right + 0.5 &&
        detailsRect.bottom <= bookingRect.bottom + 0.5 &&
        cancelRect.left >= bookingRect.left &&
        cancelRect.top >= bookingRect.top &&
        cancelRect.right <= bookingRect.right + 0.5 &&
        cancelRect.bottom <= bookingRect.bottom + 0.5,
      ),
      horizontalOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });
  expect(createdBlockLayout).toEqual({
    bookingContainedInViewport: true,
    bookingContentContained: true,
    horizontalOverflow: 0,
  });
  await page.screenshot({
    fullPage: true,
    path: resolve(artifactsDirectory, 'mobile-booking-created.png'),
  });

  const row = page.locator(`[data-booking-id="${booking.id}"]`);
  await row.getByRole('button', {name: 'Скасувати'}).click();
  const cancellationDialog =
    page.getByRole('dialog', {name: 'Скасувати бронювання'});
  await cancellationDialog
    .getByRole('button', {name: 'Скасувати бронювання'})
    .click();

  await expect(page.locator(`[data-booking-id="${booking.id}"]`)).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({hasText: 'Бронювання скасовано'}),
  ).toBeVisible();
  await expect(database.booking.findUniqueOrThrow({where: {id: booking.id}}))
    .resolves.toMatchObject({cancelledAt: expect.any(Date)});
});

test('@mobile daily schedule has stable geometry and reachable controls', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);
  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}&day=${weekStart}`,
  );

  await expect(page.getByRole('list', {name: /Розклад на/})).toHaveCount(1);
  const layout = await page.evaluate(() => {
    const board = document.querySelector<HTMLElement>('.day-agenda');
    const controls = Array.from(document.querySelectorAll<HTMLElement>(
      '.schedule-jump-controls button, .schedule-jump-controls select',
    ));
    const firstItem = board?.querySelector('li');
    const boardRect = board?.getBoundingClientRect();
    return {
      firstItemTop: firstItem?.getBoundingClientRect().top ?? Infinity,
      boardWithinViewport: Boolean(
        boardRect &&
        boardRect.left >= 0 &&
        boardRect.right <= window.innerWidth + 0.5,
      ),
      controlsReachable: controls.length === 3 && controls.every((control) => {
        const rect = control.getBoundingClientRect();
        return (
          rect.width >= 40 &&
          rect.height >= 40 &&
          rect.left >= 0 &&
          rect.right <= window.innerWidth + 0.5
        );
      }),
      horizontalOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });
  expect(layout).toEqual({
    firstItemTop: expect.any(Number),
    boardWithinViewport: true,
    controlsReachable: true,
    horizontalOverflow: 0,
  });
  expect(layout.firstItemTop).toBeLessThanOrEqual(296);

  await page.screenshot({
    fullPage: true,
    path: resolve(artifactsDirectory, 'mobile-daily-layout.png'),
  });
});

test('@mobile room week and day URL state restores through back navigation', async ({
  database,
  page,
}) => {
  const oak = await roomByName(database, 'Oak');
  const pine = await roomByName(database, 'Pine');
  const firstWeek = officeMonday(1);
  const firstDay = firstWeek;
  const secondDay = DateTime.fromISO(firstWeek)
    .plus({days: 1})
    .toISODate() ?? '';
  const secondWeek = officeMonday(2);
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: DEMO_USER.email},
  });
  const highlightedId = `${TASK_12_BOOKING_PREFIX}history-highlight`;
  const highlightedTitle = `${TASK_12_BOOKING_PREFIX}history-highlight`;
  const highlightedStart = officeSlot(firstWeek, 0, 10);
  await database.booking.create({
    data: {
      id: highlightedId,
      roomId: oak.id,
      userId: organizer.id,
      title: highlightedTitle,
      startsAt: highlightedStart.toUTC().toJSDate(),
      endsAt: highlightedStart.plus({minutes: 30}).toUTC().toJSDate(),
    },
  });

  await page.goto(
    `/schedule?roomId=${oak.id}&weekStart=${firstWeek}&day=${firstDay}` +
    `&bookingId=${highlightedId}`,
  );
  await expect(page.locator(`[data-booking-id="${highlightedId}"]`))
    .toHaveClass(/day-agenda-highlighted/);
  await page.getByRole('button', {
    name: 'Відкрити фільтри переговорних',
  }).click();
  const roomFilters = page.getByRole('dialog', {
    name: 'Фільтри переговорних',
  });
  await roomFilters.getByRole('combobox', {name: 'Переговорна'})
    .selectOption({label: 'Pine, 8 місць'});
  await roomFilters.getByRole('button', {name: 'Закрити діалог'}).click();
  await expect(page).toHaveURL(new RegExp(`roomId=${pine.id}`));

  await page.getByLabel('День', {exact: true}).selectOption(secondDay);
  await expect(page).toHaveURL(new RegExp(`day=${secondDay}`));

  await page.getByRole('button', {name: 'Наступний тиждень'}).click();
  await expect(page).toHaveURL(new RegExp(
    `roomId=${pine.id}.*weekStart=${secondWeek}.*day=${secondWeek}`,
  ));

  await page.goBack();
  await expect(page.getByLabel('День', {exact: true})).toHaveValue(secondDay);
  await expect(page).toHaveURL(new RegExp(
    `roomId=${pine.id}.*weekStart=${firstWeek}.*day=${secondDay}`,
  ));

  await page.goBack();
  await expect(page.getByLabel('День', {exact: true})).toHaveValue(firstDay);
  await expect(page.locator('.room-meta strong')).toHaveText('Pine');

  await page.goBack();
  await expect(page.locator('.room-meta strong')).toHaveText('Oak');
  await expect(page.getByLabel('День', {exact: true})).toHaveValue(firstDay);
  await expect(page).toHaveURL(new RegExp(`bookingId=${highlightedId}`));
  await expect(page.locator(`[data-booking-id="${highlightedId}"]`))
    .toHaveClass(/day-agenda-highlighted/);

  await page.goForward();
  await expect(page.locator('.room-meta strong')).toHaveText('Pine');
  await expect(page.getByLabel('День', {exact: true})).toHaveValue(firstDay);
  await expect(page).not.toHaveURL(/bookingId=/);

  await page.goForward();
  await expect(page.getByLabel('День', {exact: true})).toHaveValue(secondDay);
  await expect(page).toHaveURL(new RegExp(
    `roomId=${pine.id}.*weekStart=${firstWeek}.*day=${secondDay}`,
  ));

  await page.goForward();
  await expect(page.getByLabel('День', {exact: true})).toHaveValue(secondWeek);
  await expect(page).toHaveURL(new RegExp(
    `roomId=${pine.id}.*weekStart=${secondWeek}.*day=${secondWeek}`,
  ));
});

test('@mobile popstate rejects a delayed old room/week response', async ({
  database,
  page,
}) => {
  const oak = await roomByName(database, 'Oak');
  const firstWeek = officeMonday(1);
  const secondDay = officeSlot(firstWeek, 1, 9).toISODate() ?? '';
  const secondWeek = officeMonday(2);
  const staleTitle = `${TASK_12_BOOKING_PREFIX}stale-popstate`;
  let releaseStaleResponse: (() => void) | undefined;
  let markStaleRequested: (() => void) | undefined;
  const staleResponseGate = new Promise<void>((resolveGate) => {
    releaseStaleResponse = resolveGate;
  });
  const staleRequested = new Promise<void>((resolveRequest) => {
    markStaleRequested = resolveRequest;
  });
  let staleRouteSettled: Promise<void> | undefined;

  await page.route('**/api/rooms/*/schedule?*', async (route) => {
    const url = new URL(route.request().url());
    if (
      url.pathname === `/api/rooms/${oak.id}/schedule` &&
      url.searchParams.get('weekStart') === secondWeek
    ) {
      const settle = (async () => {
        const response = await route.fetch();
        const body = await response.json() as {
          data: {
            bookings: unknown[];
          };
        };
        body.data.bookings = [{
          id: staleTitle,
          title: staleTitle,
          startsAt: officeSlot(secondWeek, 1, 10).toUTC().toISO(),
          endsAt: officeSlot(secondWeek, 1, 10, 30).toUTC().toISO(),
          author: {id: 'stale-user', name: 'Stale User'},
          isOwn: false,
        }];
        markStaleRequested?.();
        await staleResponseGate;
        try {
          await route.fulfill({response, json: body});
        } catch {
          // The browser may finish aborting the superseded request first.
        }
      })();
      staleRouteSettled = settle;
      await settle;
      return;
    }
    await route.continue();
  });

  await page.goto(
    `/schedule?roomId=${oak.id}&weekStart=${firstWeek}&day=${firstWeek}`,
  );
  await expect(page.getByRole('list', {name: /Розклад на/})).toHaveCount(1);
  await page.getByLabel('День', {exact: true}).selectOption(secondDay);
  await expect(page).toHaveURL(new RegExp(
    `roomId=${oak.id}.*weekStart=${firstWeek}.*day=${secondDay}`,
  ));
  await page.getByRole('button', {name: 'Наступний тиждень'}).click();
  await expect(page).toHaveURL(new RegExp(
    `roomId=${oak.id}.*weekStart=${secondWeek}.*day=${secondWeek}`,
  ));
  await staleRequested;

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(
    `roomId=${oak.id}.*weekStart=${firstWeek}.*day=${secondDay}`,
  ));
  await expect(page.getByLabel('День', {exact: true})).toHaveValue(secondDay);

  releaseStaleResponse?.();
  await staleRouteSettled;
  await expect(page.getByText(staleTitle)).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(
    `roomId=${oak.id}.*weekStart=${firstWeek}.*day=${secondDay}`,
  ));
});
