'use client';

import {DateTime} from 'luxon';
import {formatInUserZone} from '../../lib/time/browser-zone';
import {BookingBlock} from './booking-block';
import type {BookingSelection} from './booking-dialog';
import {
  SCHEDULE_LAYOUT,
  type ScheduleBooking,
} from './week-grid';

type DayScheduleProps = {
  bookingEnabled: boolean;
  bookings: ScheduleBooking[];
  day: string;
  highlightedBookingId: string | null;
  loading: boolean;
  officeCloseHour: number;
  officeOpenHour: number;
  officeTimeZone: string;
  onCancelBooking(booking: {id: string; title: string}): void;
  onSelectSlot(selection: BookingSelection): void;
  roomId: string;
  roomName: string;
  userTimeZone: string;
};

const timeOptions: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
};

function timeLabel(instant: DateTime, userTimeZone: string): string {
  return formatInUserZone(instant.toJSDate(), userTimeZone, timeOptions);
}

function dateLabel(instant: DateTime, userTimeZone: string): string {
  return formatInUserZone(instant.toJSDate(), userTimeZone, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  });
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

export function DaySchedule({
  bookingEnabled,
  bookings,
  day,
  highlightedBookingId,
  loading,
  officeCloseHour,
  officeOpenHour,
  officeTimeZone,
  onCancelBooking,
  onSelectSlot,
  roomId,
  roomName,
  userTimeZone,
}: DayScheduleProps) {
  const officeDay = DateTime.fromISO(day, {zone: officeTimeZone});
  const now = DateTime.now().setZone(officeTimeZone);
  const officeSlots =
    (officeCloseHour - officeOpenHour) * 60 /
    SCHEDULE_LAYOUT.slotMinutes;
  const gridHeight = officeSlots * SCHEDULE_LAYOUT.slotHeightPx;
  const currentMinutes =
    now.hour * 60 + now.minute - officeOpenHour * 60;
  const currentTop =
    currentMinutes / SCHEDULE_LAYOUT.slotMinutes *
    SCHEDULE_LAYOUT.slotHeightPx;
  const showCurrentTime =
    officeDay.hasSame(now, 'day') &&
    currentTop >= 0 &&
    currentTop <= gridHeight;
  const dayBookings = bookings.filter((booking) =>
    DateTime.fromISO(booking.startsAt)
      .setZone(officeTimeZone)
      .hasSame(officeDay, 'day'),
  );

  return (
    <div
      aria-label="Daily room schedule"
      aria-busy={loading}
      className="day-schedule"
      role="grid"
      style={{gridTemplateRows: `3.375rem ${gridHeight}px`}}
    >
      <div aria-hidden="true" className="schedule-corner">
        {formatInUserZone(officeDay.toJSDate(), userTimeZone, {
          timeZoneName: 'short',
        }).split(' ').at(-1)}
      </div>
      <div className="schedule-day-headers" role="row">
        <div
          aria-current={officeDay.hasSame(now, 'day') ? 'date' : undefined}
          aria-label={officeDay.toFormat('ccc, LLL d')}
          className={
            officeDay.hasSame(now, 'day') ?
              'day-header current-day' :
              'day-header'
          }
          role="columnheader"
        >
          <span>{officeDay.toFormat('cccc')}</span>
          <strong>{officeDay.toFormat('LLLL d, yyyy')}</strong>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="schedule-time-gutter"
        style={{height: gridHeight}}
      >
        {Array.from({length: officeSlots}, (_, slot) => {
          const startsAt = officeDay.set({
            hour: officeOpenHour,
            minute: slot * SCHEDULE_LAYOUT.slotMinutes,
          });
          return (
            <div
              className="schedule-time-row"
              data-testid="day-schedule-time-row"
              key={slot}
              style={{height: SCHEDULE_LAYOUT.slotHeightPx}}
            >
              {slot % 2 === 0 ?
                timeLabel(startsAt, userTimeZone) :
                null}
            </div>
          );
        })}
        <span className="schedule-end-time">
          {timeLabel(
            officeDay.set({hour: officeCloseHour, minute: 0}),
            userTimeZone,
          )}
        </span>
      </div>
      <div className="schedule-days" style={{height: gridHeight}} role="row">
        <div
          className={
            officeDay.hasSame(now, 'day') ?
              'schedule-day-column current-day' :
              'schedule-day-column'
          }
          data-testid="day-schedule-day-column"
          role="gridcell"
        >
          {Array.from({length: officeSlots}, (_, slot) => {
            const startsAt = officeDay.set({
              hour: officeOpenHour,
              minute: slot * SCHEDULE_LAYOUT.slotMinutes,
            });
            const endsAt = startsAt.plus({
              minutes: SCHEDULE_LAYOUT.slotMinutes,
            });
            const occupied = bookings.some((booking) =>
              overlapsSlot(booking, startsAt, endsAt),
            );
            const bookable = bookingEnabled && startsAt > now && !occupied;
            const userStartLabel = timeLabel(startsAt, userTimeZone);
            const userEndLabel = timeLabel(endsAt, userTimeZone);
            return (
              <div
                className="schedule-slot"
                key={startsAt.toISO()}
                style={{height: SCHEDULE_LAYOUT.slotHeightPx}}
              >
                {bookable ? (
                  <button
                    aria-label={
                      `Book ${dateLabel(startsAt, userTimeZone)} at ` +
                      `${userStartLabel} in ${roomName}`
                    }
                    className="free-slot-button"
                    onClick={() => onSelectSlot({
                      dateLabel: dateLabel(startsAt, userTimeZone),
                      endsAt: endsAt.toUTC().toISO() ?? '',
                      roomId,
                      roomName,
                      startsAt: startsAt.toUTC().toISO() ?? '',
                      timeLabel: `${userStartLabel}-${userEndLabel}`,
                      timeZoneLabel: userTimeZone,
                    })}
                    title={`Book ${userStartLabel}`}
                    type="button"
                  />
                ) : null}
              </div>
            );
          })}
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
                isHighlighted={booking.id === highlightedBookingId}
                isOwn={booking.isOwn}
                key={booking.id}
                onCancel={onCancelBooking}
                timeLabel={
                  `${timeLabel(startsAt, userTimeZone)}-` +
                  timeLabel(endsAt, userTimeZone)
                }
                title={booking.title}
                top={
                  startMinutes / SCHEDULE_LAYOUT.slotMinutes *
                  SCHEDULE_LAYOUT.slotHeightPx
                }
              />
            );
          })}
          {showCurrentTime ? (
            <div
              aria-label={`Current time ${timeLabel(now, userTimeZone)}`}
              className="current-time-line"
              style={{top: currentTop}}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
