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

vi.mock('../../src/lib/time/browser-zone', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../src/lib/time/browser-zone')
  >()),
  getBrowserTimeZone: () => 'Europe/Kyiv',
}));

type Deferred<T> = {
  promise: Promise<T>;
  reject(reason?: unknown): void;
  resolve(value: T): void;
};

const rooms = [
  {id: 'oak', name: 'Oak', floor: 1, capacity: 6},
  {id: 'pine', name: 'Pine', floor: 2, capacity: 8},
];

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((reason?: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    reject(reason) {
      rejectPromise?.(reason);
    },
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
  bookingHour = 10,
) {
  const startsAt = DateTime.fromISO(weekStart, {zone: 'Europe/Kyiv'})
    .plus({days: 1, hours: bookingHour})
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
  bookingHour = 10,
): Response {
  return jsonResponse(scheduleBody(weekStart, title, bookingHour));
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

  it('keeps a cancelled block after closing a pending conflict refresh', async () => {
    const retiredConflictRefresh = deferred<Response>();
    const cancellationRefresh = deferred<Response>();
    let scheduleRequestCount = 0;
    const initialSchedule = scheduleBody(
      '2026-08-03',
      'Cancellation after conflict close',
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
        if (scheduleRequestCount === 1) {
          return Promise.resolve(jsonResponse(initialSchedule));
        }
        return scheduleRequestCount === 2 ?
          retiredConflictRefresh.promise :
          cancellationRefresh.promise;
      }
      if (url === '/api/bookings' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({
          error: {
            code: 'BOOKING_CONFLICT',
            message: 'This time is already booked. Choose another slot.',
          },
        }, 409));
      }
      if (
        url === '/api/bookings/cancellation-after-conflict-close' &&
        init?.method === 'DELETE'
      ) {
        return Promise.resolve(jsonResponse(undefined, 204));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const block = await screen.findByRole('article', {
      name: /Cancellation after conflict close/,
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', {
      name: /Book Tuesday.*11:00/i,
    }));
    await user.type(screen.getByLabelText('Title'), 'Planning');
    await user.click(screen.getByRole('button', {name: 'Create booking'}));
    await waitFor(() => {
      expect(scheduleRequestCount).toBe(2);
    });

    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    await user.click(screen.getByRole('button', {
      name: 'Cancel Cancellation after conflict close',
    }));
    await user.click(screen.getByRole('button', {name: 'Cancel booking'}));
    await waitFor(() => {
      expect(scheduleRequestCount).toBe(3);
    });

    expect(block).toBeVisible();

    await act(async () => {
      retiredConflictRefresh.resolve(
        scheduleResponse('2026-08-03', 'Retired conflict result', 12),
      );
    });
    expect(block).toBeVisible();
    expect(screen.queryByText('Retired conflict result'))
      .not.toBeInTheDocument();

    await act(async () => {
      cancellationRefresh.resolve(jsonResponse(emptySchedule));
    });
    await waitFor(() => {
      expect(screen.queryByText('Cancellation after conflict close'))
        .not.toBeInTheDocument();
    });
  });

  it('derives multiple end-time options after selecting a free start slot', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(scheduleResponse('2026-08-03', 'Booked at ten'));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {
      name: /Book Tuesday.*11:00/i,
    }));

    expect(screen.getByRole('dialog', {name: 'Book Oak'})).toBeVisible();
    expect(screen.getByLabelText('End time').querySelectorAll('option').length)
      .toBeGreaterThan(1);
  });

  it('preserves the schedule and recomputes end times after a conflict refresh', async () => {
    const refreshedSchedule = deferred<Response>();
    let scheduleRequestCount = 0;

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
          Promise.resolve(scheduleResponse('2026-08-03', 'Booked at ten')) :
          refreshedSchedule.promise;
      }
      if (url === '/api/bookings' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({
          error: {
            code: 'BOOKING_CONFLICT',
            message: 'This time is already booked. Choose another slot.',
          },
        }, 409));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {
      name: /Book Tuesday.*11:00/i,
    }));
    await user.selectOptions(
      screen.getByLabelText('End time'),
      '2026-08-04T10:00:00.000Z',
    );
    await user.type(screen.getByLabelText('Title'), 'Planning');
    await user.click(screen.getByRole('button', {name: 'Create booking'}));
    await waitFor(() => {
      expect(scheduleRequestCount).toBe(2);
    });

    expect(screen.getByText('Booked at ten')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Create booking'})).toBeDisabled();

    await act(async () => {
      refreshedSchedule.resolve(
        scheduleResponse('2026-08-03', 'Booked at noon', 12),
      );
    });

    expect(await screen.findByText('Booked at noon')).toBeVisible();
    expect(screen.getByLabelText('End time')).toHaveValue(
      '2026-08-04T08:30:00.000Z',
    );
    expect(screen.queryByRole('option', {name: '13:00 (2 hours)'}))
      .not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create booking'})).toBeEnabled();
    expect(screen.getByRole('dialog', {name: 'Book Oak'})).toBeVisible();
  });

  it('preserves the schedule and retries a failed conflict refresh', async () => {
    const retriedSchedule = deferred<Response>();
    let scheduleRequestCount = 0;

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
        if (scheduleRequestCount === 1) {
          return Promise.resolve(
            scheduleResponse('2026-08-03', 'Prior schedule'),
          );
        }
        if (scheduleRequestCount === 2) {
          return Promise.resolve(jsonResponse({
            error: {message: 'Service unavailable'},
          }, 503));
        }
        return retriedSchedule.promise;
      }
      if (url === '/api/bookings' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({
          error: {
            code: 'BOOKING_CONFLICT',
            message: 'This time is already booked. Choose another slot.',
          },
        }, 409));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {
      name: /Book Tuesday.*11:00/i,
    }));
    await user.type(screen.getByLabelText('Title'), 'Planning');
    await user.click(screen.getByRole('button', {name: 'Create booking'}));

    expect(await screen.findByText('Unable to refresh availability.'))
      .toBeVisible();
    expect(screen.getByText('Prior schedule')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Create booking'})).toBeDisabled();

    await user.click(
      screen.getByRole('button', {name: 'Retry availability'}),
    );
    await waitFor(() => {
      expect(scheduleRequestCount).toBe(3);
    });
    expect(screen.getByRole('button', {name: 'Create booking'})).toBeDisabled();

    await act(async () => {
      retriedSchedule.resolve(
        scheduleResponse('2026-08-03', 'Retry schedule'),
      );
    });

    expect(await screen.findByText('Retry schedule')).toBeVisible();
    expect(screen.queryByText('Unable to refresh availability.'))
      .not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create booking'})).toBeEnabled();
  });

  it.each([
    {
      navigationLabel: 'Next day',
      selectedDay: '2026-08-03',
    },
    {
      navigationLabel: 'Today',
      selectedDay: '2026-08-05',
    },
  ])(
    'keeps a failed conflict schedule usable after same-week $navigationLabel',
    async ({navigationLabel, selectedDay}) => {
      navigation.searchParams = new URLSearchParams(
        `roomId=oak&weekStart=2026-08-03&day=${selectedDay}`,
      );
      let scheduleRequestCount = 0;

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
            Promise.resolve(
              scheduleResponse('2026-08-03', 'Same-week schedule'),
            ) :
            Promise.resolve(jsonResponse({
              error: {message: 'Service unavailable'},
            }, 503));
        }
        if (url === '/api/bookings' && init?.method === 'POST') {
          return Promise.resolve(jsonResponse({
            error: {
              code: 'BOOKING_CONFLICT',
              message: 'This time is already booked. Choose another slot.',
            },
          }, 409));
        }
        throw new Error(`Unexpected request: ${url}`);
      });

      renderScheduleClient();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', {
        name: /Book Tuesday.*11:00/i,
      }));
      await user.type(screen.getByLabelText('Title'), 'Planning');
      await user.click(screen.getByRole('button', {name: 'Create booking'}));
      expect(await screen.findByText('Unable to refresh availability.'))
        .toBeVisible();

      await user.click(screen.getByRole('button', {name: 'Cancel'}));
      await user.click(screen.getByRole('button', {name: navigationLabel}));

      expect(scheduleRequestCount).toBe(2);
      expect(screen.getAllByText('Same-week schedule')[0]).toBeVisible();
      expect(screen.queryByText('Loading schedule')).not.toBeInTheDocument();
      expect(
        screen.getAllByRole('button', {name: /^Book /}).length,
      ).toBeGreaterThan(0);

      await user.click(screen.getByRole('button', {
        name: /Book Thursday.*13:00/i,
      }));
      expect(screen.getByRole('button', {name: 'Create booking'}))
        .toBeEnabled();
    },
  );

  it('clears a failed conflict refresh when day navigation changes week', async () => {
    navigation.searchParams = new URLSearchParams(
      'roomId=oak&weekStart=2026-08-03&day=2026-08-09',
    );
    let scheduleRequestCount = 0;

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
        if (scheduleRequestCount === 1) {
          return Promise.resolve(
            scheduleResponse('2026-08-03', 'Prior week'),
          );
        }
        if (scheduleRequestCount === 2) {
          return Promise.resolve(jsonResponse({
            error: {message: 'Service unavailable'},
          }, 503));
        }
        return Promise.resolve(
          scheduleResponse('2026-08-10', 'Next week schedule'),
        );
      }
      if (url === '/api/bookings' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({
          error: {
            code: 'BOOKING_CONFLICT',
            message: 'This time is already booked. Choose another slot.',
          },
        }, 409));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const user = userEvent.setup();
    const sundaySlots = await screen.findAllByRole('button', {
      name: /Book Sunday.*11:00/i,
    });
    await user.click(sundaySlots[0]);
    await user.type(screen.getByLabelText('Title'), 'Planning');
    await user.click(screen.getByRole('button', {name: 'Create booking'}));
    expect(await screen.findByText('Unable to refresh availability.'))
      .toBeVisible();

    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    await user.click(screen.getByRole('button', {name: 'Next day'}));
    expect(await screen.findByText('Next week schedule')).toBeVisible();
    const mondaySlots = screen.getAllByRole('button', {
      name: /Book Monday.*11:00/i,
    });
    await user.click(mondaySlots[0]);

    expect(screen.queryByText('Unable to refresh availability.'))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry availability'}))
      .not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create booking'})).toBeEnabled();
  });

  it('clears a failed conflict refresh when the booking dialog closes', async () => {
    let scheduleRequestCount = 0;

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
          Promise.resolve(scheduleResponse('2026-08-03', 'Prior schedule')) :
          Promise.resolve(jsonResponse({
            error: {message: 'Service unavailable'},
          }, 503));
      }
      if (url === '/api/bookings' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({
          error: {
            code: 'BOOKING_CONFLICT',
            message: 'This time is already booked. Choose another slot.',
          },
        }, 409));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {
      name: /Book Tuesday.*11:00/i,
    }));
    await user.type(screen.getByLabelText('Title'), 'Planning');
    await user.click(screen.getByRole('button', {name: 'Create booking'}));
    expect(await screen.findByText('Unable to refresh availability.'))
      .toBeVisible();

    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    await user.click(screen.getByRole('button', {
      name: /Book Tuesday.*13:00/i,
    }));

    expect(screen.queryByText('Unable to refresh availability.'))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry availability'}))
      .not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create booking'})).toBeEnabled();
  });

  it.each(['success', 'rejection'] as const)(
    'ignores late conflict refresh %s after the booking dialog closes',
    async (completion) => {
      const lateRefresh = deferred<Response>();
      let scheduleRequestCount = 0;

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
            Promise.resolve(
              scheduleResponse('2026-08-03', 'Prior schedule'),
            ) :
            lateRefresh.promise;
        }
        if (url === '/api/bookings' && init?.method === 'POST') {
          return Promise.resolve(jsonResponse({
            error: {
              code: 'BOOKING_CONFLICT',
              message: 'This time is already booked. Choose another slot.',
            },
          }, 409));
        }
        throw new Error(`Unexpected request: ${url}`);
      });

      renderScheduleClient();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', {
        name: /Book Tuesday.*11:00/i,
      }));
      await user.type(screen.getByLabelText('Title'), 'Planning');
      await user.click(screen.getByRole('button', {name: 'Create booking'}));
      await waitFor(() => {
        expect(scheduleRequestCount).toBe(2);
      });
      expect(screen.getByRole('button', {name: 'Create booking'}))
        .toBeDisabled();

      await user.click(screen.getByRole('button', {name: 'Cancel'}));
      expect(screen.queryByRole('dialog', {name: 'Book Oak'}))
        .not.toBeInTheDocument();
      expect(screen.getByText('Prior schedule')).toBeVisible();

      await user.click(screen.getByRole('button', {
        name: /Book Tuesday.*13:00/i,
      }));
      expect(screen.queryByText('Unable to refresh availability.'))
        .not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Retry availability'}))
        .not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Create booking'}))
        .toBeEnabled();

      await act(async () => {
        if (completion === 'success') {
          lateRefresh.resolve(
            scheduleResponse('2026-08-03', 'Refreshed schedule', 12),
          );
        } else {
          lateRefresh.reject(new Error('Refresh failed'));
        }
      });
      if (completion === 'success') {
        expect(await screen.findByText('Refreshed schedule')).toBeVisible();
      }

      expect(screen.queryByText('Unable to refresh availability.'))
        .not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Retry availability'}))
        .not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Create booking'}))
        .toBeEnabled();
    },
  );
});
