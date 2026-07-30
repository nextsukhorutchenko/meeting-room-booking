'use client';

import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
} from 'lucide-react';
import {DateTime} from 'luxon';
import {useState} from 'react';
import {formatDateShort, formatTime} from '../../lib/i18n/formatters';
import {APP_LOCALE} from '../../lib/time/browser-zone';
import {officeDaySlotStarts} from '../../lib/time/office-time';
import {uiCopy} from '../../lib/i18n/ui-copy';
import type {ResponsiveMode} from './schedule-types';

export type ScheduleJumpTarget = {
  officeDay: string;
  slotIndex: number;
  startsAt: string;
  label: string;
};

type ScheduleNavigationProps = {
  mode: ResponsiveMode;
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
  mode,
  onDayChange,
  onJump,
  onNextDay,
  onNextWeek,
  onPreviousDay,
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
  const selectedDayIndex = Math.max(0, days.findIndex((day) =>
    day.toFormat('yyyy-LL-dd') === selectedDay));
  const mobileDateStart = Math.min(
    Math.max(selectedDayIndex - 1, 0),
    Math.max(days.length - 3, 0),
  );
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
  const usesDayNavigation =
    mode === 'medium' || mode === 'tablet' || mode === 'mobile';
  const previousLabel = usesDayNavigation ?
    uiCopy.previousDay :
    uiCopy.previousWeek;
  const nextLabel = usesDayNavigation ? uiCopy.nextDay : uiCopy.nextWeek;
  const officeToday = DateTime.now()
    .setZone(officeTimeZone)
    .toFormat('yyyy-LL-dd');

  return (
    <nav aria-label={uiCopy.scheduleNavigation} className="schedule-navigation">
      <div className="schedule-navigation-week-controls">
        <button
          aria-label={previousLabel}
          className="icon-button"
          onClick={usesDayNavigation ? onPreviousDay : onPreviousWeek}
          title={previousLabel}
          type="button"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button className="today-button" onClick={onToday} type="button">
          <CalendarClock aria-hidden="true" className="size-4" />
          {uiCopy.today}
        </button>
        <button
          aria-label={nextLabel}
          className="icon-button"
          onClick={usesDayNavigation ? onNextDay : onNextWeek}
          title={nextLabel}
          type="button"
        >
          <ChevronRight aria-hidden="true" />
        </button>
        <p aria-live="polite" className="week-label">{weekLabel}</p>
      </div>
      <div aria-label={uiCopy.officeWeekDates} className="schedule-date-strip" role="list">
        {days.map((day, index) => {
          const value = day.toFormat('yyyy-LL-dd');
          const isSelected = value === selectedDay;
          const isOfficeToday = value === officeToday;
          const stateSuffix = [
            isSelected ? 'обрано' : '',
            isOfficeToday ? 'сьогодні' : '',
          ].filter(Boolean).join(', ');
          const accessibleLabel = [
            day.toFormat('cccc, LLLL d'),
            stateSuffix,
          ].filter(Boolean).join(', ');
          return (
            <div
              data-mobile-date-visible={
                index >= mobileDateStart && index < mobileDateStart + 3 ?
                  'true' :
                  'false'
              }
              key={value}
              role="listitem"
            >
              <button
                aria-current={isSelected ? 'date' : undefined}
                aria-label={accessibleLabel}
                className={[
                  'schedule-date-button',
                  isSelected ? 'selected-day' : '',
                  isOfficeToday ? 'current-day' : '',
                ].filter(Boolean).join(' ')}
                data-office-today={isOfficeToday ? 'true' : undefined}
                onClick={() => onDayChange(value)}
                type="button"
              >
                <span>{day.toFormat('ccc')}</span>
                <strong>{day.toFormat('d')}</strong>
                <span aria-hidden="true" className="schedule-date-state-markers">
                  {isOfficeToday ? (
                    <Circle className="office-today-marker" fill="currentColor" />
                  ) : null}
                  {isSelected ? <Check className="selected-day-marker" /> : null}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      <div className="schedule-jump-controls">
        <label className="control-field">
          <span>{uiCopy.day}</span>
          <select
            id="schedule-jump-day"
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
            id="schedule-jump-time"
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
