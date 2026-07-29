import '@testing-library/jest-dom/vitest';
import {readFileSync} from 'node:fs';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Settings} from 'luxon';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  Timetable,
  type TimetableProps,
} from '../../src/components/schedule/timetable';
import type {ScheduleBooking} from '../../src/components/schedule/schedule-types';

const originalNow = Settings.now;
const sevenDays = [
  '2026-03-02',
  '2026-03-03',
  '2026-03-04',
  '2026-03-05',
  '2026-03-06',
  '2026-03-07',
  '2026-03-08',
] as const;

function booking(
  startsAt: string,
  endsAt: string,
  title: string,
): ScheduleBooking {
  return {
    id: title,
    title,
    startsAt,
    endsAt,
    author: {id: 'organizer', name: 'Demo Organizer'},
    isOwn: true,
  };
}

function renderTimetable(input: {
  bookings: readonly ScheduleBooking[];
  userTimeZone?: string;
  visibleDays?: readonly string[];
  weekStart?: string;
  onSelectSlot?: TimetableProps['onSelectSlot'];
}) {
  render(
    <Timetable
      bookings={input.bookings}
      highlightedBookingId={null}
      now="2026-02-01T00:00:00.000Z"
      officeCloseHour={19}
      officeOpenHour={9}
      officeTimeZone="Europe/Kyiv"
      onOpenDetails={vi.fn()}
      onSelectSlot={input.onSelectSlot ?? vi.fn()}
      room={{id: 'oak', name: 'Oak', floor: 1, capacity: 6}}
      userTimeZone={input.userTimeZone ?? 'America/New_York'}
      visibleDays={input.visibleDays ?? sevenDays}
      weekStart={input.weekStart ?? '2026-03-02'}
    />,
  );
}

describe('Timetable timezone semantics', () => {
  beforeEach(() => {
    Settings.now = () => Date.UTC(2026, 1, 1);
  });

  afterEach(() => {
    cleanup();
    Settings.now = originalNow;
  });

  it('uses one shared user-time row header when browser and office zones match', () => {
    renderTimetable({
      bookings: [booking(
        '2026-03-03T07:00:00.000Z',
        '2026-03-03T07:30:00.000Z',
        'Kyiv booking',
      )],
      userTimeZone: 'Europe/Kyiv',
    });

    expect(screen.getAllByRole('rowheader')).toHaveLength(20);
    expect(screen.getAllByRole('rowheader')[0]).toHaveTextContent('09:00');
    expect(screen.getByRole('columnheader', {name: /Ваш час.*Europe\/Kyiv/}))
      .toBeVisible();
  });

  it('preserves per-day clocks across the US-only DST boundary', async () => {
    const onSelectSlot = vi.fn();
    renderTimetable({
      bookings: [booking(
        '2026-03-08T08:00:00.000Z',
        '2026-03-08T08:30:00.000Z',
        'US transition Sunday',
      )],
      onSelectSlot,
    });

    expect(screen.getAllByRole('columnheader', {name: /America\/New_York/}))
      .toHaveLength(7);
    expect(screen.getByRole('button', {name: /US transition Sunday/}))
      .toHaveTextContent('04:00–04:30');

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', {
      name: /Забронювати.*неділя.*Oak/,
    })[0]);
    expect(onSelectSlot).toHaveBeenCalledWith(expect.objectContaining({
      startsAt: '2026-03-08T07:00:00.000Z',
      startTimeLabel: '03:00',
    }), expect.any(HTMLButtonElement));
  });

  it('preserves per-day clocks across the Kyiv-only DST boundary', () => {
    renderTimetable({
      bookings: [booking(
        '2026-03-29T06:00:00.000Z',
        '2026-03-29T06:30:00.000Z',
        'Kyiv transition Sunday',
      )],
      weekStart: '2026-03-23',
      visibleDays: [
        '2026-03-23',
        '2026-03-24',
        '2026-03-25',
        '2026-03-26',
        '2026-03-27',
        '2026-03-28',
        '2026-03-29',
      ],
    });

    const headers = screen.getAllByRole('columnheader', {
      name: /America\/New_York/,
    });
    expect(headers[0]).toHaveTextContent('03:00-13:00');
    expect(headers[6]).toHaveTextContent('02:00-12:00');
    expect(screen.getByRole('button', {name: /Kyiv transition Sunday/}))
      .toHaveTextContent('02:00–02:30');
  });

  it('retains both dates and zones for a date-crossing user slot', () => {
    renderTimetable({
      bookings: [],
      userTimeZone: 'America/Los_Angeles',
      visibleDays: ['2026-07-29'],
      weekStart: '2026-07-27',
    });

    expect(screen.getByRole('button', {
      name: /28 липня 2026.*23:00.*America\/Los_Angeles.*29 липня 2026.*09:00.*Europe\/Kyiv/,
    })).toBeVisible();
  });

  it('keeps the native one-day agenda layout outside global styles', () => {
    const css = readFileSync('src/app/styles/agenda.css', 'utf8');
    const globals = readFileSync('src/app/globals.css', 'utf8');

    expect(css).toMatch(/\.day-agenda ol/);
    expect(css).toMatch(/\.schedule-jump-controls/);
    expect(globals).not.toMatch(/\.day-schedule/);
    expect(css).not.toMatch(/\.week-grid/);
  });
});
