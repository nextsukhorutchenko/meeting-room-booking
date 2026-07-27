import {describe, expect, it} from 'vitest';
import {DomainError} from '../../src/lib/http/domain-error';
import {
  overlaps,
  validateBookingInterval,
} from '../../src/modules/bookings/interval';
import {TestClock} from '../helpers/test-clock';

const officeTimeZone = 'Europe/Kyiv';
const officeOpenHour = 9;
const officeCloseHour = 19;

function expectDomainError(action: () => unknown): DomainError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return error as DomainError;
  }

  throw new Error('Expected a DomainError');
}

function validate(input: Partial<Parameters<typeof validateBookingInterval>[0]>) {
  const clock = new TestClock(new Date('2026-07-27T06:00:00.000Z'));

  return validateBookingInterval({
    startsAt: new Date('2026-07-28T06:00:00.000Z'),
    endsAt: new Date('2026-07-28T06:30:00.000Z'),
    now: clock.now(),
    officeTimeZone,
    officeOpenHour,
    officeCloseHour,
    ...input,
  });
}

describe('overlaps', () => {
  const at = (hour: number, minute = 0) =>
    new Date(Date.UTC(2026, 6, 28, hour, minute));

  it.each([
    ['adjacent before', at(9), at(10), at(10), at(11), false],
    ['adjacent after', at(11), at(12), at(10), at(11), false],
    ['partial overlap at start', at(9, 30), at(10, 30), at(10), at(11), true],
    ['partial overlap at end', at(10, 30), at(11, 30), at(10), at(11), true],
    ['exact overlap', at(10), at(11), at(10), at(11), true],
    ['enclosing overlap', at(9), at(12), at(10), at(11), true],
    ['neighboring days', at(9), at(10), at(33), at(34), false],
  ])('%s', (_name, start, end, existingStart, existingEnd, expected) => {
    expect(overlaps(start, end, existingStart, existingEnd)).toBe(expected);
  });
});

describe('validateBookingInterval', () => {
  it('preserves the validated interval and its duration', () => {
    const startsAt = new Date('2026-07-28T06:00:00.000Z');
    const endsAt = new Date('2026-07-28T06:30:00.000Z');

    expect(validate({startsAt, endsAt})).toEqual({
      startsAt,
      endsAt,
      durationMinutes: 30,
    });
  });

  it.each([
    [
      'a start minute outside the 30-minute grid',
      {startsAt: new Date('2026-07-28T06:15:00.000Z')},
      'startsAt',
    ],
    [
      'seconds in the end time',
      {endsAt: new Date('2026-07-28T06:30:01.000Z')},
      'endsAt',
    ],
    [
      'milliseconds in the end time',
      {endsAt: new Date('2026-07-28T06:30:00.001Z')},
      'endsAt',
    ],
  ])('rejects %s', (_name, input, field) => {
    const error = expectDomainError(() => validate(input));

    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.status).toBe(400);
    expect(error.fields).toEqual({[field]: 'Must align to a 30-minute slot'});
  });

  it.each([
    [
      'a duration below 30 minutes',
      new Date('2026-07-28T06:00:00.000Z'),
      new Date('2026-07-28T06:00:00.000Z'),
    ],
    [
      'a duration above four hours',
      new Date('2026-07-28T06:00:00.000Z'),
      new Date('2026-07-28T10:30:00.000Z'),
    ],
  ])('rejects %s', (_name, startsAt, endsAt) => {
    const error = expectDomainError(() => validate({startsAt, endsAt}));

    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.status).toBe(400);
    expect(error.fields).toEqual({endsAt: 'Duration must be 30 to 240 minutes'});
  });

  it('rejects a start that is not in the future', () => {
    const error = expectDomainError(() =>
      validate({
        startsAt: new Date('2026-07-27T06:00:00.000Z'),
        endsAt: new Date('2026-07-27T06:30:00.000Z'),
      }),
    );

    expect(error.code).toBe('BOOKING_IN_PAST');
    expect(error.status).toBe(422);
    expect(error.fields).toEqual({startsAt: 'Must be in the future'});
  });

  it('rejects an invalid booking date', () => {
    const error = expectDomainError(() =>
      validate({startsAt: new Date('not-a-date')}),
    );

    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.status).toBe(400);
    expect(error.fields).toEqual({startsAt: 'Must be a valid date'});
  });

  it('rejects an invalid office time zone', () => {
    const error = expectDomainError(() =>
      validate({officeTimeZone: 'Europe/Invalid'}),
    );

    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.status).toBe(400);
    expect(error.fields).toEqual({
      officeTimeZone: 'Must be a valid IANA time zone',
    });
  });

  it.each([
    [
      'a start before office opening',
      new Date('2026-07-28T05:30:00.000Z'),
      new Date('2026-07-28T06:00:00.000Z'),
      'startsAt',
    ],
    [
      'an end after office closing',
      new Date('2026-07-28T15:30:00.000Z'),
      new Date('2026-07-28T16:30:00.000Z'),
      'endsAt',
    ],
  ])('rejects %s', (_name, startsAt, endsAt, field) => {
    const error = expectDomainError(() => validate({startsAt, endsAt}));

    expect(error.code).toBe('BOOKING_OUTSIDE_OFFICE_HOURS');
    expect(error.status).toBe(422);
    expect(error.fields).toEqual({
      [field]: 'Must be within office hours',
    });
  });

  it.each([
    [
      'the opening boundary',
      new Date('2026-07-28T06:00:00.000Z'),
      new Date('2026-07-28T06:30:00.000Z'),
    ],
    [
      'the closing boundary',
      new Date('2026-07-28T15:30:00.000Z'),
      new Date('2026-07-28T16:00:00.000Z'),
    ],
  ])('accepts %s', (_name, startsAt, endsAt) => {
    expect(validate({startsAt, endsAt}).durationMinutes).toBe(30);
  });

  it('uses Kyiv wall time instead of a fixed UTC offset', () => {
    const result = validateBookingInterval({
      startsAt: new Date('2026-01-27T07:00:00.000Z'),
      endsAt: new Date('2026-01-27T07:30:00.000Z'),
      now: new TestClock(new Date('2026-01-26T07:00:00.000Z')).now(),
      officeTimeZone,
      officeOpenHour,
      officeCloseHour,
    });

    expect(result.durationMinutes).toBe(30);
  });
});

describe('DomainError', () => {
  it('keeps its machine code, status, and optional field errors', () => {
    const error = new DomainError({
      code: 'VALIDATION_FAILED',
      message: 'Booking input is invalid',
      status: 400,
      fields: {startsAt: 'Required'},
    });

    expect(error).toMatchObject({
      name: 'DomainError',
      code: 'VALIDATION_FAILED',
      message: 'Booking input is invalid',
      status: 400,
      fields: {startsAt: 'Required'},
    });
  });
});
