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
      name: 'Скасувати бронювання',
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
      name: 'Закрити діалог',
    }));

    expect(onCloseError).toHaveBeenCalledOnce();
  });

  it('uses the backdrop as a dismiss command when cancellation is idle', async () => {
    const onKeep = vi.fn();
    render(
      <CancellationDialog
        booking={{id: 'booking-1', title: 'Roadmap review'}}
        error=""
        onCloseError={vi.fn()}
        onConfirm={vi.fn()}
        onKeep={onKeep}
        pending={false}
      />,
    );

    const backdrop = document.querySelector<HTMLElement>('.dialog-backdrop');
    expect(backdrop).not.toBeNull();
    await userEvent.setup().click(backdrop as HTMLElement);

    expect(onKeep).toHaveBeenCalledOnce();
  });

  it('disables X, Escape, and backdrop dismissal while pending', async () => {
    const onKeep = vi.fn();
    render(
      <CancellationDialog
        booking={{id: 'booking-1', title: 'Roadmap review'}}
        error=""
        onCloseError={vi.fn()}
        onConfirm={vi.fn()}
        onKeep={onKeep}
        pending
      />,
    );

    const closeButton = screen.getByRole('button', {
      name: 'Закрити діалог',
    });
    const backdrop = document.querySelector<HTMLElement>('.dialog-backdrop');
    expect(closeButton).toBeDisabled();
    expect(backdrop).not.toBeNull();

    const user = userEvent.setup();
    await user.click(closeButton);
    await user.keyboard('{Escape}');
    await user.click(backdrop as HTMLElement);

    expect(onKeep).not.toHaveBeenCalled();
  });
});
