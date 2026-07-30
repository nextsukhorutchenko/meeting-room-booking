import {
  expect,
  officeMonday,
  roomByName,
  TASK_11_ROOM_PREFIX,
  test,
} from './fixtures';

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
    expect(geometry.viewportClientHeight).toBeGreaterThanOrEqual(624);
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
  await control.focus();
  const styles = await control.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      animationDuration: computed.animationDuration,
      outlineStyle: computed.outlineStyle,
      outlineWidth: computed.outlineWidth,
      transform: computed.transform,
      transitionDuration: computed.transitionDuration,
    };
  });

  expect(styles.outlineStyle).toBe('solid');
  expect(styles.outlineWidth).toBe('2px');
  expect(styles.animationDuration).toBe('0s');
  expect(styles.transitionDuration).toBe('0s');
  expect(styles.transform).toBe('none');
});
