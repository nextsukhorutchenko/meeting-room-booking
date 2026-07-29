'use client';

import {CirclePlus} from 'lucide-react';
import {DateTime} from 'luxon';
import {useLayoutEffect, useRef} from 'react';
import {
  formatAccessibleBooking,
  formatAccessibleSlot,
  formatDateLong,
  formatTime,
  formatTimeRange,
} from '../../lib/i18n/formatters';
import {projectDayAgenda} from './schedule-projection';
import type {StartSlotSelection} from './booking-selection';
import type {DayAgendaItem, RoomSummary, ScheduleBooking} from './schedule-types';

export type DayAgendaProps = {
  bookings: readonly ScheduleBooking[];
  highlightedBookingId: string | null;
  now: string;
  officeCloseHour: number;
  officeDay: string;
  officeOpenHour: number;
  officeTimeZone: string;
  onCancel(booking: ScheduleBooking, invoker: HTMLElement): void;
  onOpenDetails(booking: ScheduleBooking, invoker: HTMLElement): void;
  onSelectSlot(selection: StartSlotSelection, invoker: HTMLElement): void;
  positionEpoch: number;
  room: RoomSummary;
  selectedStartsAt: string | null;
  userTimeZone: string;
  weekStart: string;
};

function agendaItemReference(item: DayAgendaItem): string {
  return item.kind === 'busy' ?
    `booking-${item.booking.id}` :
    `slot-${item.startsAt}`;
}

export function DayAgenda({
  bookings,
  highlightedBookingId,
  now,
  officeCloseHour,
  officeDay,
  officeOpenHour,
  officeTimeZone,
  onCancel,
  onOpenDetails,
  onSelectSlot,
  positionEpoch,
  room,
  selectedStartsAt,
  userTimeZone,
  weekStart,
}: DayAgendaProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const positionedEpoch = useRef<number | null>(null);
  const projection = projectDayAgenda({
    bookings,
    now,
    officeCloseHour,
    officeDay,
    officeOpenHour,
    officeTimeZone,
    userTimeZone,
    weekStart,
  });

  useLayoutEffect(() => {
    if (!projection.ok || positionedEpoch.current === positionEpoch) return;
    positionedEpoch.current = positionEpoch;
    const current = DateTime.fromISO(now, {setZone: true}).toUTC();
    const busyItems = projection.value.items.filter((item) =>
      item.kind === 'busy');
    const deepLinkedBooking = busyItems.find((item) =>
      item.booking.id === highlightedBookingId);
    const selectedStart = projection.value.items.find((item) =>
      item.kind !== 'busy' && item.startsAt === selectedStartsAt);
    const currentBooking = busyItems.find((item) => {
      const start = DateTime.fromISO(item.booking.startsAt, {setZone: true});
      const end = DateTime.fromISO(item.booking.endsAt, {setZone: true});
      return start <= current && end > current;
    });
    const nearestFutureFree = projection.value.items.find((item) =>
      item.kind === 'free');
    const nextFutureBusy = busyItems.find((item) =>
      DateTime.fromISO(item.booking.startsAt, {setZone: true}) > current);
    const officeOpenItem = projection.value.items[0];
    const target =
      (deepLinkedBooking && itemRefs.current.get(`booking-${deepLinkedBooking.booking.id}`)) ??
      (selectedStart && itemRefs.current.get(agendaItemReference(selectedStart))) ??
      (currentBooking && itemRefs.current.get(`booking-${currentBooking.booking.id}`)) ??
      (nearestFutureFree && itemRefs.current.get(agendaItemReference(nearestFutureFree))) ??
      (nextFutureBusy && itemRefs.current.get(`booking-${nextFutureBusy.booking.id}`)) ??
      (officeOpenItem && itemRefs.current.get(agendaItemReference(officeOpenItem))) ??
      headingRef.current;
    target?.scrollIntoView({behavior: 'auto', block: 'start'});
  }, [highlightedBookingId, now, positionEpoch, projection, selectedStartsAt]);

  if (!projection.ok) {
    return <p className="day-agenda-error" role="alert">Розклад недоступний.</p>;
  }

  const headingId = `day-agenda-${officeDay}`;
  return (
    <section aria-labelledby={headingId} className="day-agenda">
      <h2 id={headingId} ref={headingRef}>
        Розклад на {formatDateLong(
          projection.value.items[0]?.kind === 'busy' ?
            projection.value.items[0].booking.startsAt :
            projection.value.items[0]?.startsAt ?? now,
          officeTimeZone,
        )}
      </h2>
      <ol aria-label={`Розклад на ${room.name}`}>
        {projection.value.items.map((item) => {
          if (item.kind === 'busy') {
            const booking = item.booking;
            const future = DateTime.fromISO(booking.endsAt, {setZone: true}) >
              DateTime.fromISO(now, {setZone: true});
            return (
              <li
                className={[
                  'day-agenda-item', 'day-agenda-busy',
                  booking.isOwn ? 'day-agenda-own' : '',
                  booking.id === highlightedBookingId ? 'day-agenda-highlighted' : '',
                ].filter(Boolean).join(' ')}
                data-booking-id={booking.id}
                key={booking.id}
                ref={(element) => {
                  if (element) itemRefs.current.set(`booking-${booking.id}`, element);
                }}
              >
                <time dateTime={booking.startsAt}>
                  {formatTimeRange(booking.startsAt, booking.endsAt, userTimeZone)}
                </time>
                <button
                  aria-label={formatAccessibleBooking({
                    authorName: booking.author.name,
                    endsAt: booking.endsAt,
                    isOwn: booking.isOwn,
                    officeTimeZone,
                    startsAt: booking.startsAt,
                    title: booking.title,
                    userTimeZone,
                  })}
                  className="day-agenda-details"
                  onClick={(event) => onOpenDetails(booking, event.currentTarget)}
                  type="button"
                >
                  <span>{booking.title}</span>
                  <span>{booking.isOwn ? 'Ваше' : 'Зайнято'}</span>
                </button>
                {booking.isOwn && future ? (
                  <button
                    className="day-agenda-cancel"
                    onClick={(event) => onCancel(booking, event.currentTarget)}
                    type="button"
                  >
                    Скасувати
                  </button>
                ) : null}
              </li>
            );
          }

          const startsAt = item.startsAt;
          const past = item.kind === 'past';
          return (
            <li
              className={[
                'day-agenda-item', 'day-agenda-slot',
                past ? 'day-agenda-past' : 'day-agenda-free',
              ].join(' ')}
              key={startsAt}
              ref={(element) => {
                if (element) itemRefs.current.set(`slot-${startsAt}`, element);
              }}
            >
              <time dateTime={startsAt}>{formatTime(startsAt, userTimeZone)}</time>
              <button
                aria-label={formatAccessibleSlot({
                  instant: startsAt,
                  officeInstant: startsAt,
                  officeTimeZone,
                  roomName: room.name,
                  userTimeZone,
                })}
                className="day-agenda-slot-button"
                disabled={past}
                onClick={(event) => onSelectSlot({
                  dateLabel: formatDateLong(startsAt, userTimeZone),
                  roomId: room.id,
                  roomName: room.name,
                  startsAt,
                  startTimeLabel: formatTime(startsAt, userTimeZone),
                  timeZoneLabel: userTimeZone,
                }, event.currentTarget)}
                type="button"
              >
                <CirclePlus aria-hidden="true" />
                {past ? 'Минулий час' : 'Вільно'}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
