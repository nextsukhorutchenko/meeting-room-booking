import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {DayAgenda} from '../../src/components/schedule/day-agenda';
import type {ScheduleBooking} from '../../src/components/schedule/schedule-types';

const scrollIntoView = vi.fn();

const fourHourBooking: ScheduleBooking = {
  id: 'quarterly-planning',
  title: 'Планування кварталу',
  startsAt: '2026-07-30T06:00:00.000Z',
  endsAt: '2026-07-30T10:00:00.000Z',
  author: {id: 'author-1', name: 'Олена'},
  isOwn: true,
};

const props = {
  bookings: [] as readonly ScheduleBooking[],
  highlightedBookingId: null,
  now: '2026-07-30T06:45:00.000Z',
  officeCloseHour: 19,
  officeDay: '2026-07-30',
  officeOpenHour: 9,
  officeTimeZone: 'Europe/Kyiv',
  onCancel: vi.fn(),
  onOpenDetails: vi.fn(),
  onSelectSlot: vi.fn(),
  positionEpoch: 1,
  room: {id: 'oak', name: 'Oak', floor: 3, capacity: 8},
  selectedStartsAt: null,
  slotSelectionDisabled: false,
  userTimeZone: 'America/New_York',
  weekStart: '2026-07-27',
};

describe('DayAgenda', () => {
  afterEach(() => {
    cleanup();
    scrollIntoView.mockReset();
  });

  it('renders a four-hour booking once and covers all twenty slots', () => {
    render(<DayAgenda {...props} bookings={[fourHourBooking]} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(13);
    expect(screen.getAllByText('Планування кварталу')).toHaveLength(1);
    expect(screen.getByRole('list', {name: /Розклад на/})).toBeVisible();
  });

  it('positions once per epoch without moving focus', () => {
    const focusedBeforeRender = document.createElement('button');
    document.body.append(focusedBeforeRender);
    focusedBeforeRender.focus();
    const {rerender} = render(<DayAgenda {...props} positionEpoch={4} />);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    rerender(<DayAgenda {...props} positionEpoch={4} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(focusedBeforeRender);
    focusedBeforeRender.remove();
  });

  it('disables free-slot actions while selection is pending and reenables them', () => {
    const {container, rerender} = render(
      <DayAgenda {...props} slotSelectionDisabled />,
    );
    const freeSlots = container.querySelectorAll<HTMLButtonElement>(
      '.day-agenda-free .day-agenda-slot-button',
    );

    expect(freeSlots.length).toBeGreaterThan(0);
    freeSlots.forEach((slot) => expect(slot).toBeDisabled());

    rerender(<DayAgenda {...props} slotSelectionDisabled={false} />);

    freeSlots.forEach((slot) => expect(slot).toBeEnabled());
  });
});

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: scrollIntoView,
});
