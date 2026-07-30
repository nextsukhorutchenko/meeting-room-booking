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
import {DateTime, Settings} from 'luxon';
import {useEffect} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ScheduleWorkspace} from
  '../../src/components/schedule/schedule-workspace';
import {
  PresentationCoordinator,
  usePresentationCoordinator,
  type ModalOwner,
} from '../../src/components/app/presentation-coordinator';

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

function OwnerTrace({owners}: {owners: ModalOwner[]}) {
  const {modalOwner} = usePresentationCoordinator();

  useEffect(() => {
    owners.push(modalOwner);
  }, [modalOwner, owners]);

  return null;
}

function renderScheduleClient(ownerTrace?: ModalOwner[]) {
  return render(
    <PresentationCoordinator>
      {ownerTrace ? <OwnerTrace owners={ownerTrace} /> : null}
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
    vi.restoreAllMocks();
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

  it('positions once when compact day navigation changes the office day', async () => {
    setViewportWidth(320);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') return Promise.resolve(jsonResponse({data: rooms}));
      if (url.includes('weekStart=2026-08-03')) {
        return Promise.resolve(scheduleResponse('2026-08-03', 'First week'));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    scrollIntoView.mockReset();
    await userEvent.setup().click(
      screen.getByRole('button', {name: 'Наступний день'}),
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

  it('retries only rooms while preserving schedule data and restores focus', async () => {
    let roomRequests = 0;
    let scheduleRequests = 0;
    const recoveredRooms = deferred<Response>();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        roomRequests += 1;
        return roomRequests === 1 ?
          Promise.resolve(
            jsonResponse({
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Rooms unavailable',
              },
            }, 503),
          ) :
          recoveredRooms.promise;
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        scheduleRequests += 1;
        return Promise.resolve(
          scheduleResponse('2026-08-03', 'Збережений розклад'),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    expect(await screen.findByText('Збережений розклад')).toBeVisible();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent(
      'Сервіс тимчасово недоступний. Спробуйте ще раз.',
    );
    expect(screen.queryByText('Rooms unavailable')).not.toBeInTheDocument();

    const retry = screen.getByRole('button', {
      name: 'Повторити завантаження переговорних',
    });
    const user = userEvent.setup();
    await user.click(retry);

    expect(screen.getByText('Збережений розклад')).toBeVisible();
    expect(screen.getByRole('status', {name: 'Завантажуємо переговорні'}))
      .toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('status', {name: 'Завантажуємо розклад'}))
      .not.toBeInTheDocument();
    await act(async () => {
      recoveredRooms.resolve(jsonResponse({data: rooms}));
    });
    await waitFor(() => {
      expect(screen.queryByText('Переговорні недоступні'))
        .not.toBeInTheDocument();
      expect(screen.getByLabelText('Переговорна')).toHaveFocus();
    });
    expect(roomRequests).toBe(2);
    expect(scheduleRequests).toBe(1);
  });

  it('opens complete details for both own and other timetable bookings', async () => {
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
    const otherDetails = screen.getByRole('region', {
      name: 'Деталі бронювання',
    });
    expect(within(otherDetails).getByText('Чуже бронювання')).toBeVisible();
    expect(within(otherDetails).getByText('Demo Organizer')).toBeVisible();
    expect(within(otherDetails).getByText('Oak')).toBeVisible();
    expect(within(otherDetails).getAllByText(/Europe\/Kyiv/)).toHaveLength(2);
    expect(within(otherDetails).queryByRole('button', {
      name: 'Скасувати бронювання',
    })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', {name: 'Скасувати бронювання'}))
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
    const ownDetails = screen.getByRole('region', {
      name: 'Деталі бронювання',
    });
    const cancelFromDetails = within(ownDetails).getByRole('button', {
      name: 'Скасувати бронювання',
    });
    await user.click(cancelFromDetails);
    expect(await screen.findByRole('dialog', {name: 'Скасувати бронювання'}))
      .toBeVisible();
  });

  it.each([
    [1024, 'Закрити'],
    [1440, 'Закрити панель бронювання'],
  ])(
    'restores the side-pane booking invoker at %ipx after %s',
    async (width, closeName) => {
      setViewportWidth(width);
      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url === '/api/rooms') {
          return Promise.resolve(jsonResponse({data: rooms}));
        }
        if (url.includes('/api/rooms/oak/schedule')) {
          return Promise.resolve(
            scheduleResponse('2026-08-03', 'Focus booking'),
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      });

      renderScheduleClient();
      const user = userEvent.setup();
      const invoker = await screen.findByRole('button', {
        name: /Focus booking/,
      });
      await user.click(invoker);
      const details = screen.getByRole('region', {
        name: 'Деталі бронювання',
      });

      await user.click(within(details).getByRole('button', {
        name: closeName,
      }));

      await waitFor(() => expect(invoker).toHaveFocus());
    },
  );

  it('closes side-pane details safely when its invoker disconnected', async () => {
    setViewportWidth(1024);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(
          scheduleResponse('2026-08-03', 'Detached invoker'),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const user = userEvent.setup();
    const invoker = await screen.findByRole('button', {
      name: /Detached invoker/,
    });
    await user.click(invoker);
    const close = within(screen.getByRole('region', {
      name: 'Деталі бронювання',
    })).getByRole('button', {name: 'Закрити панель бронювання'});
    invoker.remove();

    await user.click(close);

    expect(invoker.isConnected).toBe(false);
    expect(screen.queryByRole('button', {
      name: 'Закрити панель бронювання',
    })).not.toBeInTheDocument();
  });

  it('opens compact booking details while direct agenda Cancel stays a sibling', async () => {
    setViewportWidth(320);
    navigation.searchParams = new URLSearchParams(
      'roomId=oak&weekStart=2026-08-03&day=2026-08-04',
    );
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(
          scheduleResponse('2026-08-03', 'Власне бронювання'),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {
      name: /Власне бронювання/,
    }));

    const details = await screen.findByRole('dialog', {
      name: 'Деталі бронювання',
    });
    expect(within(details).getByRole('button', {
      name: 'Скасувати бронювання',
    })).toBeVisible();
    expect(screen.queryByRole('dialog', {name: 'Скасувати бронювання'}))
      .not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', {name: 'Скасувати'}));

    expect(await screen.findByRole('dialog', {name: 'Скасувати бронювання'}))
      .toBeVisible();
    expect(screen.queryByRole('dialog', {name: 'Деталі бронювання'}))
      .not.toBeInTheDocument();
  });

  it('preserves one draft while reconciling booking ownership across modes', async () => {
    setViewportWidth(1024);
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
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {
      name: /Забронювати вівторок.*11:00/i,
    }));
    await user.type(screen.getByLabelText('Назва'), 'Збережена чернетка');

    await act(async () => setViewportWidth(768));

    expect(await screen.findByRole('dialog', {name: 'Бронювання: Oak'}))
      .toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Назва')).toHaveValue('Збережена чернетка');

    await act(async () => setViewportWidth(1024));

    expect(screen.queryByRole('dialog', {name: 'Бронювання: Oak'}))
      .not.toBeInTheDocument();
    expect(screen.getByRole('region', {name: 'Бронювання: Oak'})).toBeVisible();
    expect(screen.getByLabelText('Назва')).toHaveValue('Збережена чернетка');
  });

  it('does not close an unrelated cancellation owner on compact-to-medium resize', async () => {
    setViewportWidth(320);
    navigation.searchParams = new URLSearchParams(
      'roomId=oak&weekStart=2026-08-03&day=2026-08-04',
    );
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(
          scheduleResponse('2026-08-03', 'Власне бронювання'),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    await userEvent.setup().click(await screen.findByRole('button', {
      name: 'Скасувати',
    }));
    expect(screen.getByRole('dialog', {name: 'Скасувати бронювання'}))
      .toBeVisible();

    await act(async () => setViewportWidth(1024));

    expect(screen.getByRole('dialog', {name: 'Скасувати бронювання'}))
      .toBeVisible();

    await act(async () => setViewportWidth(320));

    expect(screen.getByRole('dialog', {name: 'Скасувати бронювання'}))
      .toBeVisible();
  });

  it('restores booking cancellation atomically after compact-to-medium resize', async () => {
    setViewportWidth(320);
    navigation.searchParams = new URLSearchParams(
      'roomId=oak&weekStart=2026-08-03&day=2026-08-04',
    );
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(
          scheduleResponse('2026-08-03', 'Resize keep'),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const owners: ModalOwner[] = [];

    renderScheduleClient(owners);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {name: /Resize keep/}));
    await user.click(within(screen.getByRole('dialog', {
      name: 'Деталі бронювання',
    })).getByRole('button', {name: 'Скасувати бронювання'}));
    await act(async () => setViewportWidth(1024));
    const ownerStart = owners.length;

    await user.click(within(screen.getByRole('dialog', {
      name: 'Скасувати бронювання',
    })).getByRole('button', {name: 'Залишити бронювання'}));

    const details = await screen.findByRole('region', {
      name: 'Деталі бронювання',
    });
    const currentCancel = within(details).getByRole('button', {
      name: 'Скасувати бронювання',
    });
    await waitFor(() => expect(currentCancel).toHaveFocus());
    expect(owners.slice(ownerStart)).toEqual(['none']);
    expect(details.closest('.booking-surface')).not.toHaveAttribute('inert');
    expect(details.closest('.booking-surface'))
      .not.toHaveAttribute('data-suspended');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('restores booking cancellation atomically after medium-to-compact resize', async () => {
    setViewportWidth(1024);
    let deleteRequests = 0;
    fetchMock.mockImplementation((
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(
          scheduleResponse('2026-08-03', 'Resize error'),
        );
      }
      if (url === '/api/bookings/resize-error' && init?.method === 'DELETE') {
        deleteRequests += 1;
        return Promise.resolve(jsonResponse({
          error: {code: 'UNKNOWN'},
        }, 500));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const owners: ModalOwner[] = [];

    renderScheduleClient(owners);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', {name: /Resize error/}));
    await user.click(within(screen.getByRole('region', {
      name: 'Деталі бронювання',
    })).getByRole('button', {name: 'Скасувати бронювання'}));
    const cancellationDialog = screen.getByRole('dialog', {
      name: 'Скасувати бронювання',
    });
    await user.click(within(cancellationDialog).getByRole('button', {
      name: 'Скасувати бронювання',
    }));
    expect(await within(cancellationDialog).findByRole('alert')).toBeVisible();
    await act(async () => setViewportWidth(320));
    const ownerStart = owners.length;

    await user.click(within(cancellationDialog).getByRole('button', {
      name: 'Закрити діалог',
    }));

    const details = await screen.findByRole('dialog', {
      name: 'Деталі бронювання',
    });
    const currentCancel = within(details).getByRole('button', {
      name: 'Скасувати бронювання',
    });
    await waitFor(() => expect(currentCancel).toHaveFocus());
    expect(owners.slice(ownerStart)).toEqual(['booking']);
    expect(details.closest('.booking-surface')).not.toHaveAttribute('inert');
    expect(details.closest('.booking-surface'))
      .not.toHaveAttribute('data-suspended');
    expect(deleteRequests).toBe(1);
  });

  it('swaps the medium room pane for the booking pane', async () => {
    setViewportWidth(1024);
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
    const workspace = await screen.findByRole('region', {
      name: 'Розклад переговорної',
    });
    const roomPane = screen.getByRole('complementary', {
      name: 'Вибір переговорної',
    });
    expect(workspace).toHaveAttribute('data-medium-pane', 'room');
    expect(roomPane).toBeVisible();

    await userEvent.setup().click(await screen.findByRole('button', {
      name: /Забронювати вівторок.*11:00/i,
    }));

    expect(workspace).toHaveAttribute('data-medium-pane', 'booking');
    expect(roomPane).not.toBeVisible();
    const bookingPane = screen.getByRole('region', {name: 'Бронювання: Oak'});
    expect(bookingPane).toBeVisible();
    expect(bookingPane.closest('.booking-surface')?.parentElement)
      .toBe(workspace);
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

  it('puts the schedule jump link before compact controls', async () => {
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
    const workspace = await screen.findByRole('region', {
      name: 'Розклад переговорної',
    });
    const focusable = workspace.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), ' +
      'select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    const jumpLink = screen.getByRole('link', {
      name: 'До пошуку часу',
    });
    expect(focusable[0]).toBe(jumpLink);

    await userEvent.setup().click(jumpLink);

    expect(screen.getByLabelText('День')).toHaveFocus();
  });

  it('cancels a compact capacity draft without refetching', async () => {
    setViewportWidth(768);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms' || url.startsWith('/api/rooms?')) {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(scheduleResponse('2026-08-03', 'Stable'));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    await screen.findByText('Stable');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', {
      name: 'Відкрити фільтри переговорних',
    }));
    await user.type(screen.getByRole('spinbutton', {
      name: 'Мінімальна місткість',
    }), '9');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', {
      name: 'Відкрити фільтри переговорних',
    }));
    expect(screen.getByRole('spinbutton', {
      name: 'Мінімальна місткість',
    })).toHaveValue(null);
    expect(fetchMock.mock.calls.filter(([input]) =>
      /^\/api\/rooms(?:\?|$)/.test(requestUrl(input)))).toHaveLength(1);
  });

  it('applies a compact capacity draft with one room fetch', async () => {
    setViewportWidth(768);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url === '/api/rooms?minCapacity=9') {
        return Promise.resolve(jsonResponse({data: []}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(scheduleResponse('2026-08-03', 'Stable'));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    await screen.findByText('Stable');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', {
      name: 'Відкрити фільтри переговорних',
    }));
    await user.type(screen.getByRole('spinbutton', {
      name: 'Мінімальна місткість',
    }), '9');
    await user.click(screen.getByRole('button', {name: 'Застосувати'}));

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([input]) =>
        requestUrl(input) === '/api/rooms?minCapacity=9')).toHaveLength(1);
    });
    expect(screen.queryByRole('dialog', {
      name: 'Фільтри переговорних',
    })).not.toBeInTheDocument();
  });

  it('resets a compact capacity draft without applying it', async () => {
    setViewportWidth(768);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms' || url.startsWith('/api/rooms?')) {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/api/rooms/oak/schedule')) {
        return Promise.resolve(scheduleResponse('2026-08-03', 'Stable'));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    await screen.findByText('Stable');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', {
      name: 'Відкрити фільтри переговорних',
    }));
    const capacity = screen.getByRole('spinbutton', {
      name: 'Мінімальна місткість',
    });
    await user.type(capacity, '9');
    await user.click(screen.getByRole('button', {name: 'Скинути'}));

    expect(capacity).toHaveValue(null);
    expect(screen.getByRole('dialog', {
      name: 'Фільтри переговорних',
    })).toBeVisible();
    expect(fetchMock.mock.calls.filter(([input]) =>
      /^\/api\/rooms(?:\?|$)/.test(requestUrl(input)))).toHaveLength(1);
  });

  it('removes stale bookings and booking controls after an auth failure', async () => {
    const failedSchedule = deferred<Response>();
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');

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
        error: {code: 'AUTH_REQUIRED', message: 'Session expired'},
      }, 401));
    });

    await waitFor(() => expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({type: 'roomwork:auth-required'}),
    ));
    expect(screen.queryByText(
      'Сесію завершено. Увійдіть знову, щоб продовжити.',
    )).not.toBeInTheDocument();
    expect(screen.queryByText('Session expired')).not.toBeInTheDocument();
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
      screen.getByRole('button', {name: 'Скасувати бронювання'}),
    );
    await user.click(within(await screen.findByRole('dialog', {
      name: 'Скасувати бронювання',
    })).getByRole('button', {name: 'Скасувати бронювання'}));
    await waitFor(() => {
      expect(scheduleRequestCount).toBe(2);
    });

    expect(
      screen.queryByRole('dialog', {name: 'Скасувати бронювання'}),
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

  it('retries an independent schedule load error without reloading rooms', async () => {
    let scheduleRequests = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/schedule?')) {
        scheduleRequests += 1;
        return Promise.resolve(
          scheduleRequests === 1 ?
            jsonResponse({error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Schedule unavailable',
            }}, 503) :
            scheduleResponse('2026-08-03', 'Recovered schedule'),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();
    expect(await screen.findByText(
      'Сервіс тимчасово недоступний. Спробуйте ще раз.',
    )).toBeVisible();
    expect(screen.queryByText('Schedule unavailable')).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', {
      name: 'Повторити завантаження розкладу',
    }));

    expect(await screen.findByText('Recovered schedule')).toBeVisible();
    expect(scheduleRequests).toBe(2);
    expect(fetchMock.mock.calls.filter(([input]) =>
      requestUrl(input) === '/api/rooms')).toHaveLength(1);
  });

  it('uses the Ukrainian schedule fallback for an unknown error payload', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === '/api/rooms') {
        return Promise.resolve(jsonResponse({data: rooms}));
      }
      if (url.includes('/schedule?')) {
        return Promise.resolve(jsonResponse({
          error: {code: 'UNRECOGNIZED', message: 'Unknown schedule failure'},
        }, 500));
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderScheduleClient();

    expect(await screen.findByText(
      'Не вдалося завантажити розклад. Спробуйте ще раз.',
    )).toBeVisible();
    expect(screen.queryByText('Unknown schedule failure')).not.toBeInTheDocument();
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
      await user.click(screen.getByRole('button', {
        name: 'Скасувати бронювання',
      }));
      await user.click(within(await screen.findByRole('dialog', {
        name: 'Скасувати бронювання',
      })).getByRole('button', {name: 'Скасувати бронювання'}));
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
        expect(screen.queryByRole('dialog', {name: 'Скасувати бронювання'}))
          .not.toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', {name: /Stale cancellation/}));
      await user.click(screen.getByRole('button', {
        name: 'Скасувати бронювання',
      }));
      await user.click(within(await screen.findByRole('dialog', {
        name: 'Скасувати бронювання',
      })).getByRole('button', {name: 'Скасувати бронювання'}));
      await waitFor(() => expect(deleteRequestCount).toBe(2));

      await act(async () => {
        if (completion === 'success') {
          deletes[0].resolve(jsonResponse(undefined, 204));
        } else {
          deletes[0].reject(new Error('stale request failure'));
        }
      });

      expect(screen.getByRole('dialog', {
        name: 'Скасувати бронювання',
      })).toBeVisible();
      expect(screen.getByRole('button', {
        name: 'Скасувати бронювання',
      })).toBeDisabled();
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
    await user.click(screen.getByRole('button', {
      name: 'Скасувати бронювання',
    }));
    await user.click(within(await screen.findByRole('dialog', {
      name: 'Скасувати бронювання',
    })).getByRole('button', {name: 'Скасувати бронювання'}));
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
