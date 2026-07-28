import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
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

test.beforeAll(async () => {
  await mkdir(artifactsDirectory, {recursive: true});
});

test('@booking @critical own booking exposes Cancel and confirmation is required', async ({
  database,
  page,
}) => {
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

  await page.goto(`/schedule?roomId=${room.id}&weekStart=${weekStart}`);
  const block = page.getByRole('article', {name: new RegExp(title)});
  await expect(block).toBeVisible();
  await block.getByRole('button', {name: `Cancel ${title}`}).click();

  const dialog = page.getByRole('dialog', {name: 'Cancel booking'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', {name: 'Keep booking'}))
    .toBeFocused();
  await expect(database.booking.findUniqueOrThrow({where: {id: booking.id}}))
    .resolves.toMatchObject({cancelledAt: null});

  const layout = await page.evaluate(() => {
    const block = document.querySelector('.booking-block');
    const dialog = document.querySelector('.dialog-panel');
    const title = block?.querySelector('strong');
    const metadata = block?.querySelector('.booking-block-meta');
    const cancel = block?.querySelector('.booking-cancel-button');
    const actions = dialog?.querySelector('.dialog-actions');
    const blockRect = block?.getBoundingClientRect();
    const dialogRect = dialog?.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    const metadataRect = metadata?.getBoundingClientRect();
    const cancelRect = cancel?.getBoundingClientRect();
    const actionsRect = actions?.getBoundingClientRect();
    return {
      blockContentContained: Boolean(
        blockRect &&
        titleRect &&
        metadataRect &&
        cancelRect &&
        titleRect.top >= blockRect.top &&
        metadataRect.bottom <= blockRect.bottom + 0.5 &&
        cancelRect.top >= blockRect.top &&
        cancelRect.right <= blockRect.right + 0.5 &&
        titleRect.right <= cancelRect.left + 0.5 &&
        metadataRect.right <= cancelRect.left + 0.5,
      ),
      dialogContained: Boolean(
        dialogRect &&
        dialogRect.left >= 0 &&
        dialogRect.top >= 0 &&
        dialogRect.right <= window.innerWidth &&
        dialogRect.bottom <= window.innerHeight,
      ),
      dialogActionsContained: Boolean(
        dialogRect &&
        actionsRect &&
        actionsRect.left >= dialogRect.left &&
        actionsRect.right <= dialogRect.right &&
        actionsRect.bottom <= dialogRect.bottom,
      ),
      horizontalOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      cancelHeight: cancelRect?.height ?? 0,
      cancelWidth: cancelRect?.width ?? 0,
    };
  });
  expect(layout).toEqual({
    blockContentContained: true,
    cancelHeight: expect.any(Number),
    cancelWidth: expect.any(Number),
    dialogContained: true,
    dialogActionsContained: true,
    horizontalOverflow: 0,
  });
  expect(layout.cancelHeight).toBeGreaterThanOrEqual(40);
  expect(layout.cancelWidth).toBeGreaterThanOrEqual(40);
  await page.screenshot({
    path: resolve(artifactsDirectory, 'cancel-confirmation.png'),
  });

  await dialog.getByRole('button', {name: 'Keep booking'}).click();
  await expect(dialog).toBeHidden();
  await expect(block).toBeVisible();
  await expect(database.booking.findUniqueOrThrow({where: {id: booking.id}}))
    .resolves.toMatchObject({cancelledAt: null});
});

test("@booking other user's booking has no cancellation command", async ({
  database,
  page,
}) => {
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

  await page.goto(`/schedule?roomId=${room.id}&weekStart=${weekStart}`);
  const block = page.getByRole('article', {name: new RegExp(title)});
  await expect(block).toBeVisible();
  await expect(block.getByRole('button', {name: /Cancel/i})).toHaveCount(0);
});

test('@booking max-length unbroken cancellation title stays contained', async ({
  database,
  page,
}) => {
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

  await page.goto(`/schedule?roomId=${room.id}&weekStart=${weekStart}`);
  const block = page.getByRole('article', {name: new RegExp(title)});
  await expect(block).toBeVisible();
  await block.getByRole('button', {name: `Cancel ${title}`}).click();

  const dialog = page.getByRole('dialog', {name: 'Cancel booking'});
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
}) => {
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

  await page.goto(`/schedule?roomId=${room.id}&weekStart=${weekStart}`);
  const block = page.getByRole('article', {name: new RegExp(title)});
  await expect(block).toBeVisible();
  await block.getByRole('button', {name: `Cancel ${title}`}).click();

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
  await page
    .getByRole('dialog', {name: 'Cancel booking'})
    .getByRole('button', {name: 'Cancel booking'})
    .click();
  await cancellationResponse;
  await refreshedSchedule;

  await expect(page.getByRole('dialog', {name: 'Cancel booking'})).toBeHidden();
  await expect(block).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({hasText: 'Booking cancelled'}),
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
