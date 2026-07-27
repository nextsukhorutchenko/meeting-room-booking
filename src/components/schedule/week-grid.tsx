'use client';

import {DateTime} from 'luxon';
import {BookingBlock} from './booking-block';
import type {BookingSelection} from './booking-dialog';

export const SCHEDULE_LAYOUT = {
  slotMinutes: 30,
  slotHeightPx: 36,
  dayCount: 7,
  officeSlots: 20,
} as const;

type ScheduleBooking = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  author: {id: string; name: string};
  isOwn: boolean;
};

type WeekGridProps = {
  bookingEnabled: boolean;
  bookings: ScheduleBooking[];
  loading: boolean;
  officeTimeZone: string;
  onCancelBooking(booking: {id: string; title: string}): void;
  onSelectSlot(selection: BookingSelection): void;
  roomId: string;
  roomName: string;
  weekStart: string;
};

const officeOpenHour = 9;

function slotLabel(slot: number): string {
  return DateTime.fromObject({hour: officeOpenHour})
    .plus({minutes: slot * SCHEDULE_LAYOUT.slotMinutes})
    .toFormat('HH:mm');
}

function overlapsSlot(
  booking: ScheduleBooking,
  startsAt: DateTime,
  endsAt: DateTime,
): boolean {
  const bookingStart = DateTime.fromISO(booking.startsAt);
  const bookingEnd = DateTime.fromISO(booking.endsAt);
  return bookingStart < endsAt && bookingEnd > startsAt;
}

export function WeekGrid({
  bookingEnabled,
  bookings,
  loading,
  officeTimeZone,
  onCancelBooking,
  onSelectSlot,
  roomId,
  roomName,
  weekStart,
}: WeekGridProps) {
  const week = DateTime.fromISO(weekStart, {zone: officeTimeZone});
  const now = DateTime.now().setZone(officeTimeZone);
  const days = Array.from(
    {length: SCHEDULE_LAYOUT.dayCount},
    (_, index) => week.plus({days: index}),
  );
  const gridHeight =
    SCHEDULE_LAYOUT.officeSlots * SCHEDULE_LAYOUT.slotHeightPx;
  const currentMinutes = now.hour * 60 + now.minute - officeOpenHour * 60;
  const currentTop =
    currentMinutes / SCHEDULE_LAYOUT.slotMinutes *
    SCHEDULE_LAYOUT.slotHeightPx;
  const showCurrentTime =
    now >= week &&
    now < week.plus({days: SCHEDULE_LAYOUT.dayCount}) &&
    currentTop >= 0 &&
    currentTop <= gridHeight;

  return (
    <div
      aria-label="Weekly room schedule"
      aria-busy={loading}
      className="week-grid"
      role="grid"
    >
      <div aria-hidden="true" className="schedule-corner">
        GMT{week.toFormat('ZZ')}
      </div>
      <div className="schedule-day-headers" role="row">
        {days.map((day) => {
          const isToday = day.hasSame(now, 'day');
          return (
            <div
              aria-label={day.toFormat('ccc, LLL d')}
              aria-current={isToday ? 'date' : undefined}
              className={isToday ? 'day-header current-day' : 'day-header'}
              key={day.toISODate()}
              role="columnheader"
            >
              <span>{day.toFormat('ccc')}</span>
              <strong>{day.toFormat('LLL d')}</strong>
            </div>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className="schedule-time-gutter"
        style={{height: gridHeight}}
      >
        {Array.from(
          {length: SCHEDULE_LAYOUT.officeSlots},
          (_, slot) => (
            <div
              className="schedule-time-row"
              data-testid="schedule-time-row"
              key={slot}
              style={{height: SCHEDULE_LAYOUT.slotHeightPx}}
            >
              {slot % 2 === 0 ? slotLabel(slot) : null}
            </div>
          ),
        )}
        <span className="schedule-end-time">19:00</span>
      </div>
      <div className="schedule-days" style={{height: gridHeight}} role="row">
        {days.map((day, dayIndex) => {
          const isToday = day.hasSame(now, 'day');
          const dayBookings = bookings.filter((booking) => {
            const start = DateTime.fromISO(booking.startsAt)
              .setZone(officeTimeZone);
            return start.hasSame(day, 'day');
          });

          return (
            <div
              className={
                isToday ? 'schedule-day-column current-day' :
                  'schedule-day-column'
              }
              data-testid="schedule-day-column"
              key={day.toISODate()}
              role="gridcell"
            >
              {Array.from(
                {length: SCHEDULE_LAYOUT.officeSlots},
                (_, slot) => {
                  const startsAt = day.startOf('day').set({
                    hour: officeOpenHour,
                    minute: slot * SCHEDULE_LAYOUT.slotMinutes,
                  });
                  const endsAt = startsAt.plus({
                    minutes: SCHEDULE_LAYOUT.slotMinutes,
                  });
                  const occupied = bookings.some((booking) =>
                    overlapsSlot(booking, startsAt, endsAt),
                  );
                  const bookable =
                    bookingEnabled && startsAt > now && !occupied;
                  return (
                    <div
                      className="schedule-slot"
                      key={startsAt.toISO()}
                      style={{height: SCHEDULE_LAYOUT.slotHeightPx}}
                    >
                      {bookable ? (
                        <button
                          aria-label={
                            `Book ${day.toFormat('cccc, LLLL d')} at ` +
                            `${startsAt.toFormat('HH:mm')} in ${roomName}`
                          }
                          className="free-slot-button"
                          onClick={() => onSelectSlot({
                            dateLabel: day.toFormat('cccc, LLLL d, yyyy'),
                            endsAt: endsAt.toISO() ?? '',
                            roomId,
                            roomName,
                            startsAt: startsAt.toISO() ?? '',
                            timeLabel:
                              `${startsAt.toFormat('HH:mm')}-` +
                              endsAt.toFormat('HH:mm'),
                          })}
                          title={`Book ${startsAt.toFormat('HH:mm')}`}
                          type="button"
                        />
                      ) : null}
                    </div>
                  );
                },
              )}
              {dayBookings.map((booking) => {
                const startsAt = DateTime.fromISO(booking.startsAt)
                  .setZone(officeTimeZone);
                const endsAt = DateTime.fromISO(booking.endsAt)
                  .setZone(officeTimeZone);
                const startMinutes =
                  startsAt.hour * 60 + startsAt.minute -
                  officeOpenHour * 60;
                const durationMinutes = endsAt.diff(startsAt, 'minutes').minutes;
                return (
                  <BookingBlock
                    authorName={booking.author.name}
                    bookingId={booking.id}
                    height={
                      durationMinutes / SCHEDULE_LAYOUT.slotMinutes *
                      SCHEDULE_LAYOUT.slotHeightPx
                    }
                    isOwn={booking.isOwn}
                    key={booking.id}
                    onCancel={onCancelBooking}
                    title={booking.title}
                    top={
                      startMinutes / SCHEDULE_LAYOUT.slotMinutes *
                      SCHEDULE_LAYOUT.slotHeightPx
                    }
                  />
                );
              })}
              {showCurrentTime && dayIndex === now.weekday - 1 ? (
                <div
                  aria-label={`Current time ${now.toFormat('HH:mm')}`}
                  className="current-time-line"
                  style={{top: currentTop}}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
