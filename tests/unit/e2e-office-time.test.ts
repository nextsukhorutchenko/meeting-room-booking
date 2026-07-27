import {DateTime} from 'luxon';
import {describe, expect, it} from 'vitest';
import {
  officeMonday,
  officeTodayLabel,
} from '../../e2e/office-time';

describe('office-time Playwright helpers', () => {
  it('uses the Kyiv calendar when the host date is still Sunday', () => {
    const sundayInUtcMondayInKyiv = DateTime.fromISO(
      '2026-08-02T22:30:00Z',
      {setZone: true},
    );

    expect(sundayInUtcMondayInKyiv.toFormat('ccc, LLL d')).toBe('Sun, Aug 2');
    expect(officeMonday(0, sundayInUtcMondayInKyiv)).toBe('2026-08-03');
    expect(officeTodayLabel(sundayInUtcMondayInKyiv)).toBe('Mon, Aug 3');
  });

  it('keeps Friday and Sunday in their Kyiv office week', () => {
    const friday = DateTime.fromISO('2026-08-07T12:00:00Z', {setZone: true});
    const sunday = DateTime.fromISO('2026-08-09T12:00:00Z', {setZone: true});

    expect(officeMonday(0, friday)).toBe('2026-08-03');
    expect(officeMonday(0, sunday)).toBe('2026-08-03');
  });
});
