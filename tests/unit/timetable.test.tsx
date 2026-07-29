import '@testing-library/jest-dom/vitest';
import {render, screen} from '@testing-library/react';
import {Settings} from 'luxon';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Timetable} from '../../src/components/schedule/timetable';
import type {ScheduleBooking} from '../../src/components/schedule/schedule-types';

const weekStart = '2026-07-27';
const sevenDays = [
  '2026-07-27',
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
] as const;

const fourHourBooking: ScheduleBooking = {
  id: 'quarter-planning',
  title: 'Планування кварталу',
  startsAt: '2026-07-27T06:00:00.000Z',
  endsAt: '2026-07-27T10:00:00.000Z',
  author: {id: 'organizer', name: 'Олена Організаторка'},
  isOwn: false,
};

const longBooking: ScheduleBooking = {
  id: 'long-title',
  title: 'Плануваннябезперервногозаголовкадляперевіркикомпактногоосередку',
  startsAt: '2026-07-27T06:00:00.000Z',
  endsAt: '2026-07-27T06:30:00.000Z',
  author: {id: 'organizer', name: 'Олена Організаторка'},
  isOwn: false,
};

function renderTimetable(
  bookings: readonly ScheduleBooking[] = [],
  visibleDays: readonly string[] = sevenDays,
) {
  return render(
    <Timetable
      bookings={bookings}
      highlightedBookingId={null}
      now="2026-07-20T06:00:00.000Z"
      officeCloseHour={19}
      officeOpenHour={9}
      officeTimeZone="Europe/Kyiv"
      onOpenDetails={vi.fn()}
      onSelectSlot={vi.fn()}
      room={{id: 'maple', name: 'Maple', floor: 3, capacity: 8}}
      userTimeZone="Europe/Kyiv"
      visibleDays={visibleDays}
      weekStart={weekStart}
    />,
  );
}

describe('Timetable', () => {
  const originalNow = Settings.now;

  beforeEach(() => {
    Settings.now = () => Date.UTC(2026, 6, 20, 6);
  });

  afterEach(() => {
    Settings.now = originalNow;
  });

  it('renders a native seven-day table with twenty row headers', () => {
    renderTimetable();

    expect(screen.getByRole('table', {
      name: /Розклад переговорної Maple/,
    })).toBeVisible();
    expect(screen.getAllByRole('rowheader')).toHaveLength(20);
    expect(screen.getAllByRole('columnheader')).toHaveLength(8);
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('renders one four-hour booking cell with rowSpan eight', () => {
    renderTimetable([fourHourBooking]);

    expect(screen.getByRole('cell', {name: /Планування кварталу/}))
      .toHaveAttribute('rowspan', '8');
  });

  it('keeps long title, range and status inside a compact booking trigger', () => {
    renderTimetable([longBooking]);

    const trigger = screen.getByRole('button', {name: /Плануваннябезперервного/});
    expect(trigger.querySelector('[data-booking-title]')).toBeVisible();
    expect(trigger).toHaveTextContent('09:00–09:30');
    expect(trigger).toHaveTextContent('Зайнято');
    expect(trigger.querySelector('[aria-label^="Скасувати"]')).toBeNull();
  });

  it('keeps an empty slot as one accessible native action', () => {
    renderTimetable([], ['2026-07-27']);

    const slot = screen.getAllByRole('button', {name: /Забронювати.*Maple/})[0];
    expect(slot).toHaveTextContent('Вільно');
    expect(slot.querySelector('svg')).toBeTruthy();
  });
});
