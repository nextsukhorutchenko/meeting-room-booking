import {describe, expect, it} from 'vitest';
import {
  buildBookingEndTimeOptions,
  type BookingAvailabilityInterval,
} from '../../src/modules/bookings/end-time-options';

const defaults = {
  officeCloseHour: 19,
  officeTimeZone: 'Europe/Kyiv',
  startsAt: '2026-07-28T10:00:00+03:00',
  userTimeZone: 'Europe/Kyiv',
};

function interval(startsAt: string, endsAt: string): BookingAvailabilityInterval {
  return {endsAt, startsAt};
}

function build(
  input: Partial<Parameters<typeof buildBookingEndTimeOptions>[0]> = {},
) {
  return buildBookingEndTimeOptions({
    bookings: [],
    ...defaults,
    ...input,
  });
}

describe('buildBookingEndTimeOptions', () => {
  it('offers every half hour through exactly four hours', () => {
    const options = build({bookings: []});

    expect(options).toHaveLength(8);
    expect(options.at(-1)).toMatchObject({
      durationMinutes: 240,
      endsAt: '2026-07-28T11:00:00.000Z',
    });
  });

  it('stops at office close', () => {
    const options = build({
      startsAt: '2026-07-28T17:30:00+03:00',
    });

    expect(options.map((option) => option.durationMinutes)).toEqual([
      30, 60, 90,
    ]);
  });

  it('includes an end equal to the earliest next booking start', () => {
    const options = build({
      bookings: [
        interval('2026-07-28T15:00:00+03:00', '2026-07-28T16:00:00+03:00'),
        interval('2026-07-28T12:00:00+03:00', '2026-07-28T13:00:00+03:00'),
      ],
    });

    expect(options.at(-1)).toMatchObject({
      durationMinutes: 120,
      endsAt: '2026-07-28T09:00:00.000Z',
    });
  });

  it('returns no options when a booking overlaps the selected start', () => {
    expect(build({
      bookings: [
        interval('2026-07-28T09:30:00+03:00', '2026-07-28T10:30:00+03:00'),
      ],
    })).toEqual([]);
  });

  it('formats labels in the browser zone', () => {
    const [option] = build({
      userTimeZone: 'America/New_York',
    });

    expect(option).toMatchObject({
      durationLabel: '30 min',
      endTimeLabel: '03:30',
      rangeLabel: '03:00-03:30',
    });
  });

  it('returns no options for an invalid start or office time zone', () => {
    expect(build({startsAt: 'not-a-date'})).toEqual([]);
    expect(build({officeTimeZone: 'Europe/Invalid'})).toEqual([]);
  });

  it('returns no options when the available boundary is before 30 minutes', () => {
    expect(build({
      bookings: [
        interval('2026-07-28T10:15:00+03:00', '2026-07-28T11:00:00+03:00'),
      ],
    })).toEqual([]);
  });
});
