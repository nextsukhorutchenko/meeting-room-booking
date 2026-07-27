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
  await page.getByRole('combobox', {name: 'Room'})
    .selectOption({label: 'Pine, 8 people'});
  await page.getByLabel('Day', {exact: true})
    .fill(selectedDay.toISODate() ?? '');
  await expect(page).toHaveURL(new RegExp(
    `roomId=${room.id}.*weekStart=${weekStart}.*day=` +
    `${selectedDay.toISODate()}`,
  ));

  await page.getByRole('button', {
    name: /Book Tuesday.*10:00/i,
  }).click();
  const dialog = page.getByRole('dialog', {name: 'Book Pine'});
  await dialog.getByLabel('Title').fill(title);
  const createRequest = page.waitForRequest((request) =>
    request.url().endsWith('/api/bookings') &&
    request.method() === 'POST',
  );
  await dialog.getByRole('button', {name: 'Create booking'}).click();
  const createPayload = (await createRequest).postDataJSON() as {
    endsAt: string;
    startsAt: string;
  };
  expect(createPayload.startsAt).toMatch(/Z$/);
  expect(createPayload.endsAt).toMatch(/Z$/);

  await expect(
    page.getByRole('status').filter({hasText: 'Booking created'}),
  ).toBeVisible();
  await expect(page.getByRole('article', {name: new RegExp(title)}))
    .toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: resolve(artifactsDirectory, 'mobile-booking-created.png'),
  });

  await page.getByRole('link', {name: 'My Bookings'}).click();
  const booking = await database.booking.findFirstOrThrow({where: {title}});
  const row = page.locator(`[data-booking-id="${booking.id}"]`);
  await expect(row).toBeVisible();
  await row.getByRole('button', {name: `Cancel ${title}`}).click();
  const cancellationDialog =
    page.getByRole('dialog', {name: 'Cancel booking'});
  await cancellationDialog
    .getByRole('button', {name: 'Cancel booking'})
    .click();

  await expect(row).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({hasText: 'Booking cancelled'}),
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

  await expect(page.getByRole('grid', {name: 'Daily room schedule'}))
    .toBeVisible();
  await expect(page.getByRole('grid', {name: 'Weekly room schedule'}))
    .toBeHidden();
  const layout = await page.evaluate(() => {
    const board = document.querySelector<HTMLElement>('.day-schedule');
    const controls = Array.from(document.querySelectorAll<HTMLElement>(
      '.mobile-day-controls button, .mobile-day-controls input',
    ));
    const bookingColumns = document.querySelectorAll(
      '.day-schedule [data-testid="day-schedule-day-column"]',
    );
    const boardRect = board?.getBoundingClientRect();
    return {
      boardHeight: boardRect?.height ?? 0,
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
      dayColumnCount: bookingColumns.length,
      horizontalOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });
  expect(layout).toEqual({
    boardHeight: 774,
    boardWithinViewport: true,
    controlsReachable: true,
    dayColumnCount: 1,
    horizontalOverflow: 0,
  });

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
  await expect(page.getByRole('article', {name: new RegExp(highlightedTitle)}))
    .toHaveAttribute('data-highlighted', 'true');
  await page.getByRole('combobox', {name: 'Room'})
    .selectOption({label: 'Pine, 8 people'});
  await expect(page).toHaveURL(new RegExp(`roomId=${pine.id}`));

  await page.getByRole('button', {name: 'Next day'}).click();
  await expect(page).toHaveURL(new RegExp(`day=${secondDay}`));

  await page.getByLabel('Day', {exact: true}).fill(secondWeek);
  await expect(page).toHaveURL(new RegExp(
    `roomId=${pine.id}.*weekStart=${secondWeek}.*day=${secondWeek}`,
  ));

  await page.goBack();
  await expect(page.getByLabel('Day', {exact: true})).toHaveValue(secondDay);
  await expect(page).toHaveURL(new RegExp(
    `roomId=${pine.id}.*weekStart=${firstWeek}.*day=${secondDay}`,
  ));

  await page.goBack();
  await expect(page.getByLabel('Day', {exact: true})).toHaveValue(firstDay);
  await expect(page.getByRole('combobox', {name: 'Room'}))
    .toHaveValue(pine.id);

  await page.goBack();
  await expect(page.getByRole('combobox', {name: 'Room'}))
    .toHaveValue(oak.id);
  await expect(page.getByLabel('Day', {exact: true})).toHaveValue(firstDay);
  await expect(page).toHaveURL(new RegExp(`bookingId=${highlightedId}`));
  await expect(page.getByRole('article', {name: new RegExp(highlightedTitle)}))
    .toHaveAttribute('data-highlighted', 'true');

  await page.goForward();
  await expect(page.getByRole('combobox', {name: 'Room'}))
    .toHaveValue(pine.id);
  await expect(page.getByLabel('Day', {exact: true})).toHaveValue(firstDay);
  await expect(page).not.toHaveURL(/bookingId=/);

  await page.goForward();
  await expect(page.getByLabel('Day', {exact: true})).toHaveValue(secondDay);
  await expect(page).toHaveURL(new RegExp(
    `roomId=${pine.id}.*weekStart=${firstWeek}.*day=${secondDay}`,
  ));

  await page.goForward();
  await expect(page.getByLabel('Day', {exact: true})).toHaveValue(secondWeek);
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
  await expect(page.getByRole('grid', {name: 'Daily room schedule'}))
    .toBeVisible();
  await page.getByRole('button', {name: 'Next day'}).click();
  await expect(page).toHaveURL(new RegExp(
    `roomId=${oak.id}.*weekStart=${firstWeek}.*day=${secondDay}`,
  ));
  await page.getByLabel('Day', {exact: true}).fill(secondWeek);
  await expect(page).toHaveURL(new RegExp(
    `roomId=${oak.id}.*weekStart=${secondWeek}.*day=${secondWeek}`,
  ));
  await staleRequested;

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(
    `roomId=${oak.id}.*weekStart=${firstWeek}.*day=${secondDay}`,
  ));
  await expect(page.getByLabel('Day', {exact: true})).toHaveValue(secondDay);

  releaseStaleResponse?.();
  await staleRouteSettled;
  await expect(page.getByText(staleTitle)).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(
    `roomId=${oak.id}.*weekStart=${firstWeek}.*day=${secondDay}`,
  ));
});
