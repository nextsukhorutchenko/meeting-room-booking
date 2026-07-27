import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {DateTime, Settings} from 'luxon';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ScheduleClient} from '../../src/components/schedule/schedule-client';

const navigation = vi.hoisted(() => ({
  router: {push: vi.fn(), replace: vi.fn()},
  searchParams: new URLSearchParams(
    'roomId=oak&weekStart=2026-08-03',
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation.router,
  useSearchParams: () => navigation.searchParams,
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

const rooms = [
  {id: 'oak', name: 'Oak', floor: 1, capacity: 6},
  {id: 'pine', name: 'Pine', floor: 2, capacity: 8},
];

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

function jsonResponse<T>(
  body: T,
  status = 200,
): Response {
  return {
    json: vi.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status,
  } as unknown as Response;
}

function scheduleBody(
  weekStart: string,
  title: string,
) {
  const startsAt = DateTime.fromISO(weekStart, {zone: 'Europe/Kyiv'})
    .plus({days: 1, hours: 10})
    .toUTC();
  return {
    data: {
      room: rooms[0],
      officeTimeZone: 'Europe/Kyiv',
      officeWeekStart: weekStart,
      range: {
        startsAt: startsAt.startOf('week').toISO(),
        endsAt: startsAt.startOf('week').plus({weeks: 1}).toISO(),
      },
      bookings: [{
        id: title.toLowerCase().replaceAll(' ', '-'),
        title,
        startsAt: startsAt.toISO(),
        endsAt: startsAt.plus({minutes: 30}).toISO(),
        author: {id: 'organizer', name: 'Demo Organizer'},
        isOwn: true,
      }],
    },
  };
}

function scheduleResponse(
  weekStart: string,
  title: string,
): Response {
  return jsonResponse(scheduleBody(weekStart, title));
}

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input.toString();
}

function renderScheduleClient() {
  return render(
    <ScheduleClient
      officeCloseHour={19}
      officeOpenHour={9}
      officeTimeZone="Europe/Kyiv"
    />,
  );
}

describe('ScheduleClient request state', () => {
  const fetchMock = vi.fn();
  const originalNow = Settings.now;

  beforeEach(() => {
    Settings.now = () => Date.UTC(2026, 7, 3, 6);
    navigation.searchParams = new URLSearchParams(
      'roomId=oak&weekStart=2026-08-03',
    );
    navigation.router.push.mockReset();
    navigation.router.replace.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    Settings.now = originalNow;
    vi.unstubAllGlobals();
  });

  it('ignores a superseded schedule response and does not refetch rooms', async () => {
    const oldScheduleJson = deferred<ReturnType<typeof scheduleBody>>();
    const activeSchedule = deferred<Response>();
    const oldResponse = {
      json: vi.fn(() => oldScheduleJson.promise),
      ok: true,
      status: 200,
    } as unknown as Response;

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('weekStart=2026-08-03')) {
        return Promise.resolve(oldResponse);
      }
      if (url.includes('weekStart=2026-08-10')) {
        return activeSchedule.promise;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    await waitFor(() => {
      expect(oldResponse.json).toHaveBeenCalledOnce();
    });

    await userEvent.setup().click(
      screen.getByRole('button', {name: 'Next week'}),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('weekStart=2026-08-10'),
        expect.any(Object),
      );
    });
    expect(
      screen.queryAllByRole('button', {name: /^Book /}),
    ).toHaveLength(0);

    await act(async () => {
      activeSchedule.resolve(
        scheduleResponse('2026-08-10', 'Active booking'),
      );
    });
    expect(await screen.findByText('Active booking')).toBeVisible();
    expect(
      screen.getAllByRole('button', {name: /^Book /}).length,
    ).toBeGreaterThan(0);

    await act(async () => {
      oldScheduleJson.resolve(
        scheduleBody('2026-08-03', 'Stale booking'),
      );
    });

    expect(screen.getByText('Active booking')).toBeVisible();
    expect(screen.queryByText('Stale booking')).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        requestUrl(input as RequestInfo | URL) === '/api/rooms',
      ),
    ).toHaveLength(1);
  });

  it('ignores an old room/week response after search params restore state', async () => {
    const staleScheduleJson = deferred<ReturnType<typeof scheduleBody>>();
    const staleResponse = {
      json: vi.fn(() => staleScheduleJson.promise),
      ok: true,
      status: 200,
    } as unknown as Response;
    navigation.searchParams = new URLSearchParams(
      'roomId=pine&weekStart=2026-08-10&day=2026-08-11',
    );

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (
        url.includes('/api/rooms/pine/schedule') &&
        url.includes('weekStart=2026-08-10')
      ) {
        return Promise.resolve(staleResponse);
      }
      if (
        url.includes('/api/rooms/oak/schedule') &&
        url.includes('weekStart=2026-08-03')
      ) {
        return Promise.resolve(
          scheduleResponse('2026-08-03', 'Active popstate'),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const view = renderScheduleClient();
    await waitFor(() => {
      expect(staleResponse.json).toHaveBeenCalledOnce();
    });

    navigation.searchParams = new URLSearchParams(
      'roomId=oak&weekStart=2026-08-03&day=2026-08-04' +
      '&bookingId=active-popstate',
    );
    view.rerender(
      <ScheduleClient
        officeCloseHour={19}
        officeOpenHour={9}
        officeTimeZone="Europe/Kyiv"
      />,
    );

    const activeBookings = await screen.findAllByRole('article', {
      name: /Active popstate/,
    });
    expect(activeBookings).toHaveLength(2);
    for (const activeBooking of activeBookings) {
      expect(activeBooking).toHaveAttribute('data-highlighted', 'true');
    }

    await act(async () => {
      staleScheduleJson.resolve(
        scheduleBody('2026-08-10', 'Stale popstate'),
      );
    });

    expect(activeBookings[0]).toBeVisible();
    expect(screen.queryByText('Stale popstate')).not.toBeInTheDocument();
  });

  it('removes stale bookings and booking controls after an auth failure', async () => {
    const failedSchedule = deferred<Response>();

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('weekStart=2026-08-03')) {
        return Promise.resolve(
          scheduleResponse('2026-08-03', 'Previously loaded'),
        );
      }
      if (url.includes('weekStart=2026-08-10')) {
        return failedSchedule.promise;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    expect(await screen.findByText('Previously loaded')).toBeVisible();
    expect(
      screen.getAllByRole('button', {name: /^Book /}).length,
    ).toBeGreaterThan(0);

    await userEvent.setup().click(
      screen.getByRole('button', {name: 'Next week'}),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('weekStart=2026-08-10'),
        expect.any(Object),
      );
    });

    await act(async () => {
      failedSchedule.resolve(jsonResponse({
        error: {message: 'Session expired'},
      }, 401));
    });

    expect(await screen.findByText('Session expired')).toBeVisible();
    expect(screen.queryByText('Previously loaded')).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole('button', {name: /^Book /}),
    ).toHaveLength(0);
  });

  it('withholds a same-key schedule while a filtered room reactivates', async () => {
    const restoredSchedule = deferred<Response>();
    let roomRequestCount = 0;
    let scheduleRequestCount = 0;
    let staleBookingAtRestoredRequest = false;
    let bookButtonsAtRestoredRequest = -1;

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        roomRequestCount += 1;
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url === '/api/rooms?minCapacity=9') {
        return Promise.resolve(jsonResponse({data: []}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        scheduleRequestCount += 1;
        if (scheduleRequestCount === 1) {
          return Promise.resolve(
            scheduleResponse('2026-08-03', 'Prior Oak booking'),
          );
        }
        staleBookingAtRestoredRequest =
          screen.queryByText('Prior Oak booking') !== null;
        bookButtonsAtRestoredRequest =
          screen.queryAllByRole('button', {name: /^Book /}).length;
        return restoredSchedule.promise;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    expect(await screen.findByText('Prior Oak booking')).toBeVisible();
    expect(
      screen.getAllByRole('button', {name: /^Book /}).length,
    ).toBeGreaterThan(0);

    const capacity = screen.getByRole('spinbutton', {
      name: 'Minimum capacity',
    });
    const user = userEvent.setup();
    await user.type(capacity, '9');

    expect(
      await screen.findByText('No rooms match this capacity'),
    ).toBeVisible();
    expect(screen.queryByText('Prior Oak booking')).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole('button', {name: /^Book /}),
    ).toHaveLength(0);

    await user.clear(capacity);
    await waitFor(() => {
      expect(scheduleRequestCount).toBe(2);
    });

    expect(roomRequestCount).toBe(2);
    expect(staleBookingAtRestoredRequest).toBe(false);
    expect(bookButtonsAtRestoredRequest).toBe(0);
    expect(screen.queryByText('Prior Oak booking')).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole('button', {name: /^Book /}),
    ).toHaveLength(0);

    await act(async () => {
      restoredSchedule.resolve(
        scheduleResponse('2026-08-03', 'Restored Oak booking'),
      );
    });

    expect(await screen.findByText('Restored Oak booking')).toBeVisible();
    expect(
      screen.getAllByRole('button', {name: /^Book /}).length,
    ).toBeGreaterThan(0);
  });

  it('keeps a cancelled block until the active schedule refetch completes', async () => {
    const refreshedSchedule = deferred<Response>();
    let scheduleRequestCount = 0;
    const initialSchedule = scheduleBody(
      '2026-08-03',
      'Cancellation timing',
    );
    const emptySchedule = {
      data: {
        ...initialSchedule.data,
        bookings: [],
      },
    };

    fetchMock.mockImplementation((
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        scheduleRequestCount += 1;
        return scheduleRequestCount === 1 ?
          Promise.resolve(jsonResponse(initialSchedule)) :
          refreshedSchedule.promise;
      }
      if (
        url === '/api/bookings/cancellation-timing' &&
        init?.method === 'DELETE'
      ) {
        return Promise.resolve(jsonResponse(undefined, 204));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const block = await screen.findByRole('article', {
      name: /Cancellation timing/,
    });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', {name: 'Cancel Cancellation timing'}),
    );
    await user.click(
      screen.getByRole('button', {name: 'Cancel booking'}),
    );
    await waitFor(() => {
      expect(scheduleRequestCount).toBe(2);
    });

    expect(
      screen.queryByRole('dialog', {name: 'Cancel booking'}),
    ).not.toBeInTheDocument();
    expect(block).toBeVisible();

    await act(async () => {
      refreshedSchedule.resolve(jsonResponse(emptySchedule));
    });

    await waitFor(() => {
      expect(screen.queryByText('Cancellation timing'))
        .not.toBeInTheDocument();
    });
  });
});
