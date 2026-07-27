import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  areTimeZonesEquivalent,
  formatInUserZone,
  getBrowserTimeZone,
} from './browser-zone';

describe('browser-zone', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads a valid browser IANA timezone', () => {
    const timeZone = getBrowserTimeZone('Europe/Kyiv');

    expect(() => new Intl.DateTimeFormat('en-US', {timeZone})).not.toThrow();
  });

  it('formats the same UTC instant in the requested user timezone', () => {
    const instant = '2026-07-28T07:00:00.000Z';
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
    };

    expect(formatInUserZone(instant, 'Europe/Kyiv', options)).toBe('10:00');
    expect(formatInUserZone(instant, 'America/New_York', options)).toBe('03:00');
  });

  it('treats canonical IANA aliases as the same timezone', () => {
    expect(areTimeZonesEquivalent('Europe/Kyiv', 'Europe/Kiev')).toBe(true);
    expect(
      areTimeZonesEquivalent('Europe/Kyiv', 'America/New_York'),
    ).toBe(false);
  });

  it('falls back to the validated office zone when a browser alias fails', () => {
    const NativeDateTimeFormat = Intl.DateTimeFormat;
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ) => {
      if (!options?.timeZone) {
        const formatter = new NativeDateTimeFormat(locales, options);
        vi.spyOn(formatter, 'resolvedOptions').mockReturnValue({
          ...formatter.resolvedOptions(),
          timeZone: 'Europe/Kiev',
        });
        return formatter;
      }
      if (options.timeZone === 'Europe/Kiev') {
        throw new RangeError('Unsupported timezone alias');
      }
      return new NativeDateTimeFormat(locales, options);
    });

    expect(getBrowserTimeZone('Europe/Kyiv')).toBe('Europe/Kyiv');
    expect(
      areTimeZonesEquivalent('Europe/Kyiv', 'Europe/Kiev'),
    ).toBe(true);
  });

  it('formats in the office zone when the requested browser zone fails', () => {
    expect(
      formatInUserZone(
        '2026-07-28T07:00:00.000Z',
        'Unsupported/Browser_Zone',
        {
          hour: '2-digit',
          hourCycle: 'h23',
          minute: '2-digit',
        },
        'Europe/Kyiv',
      ),
    ).toBe('10:00');
  });
});
