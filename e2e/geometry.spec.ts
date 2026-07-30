import {
  expect,
  officeMonday,
  officeSlot,
  roomByName,
  TASK_11_ROOM_PREFIX,
  test,
} from './fixtures';
import type {Locator, Page} from '@playwright/test';
import {DateTime} from 'luxon';

async function tabTo(page: Page, target: Locator, limit = 40): Promise<void> {
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }
  throw new Error('Keyboard traversal did not reach the geometry target.');
}

const expectedDays = new Map([
  ['expanded', 7],
  ['medium', 3],
  ['tablet', 2],
] as const);

test.use({timezoneId: 'America/Argentina/Buenos_Aires'});

test('@schedule @mobile responsive schedule geometry stays within its viewport', async ({
  database,
  page,
}, testInfo) => {
  const projectName = testInfo.project.name;
  const isAgenda = !expectedDays.has(
    projectName as 'expanded' | 'medium' | 'tablet',
  );
  const room = projectName === 'reflow' ?
    await database.room.create({
      data: {
        capacity: 18,
        floor: 12,
        name: TASK_11_ROOM_PREFIX +
          'Переговорна для міжнародних координаційних зустрічей',
        sortOrder: 999,
      },
    }) :
    await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);

  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}&day=${weekStart}`,
  );
  await expect(page.getByTestId('timezone-notice')).toContainText(
    'America/Argentina/Buenos_Aires',
  );
  await expect(page.getByTestId('timezone-notice')).toContainText(
    'Europe/Kyiv',
  );

  if (isAgenda) {
    const agenda = page.getByRole('list', {name: /Розклад на/});
    await expect(agenda).toHaveCount(1);
    await expect(page.getByRole('table')).toHaveCount(0);
    const firstAgendaItem = agenda.getByRole('listitem').first();
    await expect(firstAgendaItem).toBeVisible();
    expect((await firstAgendaItem.boundingBox())?.y)
      .toBeLessThanOrEqual(296);
  } else {
    const table = page.getByRole('table');
    const dayCount = expectedDays.get(
      projectName as 'expanded' | 'medium' | 'tablet',
    );
    await expect(table.getByRole('columnheader'))
      .toHaveCount((dayCount ?? 0) + 1);
    await expect(table.getByRole('rowheader')).toHaveCount(20);
    await expect(page.getByRole('grid')).toHaveCount(0);
  }

  const geometry = await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('.schedule-viewport');
    const bottomNavigation =
      document.querySelector<HTMLElement>('.bottom-nav');
    const main = document.querySelector<HTMLElement>('.app-shell-main');
    const navigationHeight =
      bottomNavigation?.getBoundingClientRect().height ?? 0;
    const mainBottomPadding = main ?
      Number.parseFloat(getComputedStyle(main).paddingBottom) :
      0;
    return {
      documentOverflow:
        document.documentElement.scrollWidth - innerWidth,
      safeAreaClearance: mainBottomPadding >= navigationHeight,
      viewportClientHeight: viewport?.clientHeight ?? 0,
      viewportScrollHeight: viewport?.scrollHeight ?? 0,
    };
  });

  expect(geometry.documentOverflow).toBeLessThanOrEqual(0);
  expect(geometry.safeAreaClearance).toBe(true);
  if (projectName === 'expanded') {
    const viewportBox = await page.locator('.schedule-viewport').boundingBox();
    const rows = page.getByRole('rowheader');
    const firstSlot = await rows.nth(0).boundingBox();
    const twelfthSlot = await rows.nth(11).boundingBox();
    expect(viewportBox).not.toBeNull();
    expect(firstSlot).not.toBeNull();
    expect(twelfthSlot).not.toBeNull();
    expect(
      (twelfthSlot?.y ?? 0) +
      (twelfthSlot?.height ?? 0) -
      (firstSlot?.y ?? 0),
    )
      .toBeGreaterThanOrEqual(624);
    expect(firstSlot?.y ?? -1).toBeGreaterThanOrEqual(viewportBox?.y ?? 0);
    expect(
      (twelfthSlot?.y ?? Number.POSITIVE_INFINITY) +
      (twelfthSlot?.height ?? 0),
    )
      .toBeLessThanOrEqual((viewportBox?.y ?? 0) + (viewportBox?.height ?? 0));
    expect(geometry.viewportScrollHeight)
      .toBeGreaterThan(geometry.viewportClientHeight);
  }
});

test('@booking booking surfaces retain one deterministic modal owner', async ({
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
  await slot.click();

  const compact = ['tablet', 'mobile-lg', 'mobile', 'reflow']
    .includes(testInfo.project.name);
  await expect(page.locator('[aria-modal="true"]'))
    .toHaveCount(compact ? 1 : 0);
  await expect(page.locator('[role="dialog"]'))
    .toHaveCount(compact ? 1 : 0);
  if (compact) {
    await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
    if (testInfo.project.name === 'reflow') {
      const panel = page.locator('.booking-surface-panel');
      const sheet = await panel.boundingBox();
      expect(sheet).toEqual({
        height: 800,
        width: 320,
        x: 0,
        y: 0,
      });
      const submit = panel.getByRole('button', {name: 'Забронювати'});
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeVisible();
      const submitBox = await submit.boundingBox();
      expect(
        (submitBox?.y ?? Number.POSITIVE_INFINITY) +
        (submitBox?.height ?? 0),
      )
        .toBeLessThanOrEqual(800);
    }
  } else {
    await expect(page.locator('.booking-surface-panel')).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
});

test('@schedule forced colors and reduced motion keep every state boundary visible', async ({
  database,
  page,
}, testInfo) => {
  await page.emulateMedia({
    forcedColors: 'active',
    reducedMotion: 'reduce',
  });
  const room = await roomByName(database, 'Oak');
  const currentWeek = officeMonday();
  const today = DateTime.now().setZone('Europe/Kyiv');
  const selectedDay = today.toFormat('yyyy-LL-dd');
  let rejectConflictRefresh = false;
  await page.route('**/api/rooms', (route) => route.fulfill({
    contentType: 'application/json',
    json: {data: [room]},
  }));
  await page.route('**/api/notifications', (route) => route.fulfill({
    contentType: 'application/json',
    json: {data: []},
  }));
  await page.route(`**/api/rooms/${room.id}/schedule?*`, (route) => {
    if (rejectConflictRefresh) {
      return route.fulfill({
        contentType: 'application/json',
        json: {error: {code: 'SERVICE_UNAVAILABLE'}},
        status: 503,
      });
    }
    const weekStart = new URL(route.request().url()).searchParams
      .get('weekStart') ?? currentWeek;
    const dayOffset = weekStart === currentWeek ? today.weekday - 1 : 0;
    const ownStart = officeSlot(weekStart, dayOffset, 9);
    const otherStart = officeSlot(weekStart, dayOffset, 10);
    const rangeStart = officeSlot(weekStart, 0, 0).startOf('day');
    return route.fulfill({
      contentType: 'application/json',
      json: {
        data: {
          bookings: [{
            author: {id: 'organizer', name: 'Demo Organizer'},
            endsAt: ownStart.plus({minutes: 30}).toUTC().toISO(),
            id: 'forced-own',
            isOwn: true,
            startsAt: ownStart.toUTC().toISO(),
            title: 'Власний стан',
          }, {
            author: {id: 'other', name: 'Інший користувач'},
            endsAt: otherStart.plus({minutes: 30}).toUTC().toISO(),
            id: 'forced-other',
            isOwn: false,
            startsAt: otherStart.toUTC().toISO(),
            title: 'Чужий стан',
          }],
          officeTimeZone: 'Europe/Kyiv',
          officeWeekStart: weekStart,
          range: {
            endsAt: rangeStart.plus({days: 7}).toUTC().toISO(),
            startsAt: rangeStart.toUTC().toISO(),
          },
          room,
        },
      },
    });
  });
  await page.route('**/api/bookings', (route) => {
    rejectConflictRefresh = true;
    return route.fulfill({
      contentType: 'application/json',
      json: {error: {code: 'BOOKING_CONFLICT'}},
      status: 409,
    });
  });
  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${currentWeek}` +
    `&day=${selectedDay}&bookingId=forced-own`,
  );

  const systemColors = await page.evaluate(() => {
    const probe = document.createElement('span');
    document.body.append(probe);
    const color = (value: string) => {
      probe.style.color = value;
      return getComputedStyle(probe).color;
    };
    const colors = {
      buttonText: color('ButtonText'),
      canvas: color('Canvas'),
      canvasText: color('CanvasText'),
      highlight: color('Highlight'),
    };
    probe.remove();
    return colors;
  });
  const stateStyles = (target: Locator) => target.evaluate((element) => {
    const computed = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      animationDuration: computed.animationDuration,
      backgroundColor: computed.backgroundColor,
      borderColor: computed.borderColor,
      borderLeftColor: computed.borderLeftColor,
      borderLeftStyle: computed.borderLeftStyle,
      borderStyle: computed.borderStyle,
      borderWidth: computed.borderWidth,
      color: computed.color,
      height: rect.height,
      outlineColor: computed.outlineColor,
      outlineStyle: computed.outlineStyle,
      outlineWidth: computed.outlineWidth,
      transform: computed.transform,
      transitionDuration: computed.transitionDuration,
      width: rect.width,
    };
  });

  const agenda = ['mobile-lg', 'mobile', 'reflow'].includes(
    testInfo.project.name,
  );
  const own = page.locator(
    agenda ? '.day-agenda-own' : '.booking-block.booking-own',
  );
  const other = page.locator(
    agenda ?
      '.day-agenda-busy:not(.day-agenda-own)' :
      '.booking-block:not(.booking-own)',
  );
  await expect(own).toContainText('Ваше');
  await expect(other).toContainText('Зайнято');
  await expect(own).toHaveAttribute(
    agenda ? 'data-booking-id' : 'aria-current',
    agenda ? 'forced-own' : 'true',
  );
  const ownStyles = await stateStyles(own);
  const otherStyles = await stateStyles(other);
  expect(ownStyles.backgroundColor).toBe(systemColors.canvas);
  expect(otherStyles.backgroundColor).toBe(systemColors.canvas);
  expect(ownStyles.color).toBe(systemColors.canvasText);
  expect(otherStyles.color).toBe(systemColors.canvasText);
  expect(ownStyles.borderLeftStyle).toBe('double');
  expect(otherStyles.borderLeftStyle).toBe('solid');
  expect([systemColors.buttonText, systemColors.canvasText])
    .toContain(ownStyles.borderLeftColor);
  expect(otherStyles.borderLeftColor).toBe(systemColors.canvasText);
  expect(ownStyles.outlineColor).toBe(systemColors.highlight);
  expect(ownStyles.outlineWidth).toBe('2px');

  const ownControl = agenda ? own.getByRole('button').first() : own;
  const otherControl = agenda ? other.getByRole('button').first() : other;
  for (const control of [ownControl, otherControl]) {
    await tabTo(page, control, 200);
    await expect(control).toBeFocused();
    const focusStyles = await stateStyles(control);
    expect(focusStyles.outlineColor).toBe(systemColors.highlight);
    expect(focusStyles.outlineStyle).toBe('solid');
    expect(focusStyles.outlineWidth).toBe('2px');
  }

  if (agenda) {
    const selectedDate = page.locator(
      '.schedule-date-button[aria-current="date"]',
    );
    await expect(selectedDate).toHaveAttribute('aria-current', 'date');
    expect((await stateStyles(selectedDate)).borderColor)
      .toBe(systemColors.highlight);
    await tabTo(page, selectedDate, 200);
    const focusStyles = await stateStyles(selectedDate);
    expect(focusStyles.outlineColor).toBe(systemColors.highlight);
    expect(focusStyles.outlineStyle).toBe('solid');
  } else {
    const current = page.locator('.timetable-current-day-marker');
    await expect(current).toHaveText('Сьогодні');
    expect((await stateStyles(current)).borderColor)
      .toBe(systemColors.canvasText);
  }

  const futureWeek = officeMonday(1);
  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${futureWeek}&day=${futureWeek}`,
  );
  const free = page.locator(
    '.free-slot-button:not([disabled]), .day-agenda-slot-button:not([disabled])',
  ).first();
  await free.click();
  const panel = page.locator('.booking-surface-panel');
  const panelBefore = await panel.boundingBox();
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  expect(await panel.boundingBox()).toEqual(panelBefore);
  const panelStyles = await stateStyles(panel);
  expect(panelStyles.animationDuration).toBe('0s');
  expect(panelStyles.transitionDuration).toBe('0s');
  expect(panelStyles.transform).toBe('none');
  expect(panelStyles.borderColor).toBe(systemColors.canvasText);
  expect(panelStyles.backgroundColor).toBe(systemColors.canvas);

  const submit = panel.getByRole('button', {name: 'Забронювати'});
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  const title = panel.getByLabel('Назва');
  await expect(title).toHaveAttribute('aria-invalid', 'true');
  await expect(title).toBeFocused();
  const invalidStyles = await stateStyles(title);
  expect(invalidStyles.borderStyle).toBe('dashed');
  expect(invalidStyles.borderColor).toBe(systemColors.highlight);
  expect(invalidStyles.outlineColor).toBe(systemColors.highlight);
  expect(invalidStyles.outlineStyle).toBe('solid');
  await expect(panel.getByRole('alert')).toContainText(
    'Вкажіть назву зустрічі.',
  );

  await title.fill('Конфліктний стан');
  await submit.click();
  const conflict = panel.getByRole('alert');
  await expect(conflict).toContainText('Не вдалося оновити доступність.');
  const conflictStyles = await stateStyles(conflict);
  expect(conflictStyles.borderLeftStyle).toBe('dashed');
  expect(conflictStyles.borderLeftColor).toBe(systemColors.highlight);
  const panelAfter = await panel.boundingBox();
  expect(panelAfter?.x).toBeGreaterThanOrEqual(0);
  expect(panelAfter?.y).toBeGreaterThanOrEqual(0);
  expect((panelAfter?.x ?? 0) + (panelAfter?.width ?? 0))
    .toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect((panelAfter?.y ?? 0) + (panelAfter?.height ?? 0))
    .toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
  await expect(submit).toBeVisible();

  const compact = ['tablet', 'mobile-lg', 'mobile', 'reflow']
    .includes(testInfo.project.name);
  await expect(page.locator('[aria-modal="true"]'))
    .toHaveCount(compact ? 1 : 0);
  if (compact) {
    await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
  }
});
