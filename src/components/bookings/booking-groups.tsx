import {DateTime} from 'luxon';
import {formatDateLong} from '../../lib/i18n/formatters';
import type {BookingListItem} from '../../modules/bookings/booking.types';

export type BookingGroup =
  | {kind: 'nearest'; heading: 'Найближче'; items: readonly BookingListItem[]}
  | {kind: 'date'; heading: string; items: readonly BookingListItem[]}
  | {kind: 'month'; heading: string; items: readonly BookingListItem[]};

function inUserZone(booking: BookingListItem, userTimeZone: string): DateTime {
  return DateTime.fromISO(booking.startsAt, {setZone: true}).setZone(userTimeZone);
}

function groupBy<T extends 'date' | 'month'>(input: {
  items: readonly BookingListItem[];
  kind: T;
  key(booking: BookingListItem): string;
  heading(booking: BookingListItem): string;
}): Array<Extract<BookingGroup, {kind: T}>> {
  const groups = new Map<string, {
    heading: string;
    items: BookingListItem[];
  }>();

  for (const booking of input.items) {
    const key = input.key(booking);
    const group = groups.get(key);
    if (group) {
      group.items.push(booking);
    } else {
      groups.set(key, {heading: input.heading(booking), items: [booking]});
    }
  }

  return Array.from(groups.values(), (group) => ({
    heading: group.heading,
    items: group.items,
    kind: input.kind,
  })) as Array<Extract<BookingGroup, {kind: T}>>;
}

function nearestIndex(future: readonly BookingListItem[]): number {
  return future.reduce((nearest, booking, index) =>
    Date.parse(booking.startsAt) < Date.parse(future[nearest].startsAt) ?
      index :
      nearest,
  0);
}

export function groupBookings(input: {
  future: readonly BookingListItem[];
  past: readonly BookingListItem[];
  userTimeZone: string;
}): readonly BookingGroup[] {
  const future = [...input.future];
  const groups: BookingGroup[] = [];

  if (future.length > 0) {
    const index = nearestIndex(future);
    const [nearest] = future.splice(index, 1);
    groups.push({heading: 'Найближче', items: [nearest], kind: 'nearest'});
  }

  groups.push(...groupBy({
    items: future,
    kind: 'date',
    key: (booking) => inUserZone(booking, input.userTimeZone).toISODate() ?? booking.startsAt,
    heading: (booking) => formatDateLong(booking.startsAt, input.userTimeZone),
  }));
  groups.push(...groupBy({
    items: input.past,
    kind: 'month',
    key: (booking) => inUserZone(booking, input.userTimeZone).toFormat('yyyy-LL'),
    heading: (booking) => new Intl.DateTimeFormat('uk-UA', {
      month: 'long',
      timeZone: input.userTimeZone,
      year: 'numeric',
    }).format(new Date(booking.startsAt)),
  }));

  return groups;
}
