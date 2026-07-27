import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  CancelBookingDialog,
  type CancellationSelection,
} from '../../src/components/bookings/cancel-booking-dialog';

const selection: CancellationSelection = {
  id: 'booking-1',
  title: 'Roadmap review',
};

function response(body: unknown, status: number): Response {
  return {
    json: vi.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status,
  } as unknown as Response;
}

describe('CancelBookingDialog', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('requires explicit confirmation and initially focuses Keep booking', async () => {
    const onClose = vi.fn();
    render(
      <CancelBookingDialog
        booking={selection}
        onCancelled={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('button', {name: 'Keep booking'})).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.setup().click(
      screen.getByRole('button', {name: 'Keep booking'}),
    );

    expect(onClose).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('disables actions and prevents duplicate cancellation requests', async () => {
    let resolveRequest: ((value: Response) => void) | undefined;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    }));
    const onCancelled = vi.fn();
    render(
      <CancelBookingDialog
        booking={selection}
        onCancelled={onCancelled}
        onClose={vi.fn()}
      />,
    );

    const confirm = screen.getByRole('button', {name: 'Cancel booking'});
    await userEvent.setup().dblClick(confirm);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/bookings/booking-1', {
      method: 'DELETE',
    });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Keep booking'})).toBeDisabled();

    resolveRequest?.(response(undefined, 204));
    expect(await screen.findByRole('button', {name: 'Cancel booking'}))
      .not.toBeDisabled();
    expect(onCancelled).toHaveBeenCalledOnce();
  });

  it('keeps a server error visible in the open dialog', async () => {
    fetchMock.mockResolvedValue(response({
      error: {message: 'Cancellation is temporarily unavailable.'},
    }, 503));
    const onClose = vi.fn();
    render(
      <CancelBookingDialog
        booking={selection}
        onCancelled={vi.fn()}
        onClose={onClose}
      />,
    );

    await userEvent.setup().click(
      screen.getByRole('button', {name: 'Cancel booking'}),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cancellation is temporarily unavailable.',
    );
    expect(screen.getByRole('dialog', {name: 'Cancel booking'})).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});
