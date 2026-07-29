import '@testing-library/jest-dom/vitest';
import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NotificationBell} from '../../src/components/app/notification-bell';
import {
  PresentationCoordinator,
  usePresentationCoordinator,
} from
  '../../src/components/app/presentation-coordinator';

function FilterOwnerProbe() {
  const {request} = usePresentationCoordinator();
  return (
    <button onClick={(event) => request({
      trigger: event.currentTarget,
      type: 'OPEN_FILTER',
    })} type="button">
      Open filter
    </button>
  );
}

function response(data: unknown, status = 200): Response {
  return {
    json: vi.fn().mockResolvedValue(
      status === 200 ? {data} : {error: {message: 'Unavailable'}},
    ),
    ok: status >= 200 && status < 300,
    status,
  } as unknown as Response;
}

describe('NotificationBell', () => {
  const fetchMock = vi.fn();
  let hidden = false;

  beforeEach(() => {
    hidden = false;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(response([]));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('polls immediately and presents an accessible bell and polite toast', async () => {
    fetchMock.mockResolvedValue(response([{
      id: 'notification-1',
      roomName: 'Oak',
      currentTitle: 'Planning',
      endsAt: '2026-07-28T10:00:00.000Z',
      nextAuthorName: 'Next User',
    }]));

    render(<NotificationBell />);

    await waitFor(() => expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/notifications',
      expect.objectContaining({
        cache: 'no-store',
        method: 'GET',
      }),
    ));
    await waitFor(() => expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/notifications',
      expect.objectContaining({
        body: JSON.stringify({notificationId: 'notification-1'}),
        method: 'POST',
      }),
    ));
    expect(
      screen.getByRole('button', {name: 'Notifications, 1 unread'}),
    ).toBeVisible();
    const liveRegion = screen.getByRole('region', {
      name: 'Booking notifications',
    });
    const toast = screen.getByRole('status');
    expect(liveRegion).not.toHaveAttribute('aria-live');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveTextContent(
      'Planning ends soon in Oak. Next User is next.',
    );

    await userEvent.setup().click(
      screen.getByRole('button', {name: 'Dismiss notification'}),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Notifications'}),
    ).toBeVisible();
  });

  it('polls every 60 seconds only while visible and polls on visibility return', async () => {
    vi.useFakeTimers();
    render(<NotificationBell />);

    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    hidden = true;
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    hidden = false;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('ignores malformed and failed polling responses without showing a toast', async () => {
    fetchMock
      .mockResolvedValueOnce(response({private: 'value'}))
      .mockResolvedValueOnce(response(undefined, 503));
    const {unmount} = render(<NotificationBell />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    unmount();

    render(<NotificationBell />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each(['fetch', 'json'] as const)(
    'ignores a rejected %s operation',
    async (failure) => {
      fetchMock.mockImplementationOnce(async () => {
        if (failure === 'fetch') {
          throw new Error('private fetch failure');
        }
        return {
          json: vi.fn().mockRejectedValue(new Error('private JSON failure')),
          ok: true,
        } as unknown as Response;
      });

      render(<NotificationBell />);

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    },
  );

  it('aborts an in-flight poll and removes its visibility listener', async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((
      _url: string,
      init?: RequestInit,
    ) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const {unmount} = render(<NotificationBell />);
    await waitFor(() => expect(signal).toBeDefined());

    unmount();

    expect(signal?.aborted).toBe(true);
    expect(removeListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
  });

  it('uses modal ownership only for the mobile notification surface', async () => {
    fetchMock.mockResolvedValue(response([{
      id: 'notification-1',
      roomName: 'Oak',
      currentTitle: 'Planning',
      endsAt: '2026-07-28T10:00:00.000Z',
      nextAuthorName: 'Next User',
    }]));
    render(
      <PresentationCoordinator>
        <NotificationBell mode="mobile" />
      </PresentationCoordinator>,
    );

    await screen.findByRole('button', {name: 'Notifications, 1 unread'});
    await userEvent.setup().click(screen.getByRole('button', {
      name: 'Notifications, 1 unread',
    }));

    expect(screen.getByRole('dialog', {name: 'Booking notifications'}))
      .toHaveAttribute('aria-modal', 'true');
  });

  it('does not make desktop notification popovers modal', async () => {
    fetchMock.mockResolvedValue(response([{
      id: 'notification-1',
      roomName: 'Oak',
      currentTitle: 'Planning',
      endsAt: '2026-07-28T10:00:00.000Z',
      nextAuthorName: 'Next User',
    }]));
    render(
      <PresentationCoordinator>
        <NotificationBell mode="tablet" />
      </PresentationCoordinator>,
    );

    await screen.findByRole('button', {name: 'Notifications, 1 unread'});
    expect(screen.getByRole('region', {name: 'Booking notifications'}))
      .not.toHaveAttribute('aria-modal');
  });

  it('denies a mobile notification modal while another modal owns presentation', async () => {
    fetchMock.mockResolvedValue(response([{
      id: 'notification-1',
      roomName: 'Oak',
      currentTitle: 'Planning',
      endsAt: '2026-07-28T10:00:00.000Z',
      nextAuthorName: 'Next User',
    }]));
    render(
      <PresentationCoordinator>
        <FilterOwnerProbe />
        <NotificationBell mode="mobile" />
      </PresentationCoordinator>,
    );

    const user = userEvent.setup();
    await screen.findByRole('button', {name: 'Notifications, 1 unread'});
    await user.click(screen.getByRole('button', {name: 'Open filter'}));
    await user.click(screen.getByRole('button', {
      name: 'Notifications, 1 unread',
    }));

    expect(screen.queryByRole('dialog', {name: 'Booking notifications'}))
      .not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Notifications, 1 unread'}))
      .toHaveAttribute('aria-expanded', 'false');
  });
});
