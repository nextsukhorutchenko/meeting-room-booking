'use client';

import {CalendarClock, ChevronLeft, ChevronRight} from 'lucide-react';
import {DateTime} from 'luxon';
import {useState} from 'react';
import {formatDateShort, formatTime} from '../../lib/i18n/formatters';
import {APP_LOCALE} from '../../lib/time/browser-zone';
import {officeDaySlotStarts} from '../../lib/time/office-time';
import {uiCopy} from '../../lib/i18n/ui-copy';

export type ScheduleJumpTarget = {
  officeDay: string;
  slotIndex: number;
  startsAt: string;
  label: string;
};

type ScheduleNavigationProps = {
  onDayChange(value: string): void;
  onJump(target: ScheduleJumpTarget): void;
  onNextDay(): void;
  onNextWeek(): void;
  onPreviousDay(): void;
  onPreviousWeek(): void;
  onToday(): void;
  officeCloseHour: number;
  officeOpenHour: number;
  officeTimeZone: string;
  selectedDay: string;
  userTimeZone: string;
  weekStart: string;
};

export function ScheduleNavigation({
  onDayChange,
  onJump,
  onNextWeek,
  onPreviousWeek,
  onToday,
  officeCloseHour,
  officeOpenHour,
  officeTimeZone,
  selectedDay,
  userTimeZone,
  weekStart,
}: ScheduleNavigationProps) {
  const start = DateTime.fromISO(weekStart).setLocale(APP_LOCALE);
  const end = start.plus({days: 6});
  const weekLabel = start.isValid ?
    `${start.toFormat('LLL d')} - ${end.toFormat('LLL d, yyyy')}` :
    uiCopy.currentWeek;
  const days = Array.from({length: 7}, (_, index) => start.plus({days: index}));
  const selectedJumpDay = days.some((day) =>
    day.toFormat('yyyy-LL-dd') === selectedDay) ? selectedDay : weekStart;
  const slots = officeDaySlotStarts({
    officeCloseHour,
    officeDay: selectedJumpDay,
    officeOpenHour,
    officeTimeZone,
  }).map((slot, slotIndex): ScheduleJumpTarget => {
    const startsAt = slot.toUTC().toISO() ?? '';
    return {
      officeDay: selectedJumpDay,
      slotIndex,
      startsAt,
      label: `${formatDateShort(startsAt, userTimeZone)} ${formatTime(startsAt, userTimeZone)}; ` +
        `офіс ${formatDateShort(startsAt, officeTimeZone)} ${formatTime(startsAt, officeTimeZone)}`,
    };
  });
  const selectedSlot = slots.find((slot) => slot.officeDay === selectedDay) ?? slots[0];
  const [jumpStartsAt, setJumpStartsAt] = useState(selectedSlot?.startsAt ?? '');
  const currentJumpStartsAt = slots.some((slot) => slot.startsAt === jumpStartsAt) ?
    jumpStartsAt :
    selectedSlot?.startsAt ?? '';

  return (
    <nav aria-label={uiCopy.scheduleNavigation} className="schedule-navigation">
      <div className="schedule-navigation-week-controls">
        <button
          aria-label={uiCopy.previousWeek}
          className="icon-button"
          onClick={onPreviousWeek}
          title={uiCopy.previousWeek}
          type="button"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button className="today-button" onClick={onToday} type="button">
          <CalendarClock aria-hidden="true" className="size-4" />
          {uiCopy.today}
        </button>
        <button
          aria-label={uiCopy.nextWeek}
          className="icon-button"
          onClick={onNextWeek}
          title={uiCopy.nextWeek}
          type="button"
        >
          <ChevronRight aria-hidden="true" />
        </button>
        <p aria-live="polite" className="week-label">{weekLabel}</p>
      </div>
      <div aria-label={uiCopy.officeWeekDates} className="schedule-date-strip" role="list">
        {days.map((day) => {
          const value = day.toFormat('yyyy-LL-dd');
          return (
            <div key={value} role="listitem">
              <button
                aria-current={value === selectedDay ? 'date' : undefined}
                aria-label={day.toFormat('cccc, LLLL d')}
                className={
                  value === selectedDay ?
                    'schedule-date-button current-day' :
                    'schedule-date-button'
                }
                onClick={() => onDayChange(value)}
                type="button"
              >
                <span>{day.toFormat('ccc')}</span>
                <strong>{day.toFormat('d')}</strong>
              </button>
            </div>
          );
        })}
      </div>
      <div className="schedule-jump-controls">
        <label className="control-field">
          <span>{uiCopy.day}</span>
          <select
            onChange={(event) => {
              const nextDay = event.target.value;
              const nextStartsAt = officeDaySlotStarts({
                officeCloseHour,
                officeDay: nextDay,
                officeOpenHour,
                officeTimeZone,
              })[0]?.toUTC().toISO() ?? '';
              setJumpStartsAt(nextStartsAt);
              onDayChange(nextDay);
            }}
            value={selectedDay}
          >
            {days.map((day) => {
              const value = day.toFormat('yyyy-LL-dd');
              return <option key={value} value={value}>{day.toFormat('cccc, d LLLL')}</option>;
            })}
          </select>
        </label>
        <label className="control-field">
          <span>Час</span>
          <select
            onChange={(event) => setJumpStartsAt(event.target.value)}
            value={currentJumpStartsAt}
          >
            {slots.map((slot) => (
              <option key={slot.startsAt} value={slot.startsAt}>{slot.label}</option>
            ))}
          </select>
        </label>
        <button
          className="schedule-jump-button"
          onClick={() => {
            const target = slots.find((slot) => slot.startsAt === currentJumpStartsAt);
            if (target) onJump(target);
          }}
          type="button"
        >
          Перейти
        </button>
      </div>
    </nav>
  );
}
