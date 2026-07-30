import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  PresentationCoordinator,
  usePresentationCoordinator,
} from '../../src/components/app/presentation-coordinator';
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

const detailsState: BookingControllerState = {
  booking: {
    author: {id: 'other', name: 'Олена'},
    endsAt: '2026-08-04T09:30:00.000Z',
    id: 'details',
    isOwn: false,
    startsAt: '2026-08-04T09:00:00.000Z',
    title: 'Деталі без дій',
  },
  selectionGeneration: 1,
  status: 'details',
};

function ZeroFocusableDetailsHarness() {
  const [open, setOpen] = useState(false);
  const {registerBackground, request} = usePresentationCoordinator();
  return (
    <>
      <div ref={registerBackground}>
        <button
          onClick={() => {
            if (request({type: 'OPEN_BOOKING'}) === 'ACCEPTED') {
              setOpen(true);
            }
          }}
          type="button"
        >
          Відкрити деталі
        </button>
      </div>
      {open ? (
        <AdaptiveBookingSurface
          mode="mobile"
          onClose={() => {
            request({type: 'CLOSE_BOOKING'});
            setOpen(false);
          }}
          onEndChange={vi.fn()}
          onRetryRefresh={vi.fn()}
          onSubmit={vi.fn()}
          onTitleChange={vi.fn()}
          state={detailsState}
        />
      ) : null}
    </>
  );
}

afterEach(cleanup);

describe('AdaptiveBookingSurface', () => {
  it.each(['medium', 'tablet', 'mobile'] as const)(
    'hides and inerts the closed %s surface',
    (mode) => {
      const {container} = render(
        <AdaptiveBookingSurface
          mode={mode}
          onClose={vi.fn()}
          onEndChange={vi.fn()}
          onRetryRefresh={vi.fn()}
          onSubmit={vi.fn()}
          onTitleChange={vi.fn()}
          state={{selectionGeneration: 0, status: 'closed'}}
        />,
      );
      const surface = container.querySelector('.booking-surface');

      expect(surface).toHaveAttribute('hidden');
      expect(surface).toHaveAttribute('aria-hidden', 'true');
      expect(surface).toHaveAttribute('inert');
      expect(surface?.querySelectorAll(
        'a, button, input, select, textarea, [tabindex]',
      )).toHaveLength(0);
    },
  );

  it('keeps expanded closed guidance visible and interactive descendants absent', () => {
    const {container} = render(
      <AdaptiveBookingSurface
        mode="expanded"
        onClose={vi.fn()}
        onEndChange={vi.fn()}
        onRetryRefresh={vi.fn()}
        onSubmit={vi.fn()}
        onTitleChange={vi.fn()}
        state={{selectionGeneration: 0, status: 'closed'}}
      />,
    );
    const surface = container.querySelector('.booking-surface');

    expect(screen.getByText(
      'Виберіть вільний час у розкладі, щоб створити бронювання.',
    )).toBeVisible();
    expect(surface).not.toHaveAttribute('hidden');
    expect(surface).not.toHaveAttribute('aria-hidden');
    expect(surface).not.toHaveAttribute('inert');
    expect(surface?.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]',
    )).toHaveLength(0);
  });

  it('keeps the surface and panel nodes while opening and resizing', () => {
    const props = {
      mode: 'tablet' as const,
      onClose: vi.fn(),
      onEndChange: vi.fn(),
      onRetryRefresh: vi.fn(),
      onSubmit: vi.fn(),
      onTitleChange: vi.fn(),
    };
    const {container, rerender} = render(
      <AdaptiveBookingSurface
        {...props}
        state={{selectionGeneration: 0, status: 'closed'}}
      />,
    );
    const surface = container.querySelector('.booking-surface');
    const panel = container.querySelector('.booking-surface-panel');
    if (!surface || !panel) throw new Error('Booking surface is missing');

    rerender(<AdaptiveBookingSurface {...props} state={state} />);
    rerender(<AdaptiveBookingSurface {...props} mode="expanded" state={state} />);

    expect(container.querySelector('.booking-surface')?.isSameNode(surface))
      .toBe(true);
    expect(container.querySelector('.booking-surface-panel')?.isSameNode(panel))
      .toBe(true);
  });

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

  it('contains the complete compact dialog tab loop in both directions', async () => {
    render(
      <AdaptiveBookingSurface
        mode="mobile"
        onClose={vi.fn()}
        onEndChange={vi.fn()}
        onRetryRefresh={vi.fn()}
        onSubmit={vi.fn()}
        onTitleChange={vi.fn()}
        state={state}
      />,
    );
    const user = userEvent.setup();
    const dialog = screen.getByRole('dialog', {name: 'Бронювання: Дуб'});
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled])',
    ));

    expect(focusable).toHaveLength(5);
    for (const expected of focusable) {
      await user.tab();
      expect(expected).toHaveFocus();
    }
    await user.tab();
    expect(focusable[0]).toHaveFocus();
    await user.tab({shift: true});
    expect(focusable.at(-1)).toHaveFocus();
  });

  it('contains and restores a coordinator-backed dialog with no focusable child', async () => {
    render(
      <PresentationCoordinator>
        <ZeroFocusableDetailsHarness />
      </PresentationCoordinator>,
    );
    const user = userEvent.setup();
    const opener = screen.getByRole('button', {name: 'Відкрити деталі'});

    await user.click(opener);

    const dialog = await screen.findByRole('dialog', {
      name: 'Деталі бронювання',
    });
    expect(dialog.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )).toHaveLength(0);
    expect(dialog).toHaveAttribute('tabindex', '-1');
    await waitFor(() => expect(dialog).toHaveFocus());

    await user.tab();
    expect(dialog).toHaveFocus();
    await user.tab({shift: true});
    expect(dialog).toHaveFocus();
    await user.keyboard('{Escape}');

    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.queryByRole('dialog', {name: 'Деталі бронювання'}))
      .not.toBeInTheDocument();
  });
});
