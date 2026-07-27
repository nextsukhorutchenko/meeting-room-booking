import {describe, expect, it} from 'vitest';
import {
  areTimeZonesEquivalent,
  formatInUserZone,
  getBrowserTimeZone,
} from './browser-zone';

describe('browser-zone', () => {
  it('reads a valid browser IANA timezone', () => {
    const timeZone = getBrowserTimeZone();

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
});
