import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  expect,
  roomByName,
  test,
} from './fixtures';

const artifactsDirectory = resolve(
  '.superpowers/sdd/2026-07-27-meeting-room-booking-implementation/' +
  'task-12-artifacts',
);

test.beforeAll(async () => {
  await mkdir(artifactsDirectory, {recursive: true});
});

test('@timezone non-English browser locale hydrates stable English labels', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const weekStart = '2026-03-02';
  const hydrationErrors: string[] = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /hydration|did not match|server rendered/i.test(message.text())
    ) {
      hydrationErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => hydrationErrors.push(error.message));

  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=${weekStart}&day=${weekStart}`,
  );
  expect(await page.evaluate(() => navigator.language)).toBe('fr-FR');
  await expect(page.getByText('Mar 2 - Mar 8, 2026')).toBeVisible();
  await expect(page.getByRole('columnheader', {name: /Mon, Mar 2/}))
    .toBeVisible();
  await expect(page).toHaveURL(new RegExp(
    `weekStart=${weekStart}.*day=${weekStart}`,
  ));
  expect(hydrationErrors).toEqual([]);

  await page.screenshot({
    fullPage: true,
    path: resolve(
      artifactsDirectory,
      'desktop-new-york-fr-locale.png',
    ),
  });
});

test('@timezone unsupported browser alias falls back during hydration', async ({
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const hydrationErrors: string[] = [];
  await page.addInitScript(() => {
    const NativeDateTimeFormat = Intl.DateTimeFormat;
    function PatchedDateTimeFormat(
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ): Intl.DateTimeFormat {
      if (options?.timeZone === 'Europe/Kiev') {
        throw new RangeError('Unsupported timezone alias');
      }
      const formatter = new NativeDateTimeFormat(locales, options);
      if (!options?.timeZone) {
        const nativeResolvedOptions =
          formatter.resolvedOptions.bind(formatter);
        Object.defineProperty(formatter, 'resolvedOptions', {
          value: () => ({
            ...nativeResolvedOptions(),
            timeZone: 'Europe/Kiev',
          }),
        });
      }
      return formatter;
    }
    Object.setPrototypeOf(PatchedDateTimeFormat, NativeDateTimeFormat);
    PatchedDateTimeFormat.prototype = NativeDateTimeFormat.prototype;
    Intl.DateTimeFormat =
      PatchedDateTimeFormat as typeof Intl.DateTimeFormat;
  });
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /hydration|did not match|server rendered/i.test(message.text())
    ) {
      hydrationErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => hydrationErrors.push(error.message));

  await page.goto(
    `/schedule?roomId=${room.id}&weekStart=2026-03-02&day=2026-03-02`,
  );
  await expect(page.getByRole('columnheader', {name: 'Mon, Mar 2'}))
    .toBeVisible();
  await expect(page.getByText(
    'Office hours: 09:00–19:00 Europe/Kyiv',
    {exact: true},
  )).toHaveCount(0);
  await expect(page.getByTestId('schedule-time-row').first())
    .toHaveText('09:00');
  expect(hydrationErrors).toEqual([]);
});
