import '@testing-library/jest-dom/vitest';
import {readFileSync} from 'node:fs';
import {render, screen} from '@testing-library/react';
import {Settings} from 'luxon';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  COMPACT_BOOKING_LAYOUT,
  Timetable,
} from '../../src/components/schedule/timetable';
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

  it('reserves one compact row for the title and status without clipping the time range', () => {
    const css = readFileSync('src/app/styles/timetable.css', 'utf8');
    const contentWidth = COMPACT_BOOKING_LAYOUT.dayCellWidthPx -
      COMPACT_BOOKING_LAYOUT.horizontalPaddingPx * 2;

    expect(
      COMPACT_BOOKING_LAYOUT.titleMinimumWidthPx +
      COMPACT_BOOKING_LAYOUT.inlineGapPx +
      COMPACT_BOOKING_LAYOUT.statusMaximumWidthPx,
    ).toBeLessThanOrEqual(contentWidth);
    expect(css).toMatch(/\.booking-block-heading[\s\S]*grid-template-columns:/);
    expect(css).toMatch(/\.booking-time-label[\s\S]*overflow: visible;/);
    expect(css).toMatch(/--timetable-status-max-width/);
    expect(css).not.toMatch(/\.booking-block \{[^}]*overflow: hidden;/);
  });

  it('labels the current-day header with visible non-color text', () => {
    render(
      <Timetable
        bookings={[]}
        highlightedBookingId={null}
        now="2026-07-29T06:00:00.000Z"
        officeCloseHour={19}
        officeOpenHour={9}
        officeTimeZone="Europe/Kyiv"
        onOpenDetails={vi.fn()}
        onSelectSlot={vi.fn()}
        room={{id: 'maple', name: 'Maple', floor: 3, capacity: 8}}
        userTimeZone="Europe/Kyiv"
        visibleDays={sevenDays}
        weekStart={weekStart}
      />,
    );

    const currentHeader = screen.getByRole('columnheader', {
      name: /Сьогодні/,
    });
    expect(currentHeader).toHaveAttribute('aria-current', 'date');
    expect(currentHeader).toHaveTextContent('Сьогодні');
  });

  it.each([
    {
      booking: {
        ...fourHourBooking,
        id: 'same-zone',
        startsAt: '2026-03-02T07:00:00.000Z',
        endsAt: '2026-03-02T07:30:00.000Z',
        title: 'Одна зона',
      },
      label: /2 березня 2026.*09:00.*2 березня 2026.*09:30.*Europe\/Kyiv/,
      userTimeZone: 'Europe/Kyiv',
      visibleDays: ['2026-03-02'],
      weekStart: '2026-03-02',
    },
    {
      booking: {
        ...fourHourBooking,
        id: 'different-zone',
        startsAt: '2026-03-02T07:00:00.000Z',
        endsAt: '2026-03-02T07:30:00.000Z',
        title: 'Різні зони',
      },
      label: /2 березня 2026.*02:00.*America\/New_York.*09:00.*Europe\/Kyiv/,
      userTimeZone: 'America/New_York',
      visibleDays: ['2026-03-02'],
      weekStart: '2026-03-02',
    },
    {
      booking: {
        ...fourHourBooking,
        id: 'date-crossing',
        startsAt: '2026-07-29T06:00:00.000Z',
        endsAt: '2026-07-29T07:30:00.000Z',
        title: 'Перехід дати',
      },
      label: /28 липня 2026.*29 липня 2026.*America\/Los_Angeles.*29 липня 2026.*Europe\/Kyiv/,
      userTimeZone: 'America/Los_Angeles',
      visibleDays: ['2026-07-29'],
      weekStart,
    },
  ])(
    'gives $booking.title an unambiguous accessible range',
    ({booking, label, userTimeZone, visibleDays, weekStart: fixtureWeek}) => {
      render(
        <Timetable
          bookings={[booking]}
          highlightedBookingId={null}
          now="2026-02-01T00:00:00.000Z"
          officeCloseHour={19}
          officeOpenHour={9}
          officeTimeZone="Europe/Kyiv"
          onOpenDetails={vi.fn()}
          onSelectSlot={vi.fn()}
          room={{id: 'maple', name: 'Maple', floor: 3, capacity: 8}}
          userTimeZone={userTimeZone}
          visibleDays={visibleDays}
          weekStart={fixtureWeek}
        />,
      );

      expect(screen.getByRole('button', {name: label})).toBeVisible();
    },
  );

  it('keeps an empty slot as one accessible native action', () => {
    renderTimetable([], ['2026-07-27']);

    const slot = screen.getAllByRole('button', {name: /Забронювати.*Maple/})[0];
    expect(slot).toHaveTextContent('Вільно');
    expect(slot.querySelector('svg')).toBeTruthy();
  });
});
