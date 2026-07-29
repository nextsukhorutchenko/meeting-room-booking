'use client';

import {X} from 'lucide-react';
import {useEffect, useRef} from 'react';
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
  const panelRef = useRef<HTMLElement>(null);
  const isOpen = isBookingDraft(state) || state.status === 'details';
  const selectionGeneration = isBookingDraft(state) ?
    state.selectionGeneration : null;
  const compact = mode === 'tablet' || mode === 'mobile';
  const hidden = !isOpen && mode !== 'expanded';
  const label = isBookingDraft(state) ? `Бронювання: ${state.selection.roomName}` :
    uiCopy.bookingDetails;

  useEffect(() => {
    if (selectionGeneration === null) return;
    panelRef.current?.querySelector<HTMLInputElement>('[name="title"]')?.focus();
  }, [selectionGeneration]);

  useEffect(() => {
    if (!isBookingDraft(state)) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && state.status === 'editing') {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, state]);

  return (
    <div
      aria-hidden={hidden || undefined}
      className="booking-surface"
      data-mode={mode}
      data-open={isOpen}
      hidden={hidden}
      inert={hidden || undefined}
    >
      <div className="booking-surface-backdrop" />
      <section
        aria-label={label}
        aria-modal={compact && isOpen ? true : undefined}
        className="booking-surface-panel"
        ref={panelRef}
        role={compact && isOpen ? 'dialog' : undefined}
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
}
