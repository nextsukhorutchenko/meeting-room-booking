'use client';

import {CalendarClock, ChevronLeft, ChevronRight} from 'lucide-react';
import {DateTime} from 'luxon';
import {APP_LOCALE} from '../../lib/time/browser-zone';
import {RoomFilter, type RoomOption} from './room-filter';

type ScheduleToolbarProps = {
  minCapacity: string;
  onDayChange(value: string): void;
  onNextDay(): void;
  onMinCapacityChange(value: string): void;
  onNextWeek(): void;
  onPreviousDay(): void;
  onPreviousWeek(): void;
  onRoomChange(roomId: string): void;
  onToday(): void;
  rooms: RoomOption[];
  selectedDay: string;
  selectedRoomId: string;
  weekStart: string;
};

export function ScheduleToolbar({
  minCapacity,
  onDayChange,
  onNextDay,
  onMinCapacityChange,
  onNextWeek,
  onPreviousDay,
  onPreviousWeek,
  onRoomChange,
  onToday,
  rooms,
  selectedDay,
  selectedRoomId,
  weekStart,
}: ScheduleToolbarProps) {
  const start = DateTime.fromISO(weekStart).setLocale(APP_LOCALE);
  const end = start.plus({days: 6});
  const weekLabel = start.isValid
    ? `${start.toFormat('LLL d')} - ${end.toFormat('LLL d, yyyy')}`
    : 'Current week';

  return (
    <div className="schedule-toolbar">
      <RoomFilter
        minCapacity={minCapacity}
        onMinCapacityChange={onMinCapacityChange}
        onRoomChange={onRoomChange}
        rooms={rooms}
        selectedRoomId={selectedRoomId}
      />
      <div className="week-controls desktop-week-controls">
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
        <p className="week-label" aria-live="polite">{weekLabel}</p>
      </div>
      <div className="mobile-day-controls">
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
    </div>
  );
}
