import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  CancelBookingDialog,
  type CancellationSelection,
} from '../../src/components/bookings/cancel-booking-dialog';

const selection: CancellationSelection = {
  id: 'booking-1',
  title: 'Roadmap review',
};

function CancellationHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Cancel Roadmap review
      </button>
      {open ? (
        <CancelBookingDialog
          booking={selection}
          onCancelled={vi.fn()}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

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

  it('contains Tab, Shift+Tab, Escape, and X while pending', async () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => {}));
    const onClose = vi.fn();
    render(
      <>
        <button type="button">Underlying before</button>
        <CancelBookingDialog
          booking={selection}
          onCancelled={vi.fn()}
          onClose={onClose}
        />
        <button type="button">Underlying after</button>
      </>,
    );
    const user = userEvent.setup();
    const confirm = screen.getByRole('button', {name: 'Cancel booking'});
    await user.click(confirm);
    expect(confirm).toBeDisabled();

    const dialog = screen.getByRole('dialog', {name: 'Cancel booking'});
    const close = screen.getByRole('button', {name: 'Close dialog'});
    const underlyingBefore = screen.getByRole('button', {
      name: 'Underlying before',
    });
    const underlyingAfter = screen.getByRole('button', {
      name: 'Underlying after',
    });
    expect(confirm).toHaveFocus();

    const tabFromDisabled = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab',
    });
    document.dispatchEvent(tabFromDisabled);
    expect(tabFromDisabled.defaultPrevented).toBe(true);
    expect(close).toHaveFocus();

    underlyingBefore.focus();
    const tabFromOutside = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab',
    });
    document.dispatchEvent(tabFromOutside);
    expect(tabFromOutside.defaultPrevented).toBe(true);
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(close).toHaveFocus();

    underlyingAfter.focus();
    const shiftTab = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab',
      shiftKey: true,
    });
    document.dispatchEvent(shiftTab);
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(close).toHaveFocus();

    await user.keyboard('{Escape}');
    await user.click(close);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog).toBeVisible();
    expect(underlyingBefore).not.toHaveFocus();
    expect(underlyingAfter).not.toHaveFocus();
  });

  it.each([
    'Keep booking',
    'Close dialog',
    'Escape',
  ])('normal %s close returns focus to the invoking command', async (action) => {
    render(<CancellationHarness />);
    const user = userEvent.setup();
    const command = screen.getByRole('button', {
      name: 'Cancel Roadmap review',
    });
    await user.click(command);
    expect(screen.getByRole('button', {name: 'Keep booking'})).toHaveFocus();

    if (action === 'Escape') {
      await user.keyboard('{Escape}');
    } else {
      await user.click(screen.getByRole('button', {name: action}));
    }

    expect(
      screen.queryByRole('dialog', {name: 'Cancel booking'}),
    ).not.toBeInTheDocument();
    expect(command).toHaveFocus();
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
