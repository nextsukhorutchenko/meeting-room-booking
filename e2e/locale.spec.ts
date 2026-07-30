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

test('@timezone non-English browser locale hydrates stable Ukrainian labels', async ({
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
  await expect(page.getByText('бер. 2 - бер. 8, 2026')).toBeVisible();
  await expect(page.getByRole('columnheader', {name: /понеділок.*2 березня/}))
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

test('@timezone browser alias canonicalizes during hydration', async ({
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
      const formatter = new NativeDateTimeFormat(locales, options);
      if (!options?.timeZone) {
        const nativeResolvedOptions =
          formatter.resolvedOptions.bind(formatter);
        Object.defineProperty(formatter, 'resolvedOptions', {
          value: () => ({
            ...nativeResolvedOptions(),
            timeZone: 'America/Argentina/Buenos_Aires',
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
  await expect(page.getByRole('columnheader', {name: /понеділок.*2 березня/}))
    .toBeVisible();
  const canonicalBrowserTimeZone = await page.evaluate(() =>
    new Intl.DateTimeFormat('uk-UA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    }).resolvedOptions().timeZone,
  );
  expect(canonicalBrowserTimeZone).toBe('America/Buenos_Aires');
  const timezoneNotice = page.getByTestId('timezone-notice');
  await expect(timezoneNotice)
    .toContainText(`Ваш час: ${canonicalBrowserTimeZone}`);
  await expect(timezoneNotice)
    .toContainText('Години офісу: 09:00–19:00 Europe/Kyiv');
  await expect(page.getByRole('rowheader').first()).toContainText('09:00');
  expect(hydrationErrors).toEqual([]);
});
