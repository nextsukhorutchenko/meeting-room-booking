'use client';

import {X} from 'lucide-react';
import {createPortal} from 'react-dom';
import {useCallback, useState, type RefObject} from 'react';
import {
  usePresentationCoordinator,
  usePresentationCoordinatorAvailable,
  usePresentationSurface,
} from '../app/presentation-coordinator';
import {uiCopy} from '../../lib/i18n/ui-copy';
import {formatDateLong, formatTimeRange} from '../../lib/i18n/formatters';
import {BookingComposer, type BookingComposerProps} from './booking-composer';
import type {BookingControllerState} from './booking-controller';
import type {ResponsiveMode, ScheduleBooking} from './schedule-types';
import {useFocusContainment} from '../ui/use-focus-containment';

type AdaptiveBookingSurfaceProps = Omit<BookingComposerProps, 'state'> & {
  detailsContext: {
    officeTimeZone: string;
    roomName: string;
    userTimeZone: string;
  };
  detailsCancelButtonRef?: RefObject<HTMLButtonElement | null>;
  mode: ResponsiveMode;
  onCancelDetails(booking: ScheduleBooking, trigger: HTMLElement): void;
  state: BookingControllerState;
};

function isBookingDraft(
  state: BookingControllerState,
): state is Extract<BookingControllerState, {selection: unknown}> {
  return 'selection' in state;
}

function BookingDetails({
  booking,
  cancelButtonRef,
  context,
  onCancel,
  onClose,
}: {
  booking: ScheduleBooking;
  cancelButtonRef?: RefObject<HTMLButtonElement | null>;
  context: AdaptiveBookingSurfaceProps['detailsContext'];
  onCancel(trigger: HTMLElement): void;
  onClose(): void;
}) {
  const userTime = `${formatDateLong(booking.startsAt, context.userTimeZone)}, ` +
    `${formatTimeRange(
      booking.startsAt,
      booking.endsAt,
      context.userTimeZone,
    )} ${context.userTimeZone}`;
  const officeTime = `${formatDateLong(
    booking.startsAt,
    context.officeTimeZone,
  )}, ${formatTimeRange(
    booking.startsAt,
    booking.endsAt,
    context.officeTimeZone,
  )} ${context.officeTimeZone}`;

  return (
    <div className="booking-details">
      <dl>
        <div>
          <dt>Назва</dt>
          <dd>{booking.title}</dd>
        </div>
        <div>
          <dt>Організатор</dt>
          <dd>{booking.author.name}</dd>
        </div>
        <div>
          <dt>Переговорна</dt>
          <dd>{context.roomName}</dd>
        </div>
        <div>
          <dt>Ваш час</dt>
          <dd>{userTime}</dd>
        </div>
        <div>
          <dt>Час офісу</dt>
          <dd>{officeTime}</dd>
        </div>
      </dl>
      <div className="booking-actions">
        <button className="secondary-button" onClick={onClose} type="button">
          {uiCopy.close}
        </button>
        {booking.isOwn ? (
          <button
            className="destructive-button"
            onClick={(event) => onCancel(event.currentTarget)}
            ref={cancelButtonRef}
            type="button"
          >
            {uiCopy.cancelBooking}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AdaptiveBookingSurface({
  detailsCancelButtonRef,
  detailsContext,
  mode,
  onCancelDetails,
  onClose,
  onEndChange,
  onRetryRefresh,
  onSubmit,
  onTitleChange,
  state,
}: AdaptiveBookingSurfaceProps) {
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const {modalOwner} = usePresentationCoordinator();
  const isOpen = isBookingDraft(state) || state.status === 'details';
  const compact = mode === 'tablet' || mode === 'mobile';
  const hidden = !isOpen && mode !== 'expanded';
  const label = isBookingDraft(state) ? `Бронювання: ${state.selection.roomName}` :
    uiCopy.bookingDetails;
  const ownerActive = usePresentationSurface('booking', panel);
  const hasCoordinator = usePresentationCoordinatorAvailable();
  const modalActive = compact && isOpen && ownerActive;
  const suspended = isOpen && hasCoordinator && (
    modalOwner === 'cancellation' ||
    (compact && !ownerActive)
  );
  const setPanelRef = useCallback((element: HTMLElement | null) => {
    setPanel((current) => current === element ? current : element);
  }, []);
  useFocusContainment({
    active: modalActive,
    container: panel,
    onEscape: onClose,
  });
  const surface = (
    <div
      aria-hidden={hidden || suspended || undefined}
      className="booking-surface"
      data-mode={mode}
      data-open={isOpen}
      data-suspended={suspended ? 'true' : undefined}
      hidden={hidden}
      inert={hidden || suspended || undefined}
    >
      <div className="booking-surface-backdrop" />
      <section
        aria-label={label}
        aria-modal={modalActive || undefined}
        className="booking-surface-panel"
        ref={setPanelRef}
        role={modalActive ? 'dialog' : !hidden && !suspended ? 'region' : undefined}
        tabIndex={modalActive ? -1 : undefined}
      >
        <div className="booking-surface-heading">
          <h2>{isBookingDraft(state) ? uiCopy.book : uiCopy.bookingDetails}</h2>
          {isOpen ? (
            <button
              aria-label="Закрити панель бронювання"
              className="icon-button"
              disabled={isBookingDraft(state) && (
                state.status === 'submitting' ||
                state.status === 'conflictRefreshing'
              )}
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
          <BookingDetails
            booking={state.booking}
            cancelButtonRef={detailsCancelButtonRef}
            context={detailsContext}
            onCancel={(trigger) => onCancelDetails(state.booking, trigger)}
            onClose={onClose}
          />
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
