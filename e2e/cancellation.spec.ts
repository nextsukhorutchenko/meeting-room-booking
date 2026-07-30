import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {Locator, Page} from '@playwright/test';
import {
  DEMO_USER,
  expect,
  officeMonday,
  officeSlot,
  roomByName,
  TASK_10_BOOKING_PREFIX,
  test,
} from './fixtures';

const artifactsDirectory = resolve(
  '.superpowers/sdd/2026-07-27-meeting-room-booking-implementation/' +
  'task-10-artifacts',
);
const nonModalBookingProjects = new Set(['expanded', 'medium']);

test.beforeAll(async () => {
  await mkdir(artifactsDirectory, {recursive: true});
});

function bookingDetailsSurface(page: Page, projectName: string): Locator {
  return nonModalBookingProjects.has(projectName) ?
    page.getByRole('region', {name: 'Деталі бронювання'}) :
    page.getByRole('dialog', {name: 'Деталі бронювання'});
}

async function openCancellationFromSchedule(
  page: Page,
  projectName: string,
  title: string,
): Promise<{
  bookingTrigger: Locator;
  cancelTrigger: Locator;
  detailsSurface: Locator;
  dialog: Locator;
}> {
  const bookingTrigger = page.getByRole('button', {name: new RegExp(title)});
  await expect(bookingTrigger).toBeVisible();
  await bookingTrigger.click();

  const detailsSurface = bookingDetailsSurface(page, projectName);
  await expect(detailsSurface).toBeVisible();
  const cancelTrigger = detailsSurface.getByRole('button', {
    exact: true,
    name: 'Скасувати бронювання',
  });
  await cancelTrigger.click();

  const dialog = page.getByRole('dialog', {name: 'Скасувати бронювання'});
  await expect(dialog).toBeVisible();
  return {bookingTrigger, cancelTrigger, detailsSurface, dialog};
}

async function expectBookingDetailsRestored(
  page: Page,
  projectName: string,
  detailsSurface: Locator,
  cancelTrigger: Locator,
): Promise<void> {
  await expect(detailsSurface).toBeVisible();
  await expect(cancelTrigger).toBeFocused();
  if (nonModalBookingProjects.has(projectName)) {
    await expect(detailsSurface).not.toHaveAttribute('aria-modal');
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
    await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');
    await expect(page.locator('.app-shell')).not.toHaveAttribute(
      'aria-hidden',
    );
  } else {
    await expect(detailsSurface).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
    await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
    await expect(page.locator('.app-shell')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  }
}

test('@booking @critical own booking exposes Cancel and confirmation is required', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: DEMO_USER.email},
  });
  const weekStart = officeMonday(1);
  const startsAt = officeSlot(weekStart, 1, 10);
  const title = `${TASK_10_BOOKING_PREFIX}confirmation-required`;
  const booking = await database.booking.create({
    data: {
      roomId: room.id,
      userId: organizer.id,
      title,
      startsAt: startsAt.toUTC().toJSDate(),
      endsAt: startsAt.plus({minutes: 30}).toUTC().toJSDate(),
    },
  });

  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}` +
    `&day=${startsAt.toISODate()}`,
  );
  const bookingTrigger = page.getByRole('button', {name: new RegExp(title)});
  await expect(bookingTrigger).toBeVisible();
  const bookingLayout = await bookingTrigger.evaluate((block) => {
    const blockRect = block.getBoundingClientRect();
    const contentRects = Array.from(block.children).map((child) =>
      child.getBoundingClientRect());
    return {
      blockContentContained: contentRects.length > 0 &&
        contentRects.every((rect) =>
          rect.left >= blockRect.left &&
          rect.right <= blockRect.right + 0.5 &&
          rect.top >= blockRect.top &&
          rect.bottom <= blockRect.bottom + 0.5),
      triggerHeight: blockRect.height,
      triggerWidth: blockRect.width,
    };
  });
  const {
    cancelTrigger,
    detailsSurface,
    dialog,
  } = await openCancellationFromSchedule(
    page,
    testInfo.project.name,
    title,
  );
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
  await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-hidden', 'true');
  await expect(dialog.getByRole('button', {name: 'Залишити бронювання'}))
    .toBeFocused();
  await expect(database.booking.findUniqueOrThrow({where: {id: booking.id}}))
    .resolves.toMatchObject({cancelledAt: null});

  const stableBooking = page.locator(`[data-booking-id="${booking.id}"]`);
  await expect(stableBooking).toBeVisible();
  const dialogLayout = await dialog.evaluate((dialogElement) => {
    const dialogRect = dialogElement.getBoundingClientRect();
    const actions = dialogElement.querySelector('.dialog-actions');
    const actionsRect = actions?.getBoundingClientRect();
    return {
      dialogContained:
        dialogRect.left >= 0 &&
        dialogRect.top >= 0 &&
        dialogRect.right <= window.innerWidth &&
        dialogRect.bottom <= window.innerHeight,
      dialogActionsContained: Boolean(
        actionsRect &&
        actionsRect.left >= dialogRect.left &&
        actionsRect.right <= dialogRect.right &&
        actionsRect.bottom <= dialogRect.bottom,
      ),
    };
  });
  const horizontalOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth -
      document.documentElement.clientWidth);
  const layout = {
    ...bookingLayout,
    ...dialogLayout,
    horizontalOverflow,
  };
  expect(layout).toEqual({
    blockContentContained: true,
    triggerHeight: expect.any(Number),
    triggerWidth: expect.any(Number),
    dialogContained: true,
    dialogActionsContained: true,
    horizontalOverflow: 0,
  });
  expect(layout.triggerHeight).toBeGreaterThanOrEqual(44);
  expect(layout.triggerWidth).toBeGreaterThanOrEqual(44);
  await page.screenshot({
    path: resolve(artifactsDirectory, 'cancel-confirmation.png'),
  });

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expectBookingDetailsRestored(
    page,
    testInfo.project.name,
    detailsSurface,
    cancelTrigger,
  );

  await cancelTrigger.click();
  await dialog.getByRole('button', {name: 'Залишити бронювання'}).click();
  await expect(dialog).toBeHidden();
  await expectBookingDetailsRestored(
    page,
    testInfo.project.name,
    detailsSurface,
    cancelTrigger,
  );
  await expect(stableBooking).toBeVisible();
  await expect(database.booking.findUniqueOrThrow({where: {id: booking.id}}))
    .resolves.toMatchObject({cancelledAt: null});
});

test('@booking cancellation error closes to its exact trigger', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: DEMO_USER.email},
  });
  const weekStart = officeMonday(1);
  const startsAt = officeSlot(weekStart, 2, 13);
  const title = `${TASK_10_BOOKING_PREFIX}error-close`;
  const booking = await database.booking.create({
    data: {
      roomId: room.id,
      userId: organizer.id,
      title,
      startsAt: startsAt.toUTC().toJSDate(),
      endsAt: startsAt.plus({minutes: 30}).toUTC().toJSDate(),
    },
  });

  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}` +
    `&day=${startsAt.toISODate()}`,
  );
  await page.route(`**/api/bookings/${booking.id}`, async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({
        body: JSON.stringify({error: {message: 'Unable to cancel booking.'}}),
        contentType: 'application/json',
        status: 500,
      });
      return;
    }
    await route.continue();
  });

  const {
    cancelTrigger,
    detailsSurface,
    dialog,
  } = await openCancellationFromSchedule(
    page,
    testInfo.project.name,
    title,
  );
  await dialog.getByRole('button', {
    exact: true,
    name: 'Скасувати бронювання',
  }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Не вдалося скасувати бронювання. Спробуйте ще раз.',
  );

  await dialog.getByRole('button', {name: 'Закрити діалог'}).click();
  await expect(dialog).toBeHidden();
  await expectBookingDetailsRestored(
    page,
    testInfo.project.name,
    detailsSurface,
    cancelTrigger,
  );
});

test("@booking other user's booking has no cancellation command", async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const other = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: 'guest@example.test'},
  });
  const weekStart = officeMonday(1);
  const startsAt = officeSlot(weekStart, 2, 11);
  const title = `${TASK_10_BOOKING_PREFIX}other-user`;
  await database.booking.create({
    data: {
      roomId: room.id,
      userId: other.id,
      title,
      startsAt: startsAt.toUTC().toJSDate(),
      endsAt: startsAt.plus({minutes: 30}).toUTC().toJSDate(),
    },
  });

  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}` +
    `&day=${startsAt.toISODate()}`,
  );
  const block = page.getByRole('button', {name: new RegExp(title)});
  await expect(block).toBeVisible();
  await block.click();
  const detailsSurface = bookingDetailsSurface(page, testInfo.project.name);
  await expect(detailsSurface).toBeVisible();
  await expect(detailsSurface.getByRole('button', {
    exact: true,
    name: 'Скасувати бронювання',
  })).toHaveCount(0);
  await expect(page.getByRole('dialog', {
    name: 'Скасувати бронювання',
  })).toHaveCount(0);
});

test('@booking max-length unbroken cancellation title stays contained', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: DEMO_USER.email},
  });
  const weekStart = officeMonday(1);
  const startsAt = officeSlot(weekStart, 4, 15);
  const title = 'X'.repeat(100);
  await database.booking.create({
    data: {
      id: `${TASK_10_BOOKING_PREFIX}max-title`,
      roomId: room.id,
      userId: organizer.id,
      title,
      startsAt: startsAt.toUTC().toJSDate(),
      endsAt: startsAt.plus({minutes: 30}).toUTC().toJSDate(),
    },
  });

  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}` +
    `&day=${startsAt.toISODate()}`,
  );
  const {dialog} = await openCancellationFromSchedule(
    page,
    testInfo.project.name,
    title,
  );
  const layout = await dialog.evaluate((dialogElement) => {
    const panel = dialogElement as HTMLElement;
    const copy = panel.querySelector<HTMLElement>('.cancellation-dialog-copy');
    const titleElement = copy?.querySelector<HTMLElement>('strong');
    const actions = panel.querySelector<HTMLElement>('.dialog-actions');
    const panelRect = panel.getBoundingClientRect();
    const titleRect = titleElement?.getBoundingClientRect();
    const actionsRect = actions?.getBoundingClientRect();
    return {
      actionsContained: Boolean(
        actionsRect &&
        actionsRect.left >= panelRect.left &&
        actionsRect.right <= panelRect.right &&
        actionsRect.bottom <= panelRect.bottom,
      ),
      copyScrollContained: Boolean(
        copy && copy.scrollWidth <= copy.clientWidth + 1,
      ),
      documentHorizontalOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      titleRectContained: Boolean(
        titleRect &&
        titleRect.left >= panelRect.left &&
        titleRect.right <= panelRect.right,
      ),
      titleScrollContained: Boolean(
        titleElement &&
        titleElement.scrollWidth <= titleElement.clientWidth + 1,
      ),
    };
  });
  expect(layout).toEqual({
    actionsContained: true,
    copyScrollContained: true,
    documentHorizontalOverflow: 0,
    titleRectContained: true,
    titleScrollContained: true,
  });
  await page.screenshot({
    path: resolve(artifactsDirectory, 'cancel-max-title.png'),
  });
});

test('@booking success removes block, shows toast, and persists cancellation', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: DEMO_USER.email},
  });
  const weekStart = officeMonday(1);
  const startsAt = officeSlot(weekStart, 3, 14);
  const title = `${TASK_10_BOOKING_PREFIX}success`;
  const booking = await database.booking.create({
    data: {
      roomId: room.id,
      userId: organizer.id,
      title,
      startsAt: startsAt.toUTC().toJSDate(),
      endsAt: startsAt.plus({minutes: 30}).toUTC().toJSDate(),
    },
  });

  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}` +
    `&day=${startsAt.toISODate()}`,
  );
  const {
    dialog,
  } = await openCancellationFromSchedule(
    page,
    testInfo.project.name,
    title,
  );
  const stableBooking = page.locator(`[data-booking-id="${booking.id}"]`);
  await expect(stableBooking).toBeVisible();

  const cancellationResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/bookings/${booking.id}`) &&
    response.request().method() === 'DELETE' &&
    response.status() === 204,
  );
  const refreshedSchedule = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === `/api/rooms/${room.id}/schedule` &&
      url.searchParams.get('weekStart') === weekStart &&
      response.status() === 200;
  });
  await dialog
    .getByRole('button', {exact: true, name: 'Скасувати бронювання'})
    .click();
  await cancellationResponse;
  await refreshedSchedule;

  await expect(page.getByRole('dialog', {name: 'Скасувати бронювання'}))
    .toBeHidden();
  await expect(stableBooking).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({hasText: 'Бронювання скасовано'}),
  ).toBeVisible();
  await expect.poll(async () => {
    const persisted = await database.booking.findUnique({
      where: {id: booking.id},
    });
    return persisted?.cancelledAt?.toISOString() ?? null;
  }).not.toBeNull();
  await expect(database.booking.findUnique({where: {id: booking.id}}))
    .resolves.toMatchObject({
      id: booking.id,
      title,
      cancelledAt: expect.any(Date),
    });
});
