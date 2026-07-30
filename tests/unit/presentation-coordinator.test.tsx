import '@testing-library/jest-dom/vitest';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useRef, useState, type ReactElement} from 'react';
import {afterEach, describe, expect, it} from 'vitest';
import {
  PresentationCoordinator,
  usePresentationCoordinator,
} from '../../src/components/app/presentation-coordinator';
import {Dialog} from '../../src/components/ui/dialog';

afterEach(() => document.body.replaceChildren());

function CoordinatorHarness(): ReactElement {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [cancellationOpen, setCancellationOpen] = useState(false);
  const bookingCancelRef = useRef<HTMLButtonElement>(null);
  const {modalOwner, request} = usePresentationCoordinator();

  return (
    <>
      <button
        onClick={() => {
          if (request({type: 'OPEN_BOOKING'}) === 'ACCEPTED') {
            setBookingOpen(true);
          }
        }}
        type="button"
      >
        Open booking
      </button>
      <section
        aria-hidden={modalOwner !== 'booking' || undefined}
        data-suspended={modalOwner === 'cancellation' ? 'true' : undefined}
      >
        {bookingOpen ? (
          <Dialog label="Booking" onClose={() => undefined} open owner="booking">
            <div data-suspended={modalOwner === 'cancellation' ? 'true' : undefined}>
              <button
                onClick={(event) => {
                  if (request({
                    trigger: event.currentTarget,
                    type: 'OPEN_CANCEL_FROM_BOOKING',
                  }) === 'ACCEPTED') {
                    setCancellationOpen(true);
                  }
                }}
                ref={bookingCancelRef}
                type="button"
              >
                Скасувати бронювання
              </button>
            </div>
          </Dialog>
        ) : null}
      </section>
      {cancellationOpen ? (
        <Dialog
          label="Скасувати бронювання"
          onClose={() => {
            request({
              bookingRestore: {
                cancelTrigger: bookingCancelRef.current,
                modal: true,
              },
              type: 'KEEP_CANCEL',
            });
            setCancellationOpen(false);
          }}
          open
          owner="cancellation"
        >
          <button
            onClick={() => {
              request({
                bookingRestore: {
                  cancelTrigger: bookingCancelRef.current,
                  modal: true,
                },
                type: 'KEEP_CANCEL',
              });
              setCancellationOpen(false);
            }}
            type="button"
          >
            Залишити бронювання
          </button>
        </Dialog>
      ) : null}
    </>
  );
}

function Harness(): ReactElement {
  return (
    <PresentationCoordinator>
      <CoordinatorHarness />
    </PresentationCoordinator>
  );
}

function SurfaceUnmountHarness({showSurface}: {showSurface: boolean}): ReactElement {
  const {modalOwner, request} = usePresentationCoordinator();
  return (
    <>
      <output>{modalOwner}</output>
      <button
        onClick={(event) => request({
          trigger: event.currentTarget,
          type: 'OPEN_FILTER',
        })}
        type="button"
      >
        Open filter
      </button>
      {showSurface ? (
        <Dialog label="Filter" onClose={() => undefined} open owner="filter">
          <button type="button">Filter control</button>
        </Dialog>
      ) : null}
    </>
  );
}

describe('PresentationCoordinator', () => {
  it('never commits two aria-modal surfaces during booking to cancellation', async () => {
    render(<Harness />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', {name: 'Open booking'}));
    await user.click(screen.getByRole('button', {
      name: 'Скасувати бронювання',
    }));

    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
    expect(screen.getByRole('dialog', {name: 'Скасувати бронювання'}))
      .toBeVisible();
    expect(screen.getByRole('button', {
      name: 'Скасувати бронювання',
    }).parentElement)
      .toHaveAttribute('data-suspended', 'true');
  });

  it('restores the exact booking cancel trigger after Keep', async () => {
    render(<Harness />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', {name: 'Open booking'}));
    const trigger = screen.getByRole('button', {
      name: 'Скасувати бронювання',
    });
    await user.click(trigger);
    await user.click(screen.getByRole('button', {name: 'Залишити бронювання'}));

    await waitFor(() => {
      expect(document.activeElement?.isSameNode(trigger)).toBe(true);
    });
  });

  it('clears an active owner when its registered surface genuinely unmounts', async () => {
    const view = render(
      <PresentationCoordinator>
        <SurfaceUnmountHarness showSurface />
      </PresentationCoordinator>,
    );
    await userEvent.setup().click(screen.getByRole('button', {
      name: 'Open filter',
    }));
    expect(screen.getByRole('dialog', {name: 'Filter'})).toBeVisible();

    view.rerender(
      <PresentationCoordinator>
        <SurfaceUnmountHarness showSurface={false} />
      </PresentationCoordinator>,
    );

    await waitFor(() => {
      expect(screen.getByText('none', {selector: 'output'})).toBeVisible();
    });
  });
});
