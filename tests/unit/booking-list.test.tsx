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
import {PresentationCoordinator} from '../../src/components/app/presentation-coordinator';

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
  error = {code: 'SERVICE_UNAVAILABLE', message: 'History unavailable'},
): Response {
  return {
    json: vi.fn().mockResolvedValue(
      data ? {data} : {error},
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
  return render(<PresentationCoordinator>
    <BookingList officeTimeZone="Europe/Kyiv" />
  </PresentationCoordinator>);
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
      within(screen.getByRole('region', {name: 'Майбутні'}))
        .getByRole('status'),
    ).toHaveTextContent('Завантажуємо майбутні бронювання');
    expect(
      within(screen.getByRole('region', {name: 'Майбутні'}))
        .getByRole('status'),
    ).toHaveAttribute('aria-live', 'polite');
    expect(
      within(screen.getByRole('region', {name: 'Минулі'}))
        .getByRole('status'),
    ).toHaveTextContent('Завантажуємо минулі бронювання');

    await act(async () => {
      future.resolve(response({items: [], nextCursor: null}));
      past.resolve(response({items: [], nextCursor: null}));
    });

    expect(await screen.findByText('Немає майбутніх бронювань')).toBeVisible();
    expect(screen.getByText('Історія бронювань порожня')).toBeVisible();
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
      'Сервіс тимчасово недоступний. Спробуйте ще раз.',
    );
    expect(screen.queryByText('History unavailable')).not.toBeInTheDocument();
    expect(screen.getByText('Історія бронювань порожня')).toBeVisible();
  });

  it('uses the Ukrainian history fallback for an unknown error payload', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const scope = requestUrl(input).searchParams.get('scope');
      return Promise.resolve(
        scope === 'future' ?
          response(undefined, 500, {
            code: 'UNRECOGNIZED',
            message: 'Unknown history failure',
          }) :
          response({items: [], nextCursor: null}),
      );
    });

    renderBookingList();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не вдалося завантажити історію бронювань. Спробуйте ще раз.',
    );
    expect(screen.queryByText('Unknown history failure')).not.toBeInTheDocument();
  });

  it('retries only the failed initial history section', async () => {
    let futureCalls = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const scope = requestUrl(input).searchParams.get('scope');
      if (scope === 'future') {
        futureCalls += 1;
        return Promise.resolve(
          futureCalls === 1 ?
            response(undefined, 503) :
            response({items: [booking('future-recovered')], nextCursor: null}),
        );
      }
      return Promise.resolve(response({items: [], nextCursor: null}));
    });

    renderBookingList();
    const future = screen.getByRole('region', {name: 'Майбутні'});
    expect(await within(future).findByRole('alert')).toBeVisible();

    await userEvent.setup().click(within(future).getByRole('button', {
      name: 'Повторити майбутні',
    }));

    expect(await within(future).findByText('Booking future-recovered'))
      .toBeVisible();
    expect(within(future).queryByRole('alert')).not.toBeInTheDocument();
    expect(futureCalls).toBe(2);
    expect(fetchMock.mock.calls.filter(([input]) =>
      requestUrl(input).searchParams.get('scope') === 'past')).toHaveLength(1);
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
    const past = screen.getByRole('region', {name: 'Минулі'});
    expect(await within(past).findByText('Booking past-1')).toBeVisible();

    await userEvent.setup().click(
      within(past).getByRole('button', {name: 'Показати ще минулі'}),
    );

    expect(await within(past).findByText('Booking past-3')).toBeVisible();
    expect(within(past).getAllByText('Booking past-2')).toHaveLength(1);
    expect(within(past).getByText('Скасовано')).toBeVisible();
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
    const past = screen.getByRole('region', {name: 'Минулі'});
    const loadMore = await within(past).findByRole('button', {
      name: 'Показати ще минулі',
    });
    await userEvent.setup().click(loadMore);
    expect(await within(past).findByRole('alert')).toHaveTextContent(
      'Сервіс тимчасово недоступний. Спробуйте ще раз.',
    );

    await userEvent.setup().click(loadMore);

    expect(await within(past).findByText('Booking past-recovered')).toBeVisible();
    expect(within(past).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders grouped row link and Cancel as siblings in tab order', async () => {
    const linked = booking('linked-booking', {title: 'Roadmap review'});
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const scope = requestUrl(input).searchParams.get('scope');
      return Promise.resolve(response({
        items: scope === 'future' ? [linked] : [],
        nextCursor: null,
      }));
    });

    renderBookingList();
    const user = userEvent.setup();
    const row = await screen.findByTestId('booking-row-linked-booking');
    const link = row.children[0];
    const cancel = screen.getByRole('button', {
      name: 'Скасувати Roadmap review',
    });

    expect(screen.getByRole('heading', {name: 'Найближче'})).toBeVisible();
    expect(link).toHaveAttribute(
      'href',
      '/schedule?roomId=oak&weekStart=2026-08-03&day=2026-08-04' +
      '&bookingId=linked-booking',
    );
    expect(link).toContainElement(screen.getByText('Roadmap review'));
    expect(link).toContainElement(screen.getByText('Oak'));
    expect(link).toContainElement(screen.getByText('Майбутнє'));
    expect(link.parentElement).toBe(row);
    expect(cancel.parentElement).toBe(row);
    expect(
      link.compareDocumentPosition(cancel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.tab();
    expect(link).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
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
      await screen.findByRole('button', {name: 'Скасувати Cancel me'}),
    );
    const dialog = screen.getByRole('dialog', {name: 'Скасувати бронювання'});
    const link = screen.getByRole('link', {
      name: 'Відкрити Cancel me у розкладі',
    });
    const row = link.closest('li');
    expect(dialog).toBeVisible();
    expect(dialog).not.toContainElement(link);
    expect(row).toBeInTheDocument();

    await user.click(screen.getByRole('button', {
      name: 'Скасувати бронювання',
    }));
    await waitFor(() => {
      expect(screen.queryByText('Cancel me')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Бронювання скасовано').closest('[role="status"]'))
      .toHaveTextContent('Бронювання скасовано');
  });

  it('localizes cancellation API codes without exposing server messages', async () => {
    const cancellable = booking('cancel-error', {title: 'Помилка скасування'});
    fetchMock.mockImplementation((
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = requestUrl(input);
      if (url.pathname === '/api/bookings/cancel-error' &&
          init?.method === 'DELETE') {
        return Promise.resolve(response(
          undefined,
          503,
          {code: 'SERVICE_UNAVAILABLE', message: 'Cancellation failed'},
        ));
      }
      return Promise.resolve(response({
        items: url.searchParams.get('scope') === 'future' ? [cancellable] : [],
        nextCursor: null,
      }));
    });

    renderBookingList();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {
      name: 'Скасувати Помилка скасування',
    }));
    await user.click(screen.getByRole('button', {
      name: 'Скасувати бронювання',
    }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Сервіс тимчасово недоступний. Спробуйте ще раз.',
    );
    expect(screen.getByRole('button', {
      name: 'Залишити бронювання',
    })).toHaveFocus();
    expect(screen.queryByText('Cancellation failed')).not.toBeInTheDocument();
  });
});
