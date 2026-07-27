import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Settings} from 'luxon';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  type ScheduleBooking,
  WeekGrid,
} from '../../src/components/schedule/week-grid';

const originalNow = Settings.now;
const originalLocale = Settings.defaultLocale;

function renderWeek(
  weekStart: string,
  booking: ScheduleBooking,
  onSelectSlot = vi.fn(),
) {
  render(
    <WeekGrid
      bookingEnabled
      bookings={[booking]}
      highlightedBookingId={null}
      loading={false}
      officeCloseHour={19}
      officeOpenHour={9}
      officeTimeZone="Europe/Kyiv"
      onCancelBooking={vi.fn()}
      onSelectSlot={onSelectSlot}
      roomId="oak"
      roomName="Oak"
      userTimeZone="America/New_York"
      weekStart={weekStart}
    />,
  );
  return onSelectSlot;
}

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

describe('WeekGrid timezone semantics', () => {
  beforeEach(() => {
    Settings.now = () => Date.UTC(2026, 1, 1);
  });

  afterEach(() => {
    cleanup();
    Settings.now = originalNow;
    Settings.defaultLocale = originalLocale;
  });

  it('uses per-day New York clocks across the US-only DST week', async () => {
    const onSelectSlot = renderWeek(
      '2026-03-02',
      booking(
        '2026-03-08T08:00:00.000Z',
        '2026-03-08T08:30:00.000Z',
        'US transition Sunday',
      ),
    );

    expect(screen.getByTestId('day-user-hours-2026-03-02'))
      .toHaveTextContent('02:00-12:00 EST');
    expect(screen.getByTestId('day-user-hours-2026-03-08'))
      .toHaveTextContent('03:00-13:00 EDT');
    expect(screen.getByRole('article', {name: /US transition Sunday/}))
      .toHaveTextContent('04:00-04:30');

    await userEvent.setup().click(screen.getByRole('button', {
      name: /Book Sunday, March 8, 2026 at 03:00 in Oak/,
    }));
    expect(onSelectSlot).toHaveBeenCalledWith(expect.objectContaining({
      dateLabel: 'Sunday, March 8, 2026',
      startsAt: '2026-03-08T07:00:00.000Z',
      endsAt: '2026-03-08T07:30:00.000Z',
      timeLabel: '03:00-03:30',
    }));
  });

  it('uses per-day New York clocks across the Kyiv-only DST week', () => {
    renderWeek(
      '2026-03-23',
      booking(
        '2026-03-29T06:00:00.000Z',
        '2026-03-29T06:30:00.000Z',
        'Kyiv transition Sunday',
      ),
    );

    expect(screen.getByTestId('day-user-hours-2026-03-23'))
      .toHaveTextContent('03:00-13:00 EDT');
    expect(screen.getByTestId('day-user-hours-2026-03-29'))
      .toHaveTextContent('02:00-12:00 EDT');
    expect(screen.getByRole('article', {name: /Kyiv transition Sunday/}))
      .toHaveTextContent('02:00-02:30');
  });

  it('keeps English day labels when the ambient Luxon locale is French', () => {
    Settings.defaultLocale = 'fr-FR';
    renderWeek(
      '2026-03-02',
      booking(
        '2026-03-08T07:00:00.000Z',
        '2026-03-08T07:30:00.000Z',
        'Locale check',
      ),
    );

    expect(screen.getByRole('columnheader', {name: /Mon, Mar 2/}))
      .toBeVisible();
    expect(screen.getByText('Mar 2')).toBeVisible();
  });
});
