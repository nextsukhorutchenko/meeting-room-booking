'use client';

import {CalendarClock, ChevronLeft, ChevronRight} from 'lucide-react';
import {DateTime} from 'luxon';
import {RoomFilter, type RoomOption} from './room-filter';

type ScheduleToolbarProps = {
  minCapacity: string;
  onMinCapacityChange(value: string): void;
  onNextWeek(): void;
  onPreviousWeek(): void;
  onRoomChange(roomId: string): void;
  onToday(): void;
  rooms: RoomOption[];
  selectedRoomId: string;
  weekStart: string;
};

export function ScheduleToolbar({
  minCapacity,
  onMinCapacityChange,
  onNextWeek,
  onPreviousWeek,
  onRoomChange,
  onToday,
  rooms,
  selectedRoomId,
  weekStart,
}: ScheduleToolbarProps) {
  const start = DateTime.fromISO(weekStart);
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
      <div className="week-controls">
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
    </div>
  );
}
