'use client';

import type {ReactNode} from 'react';
import type {ResponsiveMode, VisibleDayCount} from './schedule-types';

export type ScheduleViewportProps = {
  mode: ResponsiveMode;
  selectedDay: string;
  slotSelectionDisabled: boolean;
  visibleTimeAnchor: string | null;
  onVisibleTimeAnchorChange(value: string): void;
  renderAgenda(slotSelectionDisabled: boolean): ReactNode;
  renderTimetable(
    visibleDayCount: VisibleDayCount,
    slotSelectionDisabled: boolean,
  ): ReactNode;
};

export function visibleDayCountForMode(
  mode: ResponsiveMode,
): VisibleDayCount | 1 | null {
  switch (mode) {
    case 'expanded':
      return 7;
    case 'medium':
      return 3;
    case 'tablet':
      return 2;
    case 'mobile':
      return 1;
    case 'unresolved':
      return null;
  }
}

export function ScheduleViewport({
  mode,
  onVisibleTimeAnchorChange,
  renderAgenda,
  renderTimetable,
  selectedDay,
  slotSelectionDisabled,
  visibleTimeAnchor,
}: ScheduleViewportProps) {
  const visibleDayCount = visibleDayCountForMode(mode);
  if (visibleDayCount === null) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading schedule view"
        className="schedule-viewport schedule-viewport-skeleton"
        role="status"
      />
    );
  }

  return (
    <div
      className="schedule-viewport"
      data-selected-day={selectedDay}
      data-visible-time-anchor={visibleTimeAnchor ?? ''}
      onScroll={(event) => {
        onVisibleTimeAnchorChange(String(event.currentTarget.scrollTop));
      }}
    >
      {mode === 'expanded' || mode === 'medium' || mode === 'tablet' ?
        renderTimetable(
          visibleDayCount as VisibleDayCount,
          slotSelectionDisabled,
        ) :
        renderAgenda(slotSelectionDisabled)}
    </div>
  );
}
