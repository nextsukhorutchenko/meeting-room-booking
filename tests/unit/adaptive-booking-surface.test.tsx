import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {BookingControllerState} from
  '../../src/components/schedule/booking-controller';
import {AdaptiveBookingSurface} from
  '../../src/components/schedule/adaptive-booking-surface';

const state: Extract<BookingControllerState, {selection: unknown}> = {
  conflictGeneration: 0,
  createRequestId: null,
  endOptions: [{
    durationLabel: '30 хв',
    durationMinutes: 30,
    endsAt: '2026-08-04T08:30:00.000Z',
    endTimeLabel: '11:30',
    rangeLabel: '11:00-11:30',
  }],
  endsAt: '2026-08-04T08:30:00.000Z',
  fieldErrors: {},
  formError: '',
  liveMessage: '',
  selection: {
    dateLabel: 'Вівторок, 4 серпня',
    roomId: 'oak',
    roomName: 'Дуб',
    startsAt: '2026-08-04T08:00:00.000Z',
    startTimeLabel: '11:00',
    timeZoneLabel: 'Europe/Kyiv',
  },
  selectionGeneration: 1,
  status: 'editing',
  title: 'Планування',
};

afterEach(cleanup);

describe('AdaptiveBookingSurface', () => {
  it('keeps the same composer node and draft while resizing', () => {
    const props = {
      onClose: vi.fn(),
      onEndChange: vi.fn(),
      onRetryRefresh: vi.fn(),
      onSubmit: vi.fn(),
      onTitleChange: vi.fn(),
      state,
    };
    const {rerender} = render(
      <AdaptiveBookingSurface {...props} mode="tablet" />,
    );
    const title = screen.getByLabelText('Назва');

    rerender(<AdaptiveBookingSurface {...props} mode="expanded" />);

    expect(screen.getByLabelText('Назва').isSameNode(title)).toBe(true);
    expect(title).toHaveValue('Планування');
  });
});
