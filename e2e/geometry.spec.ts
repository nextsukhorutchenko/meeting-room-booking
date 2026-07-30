import {
  expect,
  officeMonday,
  roomByName,
  TASK_11_ROOM_PREFIX,
  test,
} from './fixtures';
import type {Locator, Page} from '@playwright/test';

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

test('@schedule forced colors and reduced motion keep state boundaries visible', async ({
  database,
  page,
}) => {
  await page.emulateMedia({
    forcedColors: 'active',
    reducedMotion: 'reduce',
  });
  const room = await roomByName(database, 'Oak');
  const weekStart = officeMonday(1);
  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}&day=${weekStart}`,
  );

  const control = page.locator('button:visible').first();
  await tabTo(page, control);
  await expect(control).toBeFocused();
  const styles = await control.evaluate((element) => {
    const computed = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      animationDuration: computed.animationDuration,
      borderColor: computed.borderColor,
      borderStyle: computed.borderStyle,
      borderWidth: computed.borderWidth,
      color: computed.color,
      height: rect.height,
      outlineStyle: computed.outlineStyle,
      outlineWidth: computed.outlineWidth,
      transform: computed.transform,
      transitionDuration: computed.transitionDuration,
      width: rect.width,
    };
  });

  expect(styles.borderStyle).toBe('solid');
  expect(styles.borderWidth).not.toBe('0px');
  expect(styles.borderColor).toBe(styles.color);
  expect(styles.outlineStyle).toBe('solid');
  expect(styles.outlineWidth).toBe('2px');
  expect(styles.animationDuration).toBe('0s');
  expect(styles.transitionDuration).toBe('0s');
  expect(styles.transform).toBe('none');
  const after = await control.boundingBox();
  expect(after?.width).toBe(styles.width);
  expect(after?.height).toBe(styles.height);
});
