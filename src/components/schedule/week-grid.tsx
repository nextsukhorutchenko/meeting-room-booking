'use client';

import {DateTime} from 'luxon';
import {
  APP_LOCALE,
  areTimeZonesEquivalent,
  formatInUserZone,
} from '../../lib/time/browser-zone';
import {BookingBlock} from './booking-block';
import type {StartSlotSelection} from './booking-selection';

export const SCHEDULE_LAYOUT = {
  slotMinutes: 30,
  slotHeightPx: 44,
  dayCount: 7,
} as const;

export type ScheduleBooking = {
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
  highlightedBookingId: string | null;
  loading: boolean;
  officeCloseHour: number;
  officeOpenHour: number;
  officeTimeZone: string;
  onCancelBooking(booking: {id: string; title: string}): void;
  onSelectSlot(selection: StartSlotSelection): void;
  roomId: string;
  roomName: string;
  userTimeZone: string;
  weekStart: string;
};

const timeOptions: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
};

function timeLabel(
  instant: DateTime,
  userTimeZone: string,
  officeTimeZone: string,
): string {
  return formatInUserZone(
    instant.toJSDate(),
    userTimeZone,
    timeOptions,
    officeTimeZone,
  );
}

function dateLabel(
  instant: DateTime,
  userTimeZone: string,
  officeTimeZone: string,
): string {
  return formatInUserZone(instant.toJSDate(), userTimeZone, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }, officeTimeZone);
}

function zoneLabel(
  instant: DateTime,
  timeZone: string,
  officeTimeZone: string,
): string {
  return formatInUserZone(instant.toJSDate(), timeZone, {
    timeZoneName: 'short',
  }, officeTimeZone).split(' ').at(-1) ?? timeZone;
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
  weekStart,
}: WeekGridProps) {
  const week = DateTime.fromISO(weekStart, {zone: officeTimeZone});
  const now = DateTime.now().setZone(officeTimeZone);
  const days = Array.from(
    {length: SCHEDULE_LAYOUT.dayCount},
    (_, index) => week.plus({days: index}),
  );
  const showUserHours =
    !areTimeZonesEquivalent(officeTimeZone, userTimeZone);
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
      style={{gridTemplateRows: `3.5rem ${gridHeight}px`}}
    >
      <div
        aria-hidden="true"
        className="schedule-corner schedule-office-zone"
        data-testid="schedule-office-zone"
      >
        {officeTimeZone}
      </div>
      <div className="schedule-day-headers" role="row">
        {days.map((day) => {
          const isToday = day.hasSame(now, 'day');
          const localizedDay = day.setLocale(APP_LOCALE);
          const officeStart = day.set({
            hour: officeOpenHour,
            minute: 0,
          });
          const officeEnd = day.set({
            hour: officeCloseHour,
            minute: 0,
          });
          const userHours =
            `${timeLabel(officeStart, userTimeZone, officeTimeZone)}-` +
            `${timeLabel(officeEnd, userTimeZone, officeTimeZone)} ` +
            zoneLabel(officeStart, userTimeZone, officeTimeZone);
          const officeDayLabel = localizedDay.toFormat('ccc, LLL d');
          return (
            <div
              aria-label={
                showUserHours ?
                  `${officeDayLabel}, user time ${userHours}` :
                  officeDayLabel
              }
              aria-current={isToday ? 'date' : undefined}
              className={isToday ? 'day-header current-day' : 'day-header'}
              key={day.toISODate()}
              role="columnheader"
            >
              <span>{localizedDay.toFormat('ccc')}</span>
              <strong>{localizedDay.toFormat('LLL d')}</strong>
              {showUserHours ? (
                <small
                  className="day-user-hours"
                  data-testid={`day-user-hours-${day.toISODate()}`}
                >
                  {userHours}
                </small>
              ) : null}
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
          {length: officeSlots},
          (_, slot) => (
            <div
              className="schedule-time-row"
              data-testid="schedule-time-row"
              key={slot}
              style={{height: SCHEDULE_LAYOUT.slotHeightPx}}
            />
          ),
        )}
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
                {length: officeSlots},
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
                  const userStartLabel = timeLabel(
                    startsAt,
                    userTimeZone,
                    officeTimeZone,
                  );
                  return (
                    <div
                      className="schedule-slot"
                      key={startsAt.toISO()}
                      style={{height: SCHEDULE_LAYOUT.slotHeightPx}}
                    >
                      {slot % 2 === 0 ? (
                        <span
                          aria-hidden="true"
                          className="day-row-time"
                          data-testid={
                            `day-row-clock-${day.toISODate()}`
                          }
                        >
                          {userStartLabel}
                        </span>
                      ) : null}
                      {bookable ? (
                        <button
                          aria-label={
                            `Book ${dateLabel(
                              startsAt,
                              userTimeZone,
                              officeTimeZone,
                            )} at ` +
                            `${userStartLabel} in ${roomName}`
                          }
                          className="free-slot-button"
                          onClick={() => onSelectSlot({
                            dateLabel: dateLabel(
                              startsAt,
                              userTimeZone,
                              officeTimeZone,
                            ),
                            roomId,
                            roomName,
                            startsAt: startsAt.toUTC().toISO() ?? '',
                            startTimeLabel: userStartLabel,
                            timeZoneLabel: userTimeZone,
                          })}
                          title={`Book ${userStartLabel}`}
                          type="button"
                        />
                      ) : null}
                    </div>
                  );
                },
              )}
              <span
                aria-hidden="true"
                className="day-row-end-time"
                data-testid={`day-row-clock-${day.toISODate()}`}
              >
                {timeLabel(
                  day.set({hour: officeCloseHour, minute: 0}),
                  userTimeZone,
                  officeTimeZone,
                )}
              </span>
              {dayBookings.map((booking) => {
                const startsAt = DateTime.fromISO(booking.startsAt)
                  .setZone(officeTimeZone);
                const endsAt = DateTime.fromISO(booking.endsAt)
                  .setZone(officeTimeZone);
                const startMinutes =
                  startsAt.hour * 60 + startsAt.minute -
                  officeOpenHour * 60;
                const durationMinutes = endsAt.diff(startsAt, 'minutes').minutes;
                const bookingTimeLabel =
                  `${timeLabel(
                    startsAt,
                    userTimeZone,
                    officeTimeZone,
                  )}-` +
                  timeLabel(endsAt, userTimeZone, officeTimeZone);
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
                    timeLabel={bookingTimeLabel}
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
                  aria-label={
                    `Current time ${timeLabel(
                      now,
                      userTimeZone,
                      officeTimeZone,
                    )}`
                  }
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
