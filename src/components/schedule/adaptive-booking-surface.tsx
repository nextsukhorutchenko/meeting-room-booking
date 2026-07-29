'use client';

import {X} from 'lucide-react';
import {createPortal} from 'react-dom';
import {useCallback, useState} from 'react';
import {
  usePresentationCoordinatorAvailable,
  usePresentationSurface,
} from '../app/presentation-coordinator';
import {uiCopy} from '../../lib/i18n/ui-copy';
import {BookingComposer, type BookingComposerProps} from './booking-composer';
import type {BookingControllerState} from './booking-controller';
import type {ResponsiveMode} from './schedule-types';

type AdaptiveBookingSurfaceProps = Omit<BookingComposerProps, 'state'> & {
  mode: ResponsiveMode;
  state: BookingControllerState;
};

function isBookingDraft(
  state: BookingControllerState,
): state is Extract<BookingControllerState, {selection: unknown}> {
  return 'selection' in state;
}

export function AdaptiveBookingSurface({
  mode,
  onClose,
  onEndChange,
  onRetryRefresh,
  onSubmit,
  onTitleChange,
  state,
}: AdaptiveBookingSurfaceProps) {
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const isOpen = isBookingDraft(state) || state.status === 'details';
  const compact = mode === 'tablet' || mode === 'mobile';
  const hidden = !isOpen && mode !== 'expanded';
  const label = isBookingDraft(state) ? `Бронювання: ${state.selection.roomName}` :
    uiCopy.bookingDetails;
  const ownerActive = usePresentationSurface('booking', panel);
  const hasCoordinator = usePresentationCoordinatorAvailable();
  const modalActive = compact && isOpen && ownerActive;
  const setPanelRef = useCallback((element: HTMLElement | null) => {
    setPanel((current) => current === element ? current : element);
  }, []);
  const surface = (
    <div
      aria-hidden={hidden || (compact && isOpen && !modalActive) || undefined}
      className="booking-surface"
      data-mode={mode}
      data-open={isOpen}
      data-suspended={compact && isOpen && !modalActive ? 'true' : undefined}
      hidden={hidden}
      inert={hidden || undefined}
    >
      <div className="booking-surface-backdrop" />
      <section
        aria-label={label}
        aria-modal={modalActive || undefined}
        className="booking-surface-panel"
        ref={setPanelRef}
        role={modalActive ? 'dialog' : undefined}
      >
        <div className="booking-surface-heading">
          <h2>{isBookingDraft(state) ? uiCopy.book : uiCopy.bookingDetails}</h2>
          {isBookingDraft(state) ? (
            <button
              aria-label="Закрити панель бронювання"
              className="icon-button"
              disabled={state.status === 'submitting' ||
                state.status === 'conflictRefreshing'}
              onClick={onClose}
              title="Закрити панель бронювання"
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {isBookingDraft(state) ? (
          <BookingComposer
            onClose={onClose}
            onEndChange={onEndChange}
            onRetryRefresh={onRetryRefresh}
            onSubmit={onSubmit}
            onTitleChange={onTitleChange}
            state={state}
          />
        ) : state.status === 'details' ? (
          <p className="booking-surface-guidance">{state.booking.title}</p>
        ) : mode === 'expanded' ? (
          <p className="booking-surface-guidance">
            Виберіть вільний час у розкладі, щоб створити бронювання.
          </p>
        ) : null}
      </section>
    </div>
  );
  return hasCoordinator && compact && isOpen && typeof document !== 'undefined' ?
    createPortal(surface, document.body) :
    surface;
}
