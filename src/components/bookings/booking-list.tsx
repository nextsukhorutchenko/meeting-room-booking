'use client';

import {
  CalendarX2,
  LoaderCircle,
} from 'lucide-react';
import {DateTime} from 'luxon';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  getBrowserTimeZone,
} from '../../lib/time/browser-zone';
import {
  formatDateShort,
  formatTimeRange,
} from '../../lib/i18n/formatters';
import {localizeApiError} from '../../lib/i18n/ui-errors';
import type {
  BookingListItem,
  BookingPage,
} from '../../modules/bookings/booking.types';
import {
  CancellationDialog,
  type CancellationSelection,
} from './cancellation-dialog';
import {
  groupBookings,
  type BookingGroup,
} from './booking-groups';
import {usePresentationCoordinator} from '../app/presentation-coordinator';
import {Toast} from '../ui/toast';

type Scope = 'future' | 'past';

type SectionState = {
  items: BookingListItem[];
  nextCursor: string | null;
  status: 'loading' | 'success' | 'error';
  error: string;
  loadingMore: boolean;
};

type ApiResponse = {
  data?: unknown;
  error?: {code?: unknown; message?: unknown};
};

class LocalizedRequestError extends Error {}

const pageSize = 20;

function subscribeToBrowserTimeZone(): () => void {
  return () => undefined;
}

function initialState(): SectionState {
  return {
    items: [],
    nextCursor: null,
    status: 'loading',
    error: '',
    loadingMore: false,
  };
}

function isBookingListItem(value: unknown): value is BookingListItem {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Partial<BookingListItem>;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.startsAt === 'string' &&
    DateTime.fromISO(item.startsAt).isValid &&
    typeof item.endsAt === 'string' &&
    DateTime.fromISO(item.endsAt).isValid &&
    ['upcoming', 'completed', 'cancelled'].includes(item.status ?? '') &&
    Boolean(
      item.room &&
      typeof item.room.id === 'string' &&
      typeof item.room.name === 'string',
    )
  );
}

function isBookingPage(value: unknown): value is BookingPage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const page = value as Partial<BookingPage>;
  return (
    Array.isArray(page.items) &&
    page.items.every(isBookingListItem) &&
    (page.nextCursor === null || typeof page.nextCursor === 'string')
  );
}

function errorCode(body: ApiResponse): string | undefined {
  return typeof body.error?.code === 'string' ? body.error.code : undefined;
}

function bookingUrl(
  booking: BookingListItem,
  officeTimeZone: string,
): string {
  const officeStart = DateTime.fromISO(booking.startsAt)
    .setZone(officeTimeZone);
  const weekStart = DateTime.fromISO(booking.startsAt)
    .setZone(officeTimeZone)
    .startOf('week')
    .toFormat('yyyy-LL-dd');
  const parameters = new URLSearchParams({
    roomId: booking.room.id,
    weekStart,
    day: officeStart.toFormat('yyyy-LL-dd'),
    bookingId: booking.id,
  });
  return `/schedule?${parameters.toString()}`;
}

function formattedTime(
  booking: BookingListItem,
  userTimeZone: string,
): {
  date: string;
  time: string;
} {
  return {
    date: formatDateShort(booking.startsAt, userTimeZone),
    time: formatTimeRange(booking.startsAt, booking.endsAt, userTimeZone),
  };
}

function statusLabel(status: BookingListItem['status']): string {
  if (status === 'upcoming') {
    return 'Майбутнє';
  }
  if (status === 'completed') {
    return 'Завершено';
  }
  return 'Скасовано';
}

async function fetchPage(
  scope: Scope,
  cursor: string | null,
  signal: AbortSignal,
): Promise<BookingPage> {
  const parameters = new URLSearchParams({
    scope,
    limit: String(pageSize),
  });
  if (cursor) {
    parameters.set('cursor', cursor);
  }
  const response = await fetch(`/api/me/bookings?${parameters.toString()}`, {
    signal,
  });
  let body: ApiResponse;
  try {
    body = await response.json() as ApiResponse;
  } catch {
    throw new LocalizedRequestError(localizeApiError({
      code: undefined,
      fallback: 'history',
    }));
  }
  if (!response.ok || !isBookingPage(body.data)) {
    throw new LocalizedRequestError(localizeApiError({
      code: errorCode(body),
      fallback: 'history',
    }));
  }
  return body.data;
}

type BookingSectionProps = {
  emptyText: string;
  groups: readonly BookingGroup[];
  heading: string;
  loadingText: string;
  officeTimeZone: string;
  onCancel?(booking: CancellationSelection, invoker: HTMLElement): void;
  onLoadMore(): void;
  onRetry(): void;
  state: SectionState;
  userTimeZone: string;
};

function BookingSection({
  emptyText,
  groups,
  heading,
  loadingText,
  officeTimeZone,
  onCancel,
  onLoadMore,
  onRetry,
  state,
  userTimeZone,
}: BookingSectionProps) {
  return (
    <section aria-label={heading} className="booking-history-section">
      <div className="booking-history-section-heading">
        <h2>{heading}</h2>
      </div>
      {state.status === 'loading' ? (
        <p
          aria-live="polite"
          className="booking-history-state"
          role="status"
        >
          <LoaderCircle aria-hidden="true" />
          {loadingText}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p className="booking-history-error" role="alert">{state.error}</p>
      ) : null}
      {state.status === 'error' && state.items.length === 0 ? (
        <button
          aria-label={`Повторити ${heading.toLowerCase()}`}
          className="secondary-button booking-section-retry"
          onClick={onRetry}
          type="button"
        >
          Повторити
        </button>
      ) : null}
      {state.status === 'success' && state.items.length === 0 ? (
        <p
          aria-live="polite"
          className="booking-history-state"
          role="status"
        >
          {emptyText}
        </p>
      ) : null}
      {state.items.length > 0 ? (
        groups.map((group) => (
          <div
            className={`booking-history-group booking-history-group-${group.kind}`}
            key={`${group.kind}-${group.heading}`}
          >
            <h3>{group.heading}</h3>
            <ul className="booking-list">
              {group.items.map((booking) => {
                const time = formattedTime(booking, userTimeZone);
                return (
                  <li
                    className={
                      onCancel && booking.status === 'upcoming' ?
                        'booking-list-row booking-list-row-cancellable' :
                        'booking-list-row'
                    }
                    data-booking-id={booking.id}
                    data-testid={`booking-row-${booking.id}`}
                    key={booking.id}
                  >
                    <Link
                      aria-label={`Відкрити ${booking.title} у розкладі`}
                      className="booking-list-row-link"
                      href={bookingUrl(booking, officeTimeZone)}
                    >
                      <div className="booking-list-content">
                        <time dateTime={booking.startsAt}>
                          <strong>{time.date}</strong>
                          <span>{time.time}</span>
                        </time>
                        <div className="booking-list-details">
                          <strong className="booking-list-title">
                            {booking.title}
                          </strong>
                          <span>{booking.room.name}</span>
                        </div>
                      </div>
                      <span
                        className={`booking-status booking-status-${booking.status}`}
                      >
                        {statusLabel(booking.status)}
                      </span>
                    </Link>
                    {onCancel && booking.status === 'upcoming' ? (
                      <button
                        aria-label={`Скасувати ${booking.title}`}
                        className="booking-list-cancel"
                        onClick={(event) => onCancel({
                          id: booking.id,
                          title: booking.title,
                        }, event.currentTarget)}
                        title="Скасувати бронювання"
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="booking-list-cancel-visual"
                        >
                          <CalendarX2 />
                        </span>
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      ) : null}
      {state.nextCursor ? (
        <button
          aria-label={state.status === 'error' ?
            `Повторити ${heading.toLowerCase()}` :
            `Показати ще ${heading.toLowerCase()}`}
          className="secondary-button booking-load-more"
          disabled={state.loadingMore}
          onClick={onLoadMore}
          type="button"
        >
          {state.loadingMore ? (
            <LoaderCircle aria-hidden="true" />
          ) : null}
          {state.status === 'error' ? 'Повторити' : 'Показати ще'}
        </button>
      ) : null}
    </section>
  );
}

type BookingListProps = {
  officeTimeZone: string;
};

export function BookingList({officeTimeZone}: BookingListProps) {
  const {modalOwner, request} = usePresentationCoordinator();
  const [future, setFuture] = useState<SectionState>(initialState);
  const [past, setPast] = useState<SectionState>(initialState);
  const [cancellation, setCancellation] = useState<{
    booking: CancellationSelection;
    error: string;
    pending: boolean;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const readBrowserTimeZone = useCallback(
    () => getBrowserTimeZone(officeTimeZone),
    [officeTimeZone],
  );
  const userTimeZone = useSyncExternalStore(
    subscribeToBrowserTimeZone,
    readBrowserTimeZone,
    () => officeTimeZone,
  );
  const groups = groupBookings({
    future: future.items,
    past: past.items,
    userTimeZone,
  });
  const loadMorePending = useRef<Record<Scope, boolean>>({
    future: false,
    past: false,
  });
  const mounted = useRef(true);
  const cancellationRequestIdRef = useRef(0);
  const activeCancellationRequestIdRef = useRef<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    const futureController = new AbortController();
    const pastController = new AbortController();

    async function loadInitial(
      scope: Scope,
      controller: AbortController,
      update: React.Dispatch<React.SetStateAction<SectionState>>,
    ) {
      try {
        const page = await fetchPage(scope, null, controller.signal);
        if (!controller.signal.aborted) {
          update({...initialState(), ...page, status: 'success'});
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          update({
            ...initialState(),
            status: 'error',
            error: error instanceof LocalizedRequestError ?
              error.message :
              localizeApiError({
                code: 'UNKNOWN_TRANSPORT',
                fallback: 'history',
              }),
          });
        }
      }
    }

    void loadInitial('future', futureController, setFuture);
    void loadInitial('past', pastController, setPast);
    return () => {
      mounted.current = false;
      futureController.abort();
      pastController.abort();
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setToastMessage(''), 4_000);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  async function loadMore(
    scope: Scope,
    state: SectionState,
    update: React.Dispatch<React.SetStateAction<SectionState>>,
  ) {
    if (!state.nextCursor || loadMorePending.current[scope]) {
      return;
    }
    loadMorePending.current[scope] = true;
    update((current) => ({...current, loadingMore: true}));
    const controller = new AbortController();
    try {
      const page = await fetchPage(scope, state.nextCursor, controller.signal);
      if (!mounted.current) {
        return;
      }
      update((current) => {
        const ids = new Set(current.items.map((item) => item.id));
        return {
          ...current,
          items: [
            ...current.items,
            ...page.items.filter((item) => !ids.has(item.id)),
          ],
          nextCursor: page.nextCursor,
          error: '',
          loadingMore: false,
          status: 'success',
        };
      });
    } catch (error) {
      if (mounted.current) {
        update((current) => ({
          ...current,
          error: error instanceof LocalizedRequestError ?
            error.message :
            localizeApiError({
              code: 'UNKNOWN_TRANSPORT',
              fallback: 'history',
            }),
          loadingMore: false,
          status: 'error',
        }));
      }
    } finally {
      loadMorePending.current[scope] = false;
    }
  }

  async function retryInitial(
    scope: Scope,
    update: React.Dispatch<React.SetStateAction<SectionState>>,
  ) {
    update({...initialState(), status: 'loading'});
    const controller = new AbortController();
    try {
      const page = await fetchPage(scope, null, controller.signal);
      if (mounted.current) {
        update({...initialState(), ...page, status: 'success'});
      }
    } catch (error) {
      if (mounted.current) {
        update({
          ...initialState(),
          error: error instanceof LocalizedRequestError ?
            error.message :
            localizeApiError({
              code: 'UNKNOWN_TRANSPORT',
              fallback: 'history',
            }),
          status: 'error',
        });
      }
    }
  }

  function openCancellation(booking: CancellationSelection, invoker: HTMLElement) {
    if (request({
      origin: {invoker, kind: 'history'},
      type: 'OPEN_CANCEL_DIRECT',
    }) !== 'ACCEPTED') return;
    setCancellation({booking, error: '', pending: false});
  }

  function closeCancellation(command: 'KEEP_CANCEL' | 'CANCEL_ERROR_CLOSE') {
    if (cancellation?.pending) return;
    if (request({type: command}) === 'ACCEPTED') setCancellation(null);
  }

  function confirmCancellation() {
    if (!cancellation || activeCancellationRequestIdRef.current !== null) return;
    const requestId = ++cancellationRequestIdRef.current;
    const bookingId = cancellation.booking.id;
    activeCancellationRequestIdRef.current = requestId;
    setCancellation((current) => current?.booking.id === bookingId ? {
      ...current,
      error: '',
      pending: true,
    } : current);
    void (async () => {
      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
          method: 'DELETE',
        });
        if (activeCancellationRequestIdRef.current !== requestId) return;
        if (!response.ok) {
          let code: string | undefined;
          try {
            code = errorCode(await response.json() as ApiResponse);
          } catch {
            // The localized fallback covers malformed error responses.
          }
          setCancellation((current) => current?.booking.id === bookingId ? {
            ...current,
            error: localizeApiError({code, fallback: 'cancellation'}),
            pending: false,
          } : current);
          return;
        }
        activeCancellationRequestIdRef.current = null;
        setFuture((state) => ({
          ...state,
          items: state.items.filter((booking) => booking.id !== bookingId),
        }));
        setCancellation(null);
        request({type: 'CANCEL_SUCCESS'});
        setToastMessage('Бронювання скасовано');
      } catch {
        if (activeCancellationRequestIdRef.current !== requestId) return;
        setCancellation((current) => current?.booking.id === bookingId ? {
          ...current,
          error: localizeApiError({
            code: 'UNKNOWN_TRANSPORT',
            fallback: 'cancellation',
          }),
          pending: false,
        } : current);
      } finally {
        if (activeCancellationRequestIdRef.current === requestId) {
          activeCancellationRequestIdRef.current = null;
        }
      }
    })();
  }

  return (
    <div className="booking-history">
      <BookingSection
        emptyText="Немає майбутніх бронювань"
        groups={groups.filter((group) => group.kind !== 'month')}
        heading="Майбутні"
        loadingText="Завантажуємо майбутні бронювання"
        officeTimeZone={officeTimeZone}
        onCancel={openCancellation}
        onLoadMore={() => void loadMore('future', future, setFuture)}
        onRetry={() => void retryInitial('future', setFuture)}
        state={future}
        userTimeZone={userTimeZone}
      />
      <BookingSection
        emptyText="Історія бронювань порожня"
        groups={groups.filter((group) => group.kind === 'month')}
        heading="Минулі"
        loadingText="Завантажуємо минулі бронювання"
        officeTimeZone={officeTimeZone}
        onLoadMore={() => void loadMore('past', past, setPast)}
        onRetry={() => void retryInitial('past', setPast)}
        state={past}
        userTimeZone={userTimeZone}
      />
      {cancellation && modalOwner === 'cancellation' ? (
        <CancellationDialog
          booking={cancellation.booking}
          error={cancellation.error}
          onCloseError={() => closeCancellation('CANCEL_ERROR_CLOSE')}
          onConfirm={confirmCancellation}
          onKeep={() => closeCancellation('KEEP_CANCEL')}
          pending={cancellation.pending}
        />
      ) : null}
      {toastMessage ? <Toast message={toastMessage} /> : null}
    </div>
  );
}
