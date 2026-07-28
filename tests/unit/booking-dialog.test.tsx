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
  roomId: 'room-1',
  roomName: 'Oak',
  startsAt: '2026-07-28T06:00:00.000Z',
  startTimeLabel: '09:00',
  timeZoneLabel: 'Europe/Kyiv',
  endTimeOptions: [
    {
      durationLabel: '30 min',
      durationMinutes: 30,
      endsAt: '2026-07-28T06:30:00.000Z',
      endTimeLabel: '09:30',
      rangeLabel: '09:00-09:30',
    },
    {
      durationLabel: '2 hours',
      durationMinutes: 120,
      endsAt: '2026-07-28T08:00:00.000Z',
      endTimeLabel: '11:00',
      rangeLabel: '09:00-11:00',
    },
  ],
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

  function renderDialog(nextSelection: BookingSelection = selection) {
    return render(
      <BookingDialog
        onClose={vi.fn()}
        onCreated={vi.fn()}
        selection={nextSelection}
      />,
    );
  }

  function jsonResponse<T>(body: T, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {'content-type': 'application/json'},
    });
  }

  it('updates the summary and request endsAt from End time', async () => {
    fetchMock.mockResolvedValue(jsonResponse({data: {id: 'booking-1'}}, 201));
    renderDialog();

    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByLabelText('End time'),
      '2026-07-28T08:00:00.000Z',
    );
    expect(screen.getByText(/09:00-11:00/)).toBeVisible();

    await user.type(screen.getByLabelText('Title'), 'Workshop');
    await user.click(screen.getByRole('button', {name: 'Create booking'}));

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      startsAt: selection.startsAt,
      endsAt: '2026-07-28T08:00:00.000Z',
    });
  });

  it('retains a selected end time that remains available after rerendering', async () => {
    const view = renderDialog();
    await userEvent.setup().selectOptions(
      screen.getByLabelText('End time'),
      '2026-07-28T08:00:00.000Z',
    );

    view.rerender(
      <BookingDialog
        onClose={vi.fn()}
        onCreated={vi.fn()}
        selection={{
          ...selection,
          endTimeOptions: selection.endTimeOptions.map((option) => ({
            ...option,
          })),
        }}
      />,
    );

    expect(screen.getByLabelText('End time')).toHaveValue(
      '2026-07-28T08:00:00.000Z',
    );
    expect(screen.getByText(/09:00-11:00/)).toBeVisible();
  });

  it('resets a removed end time to the first available option after rerendering', async () => {
    const view = renderDialog();
    await userEvent.setup().selectOptions(
      screen.getByLabelText('End time'),
      '2026-07-28T08:00:00.000Z',
    );

    view.rerender(
      <BookingDialog
        onClose={vi.fn()}
        onCreated={vi.fn()}
        selection={{...selection, endTimeOptions: [selection.endTimeOptions[0]]}}
      />,
    );

    expect(screen.getByLabelText('End time')).toHaveValue(
      '2026-07-28T06:30:00.000Z',
    );
    expect(screen.getByText(/09:00-09:30/)).toBeVisible();
  });

  it('disables booking when no end time remains available', () => {
    renderDialog({...selection, endTimeOptions: []});

    expect(screen.getByText(
      'This start time is no longer available. Choose another slot.',
    )).toBeVisible();
    expect(screen.getByRole('button', {name: 'Create booking'})).toBeDisabled();
  });

  it('shows a direct verification requirement for EMAIL_NOT_VERIFIED', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Generic server message',
      },
    }), {status: 403, headers: {'content-type': 'application/json'}}));
    renderDialog();

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
