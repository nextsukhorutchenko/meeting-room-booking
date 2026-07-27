import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {BookingList} from '../../src/components/bookings/booking-list';

type BookingItem = {
  id: string;
  room: {id: string; name: string};
  title: string;
  startsAt: string;
  endsAt: string;
  status: 'upcoming' | 'completed' | 'cancelled';
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value) {
      resolvePromise?.(value);
    },
  };
}

function response(
  data: {items: BookingItem[]; nextCursor: string | null} | undefined,
  status = 200,
): Response {
  return {
    json: vi.fn().mockResolvedValue(
      data ? {data} : {error: {message: 'History unavailable'}},
    ),
    ok: status >= 200 && status < 300,
    status,
  } as unknown as Response;
}

function booking(
  id: string,
  options: Partial<BookingItem> = {},
): BookingItem {
  return {
    id,
    room: {id: 'oak', name: 'Oak'},
    title: `Booking ${id}`,
    startsAt: '2026-08-04T07:00:00.000Z',
    endsAt: '2026-08-04T08:00:00.000Z',
    status: 'upcoming',
    ...options,
  };
}

function requestUrl(input: RequestInfo | URL): URL {
  return new URL(
    typeof input === 'string' ? input : input.toString(),
    'http://localhost',
  );
}

function renderBookingList() {
  return render(<BookingList officeTimeZone="Europe/Kyiv" />);
}

describe('BookingList', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows independent loading and empty states for future and past history', async () => {
    const future = deferred<Response>();
    const past = deferred<Response>();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const scope = requestUrl(input).searchParams.get('scope');
      return scope === 'future' ? future.promise : past.promise;
    });

    renderBookingList();
    expect(
      within(screen.getByRole('region', {name: 'Upcoming bookings'}))
        .getByText('Loading upcoming bookings'),
    ).toBeVisible();
    expect(
      within(screen.getByRole('region', {name: 'Past bookings'}))
        .getByText('Loading past bookings'),
    ).toBeVisible();

    await act(async () => {
      future.resolve(response({items: [], nextCursor: null}));
      past.resolve(response({items: [], nextCursor: null}));
    });

    expect(await screen.findByText('No upcoming bookings')).toBeVisible();
    expect(screen.getByText('No past bookings')).toBeVisible();
  });

  it('shows a stable section error without hiding the other section', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const scope = requestUrl(input).searchParams.get('scope');
      return Promise.resolve(
        scope === 'future' ?
          response(undefined, 503) :
          response({items: [], nextCursor: null}),
      );
    });

    renderBookingList();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'History unavailable',
    );
    expect(screen.getByText('No past bookings')).toBeVisible();
  });

  it('appends the next past page in cursor order without duplicate rows', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.searchParams.get('scope') === 'future') {
        return Promise.resolve(response({items: [], nextCursor: null}));
      }
      if (url.searchParams.get('cursor') === 'next-past') {
        return Promise.resolve(response({
          items: [
            booking('past-2', {status: 'completed'}),
            booking('past-3', {status: 'cancelled'}),
          ],
          nextCursor: null,
        }));
      }
      return Promise.resolve(response({
        items: [
          booking('past-1', {status: 'completed'}),
          booking('past-2', {status: 'completed'}),
        ],
        nextCursor: 'next-past',
      }));
    });

    renderBookingList();
    const past = screen.getByRole('region', {name: 'Past bookings'});
    expect(await within(past).findByText('Booking past-1')).toBeVisible();

    await userEvent.setup().click(
      within(past).getByRole('button', {name: 'Load more past bookings'}),
    );

    expect(await within(past).findByText('Booking past-3')).toBeVisible();
    expect(within(past).getAllByText('Booking past-2')).toHaveLength(1);
    expect(within(past).getByText('Cancelled')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/bookings?scope=past&limit=20&cursor=next-past',
      expect.objectContaining({signal: expect.any(AbortSignal)}),
    );
  });

  it('clears a load-more error after a successful retry', async () => {
    let loadMoreCalls = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.searchParams.get('scope') === 'future') {
        return Promise.resolve(response({items: [], nextCursor: null}));
      }
      if (url.searchParams.get('cursor') === 'retry-past') {
        loadMoreCalls += 1;
        return Promise.resolve(
          loadMoreCalls === 1 ?
            response(undefined, 503) :
            response({
              items: [booking('past-recovered', {status: 'completed'})],
              nextCursor: null,
            }),
        );
      }
      return Promise.resolve(response({
        items: [booking('past-initial', {status: 'completed'})],
        nextCursor: 'retry-past',
      }));
    });

    renderBookingList();
    const past = screen.getByRole('region', {name: 'Past bookings'});
    const loadMore = await within(past).findByRole('button', {
      name: 'Load more past bookings',
    });
    await userEvent.setup().click(loadMore);
    expect(await within(past).findByRole('alert')).toHaveTextContent(
      'History unavailable',
    );

    await userEvent.setup().click(loadMore);

    expect(await within(past).findByText('Booking past-recovered')).toBeVisible();
    expect(within(past).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('links a row to its office week and booking highlight', async () => {
    const linked = booking('linked-booking', {title: 'Roadmap review'});
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const scope = requestUrl(input).searchParams.get('scope');
      return Promise.resolve(response({
        items: scope === 'future' ? [linked] : [],
        nextCursor: null,
      }));
    });

    renderBookingList();

    expect(await screen.findByRole('link', {name: 'Roadmap review'}))
      .toHaveAttribute(
        'href',
        '/schedule?roomId=oak&weekStart=2026-08-03&day=2026-08-04' +
        '&bookingId=linked-booking',
      );
  });

  it('reuses confirmation cancellation and removes the future row on success', async () => {
    const cancellable = booking('cancel-me', {title: 'Cancel me'});
    fetchMock.mockImplementation((
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = requestUrl(input);
      if (url.pathname === '/api/bookings/cancel-me' &&
          init?.method === 'DELETE') {
        return Promise.resolve(response(undefined, 204));
      }
      const scope = url.searchParams.get('scope');
      return Promise.resolve(response({
        items: scope === 'future' ? [cancellable] : [],
        nextCursor: null,
      }));
    });

    renderBookingList();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {name: 'Cancel Cancel me'}),
    );
    expect(screen.getByRole('dialog', {name: 'Cancel booking'})).toBeVisible();

    await user.click(screen.getByRole('button', {name: 'Cancel booking'}));
    await waitFor(() => {
      expect(screen.queryByText('Cancel me')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Booking cancelled');
  });
});
