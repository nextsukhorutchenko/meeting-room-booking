import {describe, expect, it} from 'vitest';
import {DomainError} from '../../src/lib/http/domain-error';
import {
  officeDaySlotStarts,
  officeWeekBounds,
} from '../../src/lib/time/office-time';
import {TestClock} from '../helpers/test-clock';

function expectDomainError(action: () => unknown): DomainError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return error as DomainError;
  }

  throw new Error('Expected a DomainError');
}

describe('officeWeekBounds', () => {
  it('returns office-local Monday boundaries as UTC dates', () => {
    expect(officeWeekBounds('2026-07-27', 'Europe/Kyiv')).toEqual({
      startsAt: new Date('2026-07-26T21:00:00.000Z'),
      endsAt: new Date('2026-08-02T21:00:00.000Z'),
    });
  });

  it('uses Monday as the office-week boundary for a Ukrainian locale', () => {
    expect(officeWeekBounds('2026-08-03', 'Europe/Kyiv')).toEqual({
      startsAt: new Date('2026-08-02T21:00:00.000Z'),
      endsAt: new Date('2026-08-09T21:00:00.000Z'),
    });
  });

  it('converts a week spanning the Kyiv DST change with IANA data', () => {
    expect(officeWeekBounds('2026-03-23', 'Europe/Kyiv')).toEqual({
      startsAt: new Date('2026-03-22T22:00:00.000Z'),
      endsAt: new Date('2026-03-29T21:00:00.000Z'),
    });
  });

  it.each([
    '2026-07-28',
    '2026-07-27T00:00:00Z',
    '2026-02-30',
    'not-a-date',
  ])
  ('rejects an invalid Monday input: %s', (weekStart) => {
    const error = expectDomainError(() =>
      officeWeekBounds(weekStart, 'Europe/Kyiv'),
    );

    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.status).toBe(400);
    expect(error.fields).toEqual({weekStart: 'Must be an ISO Monday date'});
  });

  it('rejects an invalid IANA time zone', () => {
    const error = expectDomainError(() =>
      officeWeekBounds('2026-07-27', 'Europe/Invalid'),
    );

    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.status).toBe(400);
    expect(error.fields).toEqual({
      officeTimeZone: 'Must be a valid IANA time zone',
    });
  });
});

describe('officeDaySlotStarts', () => {
  it('covers the complete office day with exact first, last, and count', () => {
    const slots = officeDaySlotStarts({
      officeCloseHour: 19,
      officeDay: '2026-07-29',
      officeOpenHour: 9,
      officeTimeZone: 'Europe/Kyiv',
    }).map((slot) => slot.toUTC().toISO());

    expect(slots).toHaveLength(20);
    expect(slots[0]).toBe('2026-07-29T06:00:00.000Z');
    expect(slots.at(-1)).toBe('2026-07-29T15:30:00.000Z');
  });

  it('generates half-hour UTC instants from each Kyiv office day independently', () => {
    expect(officeDaySlotStarts({
      officeCloseHour: 10,
      officeDay: '2026-03-29',
      officeOpenHour: 9,
      officeTimeZone: 'Europe/Kyiv',
    }).map((slot) => slot.toUTC().toISO())).toEqual([
      '2026-03-29T06:00:00.000Z',
      '2026-03-29T06:30:00.000Z',
    ]);
  });
});

describe('TestClock', () => {
  it('returns a defensive copy of its fixed time', () => {
    const clock = new TestClock(new Date('2026-07-27T06:00:00.000Z'));
    const firstNow = clock.now();

    firstNow.setUTCFullYear(2000);

    expect(clock.now()).toEqual(new Date('2026-07-27T06:00:00.000Z'));
  });
});
