import {describe, expect, it} from 'vitest';
import {
  projectDayAgenda,
  projectTimetable,
  type ProjectDayAgendaInput,
  type ProjectTimetableInput,
} from '../../src/components/schedule/schedule-projection';
import type {ScheduleBooking} from '../../src/components/schedule/schedule-types';

const officeTimeZone = 'Europe/Kyiv';
const weekStart = '2026-07-27';
const officeOpenHour = 9;
const officeCloseHour = 19;

function booking(
  id: string,
  startsAt: string,
  endsAt: string,
): ScheduleBooking {
  return {
    id,
    title: `Booking ${id}`,
    startsAt,
    endsAt,
    author: {id: `author-${id}`, name: `Author ${id}`},
    isOwn: false,
  };
}

const validMonday = booking(
  'monday',
  '2026-07-27T06:00:00.000Z',
  '2026-07-27T07:00:00.000Z',
);
const validThursday = booking(
  'thursday',
  '2026-07-30T06:00:00.000Z',
  '2026-07-30T07:00:00.000Z',
);
const validSunday = booking(
  'sunday',
  '2026-08-02T06:00:00.000Z',
  '2026-08-02T07:00:00.000Z',
);
const hiddenMondayA = booking(
  'hidden-a',
  '2026-07-27T06:00:00.000Z',
  '2026-07-27T07:00:00.000Z',
);
const hiddenMondayOverlap = booking(
  'hidden-b',
  '2026-07-27T06:30:00.000Z',
  '2026-07-27T07:30:00.000Z',
);
const fourHourBooking = booking(
  'four-hours',
  '2026-07-30T06:00:00.000Z',
  '2026-07-30T10:00:00.000Z',
);

const baseInput: Omit<ProjectTimetableInput, 'bookings' | 'visibleDays'> = {
  officeCloseHour,
  officeOpenHour,
  officeTimeZone,
  weekStart,
};

const agendaInput: Omit<ProjectDayAgendaInput, 'bookings'> = {
  ...baseInput,
  now: '2026-07-30T06:45:00.000Z',
  officeDay: '2026-07-30',
  userTimeZone: 'America/New_York',
};

function renderedBookingIds(result: {rows: readonly {cells: readonly {
  kind: string;
  booking?: ScheduleBooking;
}[]}[]}): string[] {
  return result.rows.flatMap((row) =>
    row.cells.flatMap((cell) =>
      cell.kind === 'booking-start' && cell.booking ? [cell.booking.id] : []),
  );
}

function expectScheduleDataError(
  result: ReturnType<typeof projectTimetable>,
  reason: string,
) {
  expect(result).toEqual({ok: false, error: 'schedule-data-error', reason});
}

describe('projectTimetable', () => {
  it('validates hidden days before filtering a three-day window', () => {
    const result = projectTimetable({
      ...baseInput,
      bookings: [validMonday, validThursday, validSunday],
      visibleDays: ['2026-07-29', '2026-07-30', '2026-07-31'],
    });

    expect(result).toMatchObject({ok: true});
    if (result.ok) {
      expect(renderedBookingIds(result.value)).toEqual([validThursday.id]);
      expect(result.value.rows).toHaveLength(20);
    }
  });

  it('rejects an overlap on a hidden day atomically', () => {
    expectScheduleDataError(projectTimetable({
      ...baseInput,
      bookings: [hiddenMondayA, hiddenMondayOverlap, validThursday],
      visibleDays: ['2026-07-29', '2026-07-30'],
    }), 'overlap');
  });

  it('rejects duplicate IDs without inferring their format', () => {
    expectScheduleDataError(projectTimetable({
      ...baseInput,
      bookings: [
        booking('any opaque id', '2026-07-27T06:00:00.000Z',
          '2026-07-27T06:30:00.000Z'),
        booking('any opaque id', '2026-07-27T07:00:00.000Z',
          '2026-07-27T07:30:00.000Z'),
      ],
      visibleDays: ['2026-07-27'],
    }), 'duplicate-id');
  });

  it('rejects a booking with a missing field', () => {
    const invalidBooking = {...validMonday, author: undefined} as unknown as
      ScheduleBooking;

    expectScheduleDataError(projectTimetable({
      ...baseInput,
      bookings: [invalidBooking],
      visibleDays: ['2026-07-27'],
    }), 'invalid-field');
  });

  it('rejects an invalid UTC instant', () => {
    expectScheduleDataError(projectTimetable({
      ...baseInput,
      bookings: [{...validMonday, startsAt: 'not-a-UTC-instant'}],
      visibleDays: ['2026-07-27'],
    }), 'invalid-instant');
  });

  it.each([
    ['equal instants', '2026-07-27T06:00:00.000Z'],
    ['an end before its start', '2026-07-27T05:30:00.000Z'],
  ])('rejects startsAt >= endsAt for %s', (_name, endsAt) => {
    expectScheduleDataError(projectTimetable({
      ...baseInput,
      bookings: [{...validMonday, endsAt}],
      visibleDays: ['2026-07-27'],
    }), 'invalid-order');
  });

  it('rejects a booking outside the office week', () => {
    expectScheduleDataError(projectTimetable({
      ...baseInput,
      bookings: [booking(
        'outside-week',
        '2026-08-03T06:00:00.000Z',
        '2026-08-03T06:30:00.000Z',
      )],
      visibleDays: ['2026-07-27'],
    }), 'outside-week');
  });

  it('rejects a booking crossing an office day', () => {
    expectScheduleDataError(projectTimetable({
      ...baseInput,
      bookings: [booking(
        'cross-day',
        '2026-07-27T15:30:00.000Z',
        '2026-07-27T21:00:00.000Z',
      )],
      visibleDays: ['2026-07-27'],
    }), 'cross-day');
  });

  it('rejects an off-grid booking', () => {
    expectScheduleDataError(projectTimetable({
      ...baseInput,
      bookings: [{...validMonday, startsAt: '2026-07-27T06:15:00.000Z'}],
      visibleDays: ['2026-07-27'],
    }), 'misaligned');
  });

  it('rejects a booking outside office hours', () => {
    expectScheduleDataError(projectTimetable({
      ...baseInput,
      bookings: [booking(
        'outside-hours',
        '2026-07-27T05:30:00.000Z',
        '2026-07-27T06:00:00.000Z',
      )],
      visibleDays: ['2026-07-27'],
    }), 'outside-hours');
  });

  it.each([
    ['zero slots', '2026-07-27T06:00:00.000Z', 'invalid-order'],
    ['nine slots', '2026-07-27T10:30:00.000Z', 'invalid-duration'],
  ])('rejects an invalid duration of %s', (_name, endsAt, reason) => {
    expectScheduleDataError(projectTimetable({
      ...baseInput,
      bookings: [{...validMonday, endsAt}],
      visibleDays: ['2026-07-27'],
    }), reason);
  });

  it('rejects a visible overlap', () => {
    expectScheduleDataError(projectTimetable({
      ...baseInput,
      bookings: [validThursday, booking(
        'visible-overlap',
        '2026-07-30T06:30:00.000Z',
        '2026-07-30T07:30:00.000Z',
      )],
      visibleDays: ['2026-07-30'],
    }), 'overlap');
  });

  it.each([30, 60, 240])('projects a valid %i-minute booking', (minutes) => {
    const result = projectTimetable({
      ...baseInput,
      bookings: [booking(
        `duration-${minutes}`,
        '2026-07-27T06:00:00.000Z',
        new Date(Date.parse('2026-07-27T06:00:00.000Z') + minutes * 60_000)
          .toISOString(),
      )],
      visibleDays: ['2026-07-27'],
    });

    expect(result).toMatchObject({ok: true});
  });

  it('allows adjacent half-open bookings', () => {
    const result = projectTimetable({
      ...baseInput,
      bookings: [
        booking('first', '2026-07-27T06:00:00.000Z',
          '2026-07-27T06:30:00.000Z'),
        booking('second', '2026-07-27T06:30:00.000Z',
          '2026-07-27T07:00:00.000Z'),
      ],
      visibleDays: ['2026-07-27'],
    });

    expect(result).toMatchObject({ok: true});
    if (result.ok) {
      expect(renderedBookingIds(result.value)).toEqual(['first', 'second']);
    }
  });
});

describe('projectDayAgenda', () => {
  it('partitions agenda coordinates exactly once', () => {
    const result = projectDayAgenda({...agendaInput, bookings: [fourHourBooking]});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.coveredSlotIndices).toEqual(
        Array.from({length: 20}, (_, index) => index),
      );
      expect(result.value.items.filter((item) => item.kind === 'busy'))
        .toHaveLength(1);
    }
  });

  it('uses an absolute browser now instant to distinguish past and free slots', () => {
    const result = projectDayAgenda({...agendaInput, bookings: []});

    expect(result).toMatchObject({ok: true});
    if (result.ok) {
      expect(result.value.items[0]).toMatchObject({kind: 'past', slotIndex: 0});
      expect(result.value.items[1]).toMatchObject({kind: 'past', slotIndex: 1});
      expect(result.value.items[2]).toMatchObject({kind: 'free', slotIndex: 2});
    }
  });
});
