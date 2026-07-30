import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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

const detailsContext = {
  officeTimeZone: 'Europe/Kyiv',
  roomName: 'Дуб',
  userTimeZone: 'America/New_York',
};

function DetailsHarness() {
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
          detailsContext={detailsContext}
          mode="mobile"
          onCancelDetails={vi.fn()}
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
          detailsContext={detailsContext}
          mode={mode}
          onCancelDetails={vi.fn()}
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
        detailsContext={detailsContext}
        mode="expanded"
        onCancelDetails={vi.fn()}
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
      detailsContext,
      mode: 'tablet' as const,
      onCancelDetails: vi.fn(),
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
      detailsContext,
      onCancelDetails: vi.fn(),
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

  it.each(['expanded', 'medium', 'tablet', 'mobile'] as const)(
    'focuses the title when a slot opens the %s surface',
    async (mode) => {
      render(
        <AdaptiveBookingSurface
          detailsContext={detailsContext}
          mode={mode}
          onCancelDetails={vi.fn()}
          onClose={vi.fn()}
          onEndChange={vi.fn()}
          onRetryRefresh={vi.fn()}
          onSubmit={vi.fn()}
          onTitleChange={vi.fn()}
          state={state}
        />,
      );

      await waitFor(() => expect(screen.getByLabelText('Назва')).toHaveFocus());
    },
  );

  it('refocuses the same title node when a different slot is selected', async () => {
    const props = {
      detailsContext,
      mode: 'expanded' as const,
      onCancelDetails: vi.fn(),
      onClose: vi.fn(),
      onEndChange: vi.fn(),
      onRetryRefresh: vi.fn(),
      onSubmit: vi.fn(),
      onTitleChange: vi.fn(),
    };
    const {rerender} = render(
      <AdaptiveBookingSurface {...props} state={state} />,
    );
    const title = screen.getByLabelText('Назва');
    screen.getByLabelText('Час завершення').focus();

    rerender(
      <AdaptiveBookingSurface
        {...props}
        state={{
          ...state,
          selection: {
            ...state.selection,
            startsAt: '2026-08-04T09:00:00.000Z',
            startTimeLabel: '12:00',
          },
          selectionGeneration: 2,
          title: '',
        }}
      />,
    );

    expect(screen.getByLabelText('Назва').isSameNode(title)).toBe(true);
    await waitFor(() => expect(title).toHaveFocus());
  });

  it('contains the complete compact dialog tab loop in both directions', async () => {
    render(
      <AdaptiveBookingSurface
        detailsContext={detailsContext}
        mode="mobile"
        onCancelDetails={vi.fn()}
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
    const title = within(dialog).getByLabelText('Назва');
    const end = within(dialog).getByLabelText('Час завершення');
    const close = within(dialog).getByRole('button', {
      name: /^Закрити$/,
    });
    const submit = within(dialog).getByRole('button', {name: 'Забронювати'});
    const closePanel = within(dialog).getByRole('button', {
      name: 'Закрити панель бронювання',
    });

    await waitFor(() => expect(title).toHaveFocus());
    for (const expected of [end, close, submit, closePanel, title]) {
      await user.tab();
      expect(expected).toHaveFocus();
    }
    for (const expected of [closePanel, submit, close, end, title]) {
      await user.tab({shift: true});
      expect(expected).toHaveFocus();
    }
  });

  it('contains complete other-booking details and restores its invoker', async () => {
    render(
      <PresentationCoordinator>
        <DetailsHarness />
      </PresentationCoordinator>,
    );
    const user = userEvent.setup();
    const opener = screen.getByRole('button', {name: 'Відкрити деталі'});

    await user.click(opener);

    const dialog = await screen.findByRole('dialog', {
      name: 'Деталі бронювання',
    });
    const details = within(dialog);
    expect(details.getByText('Деталі без дій')).toBeVisible();
    expect(details.getByText('Олена')).toBeVisible();
    expect(details.getByText('Дуб')).toBeVisible();
    expect(details.getByText(/05:00-05:30.*America\/New_York/)).toBeVisible();
    expect(details.getByText(/12:00-12:30.*Europe\/Kyiv/)).toBeVisible();
    expect(details.queryByRole('button', {
      name: 'Скасувати бронювання',
    })).not.toBeInTheDocument();
    await waitFor(() => expect(details.getByRole('button', {
      name: 'Закрити панель бронювання',
    })).toHaveFocus());
    await user.keyboard('{Escape}');

    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.queryByRole('dialog', {name: 'Деталі бронювання'}))
      .not.toBeInTheDocument();
  });

  it('exposes Cancel only for an own booking inside non-modal details', async () => {
    const onCancelDetails = vi.fn();
    const ownDetails: BookingControllerState = {
      ...detailsState,
      booking: {...detailsState.booking, isOwn: true},
    };
    render(
      <AdaptiveBookingSurface
        detailsContext={detailsContext}
        mode="medium"
        onCancelDetails={onCancelDetails}
        onClose={vi.fn()}
        onEndChange={vi.fn()}
        onRetryRefresh={vi.fn()}
        onSubmit={vi.fn()}
        onTitleChange={vi.fn()}
        state={ownDetails}
      />,
    );

    const region = screen.getByRole('region', {name: 'Деталі бронювання'});
    const cancel = within(region).getByRole('button', {
      name: 'Скасувати бронювання',
    });
    await userEvent.setup().click(cancel);

    expect(onCancelDetails).toHaveBeenCalledWith(
      ownDetails.booking,
      cancel,
    );
  });
});
