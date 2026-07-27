import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  BookingDialog,
  type BookingSelection,
} from '../../src/components/schedule/booking-dialog';

const selection: BookingSelection = {
  dateLabel: 'Tuesday, July 28',
  endsAt: '2026-07-28T07:00:00.000Z',
  roomId: 'room-1',
  roomName: 'Oak',
  startsAt: '2026-07-28T06:00:00.000Z',
  timeLabel: '09:00-10:00',
  timeZoneLabel: 'Europe/Kyiv',
};

describe('BookingDialog', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows a direct verification requirement for EMAIL_NOT_VERIFIED', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Generic server message',
      },
    }), {status: 403, headers: {'content-type': 'application/json'}}));
    render(
      <BookingDialog
        onClose={vi.fn()}
        onCreated={vi.fn()}
        selection={selection}
      />,
    );

    await userEvent.setup().type(
      screen.getByLabelText('Title'),
      'Planning',
    );
    await userEvent.setup().click(
      screen.getByRole('button', {name: 'Create booking'}),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Verify your email before booking a room.',
    );
    expect(screen.queryByText('Generic server message')).not.toBeInTheDocument();
  });
});
