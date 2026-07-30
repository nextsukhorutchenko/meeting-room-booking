import {describe, expect, it} from 'vitest';
import {groupBookings} from '../../src/components/bookings/booking-groups';
import type {BookingListItem} from '../../src/modules/bookings/booking.types';

function booking(
  id: string,
  startsAt: string,
  status: BookingListItem['status'] = 'upcoming',
): BookingListItem {
  return {
    id,
    room: {id: 'oak', name: 'Дуб'},
    title: `Планування ${id}`,
    startsAt,
    endsAt: startsAt,
    status,
  };
}

describe('groupBookings', () => {
  it('promotes the nearest future booking without duplicating it', () => {
    const later = booking('later', '2026-08-04T09:00:00.000Z');
    const nearest = booking('nearest', '2026-08-03T09:00:00.000Z');
    const afterLater = booking('after-later', '2026-08-05T09:00:00.000Z');

    const groups = groupBookings({
      future: [later, nearest, afterLater],
      past: [],
      userTimeZone: 'Europe/Kyiv',
    });

    expect(groups[0]).toMatchObject({
      heading: 'Найближче',
      items: [nearest],
      kind: 'nearest',
    });
    expect(groups.flatMap(({items}) => items).map(({id}) => id)).toEqual([
      'nearest',
      'later',
      'after-later',
    ]);
  });

  it('groups in the user time zone while retaining each API sequence order', () => {
    const groups = groupBookings({
      future: [
        booking('nearest', '2026-08-01T07:00:00.000Z'),
        booking('late-local-august-first', '2026-08-02T01:30:00.000Z'),
        booking('august-second', '2026-08-02T23:30:00.000Z'),
      ],
      past: [
        booking('august-second', '2026-08-02T10:00:00.000Z', 'completed'),
        booking('august-first', '2026-08-01T10:00:00.000Z', 'cancelled'),
        booking('july-last', '2026-07-31T10:00:00.000Z', 'completed'),
      ],
      userTimeZone: 'America/Los_Angeles',
    });

    expect(groups).toMatchObject([
      {kind: 'nearest', items: [{id: 'nearest'}]},
      {
        heading: 'субота, 1 серпня 2026 р.',
        items: [{id: 'late-local-august-first'}],
        kind: 'date',
      },
      {
        heading: 'неділя, 2 серпня 2026 р.',
        items: [{id: 'august-second'}],
        kind: 'date',
      },
      {
        heading: 'серпень 2026 р.',
        items: [{id: 'august-second'}, {id: 'august-first'}],
        kind: 'month',
      },
      {
        heading: 'липень 2026 р.',
        items: [{id: 'july-last'}],
        kind: 'month',
      },
    ]);
  });
});
