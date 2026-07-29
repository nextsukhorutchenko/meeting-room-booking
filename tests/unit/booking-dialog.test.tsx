import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {BookingComposer} from '../../src/components/schedule/booking-composer';
import type {BookingControllerState} from
  '../../src/components/schedule/booking-controller';

const state: Extract<BookingControllerState, {selection: unknown}> = {
  conflictGeneration: 0,
  createRequestId: null,
  endOptions: [{
    durationLabel: '30 хв',
    durationMinutes: 30,
    endsAt: '2026-07-28T06:30:00.000Z',
    endTimeLabel: '09:30',
    rangeLabel: '09:00-09:30',
  }, {
    durationLabel: '2 години',
    durationMinutes: 120,
    endsAt: '2026-07-28T08:00:00.000Z',
    endTimeLabel: '11:00',
    rangeLabel: '09:00-11:00',
  }],
  endsAt: '2026-07-28T06:30:00.000Z',
  fieldErrors: {},
  formError: '',
  liveMessage: '',
  selection: {
    dateLabel: 'Вівторок, 28 липня',
    roomId: 'room-1',
    roomName: 'Дуб',
    startsAt: '2026-07-28T06:00:00.000Z',
    startTimeLabel: '09:00',
    timeZoneLabel: 'Europe/Kyiv',
  },
  selectionGeneration: 1,
  status: 'editing',
  title: 'Планування',
};

afterEach(cleanup);

describe('BookingComposer', () => {
  function renderComposer(
    nextState: typeof state = state,
    callbacks = {
      onClose: vi.fn(),
      onEndChange: vi.fn(),
      onRetryRefresh: vi.fn(),
      onSubmit: vi.fn(),
      onTitleChange: vi.fn(),
    },
  ) {
    return render(<BookingComposer {...callbacks} state={nextState} />);
  }

  it('renders the selected controlled end time in the summary', () => {
    renderComposer({...state, endsAt: '2026-07-28T08:00:00.000Z'});

    expect(screen.getByText(/09:00-11:00/)).toBeVisible();
    expect(screen.getByLabelText('Час завершення')).toHaveValue(
      '2026-07-28T08:00:00.000Z',
    );
  });

  it('forwards controlled title and end changes without local draft state', async () => {
    const callbacks = {
      onClose: vi.fn(),
      onEndChange: vi.fn(),
      onRetryRefresh: vi.fn(),
      onSubmit: vi.fn(),
      onTitleChange: vi.fn(),
    };
    renderComposer(state, callbacks);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Назва'), 'X');
    await user.selectOptions(
      screen.getByLabelText('Час завершення'),
      '2026-07-28T08:00:00.000Z',
    );

    expect(callbacks.onTitleChange).toHaveBeenLastCalledWith('ПлануванняX');
    expect(callbacks.onEndChange).toHaveBeenCalledWith(
      '2026-07-28T08:00:00.000Z',
    );
  });

  it('disables close, fields, and submit while a request is pending', () => {
    renderComposer({...state, status: 'submitting'});

    expect(screen.getByLabelText('Назва')).toBeDisabled();
    expect(screen.getByLabelText('Час завершення')).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Закрити'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Забронювати'})).toBeDisabled();
  });
});
