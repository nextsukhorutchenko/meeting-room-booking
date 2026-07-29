'use client';

import {CalendarCheck2, CirclePlus} from 'lucide-react';
import {DateTime} from 'luxon';
import type {ReactElement} from 'react';
import {
  formatAccessibleSlot,
  formatAccessibleBooking,
  formatDateLong,
  formatDateShort,
  formatTime,
  formatTimeRange,
} from '../../lib/i18n/formatters';
import {areTimeZonesEquivalent} from '../../lib/time/browser-zone';
import {officeDaySlotStarts} from '../../lib/time/office-time';
import {BookingBlock} from './booking-block';
import type {StartSlotSelection} from './booking-selection';
import {projectTimetable} from './schedule-projection';
import type {
  RoomSummary,
  ScheduleBooking,
  TimetableCell,
} from './schedule-types';

export const SCHEDULE_LAYOUT = {
  slotMinutes: 30,
  slotHeightPx: 52,
} as const;

export type TimetableProps = {
  bookings: readonly ScheduleBooking[];
  highlightedBookingId: string | null;
  now: string;
  officeCloseHour: number;
  officeOpenHour: number;
  officeTimeZone: string;
  onOpenDetails(booking: ScheduleBooking, invoker: HTMLElement): void;
  onSelectSlot(selection: StartSlotSelection, invoker: HTMLElement): void;
  room: RoomSummary;
  slotSelectionDisabled: boolean;
  userTimeZone: string;
  visibleDays: readonly string[];
  weekStart: string;
};

function zoneAbbreviation(instant: string, timeZone: string): string {
  const name = new Intl.DateTimeFormat('uk-UA', {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(new Date(instant)).find((part) =>
    part.type === 'timeZoneName',
  )?.value;
  return name ?? timeZone;
}

function officeSlotInstant(input: {
  day: string;
  officeCloseHour: number;
  officeOpenHour: number;
  officeTimeZone: string;
  slotIndex: number;
}): string {
  return officeDaySlotStarts({
    officeCloseHour: input.officeCloseHour,
    officeDay: input.day,
    officeOpenHour: input.officeOpenHour,
    officeTimeZone: input.officeTimeZone,
  })[input.slotIndex].toUTC().toISO() ?? '';
}

function dayHeaderLabel(input: {
  day: string;
  officeCloseHour: number;
  officeOpenHour: number;
  officeTimeZone: string;
  sameZone: boolean;
  userTimeZone: string;
}): string {
  const start = officeSlotInstant({...input, slotIndex: 0});
  const end = DateTime.fromISO(start, {setZone: true})
    .setZone(input.officeTimeZone)
    .startOf('day')
    .set({hour: input.officeCloseHour})
    .toUTC()
    .toISO() ?? '';
  if (input.sameZone) {
    return `${formatDateLong(start, input.userTimeZone)}; ${input.userTimeZone}`;
  }
  return [
    `${formatDateLong(start, input.officeTimeZone)}; офіс ${input.officeTimeZone}`,
    `${formatDateLong(start, input.userTimeZone)}, ${formatTime(start, input.userTimeZone)}`,
    `${formatDateLong(end, input.userTimeZone)}, ${formatTime(end, input.userTimeZone)}`,
    input.userTimeZone,
  ].join('; ');
}

function cellClassName(kind: TimetableCell['kind'], isCurrentDay: boolean): string {
  return [
    'timetable-cell',
    `timetable-cell-${kind}`,
    isCurrentDay ? 'timetable-cell-current-day' : '',
  ].filter(Boolean).join(' ');
}

export function Timetable({
  bookings,
  highlightedBookingId,
  now,
  officeCloseHour,
  officeOpenHour,
  officeTimeZone,
  onOpenDetails,
  onSelectSlot,
  room,
  slotSelectionDisabled,
  userTimeZone,
  visibleDays,
  weekStart,
}: TimetableProps): ReactElement {
  const projection = projectTimetable({
    bookings,
    officeCloseHour,
    officeOpenHour,
    officeTimeZone,
    visibleDays,
    weekStart,
  });
  const sameZone = areTimeZonesEquivalent(officeTimeZone, userTimeZone);
  const nowInstant = DateTime.fromISO(now, {setZone: true}).toUTC();
  const nowOfficeDay = nowInstant.setZone(officeTimeZone).toFormat('yyyy-LL-dd');
  const caption = `${'Розклад переговорної'} ${room.name}`;

  if (!projection.ok) {
    return (
      <p className="timetable-error" role="alert">
        Розклад недоступний.
      </p>
    );
  }

  return (
    <table aria-label={caption} className="timetable">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th id="clock-column" scope="col">
            {sameZone ?
              `Ваш час (${userTimeZone})` :
              `Офісний час (${officeTimeZone})`}
          </th>
          {projection.value.days.map((day) => (
            <th
              aria-current={day === nowOfficeDay ? 'date' : undefined}
              id={`day-${day}`}
              key={day}
              scope="col"
            >
              <span className="timetable-day-office">
                {formatDateShort(
                  officeSlotInstant({
                    day,
                    officeCloseHour,
                    officeOpenHour,
                    officeTimeZone,
                    slotIndex: 0,
                  }),
                  officeTimeZone,
                )}
                {!sameZone ? ' (офіс)' : ''}
              </span>
              {day === nowOfficeDay ? (
                <span className="timetable-current-day-marker">
                  <CalendarCheck2 aria-hidden="true" />
                  Сьогодні
                </span>
              ) : null}
              {!sameZone ? (
                <span className="timetable-day-user">
                  {formatDateShort(officeSlotInstant({
                    day,
                    officeCloseHour,
                    officeOpenHour,
                    officeTimeZone,
                    slotIndex: 0,
                  }), userTimeZone)}, {formatTimeRange(
                    officeSlotInstant({
                      day,
                      officeCloseHour,
                      officeOpenHour,
                      officeTimeZone,
                      slotIndex: 0,
                    }),
                    DateTime.fromISO(day, {zone: officeTimeZone})
                      .set({hour: officeCloseHour})
                      .toUTC()
                      .toISO() ?? '',
                    userTimeZone,
                  )} {userTimeZone}
                </span>
              ) : null}
              <span className="visually-hidden">
                {dayHeaderLabel({
                  day,
                  officeCloseHour,
                  officeOpenHour,
                  officeTimeZone,
                  sameZone,
                  userTimeZone,
                })}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {projection.value.rows.map((row) => (
          <tr key={row.slotIndex}>
            <th id={`office-slot-${row.slotIndex}`} scope="row">
              {(() => {
                const instant = officeSlotInstant({
                  day: projection.value.days[0],
                  officeCloseHour,
                  officeOpenHour,
                  officeTimeZone,
                  slotIndex: row.slotIndex,
                });
                const clockZone = sameZone ? userTimeZone : officeTimeZone;
                return `${formatTime(instant, clockZone)}${
                  sameZone ? '' : ` ${zoneAbbreviation(instant, officeTimeZone)}`
                }`;
              })()}
            </th>
            {row.cells.map((cell) => {
              if (cell.kind === 'booking-continuation') return null;
              const day = cell.kind === 'empty' ? cell.day : cell.booking.officeDay;
              const startsAt = officeSlotInstant({
                day,
                officeCloseHour,
                officeOpenHour,
                officeTimeZone,
                slotIndex: row.slotIndex,
              });
              const isCurrentDay = day === nowOfficeDay;
              const headers = `office-slot-${row.slotIndex} day-${day}`;
              if (cell.kind === 'booking-start') {
                const booking = cell.booking;
                return (
                  <td
                    className={cellClassName(cell.kind, isCurrentDay)}
                    headers={headers}
                    key={`${day}-${row.slotIndex}`}
                    rowSpan={booking.spanSlots}
                  >
                    <BookingBlock
                      accessibleName={formatAccessibleBooking({
                        authorName: booking.author.name,
                        endsAt: booking.endsAt,
                        isOwn: booking.isOwn,
                        officeTimeZone,
                        startsAt: booking.startsAt,
                        title: booking.title,
                        userTimeZone,
                      })}
                      bookingId={booking.id}
                      isHighlighted={booking.id === highlightedBookingId}
                      isOwn={booking.isOwn}
                      onOpenDetails={(invoker) => onOpenDetails(booking, invoker)}
                      timeLabel={formatTimeRange(
                        booking.startsAt,
                        booking.endsAt,
                        userTimeZone,
                      ).replace('-', '–')}
                      title={booking.title}
                    />
                  </td>
                );
              }

              const slotDate = DateTime.fromISO(startsAt, {setZone: true});
              const past = slotDate <= nowInstant;
              const userDate = slotDate.setZone(userTimeZone).toFormat('yyyy-LL-dd');
              return (
                <td
                  className={cellClassName(cell.kind, isCurrentDay)}
                  headers={headers}
                  key={`${day}-${row.slotIndex}`}
                >
                  <button
                    aria-label={formatAccessibleSlot({
                      instant: startsAt,
                      officeInstant: startsAt,
                      officeTimeZone,
                      roomName: room.name,
                      userTimeZone,
                    })}
                    className="free-slot-button"
                    data-past={past ? 'true' : undefined}
                    disabled={past || slotSelectionDisabled}
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
                    {!sameZone && userDate !== day ? (
                      <span>{formatDateShort(startsAt, userTimeZone)}</span>
                    ) : null}
                    <span>Вільно</span>
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
