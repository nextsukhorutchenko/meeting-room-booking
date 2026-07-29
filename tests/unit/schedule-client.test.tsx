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
import {ScheduleWorkspace} from
  '../../src/components/schedule/schedule-workspace';
import {PresentationCoordinator} from '../../src/components/app/presentation-coordinator';

const navigation = vi.hoisted(() => ({
  router: {push: vi.fn(), replace: vi.fn()},
  searchParams: new URLSearchParams(
    'roomId=oak&weekStart=2026-08-03',
  ),
}));

const scrollIntoView = vi.fn();

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

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

function renderScheduleClient() {
  return render(
    <PresentationCoordinator>
      <ScheduleWorkspace
        officeCloseHour={19}
        officeOpenHour={9}
        officeTimeZone="Europe/Kyiv"
      />
    </PresentationCoordinator>,
  );
}

describe('ScheduleWorkspace request state', {timeout: 60_000}, () => {
  const fetchMock = vi.fn();
  const originalNow = Settings.now;

  beforeEach(() => {
    setViewportWidth(1440);
    Settings.now = () => Date.UTC(2026, 7, 3, 6);
    navigation.searchParams = new URLSearchParams(
      'roomId=oak&weekStart=2026-08-03',
    );
    navigation.router.push.mockReset();
    navigation.router.replace.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    scrollIntoView.mockReset();
  });

  afterEach(() => {
    cleanup();
    Settings.now = originalNow;
    vi.unstubAllGlobals();
    scrollIntoView.mockReset();
  });

  it('positions a same-day jump once without moving focus', async () => {
    setViewportWidth(320);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') return Promise.resolve(jsonResponse({data: rooms}));
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(scheduleResponse('2026-08-03', 'Existing booking'));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    scrollIntoView.mockReset();
    const focusedBeforeJump = screen.getByRole('button', {name: 'Перейти'});
    focusedBeforeJump.focus();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Час'), '2026-08-03T10:00:00.000Z');
    await user.click(focusedBeforeJump);

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(document.activeElement).toBe(focusedBeforeJump);
  });

  it('positions once when week navigation changes the office day', async () => {
    setViewportWidth(320);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') return Promise.resolve(jsonResponse({data: rooms}));
      if (url.includes('weekStart=2026-08-03')) {
        return Promise.resolve(scheduleResponse('2026-08-03', 'First week'));
      }
      if (url.includes('weekStart=2026-08-10')) {
        return Promise.resolve(scheduleResponse('2026-08-10', 'Second week'));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    scrollIntoView.mockReset();
    await userEvent.setup().click(
      screen.getByRole('button', {name: 'Наступний тиждень'}),
    );
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('positions once when URL state restores a different office day', async () => {
    setViewportWidth(320);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') return Promise.resolve(jsonResponse({data: rooms}));
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(scheduleResponse('2026-08-03', 'Popstate booking'));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const view = renderScheduleClient();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    scrollIntoView.mockReset();
    navigation.searchParams = new URLSearchParams(
      'roomId=oak&weekStart=2026-08-03&day=2026-08-04',
    );
    view.rerender(
      <PresentationCoordinator><ScheduleWorkspace
        officeCloseHour={19}
        officeOpenHour={9}
        officeTimeZone="Europe/Kyiv"
      /></PresentationCoordinator>,
    );

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
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
      screen.getByRole('button', {name: 'Наступний тиждень'}),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('weekStart=2026-08-10'),
        expect.any(Object),
      );
    });
    expect(
      screen.queryAllByRole('button', {name: /^Забронювати /}),
    ).toHaveLength(0);

    await act(async () => {
      activeSchedule.resolve(
        scheduleResponse('2026-08-10', 'Active booking'),
      );
    });
    expect(await screen.findByText('Active booking')).toBeVisible();
    expect(
      screen.getAllByRole('button', {name: /^Забронювати /}).length,
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
      <PresentationCoordinator><ScheduleWorkspace
        officeCloseHour={19}
        officeOpenHour={9}
        officeTimeZone="Europe/Kyiv"
      /></PresentationCoordinator>,
    );

    const activeBookings = await screen.findAllByRole('button', {
      name: /Active popstate/,
    });
    expect(activeBookings).toHaveLength(1);
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

  it('keeps one rooms request and one schedule request across resize', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(scheduleResponse('2026-08-03', 'Stable'));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    await screen.findByText('Stable');

    await act(async () => {
      setViewportWidth(768);
      setViewportWidth(1440);
    });

    expect(
      fetchMock.mock.calls.filter(([input]) =>
        requestUrl(input as RequestInfo | URL) === '/api/rooms',
      ),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        requestUrl(input as RequestInfo | URL).includes(
          '/schedule?weekStart=',
        ),
      ),
    ).toHaveLength(1);
    expect(screen.getByRole('table', {name: /Розклад переговорної Oak/}))
      .toBeVisible();
    expect(screen.queryByRole('grid'))
      .not.toBeInTheDocument();
  });

  it('selects both own and other timetable bookings through the booking URL', async () => {
    const response = scheduleBody('2026-08-03', 'Власне бронювання');
    response.data.bookings[0] = {
      ...response.data.bookings[0],
      id: 'own-booking',
    };
    response.data.bookings.push({
      ...response.data.bookings[0],
      endsAt: DateTime.fromISO(response.data.bookings[0].endsAt ?? '')
        .plus({minutes: 30})
        .toUTC()
        .toISO() ?? '',
      id: 'other-booking',
      isOwn: false,
      startsAt: response.data.bookings[0].endsAt,
      title: 'Чуже бронювання',
    });
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(jsonResponse(response));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const view = renderScheduleClient();
    const user = userEvent.setup();
    const other = await screen.findByRole('button', {name: /Чуже бронювання/});

    await user.click(other);
    expect(navigation.router.replace).toHaveBeenLastCalledWith(
      '/schedule?roomId=oak&weekStart=2026-08-03&day=2026-08-03&bookingId=other-booking',
      {scroll: false},
    );
    navigation.searchParams = new URLSearchParams(
      'roomId=oak&weekStart=2026-08-03&day=2026-08-03&bookingId=other-booking',
    );
    view.rerender(
      <PresentationCoordinator><ScheduleWorkspace
        officeCloseHour={19}
        officeOpenHour={9}
        officeTimeZone="Europe/Kyiv"
      /></PresentationCoordinator>,
    );
    expect(screen.getByRole('button', {name: /Чуже бронювання/}))
      .toHaveAttribute('data-highlighted', 'true');
    expect(screen.queryByRole('dialog', {name: 'Cancel booking'}))
      .not.toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: /Власне бронювання/}));
    expect(navigation.router.replace).toHaveBeenLastCalledWith(
      '/schedule?roomId=oak&weekStart=2026-08-03&day=2026-08-03&bookingId=own-booking',
      {scroll: false},
    );
    navigation.searchParams = new URLSearchParams(
      'roomId=oak&weekStart=2026-08-03&day=2026-08-03&bookingId=own-booking',
    );
    view.rerender(
      <PresentationCoordinator><ScheduleWorkspace
        officeCloseHour={19}
        officeOpenHour={9}
        officeTimeZone="Europe/Kyiv"
      /></PresentationCoordinator>,
    );
    expect(screen.getByRole('button', {name: /Власне бронювання/}))
      .toHaveAttribute('data-highlighted', 'true');
    expect(await screen.findByRole('dialog', {name: 'Cancel booking'}))
      .toBeVisible();
  });

  it('closes compact room filters when resizing to the desktop rail', async () => {
    setViewportWidth(768);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(scheduleResponse('2026-08-03', 'Stable'));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', {
      name: 'Відкрити фільтри переговорних',
    }));
    expect(screen.getByRole('dialog', {
      name: 'Фільтри переговорних',
    })).toBeVisible();
    await act(async () => setViewportWidth(1440));

    expect(screen.queryByRole('dialog', {
      name: 'Фільтри переговорних',
    })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', {
      name: 'Вибір переговорної',
    })).toBeVisible();
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
      screen.getAllByRole('button', {name: /^Забронювати /}).length,
    ).toBeGreaterThan(0);

    await userEvent.setup().click(
      screen.getByRole('button', {name: 'Наступний тиждень'}),
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
      screen.queryAllByRole('button', {name: /^Забронювати /}),
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
          screen.queryAllByRole('button', {name: /^Забронювати /}).length;
        return restoredSchedule.promise;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    expect(await screen.findByText('Prior Oak booking')).toBeVisible();
    expect(
      screen.getAllByRole('button', {name: /^Забронювати /}).length,
    ).toBeGreaterThan(0);

    const capacity = screen.getByRole('spinbutton', {
      name: 'Мінімальна місткість',
    });
    const user = userEvent.setup();
    await user.type(capacity, '9');

    expect(
      await screen.findByText('Немає переговорних із такою місткістю'),
    ).toBeVisible();
    expect(screen.queryByText('Prior Oak booking')).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole('button', {name: /^Забронювати /}),
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
      screen.queryAllByRole('button', {name: /^Забронювати /}),
    ).toHaveLength(0);

    await act(async () => {
      restoredSchedule.resolve(
        scheduleResponse('2026-08-03', 'Restored Oak booking'),
      );
    });

    expect(await screen.findByText('Restored Oak booking')).toBeVisible();
    expect(
      screen.getAllByRole('button', {name: /^Забронювати /}).length,
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
    const block = await screen.findByRole('button', {
      name: /Cancellation timing/,
    });
    const user = userEvent.setup();
    await user.click(block);
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

  it.each(['success', 'error'] as const)(
    'ignores a stale cancellation %s after schedule navigation opens another cancellation',
    async (completion) => {
      const deletes = [deferred<Response>(), deferred<Response>()];
      let deleteRequestCount = 0;
      fetchMock.mockImplementation((
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
        const url = requestUrl(input);
        if (url === '/api/rooms') {
          return Promise.resolve(jsonResponse({data: rooms}));
        }
        if (url.includes('/api/rooms/oak/schedule')) {
          return Promise.resolve(scheduleResponse('2026-08-03', 'Stale cancellation'));
        }
        if (url === '/api/bookings/stale-cancellation' && init?.method === 'DELETE') {
          return deletes[deleteRequestCount++].promise;
        }
        throw new Error(`Unexpected request: ${url}`);
      });

      const view = renderScheduleClient();
      const user = userEvent.setup();
      const block = await screen.findByRole('button', {
        name: /Stale cancellation/,
      });
      await user.click(block);
      await user.click(screen.getByRole('button', {name: 'Cancel booking'}));
      await waitFor(() => expect(deleteRequestCount).toBe(1));

      navigation.searchParams = new URLSearchParams(
        'roomId=oak&weekStart=2026-08-03&day=2026-08-05',
      );
      view.rerender(
        <PresentationCoordinator>
          <ScheduleWorkspace
            officeCloseHour={19}
            officeOpenHour={9}
            officeTimeZone="Europe/Kyiv"
          />
        </PresentationCoordinator>,
      );
      await waitFor(() => {
        expect(screen.queryByRole('dialog', {name: 'Cancel booking'}))
          .not.toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', {name: /Stale cancellation/}));
      await user.click(screen.getByRole('button', {name: 'Cancel booking'}));
      await waitFor(() => expect(deleteRequestCount).toBe(2));

      await act(async () => {
        if (completion === 'success') {
          deletes[0].resolve(jsonResponse(undefined, 204));
        } else {
          deletes[0].reject(new Error('stale request failure'));
        }
      });

      expect(screen.getByRole('dialog', {name: 'Cancel booking'})).toBeVisible();
      expect(screen.getByRole('button', {name: 'Cancel booking'})).toBeDisabled();
      expect(screen.queryByText('Не вдалося скасувати бронювання.'))
        .not.toBeInTheDocument();
    },
  );

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
    const block = await screen.findByRole('button', {
      name: /Cancellation after conflict close/,
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', {
      name: /Забронювати вівторок.*11:00/i,
    }));
    await user.type(screen.getByLabelText('Назва'), 'Planning');
    await user.click(screen.getByRole('button', {name: 'Забронювати'}));
    await waitFor(() => {
      expect(scheduleRequestCount).toBe(2);
    });

    await user.click(screen.getByRole('button', {name: 'Закрити'}));
    await user.click(block);
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
      name: /Забронювати вівторок.*11:00/i,
    }));

    expect(screen.getByLabelText('Назва')).toBeVisible();
    expect(screen.getByLabelText('Час завершення').querySelectorAll('option').length)
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
      name: /Забронювати вівторок.*11:00/i,
    }));
    await user.selectOptions(
      screen.getByLabelText('Час завершення'),
      '2026-08-04T10:00:00.000Z',
    );
    await user.type(screen.getByLabelText('Назва'), 'Planning');
    await user.click(screen.getByRole('button', {name: 'Забронювати'}));
    await waitFor(() => {
      expect(scheduleRequestCount).toBe(2);
    });

    expect(screen.getByText('Booked at ten')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Забронювати'})).toBeDisabled();

    await act(async () => {
      refreshedSchedule.resolve(
        scheduleResponse('2026-08-03', 'Booked at noon', 12),
      );
    });

    expect(await screen.findByText('Booked at noon')).toBeVisible();
    expect(screen.getByLabelText('Час завершення')).toHaveValue(
      '2026-08-04T08:30:00.000Z',
    );
    expect(screen.queryByRole('option', {name: '13:00 (2 год)'}))
      .not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Забронювати'})).toBeEnabled();
    expect(screen.getByLabelText('Назва')).toBeVisible();
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
      name: /Забронювати вівторок.*11:00/i,
    }));
    await user.type(screen.getByLabelText('Назва'), 'Planning');
    await user.click(screen.getByRole('button', {name: 'Забронювати'}));

    expect(await screen.findByText('Не вдалося оновити доступність.'))
      .toBeVisible();
    expect(screen.getByText('Prior schedule')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Забронювати'})).toBeDisabled();

    await user.click(
      screen.getByRole('button', {name: 'Оновити доступність'}),
    );
    await waitFor(() => {
      expect(scheduleRequestCount).toBe(3);
    });
    expect(screen.getByRole('button', {name: 'Забронювати'})).toBeDisabled();

    await act(async () => {
      retriedSchedule.resolve(
        scheduleResponse('2026-08-03', 'Retry schedule'),
      );
    });

    expect(await screen.findByText('Retry schedule')).toBeVisible();
    expect(screen.queryByText('Не вдалося оновити доступність.'))
      .not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Забронювати'})).toBeEnabled();
  });

  it.each([
    {
      navigationLabel: 'Наступний день',
      selectedDay: '2026-08-03',
      nextDay: '2026-08-04',
    },
    {
      navigationLabel: 'Сьогодні',
      selectedDay: '2026-08-05',
      nextDay: null,
    },
  ])(
    'keeps a failed conflict schedule usable after same-week $navigationLabel',
    async ({navigationLabel, nextDay, selectedDay}) => {
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
        name: /Забронювати вівторок.*11:00/i,
      }));
      await user.type(screen.getByLabelText('Назва'), 'Planning');
      await user.click(screen.getByRole('button', {name: 'Забронювати'}));
      expect(await screen.findByText('Не вдалося оновити доступність.'))
        .toBeVisible();

      if (nextDay) {
        await user.selectOptions(screen.getByLabelText('День'), nextDay);
      } else {
        await user.click(screen.getByRole('button', {name: navigationLabel}));
      }

      expect(scheduleRequestCount).toBe(2);
      expect(screen.getAllByText('Same-week schedule')[0]).toBeVisible();
      expect(screen.queryByText('Loading schedule')).not.toBeInTheDocument();
      expect(
        screen.getAllByRole('button', {name: /^Забронювати /}).length,
      ).toBeGreaterThan(0);

      await user.click(screen.getByRole('button', {
        name: /Забронювати четвер.*13:00/i,
      }));
      expect(screen.getByRole('button', {name: 'Забронювати'}))
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
      name: /Забронювати неділя.*11:00/i,
    });
    await user.click(sundaySlots[0]);
    await user.type(screen.getByLabelText('Назва'), 'Planning');
    await user.click(screen.getByRole('button', {name: 'Забронювати'}));
    expect(await screen.findByText('Не вдалося оновити доступність.'))
      .toBeVisible();

    await user.click(screen.getByRole('button', {name: 'Наступний тиждень'}));
    expect(await screen.findByText('Next week schedule')).toBeVisible();
    const mondaySlots = screen.getAllByRole('button', {
      name: /Забронювати понеділок.*11:00/i,
    });
    await user.click(mondaySlots[0]);

    expect(screen.queryByText('Не вдалося оновити доступність.'))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Оновити доступність'}))
      .not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Забронювати'})).toBeEnabled();
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
      name: /Забронювати вівторок.*11:00/i,
    }));
    await user.type(screen.getByLabelText('Назва'), 'Planning');
    await user.click(screen.getByRole('button', {name: 'Забронювати'}));
    expect(await screen.findByText('Не вдалося оновити доступність.'))
      .toBeVisible();

    await user.click(screen.getByRole('button', {name: 'Закрити'}));
    await user.click(screen.getByRole('button', {
      name: /Забронювати вівторок.*13:00/i,
    }));

    expect(screen.queryByText('Не вдалося оновити доступність.'))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Оновити доступність'}))
      .not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Забронювати'})).toBeEnabled();
  });

  it.each(['success', 'rejection'] as const)(
    'keeps the pending composer closed to duplicate actions during a %s refresh',
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
        name: /Забронювати вівторок.*11:00/i,
      }));
      await user.type(screen.getByLabelText('Назва'), 'Planning');
      await user.click(screen.getByRole('button', {name: 'Забронювати'}));
      await waitFor(() => {
        expect(scheduleRequestCount).toBe(2);
      });
      expect(screen.getByRole('button', {name: 'Забронювати'}))
        .toBeDisabled();

      expect(screen.getByRole('button', {name: 'Закрити'})).toBeDisabled();
      expect(screen.getByText('Prior schedule')).toBeVisible();

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
        expect(screen.getByRole('button', {name: 'Забронювати'}))
          .toBeEnabled();
      } else {
        expect(await screen.findByText('Не вдалося оновити доступність.'))
          .toBeVisible();
      }
    },
  );

  it('does not post or enter a pending state for a blank booking title', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') return Promise.resolve(jsonResponse({data: rooms}));
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(scheduleResponse('2026-08-03', 'Existing booking'));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {
      name: /Забронювати вівторок.*11:00/i,
    }));
    await user.click(screen.getByRole('button', {name: 'Забронювати'}));

    expect(screen.getByText('Назва має містити від 1 до 100 символів.'))
      .toBeVisible();
    expect(screen.getByRole('button', {name: 'Забронювати'})).toBeEnabled();
    expect(fetchMock.mock.calls.filter(([, init]) =>
      (init as RequestInit | undefined)?.method === 'POST',
    )).toHaveLength(0);
  });

  it('keeps the submitted draft when another desktop slot is clicked', async () => {
    const create = deferred<Response>();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') return Promise.resolve(jsonResponse({data: rooms}));
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(scheduleResponse('2026-08-03', 'Existing booking'));
      }
      if (url === '/api/bookings' && init?.method === 'POST') return create.promise;
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {
      name: /Забронювати вівторок.*11:00/i,
    }));
    await user.type(screen.getByLabelText('Назва'), 'Планування');
    await user.click(screen.getByRole('button', {name: 'Забронювати'}));
    const secondSlot = screen.getByRole('button', {
      name: /Забронювати вівторок.*13:00/i,
    });

    expect(secondSlot).toBeDisabled();
    await user.click(secondSlot);

    expect(screen.getByLabelText('Назва')).toHaveValue('Планування');
    expect(screen.getByRole('button', {name: 'Забронювати'})).toBeDisabled();
  });

  it('keeps the conflicting draft when another desktop slot is clicked', async () => {
    const refreshedSchedule = deferred<Response>();
    let scheduleRequests = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') return Promise.resolve(jsonResponse({data: rooms}));
      if (url.includes('/api/rooms/oak/schedule')) {
        scheduleRequests += 1;
        return scheduleRequests === 1 ?
          Promise.resolve(scheduleResponse('2026-08-03', 'Existing booking')) :
          refreshedSchedule.promise;
      }
      if (url === '/api/bookings' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({error: {code: 'BOOKING_CONFLICT'}}, 409));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {
      name: /Забронювати вівторок.*11:00/i,
    }));
    await user.type(screen.getByLabelText('Назва'), 'Планування');
    await user.click(screen.getByRole('button', {name: 'Забронювати'}));
    await waitFor(() => expect(scheduleRequests).toBe(2));
    const secondSlot = screen.getByRole('button', {
      name: /Забронювати вівторок.*13:00/i,
    });

    expect(secondSlot).toBeDisabled();
    await user.click(secondSlot);

    expect(screen.getByLabelText('Назва')).toHaveValue('Планування');
    expect(screen.getByRole('button', {name: 'Забронювати'})).toBeDisabled();
  });

  it('revalidates the captured room after a stale conflict response', async () => {
    const conflictResponse = deferred<Response>();
    let oakScheduleRequests = 0;
    let pineScheduleRequests = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') return Promise.resolve(jsonResponse({data: rooms}));
      if (url.includes('/api/rooms/oak/schedule')) {
        oakScheduleRequests += 1;
        return Promise.resolve(scheduleResponse('2026-08-03', 'Oak schedule'));
      }
      if (url.includes('/api/rooms/pine/schedule')) {
        pineScheduleRequests += 1;
        return Promise.resolve(scheduleResponse('2026-08-03', 'Pine schedule'));
      }
      if (url === '/api/bookings' && init?.method === 'POST') {
        return conflictResponse.promise;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {
      name: /Забронювати вівторок.*11:00/i,
    }));
    await user.type(screen.getByLabelText('Назва'), 'Планування');
    await user.click(screen.getByRole('button', {name: 'Забронювати'}));
    await user.selectOptions(screen.getByLabelText('Переговорна'), 'pine');
    await screen.findByText('Pine schedule');

    await act(async () => {
      conflictResponse.resolve(jsonResponse({
        error: {code: 'BOOKING_CONFLICT'},
      }, 409));
    });

    await waitFor(() => expect(oakScheduleRequests).toBe(2));
    expect(pineScheduleRequests).toBe(1);
    expect(screen.queryByLabelText('Назва')).not.toBeInTheDocument();
  });

  it('revalidates the captured week after a stale conflict response', async () => {
    const conflictResponse = deferred<Response>();
    let capturedWeekRequests = 0;
    let activeWeekRequests = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') return Promise.resolve(jsonResponse({data: rooms}));
      if (url.includes('weekStart=2026-08-03')) {
        capturedWeekRequests += 1;
        return Promise.resolve(scheduleResponse('2026-08-03', 'Captured week'));
      }
      if (url.includes('weekStart=2026-08-10')) {
        activeWeekRequests += 1;
        return Promise.resolve(scheduleResponse('2026-08-10', 'Active week'));
      }
      if (url === '/api/bookings' && init?.method === 'POST') {
        return conflictResponse.promise;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {
      name: /Забронювати вівторок.*11:00/i,
    }));
    await user.type(screen.getByLabelText('Назва'), 'Планування');
    await user.click(screen.getByRole('button', {name: 'Забронювати'}));
    await user.click(screen.getByRole('button', {name: 'Наступний тиждень'}));
    await screen.findByText('Active week');

    await act(async () => {
      conflictResponse.resolve(jsonResponse({
        error: {code: 'BOOKING_CONFLICT'},
      }, 409));
    });

    await waitFor(() => expect(capturedWeekRequests).toBe(2));
    expect(activeWeekRequests).toBe(1);
    expect(screen.queryByLabelText('Назва')).not.toBeInTheDocument();
  });
});
