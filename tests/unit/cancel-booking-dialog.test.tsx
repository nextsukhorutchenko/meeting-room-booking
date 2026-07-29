import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CancellationDialog} from '../../src/components/bookings/cancellation-dialog';

afterEach(cleanup);

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

describe('CancellationDialog', () => {
  it('keeps DELETE outside the presentational dialog', async () => {
    const onConfirm = vi.fn();
    render(
      <CancellationDialog
        booking={{id: 'booking-1', title: 'Roadmap review'}}
        error=""
        onCloseError={vi.fn()}
        onConfirm={onConfirm}
        onKeep={vi.fn()}
        pending={false}
      />,
    );

    await userEvent.setup().click(screen.getByRole('button', {
      name: 'Cancel booking',
    }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and delegates error dismissal', async () => {
    const onCloseError = vi.fn();
    render(
      <CancellationDialog
        booking={{id: 'booking-1', title: 'Roadmap review'}}
        error="Не вдалося скасувати бронювання."
        onCloseError={onCloseError}
        onConfirm={vi.fn()}
        onKeep={vi.fn()}
        pending={false}
      />,
    );

    await userEvent.setup().click(screen.getByRole('button', {
      name: 'Close dialog',
    }));

    expect(onCloseError).toHaveBeenCalledOnce();
  });
});
