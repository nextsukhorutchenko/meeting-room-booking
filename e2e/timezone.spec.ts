import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
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

test('@timezone @critical creates an exact browser-zone booking', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: DEMO_USER.email},
  });
  const weekStart = officeMonday(1);
  const day = officeSlot(weekStart, 1, 10);
  const title = `${TASK_12_BOOKING_PREFIX}timezone-display`;
  const createdTitle = `${TASK_12_BOOKING_PREFIX}timezone-create`;
  await database.booking.create({
    data: {
      endsAt: day.plus({minutes: 30}).toUTC().toJSDate(),
      roomId: room.id,
      startsAt: day.toUTC().toJSDate(),
      title,
      userId: organizer.id,
    },
  });

  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}` +
    `&day=${day.toISODate()}`,
  );
  await expect(page.getByLabel('День', {exact: true})).toBeVisible();
  const browserTimeZone = await page.evaluate(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  if (testInfo.project.name === 'desktop-new-york') {
    expect(browserTimeZone).toBe('America/New_York');
  } else {
    expect(['Europe/Kyiv', 'Europe/Kiev']).toContain(browserTimeZone);
  }

  const expectedStart = day.setZone(browserTimeZone).toFormat('HH:mm');
  const expectedEnd = day
    .plus({minutes: 30})
    .setZone(browserTimeZone)
    .toFormat('HH:mm');
  const booking = page.getByRole('button', {name: new RegExp(title)});
  await expect(booking).toContainText(`${expectedStart}-${expectedEnd}`);
  await expect(page.getByTestId('timezone-notice'))
    .toContainText('Europe/Kyiv');
  await expect(page.getByTestId('timezone-notice'))
    .not.toContainText(/GMT[+-]/);

  const nextSlot = day.plus({hours: 1});
  const nextSlotLabel = nextSlot.setZone(browserTimeZone).toFormat('HH:mm');
  const nextSlotEndLabel = nextSlot
    .plus({minutes: 30})
    .setZone(browserTimeZone)
    .toFormat('HH:mm');
  const expectedStartsAt = nextSlot.toUTC().toISO();
  const expectedEndsAt = nextSlot.plus({minutes: 30}).toUTC().toISO();
  type CreatePayload = {
    endsAt: string;
    roomId: string;
    startsAt: string;
    title: string;
  };
  let resolveCreatePayload:
    ((payload: CreatePayload) => void) | undefined;
  const createPayload = new Promise<CreatePayload>(
    (resolvePayload) => {
      resolveCreatePayload = resolvePayload;
    },
  );
  await page.route('**/api/bookings', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as {
        endsAt: string;
        roomId: string;
        startsAt: string;
        title: string;
      };
      resolveCreatePayload?.(payload);
    }
    await route.continue();
  });
  await page.getByRole('button', {
    name: new RegExp(`Забронювати.*${nextSlotLabel}`, 'i'),
  }).click();
  const dialog = page.getByRole('dialog', {name: 'Бронювання: Oak'});
  await expect(dialog).toContainText(
    `${nextSlotLabel}-${nextSlotEndLabel}`,
  );
  await dialog.getByLabel('Назва').fill(createdTitle);
  await dialog.getByRole('button', {name: 'Забронювати'}).click();
  await expect(createPayload).resolves.toEqual({
    endsAt: expectedEndsAt,
    roomId: room.id,
    startsAt: expectedStartsAt,
    title: createdTitle,
  });
  await expect(
    page.getByRole('status').filter({hasText: 'Бронювання створено'}),
  ).toBeVisible();
  const createdBooking = page.getByRole('button', {name: new RegExp(createdTitle)});
  await expect(createdBooking)
    .toContainText(`${nextSlotLabel}-${nextSlotEndLabel}`);
  const persistedBooking =
    await database.booking.findFirstOrThrow({where: {title: createdTitle}});
  expect(persistedBooking.startsAt.toISOString()).toBe(expectedStartsAt);
  expect(persistedBooking.endsAt.toISOString()).toBe(expectedEndsAt);
  await page.screenshot({
    fullPage: true,
    path: resolve(
      artifactsDirectory,
      `${testInfo.project.name}-schedule.png`,
    ),
  });

  await page.getByRole('link', {name: 'Мої бронювання'}).click();
  const row = page.locator(`[data-booking-id]`, {hasText: title});
  await expect(row).toContainText(`${expectedStart}-${expectedEnd}`);
  const createdRow =
    page.locator(`[data-booking-id="${persistedBooking.id}"]`);
  await expect(createdRow)
    .toContainText(`${nextSlotLabel}-${nextSlotEndLabel}`);

  await page.screenshot({
    fullPage: true,
    path: resolve(
      artifactsDirectory,
      `${testInfo.project.name}-my-bookings.png`,
    ),
  });
});

test('@timezone office-hours label follows browser/office zone difference', async ({
  database,
  page,
}, testInfo) => {
  const room = await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);
  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}` +
    `&day=${weekStart}`,
  );

  const officeHours = page.getByText(
    'Години офісу: 09:00–19:00 Europe/Kyiv',
    {exact: true},
  );
  if (testInfo.project.name === 'desktop-new-york') {
    await expect(officeHours).toBeVisible();
  } else {
    await expect(officeHours).toHaveCount(0);
  }
});

test('@timezone server rejects an instant outside Kyiv office hours', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const startsAt = officeSlot(officeMonday(1), 2, 8);
  await page.goto('/schedule');

  const response = await page.evaluate(async (data) => {
    const result = await fetch('/api/bookings', {
      body: JSON.stringify(data),
      headers: {'content-type': 'application/json'},
      method: 'POST',
    });
    return {
      body: await result.json() as unknown,
      status: result.status,
    };
  }, {
    endsAt: startsAt.plus({minutes: 30}).toUTC().toISO(),
    roomId: room.id,
    startsAt: startsAt.toUTC().toISO(),
    title: `${TASK_12_BOOKING_PREFIX}outside-office-hours`,
  });

  expect(response.status).toBe(422);
  expect(response.body).toMatchObject({
    error: {
      code: 'BOOKING_OUTSIDE_OFFICE_HOURS',
      message: 'Booking must be within office hours',
    },
  });
});
