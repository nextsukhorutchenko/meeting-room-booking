import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {DateTime} from 'luxon';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ScheduleClient} from '../../src/components/schedule/schedule-client';

const navigation = vi.hoisted(() => ({
  router: {replace: vi.fn()},
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation.router,
  useSearchParams: () => new URLSearchParams(
    'roomId=oak&weekStart=2026-08-03',
  ),
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

describe('ScheduleClient request state', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    navigation.router.replace.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
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

    render(<ScheduleClient />);
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

    render(<ScheduleClient />);
    expect(await screen.findByText('Previously loaded')).toBeVisible();

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
});
