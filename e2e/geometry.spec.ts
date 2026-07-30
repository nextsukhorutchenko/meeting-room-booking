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

const requestedBrowserTimeZone = 'America/Argentina/Buenos_Aires';

test.use({timezoneId: requestedBrowserTimeZone});

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
  const browserTimeZone = await page.evaluate(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  expect([
    requestedBrowserTimeZone,
    'America/Buenos_Aires',
  ]).toContain(browserTimeZone);
  const timezoneNotice = page.getByTestId('timezone-notice');
  await expect(timezoneNotice).toBeVisible();
  await expect(timezoneNotice).toContainText(browserTimeZone);
  await expect(timezoneNotice).toContainText('Europe/Kyiv');
  await timezoneNotice.scrollIntoViewIfNeeded();
  const timezoneNoticeGeometry = await timezoneNotice.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      bottom: box.bottom,
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
      left: box.left,
      right: box.right,
      scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth,
      top: box.top,
    };
  });
  expect(timezoneNoticeGeometry.clientHeight).toBeGreaterThan(0);
  expect(timezoneNoticeGeometry.clientWidth).toBeGreaterThan(0);
  expect(timezoneNoticeGeometry.scrollHeight)
    .toBeLessThanOrEqual(timezoneNoticeGeometry.clientHeight);
  expect(timezoneNoticeGeometry.scrollWidth)
    .toBeLessThanOrEqual(timezoneNoticeGeometry.clientWidth);
  expect(timezoneNoticeGeometry.left).toBeGreaterThanOrEqual(0);
  expect(timezoneNoticeGeometry.top).toBeGreaterThanOrEqual(0);
  expect(timezoneNoticeGeometry.right)
    .toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect(timezoneNoticeGeometry.bottom)
    .toBeLessThanOrEqual(await page.evaluate(() => innerHeight));

  if (isAgenda) {
    const agenda = page.getByRole('list', {name: /Розклад на/});
    await expect(agenda).toHaveCount(1);
    await expect(page.getByRole('table')).toHaveCount(0);
    const firstAgendaItem = agenda.getByRole('listitem').first();
    await expect(firstAgendaItem).toBeVisible();
    const documentRelativeTop = await firstAgendaItem.evaluate(
      (element) => element.getBoundingClientRect().top + window.scrollY,
    );
    expect(documentRelativeTop)
      .toBeLessThanOrEqual(296);
    const lastAgendaItem = agenda.getByRole('listitem').last();
    await lastAgendaItem.scrollIntoViewIfNeeded();
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight));
    const lastAgendaItemBox = await lastAgendaItem.boundingBox();
    const bottomNavigationBox = await page.locator('.bottom-nav').boundingBox();
    expect(lastAgendaItemBox).not.toBeNull();
    expect(bottomNavigationBox).not.toBeNull();
    expect(lastAgendaItemBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect(
      (lastAgendaItemBox?.x ?? 0) + (lastAgendaItemBox?.width ?? 0),
    ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    expect(lastAgendaItemBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect(
      (lastAgendaItemBox?.y ?? Number.POSITIVE_INFINITY) +
      (lastAgendaItemBox?.height ?? 0),
    ).toBeLessThanOrEqual(bottomNavigationBox?.y ?? 0);
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
    return {
      documentClientHeight: document.documentElement.clientHeight,
      documentOverflow:
        document.documentElement.scrollWidth - innerWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      pageScrollY: window.scrollY,
      viewportClientHeight: viewport?.clientHeight ?? 0,
      viewportOverflowY: viewport ? getComputedStyle(viewport).overflowY : '',
      viewportScrollTop: viewport?.scrollTop ?? -1,
      viewportScrollHeight: viewport?.scrollHeight ?? 0,
    };
  });

  expect(geometry.documentOverflow).toBeLessThanOrEqual(0);
  if (!isAgenda) {
    expect(['auto', 'scroll']).toContain(geometry.viewportOverflowY);
    expect(geometry.viewportScrollHeight)
      .toBeGreaterThan(geometry.viewportClientHeight);
    const viewportBox = await page.locator('.schedule-viewport').boundingBox();
    expect(viewportBox).not.toBeNull();
    if (projectName !== 'expanded') {
      expect(
        (viewportBox?.y ?? Number.POSITIVE_INFINITY) +
        (viewportBox?.height ?? 0),
      ).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
    }
  }
  if (projectName === 'expanded') {
    const viewport = page.locator('.schedule-viewport');
    const viewportBox = await viewport.boundingBox();
    const rows = page.getByRole('rowheader');
    const firstTwelveRows = await rows.evaluateAll((elements) =>
      elements.slice(0, 12).map((element) => {
        const box = element.getBoundingClientRect();
        return {
          bottom: box.bottom,
          height: box.height,
          top: box.top,
        };
      }));
    const firstSlot = firstTwelveRows[0];
    const twelfthSlot = firstTwelveRows[11];
    const browserHeight = await page.evaluate(() => innerHeight);
    expect(viewportBox).not.toBeNull();
    expect(firstTwelveRows).toHaveLength(12);
    expect(geometry.viewportScrollTop).toBe(0);
    for (const row of firstTwelveRows) {
      expect(row.height).toBeGreaterThanOrEqual(51.5);
      expect(row.height).toBeLessThanOrEqual(52.5);
      expect(row.top).toBeGreaterThanOrEqual(viewportBox?.y ?? 0);
      expect(row.bottom).toBeLessThanOrEqual(
        (viewportBox?.y ?? 0) + (viewportBox?.height ?? 0),
      );
    }
    expect(twelfthSlot.bottom - firstSlot.top).toBeGreaterThanOrEqual(624);
    expect(twelfthSlot.bottom).toBeLessThanOrEqual(browserHeight);
  }
  if (!isAgenda) {
    expect(geometry.documentScrollHeight)
      .toBeLessThanOrEqual(geometry.documentClientHeight);
    expect(geometry.pageScrollY).toBe(0);
  }
});

test('@schedule medium room and booking panes use exact swap geometry', async ({
  database,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'medium');
  const room = await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);
  const scheduleUrl =
    `/schedule?roomId=${room.id}&weekStart=${weekStart}&day=${weekStart}`;

  for (const {
    bookingWidth,
    roomWidth,
    viewportWidth,
  } of [
    {bookingWidth: 663, roomWidth: 759, viewportWidth: 1024},
    {bookingWidth: 539, roomWidth: 635, viewportWidth: 900},
  ]) {
    await page.setViewportSize({height: 768, width: viewportWidth});
    await page.goto(scheduleUrl);
    const workspace = page.getByRole('region', {
      name: 'Розклад переговорної',
    });
    await expect(workspace).toHaveAttribute('data-medium-pane', 'room');
    const main = page.locator('.schedule-workspace-main');
    expect((await main.boundingBox())?.width).toBe(roomWidth);

    const slot = page.locator('.free-slot-button:not([disabled])').first();
    await slot.click();
    await expect(workspace).toHaveAttribute('data-medium-pane', 'booking');
    expect((await main.boundingBox())?.width).toBe(bookingWidth);
    const panel = page.getByRole('region', {name: 'Бронювання: Oak'});
    const panelGeometry = await panel.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        bottom: box.bottom,
        overflowY: getComputedStyle(element).overflowY,
        top: box.top,
      };
    });
    expect(panelGeometry.top).toBeGreaterThanOrEqual(0);
    expect(panelGeometry.bottom)
      .toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
    expect(['auto', 'scroll']).toContain(panelGeometry.overflowY);
    await expect(panel.getByRole('button', {
      exact: true,
      name: 'Забронювати',
    })).toBeVisible();
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    )).toBeLessThanOrEqual(0);
    expect(await page.evaluate(() =>
      document.documentElement.scrollHeight -
      document.documentElement.clientHeight,
    )).toBeLessThanOrEqual(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
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
    if (testInfo.project.name === 'tablet') {
      const panel = page.locator('.booking-surface-panel');
      const sheet = await panel.boundingBox();
      const viewport = await page.evaluate(() => ({
        height: innerHeight,
        width: innerWidth,
      }));
      const expectedWidth = Math.min(384, viewport.width);
      expect(sheet).not.toBeNull();
      expect(sheet?.x).toBeCloseTo(viewport.width - expectedWidth, 1);
      expect(sheet?.y).toBeCloseTo(0, 1);
      expect(sheet?.width).toBeCloseTo(expectedWidth, 1);
      expect(sheet?.height).toBeCloseTo(viewport.height, 1);
    }
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
  expect(ownStyles.borderLeftStyle).toBe('double');
  expect(otherStyles.borderLeftStyle).toBe('solid');
  expect(ownStyles.outlineColor).toBe(systemColors.highlight);
  expect(ownStyles.outlineStyle).toBe('solid');
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
  expect(ownStyles.backgroundColor).toBe(systemColors.canvas);
  expect(otherStyles.backgroundColor).toBe(systemColors.canvas);
  expect(ownStyles.color).toBe(systemColors.canvasText);
  expect(otherStyles.color).toBe(systemColors.canvasText);
  expect([systemColors.buttonText, systemColors.canvasText])
    .toContain(ownStyles.borderLeftColor);
  expect(otherStyles.borderLeftColor).toBe(systemColors.canvasText);

  if (agenda) {
    const highlightedBooking = page.locator(
      '.day-agenda-highlighted[data-booking-id="forced-own"]',
    );
    await expect(highlightedBooking).toContainText('Ваше');
    await expect(highlightedBooking).toHaveAttribute(
      'data-booking-id',
      'forced-own',
    );
    const highlightedStyles = await stateStyles(highlightedBooking);
    expect(highlightedStyles.outlineColor).toBe(systemColors.highlight);
    expect(highlightedStyles.outlineStyle).toBe('solid');
    expect(highlightedStyles.outlineWidth).toBe('2px');
    expect(highlightedStyles.borderLeftStyle).toBe('double');

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
    expect(focusStyles.outlineWidth).toBe('2px');
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
  expect(invalidStyles.outlineWidth).toBe('2px');
  await expect(panel.getByRole('alert')).toHaveText(
    'Перевірте введені дані.',
  );
  await expect(title).toHaveAttribute(
    'aria-describedby',
    'booking-title-error',
  );
  await expect(panel.locator('#booking-title-error')).toHaveText(
    'Назва має містити від 1 до 100 символів.',
  );

  await title.fill('Конфліктний стан');
  await submit.click();
  const conflict = panel.getByRole('alert');
  await expect(conflict).toContainText('Не вдалося оновити доступність.');
  const conflictStyles = await stateStyles(conflict);
  expect(conflictStyles.borderLeftStyle).toBe('dashed');
  expect(conflictStyles.borderLeftColor).toBe(systemColors.highlight);
  const compact = ['tablet', 'mobile-lg', 'mobile', 'reflow']
    .includes(testInfo.project.name);
  const panelAfter = await panel.boundingBox();
  expect(panelAfter).not.toBeNull();
  expect(panelAfter?.x).toBeGreaterThanOrEqual(0);
  expect((panelAfter?.x ?? 0) + (panelAfter?.width ?? 0))
    .toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  if (compact) {
    expect(panelAfter?.y).toBeGreaterThanOrEqual(0);
    expect((panelAfter?.y ?? 0) + (panelAfter?.height ?? 0))
      .toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
    const compactScroll = await panel.evaluate((element) => ({
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
    }));
    expect(['auto', 'scroll']).toContain(compactScroll.overflowY);
    if (compactScroll.scrollHeight > compactScroll.clientHeight) {
      const compactScrollAfter = await panel.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        return {
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          scrollTop: element.scrollTop,
        };
      });
      expect(compactScrollAfter.scrollTop).toBeGreaterThan(0);
      expect(
        compactScrollAfter.scrollTop + compactScrollAfter.clientHeight,
      ).toBeGreaterThanOrEqual(compactScrollAfter.scrollHeight);
    }
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
    const compactPanelAfterScroll = await panel.boundingBox();
    const compactSubmit = await submit.boundingBox();
    expect(compactPanelAfterScroll).not.toBeNull();
    expect(compactSubmit).not.toBeNull();
    expect(compactSubmit?.y ?? -1)
      .toBeGreaterThanOrEqual(compactPanelAfterScroll?.y ?? 0);
    expect(
      (compactSubmit?.y ?? Number.POSITIVE_INFINITY) +
      (compactSubmit?.height ?? 0),
    ).toBeLessThanOrEqual(
      (compactPanelAfterScroll?.y ?? 0) +
      (compactPanelAfterScroll?.height ?? 0),
    );
  } else {
    const nonModalGeometry = await panel.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        documentClientHeight: document.documentElement.clientHeight,
        documentScrollHeight: document.documentElement.scrollHeight,
        overflowY: getComputedStyle(element).overflowY,
        panelBottom: box.bottom,
        panelTop: box.top,
        pageScrollY: window.scrollY,
      };
    });
    expect(nonModalGeometry.documentScrollHeight)
      .toBeLessThanOrEqual(nonModalGeometry.documentClientHeight);
    expect(nonModalGeometry.pageScrollY).toBe(0);
    expect(nonModalGeometry.panelTop).toBeGreaterThanOrEqual(0);
    expect(nonModalGeometry.panelBottom)
      .toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
    expect(['auto', 'scroll']).toContain(nonModalGeometry.overflowY);
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
    const submitAfterScroll = await submit.boundingBox();
    const panelAfterScroll = await panel.boundingBox();
    expect(submitAfterScroll).not.toBeNull();
    expect(panelAfterScroll).not.toBeNull();
    expect(submitAfterScroll?.y ?? -1)
      .toBeGreaterThanOrEqual(panelAfterScroll?.y ?? 0);
    expect(
      (submitAfterScroll?.y ?? Number.POSITIVE_INFINITY) +
      (submitAfterScroll?.height ?? 0),
    ).toBeLessThanOrEqual(
      (panelAfterScroll?.y ?? 0) + (panelAfterScroll?.height ?? 0),
    );
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
  await expect(page.locator('[aria-modal="true"]'))
    .toHaveCount(compact ? 1 : 0);
  if (compact) {
    await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
  }
});
