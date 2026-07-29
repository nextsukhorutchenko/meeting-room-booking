'use client';

import {CalendarClock, ChevronLeft, ChevronRight} from 'lucide-react';
import {DateTime} from 'luxon';
import {APP_LOCALE} from '../../lib/time/browser-zone';

type ScheduleNavigationProps = {
  onDayChange(value: string): void;
  onNextDay(): void;
  onNextWeek(): void;
  onPreviousDay(): void;
  onPreviousWeek(): void;
  onToday(): void;
  selectedDay: string;
  weekStart: string;
};

export function ScheduleNavigation({
  onDayChange,
  onNextDay,
  onNextWeek,
  onPreviousDay,
  onPreviousWeek,
  onToday,
  selectedDay,
  weekStart,
}: ScheduleNavigationProps) {
  const start = DateTime.fromISO(weekStart).setLocale(APP_LOCALE);
  const end = start.plus({days: 6});
  const weekLabel = start.isValid ?
    `${start.toFormat('LLL d')} - ${end.toFormat('LLL d, yyyy')}` :
    'Current week';
  const days = Array.from({length: 7}, (_, index) => start.plus({days: index}));

  return (
    <nav aria-label="Schedule navigation" className="schedule-navigation">
      <div className="schedule-navigation-week-controls">
        <button
          aria-label="Previous week"
          className="icon-button"
          onClick={onPreviousWeek}
          title="Previous week"
          type="button"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button className="today-button" onClick={onToday} type="button">
          <CalendarClock aria-hidden="true" className="size-4" />
          Today
        </button>
        <button
          aria-label="Next week"
          className="icon-button"
          onClick={onNextWeek}
          title="Next week"
          type="button"
        >
          <ChevronRight aria-hidden="true" />
        </button>
        <p aria-live="polite" className="week-label">{weekLabel}</p>
      </div>
      <div aria-label="Office week dates" className="schedule-date-strip" role="list">
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
      <div className="schedule-navigation-day-controls">
        <button
          aria-label="Previous day"
          className="icon-button"
          onClick={onPreviousDay}
          title="Previous day"
          type="button"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <label className="control-field day-picker-field">
          <span>Day</span>
          <input
            onChange={(event) => onDayChange(event.target.value)}
            type="date"
            value={selectedDay}
          />
        </label>
        <button
          aria-label="Next day"
          className="icon-button"
          onClick={onNextDay}
          title="Next day"
          type="button"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
