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
  formatInUserZone,
  getBrowserTimeZone,
} from '../../lib/time/browser-zone';
import type {
  BookingListItem,
  BookingPage,
} from '../../modules/bookings/booking.types';
import {
  CancelBookingDialog,
  type CancellationSelection,
} from './cancel-booking-dialog';
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
  error?: {message?: unknown};
};

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

function errorMessage(body: ApiResponse, fallback: string): string {
  return typeof body.error?.message === 'string' ?
    body.error.message :
    fallback;
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
  officeTimeZone: string,
): {
  date: string;
  time: string;
} {
  return {
    date: formatInUserZone(booking.startsAt, userTimeZone, {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    }, officeTimeZone),
    time:
      formatInUserZone(booking.startsAt, userTimeZone, {
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
      }, officeTimeZone) +
      '-' +
      formatInUserZone(booking.endsAt, userTimeZone, {
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
      }, officeTimeZone),
  };
}

function statusLabel(status: BookingListItem['status']): string {
  if (status === 'upcoming') {
    return 'Upcoming';
  }
  if (status === 'completed') {
    return 'Completed';
  }
  return 'Cancelled';
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
  const body = await response.json() as ApiResponse;
  if (!response.ok || !isBookingPage(body.data)) {
    throw new Error(errorMessage(body, 'Unable to load booking history.'));
  }
  return body.data;
}

type BookingSectionProps = {
  emptyText: string;
  heading: string;
  loadingText: string;
  officeTimeZone: string;
  onCancel?(booking: CancellationSelection): void;
  onLoadMore(): void;
  state: SectionState;
  userTimeZone: string;
};

function BookingSection({
  emptyText,
  heading,
  loadingText,
  officeTimeZone,
  onCancel,
  onLoadMore,
  state,
  userTimeZone,
}: BookingSectionProps) {
  return (
    <section aria-label={heading} className="booking-history-section">
      <div className="booking-history-section-heading">
        <h2>{heading}</h2>
        {state.status === 'success' && state.items.length > 0 ? (
          <span>{state.items.length} shown</span>
        ) : null}
      </div>
      {state.status === 'loading' ? (
        <p className="booking-history-state">
          <LoaderCircle aria-hidden="true" />
          {loadingText}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p className="booking-history-error" role="alert">{state.error}</p>
      ) : null}
      {state.status === 'success' && state.items.length === 0 ? (
        <p className="booking-history-state">{emptyText}</p>
      ) : null}
      {state.items.length > 0 ? (
        <ul className="booking-list">
          {state.items.map((booking) => {
            const time = formattedTime(
              booking,
              userTimeZone,
              officeTimeZone,
            );
            return (
              <li
                className="booking-list-row"
                data-booking-id={booking.id}
                key={booking.id}
              >
                <div className="booking-list-content">
                  <time dateTime={booking.startsAt}>
                    <strong>{time.date}</strong>
                    <span>{time.time}</span>
                  </time>
                  <div className="booking-list-details">
                    <Link href={bookingUrl(booking, officeTimeZone)}>
                      {booking.title}
                    </Link>
                    <span>{booking.room.name}</span>
                  </div>
                </div>
                <div className="booking-list-actions">
                  <span
                    className={`booking-status booking-status-${booking.status}`}
                  >
                    {statusLabel(booking.status)}
                  </span>
                  {onCancel && booking.status === 'upcoming' ? (
                    <button
                      aria-label={`Cancel ${booking.title}`}
                      className="booking-list-cancel"
                      onClick={() => onCancel({
                        id: booking.id,
                        title: booking.title,
                      })}
                      title="Cancel booking"
                      type="button"
                    >
                      <CalendarX2 aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {state.nextCursor ? (
        <button
          aria-label={`Load more ${heading.toLowerCase()}`}
          className="secondary-button booking-load-more"
          disabled={state.loadingMore}
          onClick={onLoadMore}
          type="button"
        >
          {state.loadingMore ? (
            <LoaderCircle aria-hidden="true" />
          ) : null}
          Load more
        </button>
      ) : null}
    </section>
  );
}

type BookingListProps = {
  officeTimeZone: string;
};

export function BookingList({officeTimeZone}: BookingListProps) {
  const [future, setFuture] = useState<SectionState>(initialState);
  const [past, setPast] = useState<SectionState>(initialState);
  const [cancellation, setCancellation] =
    useState<CancellationSelection | null>(null);
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
  const loadMorePending = useRef<Record<Scope, boolean>>({
    future: false,
    past: false,
  });
  const mounted = useRef(true);

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
            error: error instanceof Error ?
              error.message :
              'Unable to load booking history.',
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
          error: error instanceof Error ?
            error.message :
            'Unable to load booking history.',
          loadingMore: false,
          status: 'error',
        }));
      }
    } finally {
      loadMorePending.current[scope] = false;
    }
  }

  function handleCancelled() {
    if (!cancellation) {
      return;
    }
    setFuture((state) => ({
      ...state,
      items: state.items.filter((booking) => booking.id !== cancellation.id),
    }));
    setCancellation(null);
    setToastMessage('Booking cancelled');
  }

  return (
    <div className="booking-history">
      <BookingSection
        emptyText="No upcoming bookings"
        heading="Upcoming bookings"
        loadingText="Loading upcoming bookings"
        officeTimeZone={officeTimeZone}
        onCancel={setCancellation}
        onLoadMore={() => void loadMore('future', future, setFuture)}
        state={future}
        userTimeZone={userTimeZone}
      />
      <BookingSection
        emptyText="No past bookings"
        heading="Past bookings"
        loadingText="Loading past bookings"
        officeTimeZone={officeTimeZone}
        onLoadMore={() => void loadMore('past', past, setPast)}
        state={past}
        userTimeZone={userTimeZone}
      />
      {cancellation ? (
        <CancelBookingDialog
          booking={cancellation}
          onCancelled={handleCancelled}
          onClose={() => setCancellation(null)}
        />
      ) : null}
      {toastMessage ? <Toast message={toastMessage} /> : null}
    </div>
  );
}
