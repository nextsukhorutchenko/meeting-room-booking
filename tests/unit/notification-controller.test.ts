import '@testing-library/jest-dom/vitest';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createElement, Fragment, type ComponentProps, type MouseEvent} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  emptyNotificationState,
  NotificationController,
  notificationReducer,
  type NotificationClientState,
} from '../../src/components/app/notification-controller';
import {ConnectedNotificationCenter} from
  '../../src/components/app/notification-center';
import {PresentationCoordinator, usePresentationCoordinator} from
  '../../src/components/app/presentation-coordinator';
import {Dialog} from '../../src/components/ui/dialog';
import type {DueNotification} from '../../src/modules/notifications/notification.service';

const notification: DueNotification = {
  currentTitle: 'Планування',
  endsAt: '2026-07-30T10:00:00.000Z',
  id: 'notification-1',
  nextAuthorName: 'Олена',
  roomName: 'Oak',
};

function unseenCount(state: NotificationClientState): number {
  return [...state.retainedById.values()].filter(({seen}) => !seen).length;
}

function response(data: unknown, status = 200): Response {
  return {
    json: vi.fn().mockResolvedValue(status === 200 ? {data} : {data}),
    ok: status >= 200 && status < 300,
    status,
  } as unknown as Response;
}

function NotificationHarness({pathname}: {pathname?: string}) {
  return createElement(
    PresentationCoordinator,
    null,
    createElement(
      NotificationController,
      {pathname} as ComponentProps<typeof NotificationController>,
      createElement(ConnectedNotificationCenter, {mode: 'expanded'}),
    ),
  );
}

function FilterModalProbe() {
  const {modalOwner, request} = usePresentationCoordinator();
  return createElement(
    Fragment,
    null,
    createElement('button', {
      onClick: (event: MouseEvent<HTMLButtonElement>) => request({
        trigger: event.currentTarget,
        type: 'OPEN_FILTER',
      }),
      type: 'button',
    }, 'Відкрити фільтр'),
    modalOwner === 'filter' ? createElement(
      Dialog,
      {
        label: 'Фільтр',
        onClose: () => request({type: 'CLOSE_FILTER'}),
        open: true,
        owner: 'filter',
      } as unknown as ComponentProps<typeof Dialog>,
      createElement('button', {
        onClick: () => request({type: 'CLOSE_FILTER'}),
        type: 'button',
      }, 'Закрити фільтр'),
    ) : null,
  );
}

function ToastModalHarness() {
  return createElement(
    PresentationCoordinator,
    null,
    createElement(
      NotificationController,
      {} as ComponentProps<typeof NotificationController>,
      createElement(
        Fragment,
        null,
        createElement(ConnectedNotificationCenter, {mode: 'expanded'}),
        createElement(FilterModalProbe),
      ),
    ),
  );
}

function postedAckIds(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    .map(([, init]) => JSON.parse((init as RequestInit).body as string)
      .notificationId as string);
}

describe('notificationReducer', () => {
  it('marks first delivery seen when the center is already open', () => {
    const openState: NotificationClientState = {
      ...emptyNotificationState,
      centerOpen: true,
    };

    const next = notificationReducer(openState, {
      items: [notification],
      type: 'POLL_VALID',
    });

    expect(next.retainedById.get(notification.id)?.seen).toBe(true);
    expect(next.toastQueue).toEqual([]);
    expect(unseenCount(next)).toBe(0);
  });

  it('does not resurrect a dismissed redelivery', () => {
    const dismissedState = notificationReducer(emptyNotificationState, {
      items: [notification],
      type: 'POLL_VALID',
    });
    const next = notificationReducer(
      notificationReducer(dismissedState, {
        id: notification.id,
        type: 'DISMISS',
      }),
      {items: [notification], type: 'POLL_VALID'},
    );

    expect(next.retainedById.has(notification.id)).toBe(false);
    expect(next.dismissedIds.has(notification.id)).toBe(true);
  });

  it('updates a duplicate while open without queueing a later toast', () => {
    const delivered = notificationReducer(emptyNotificationState, {
      items: [notification],
      type: 'POLL_VALID',
    });
    const open = notificationReducer(delivered, {type: 'CENTER_OPEN'});
    const next = notificationReducer(open, {
      items: [{...notification, currentTitle: 'Оновлена назва'}],
      type: 'POLL_VALID',
    });

    expect(next.retainedById.get(notification.id)).toMatchObject({
      data: {currentTitle: 'Оновлена назва'},
      seen: true,
    });
    expect(next.toastQueue).toEqual([]);
  });

  it('resets the active toast timer when another modal opens', () => {
    const delivered = notificationReducer(emptyNotificationState, {
      items: [notification],
      type: 'POLL_VALID',
    });
    const active = notificationReducer(delivered, {type: 'TOAST_SHOW_NEXT'});
    const next = notificationReducer(active, {type: 'MODAL_OPEN'});

    expect(next.activeToastId).toBeNull();
    expect(next.toastQueue).toEqual([notification.id]);
  });

  it('changes only acknowledgement state after an acknowledgement result', () => {
    const delivered = notificationReducer(emptyNotificationState, {
      items: [notification],
      type: 'POLL_VALID',
    });
    const next = notificationReducer(delivered, {
      id: notification.id,
      type: 'ACK_OK',
    });

    expect(next.retainedById.get(notification.id)).toEqual({
      ack: 'acked',
      data: notification,
      seen: false,
    });
    expect(next.toastQueue).toEqual([notification.id]);
  });
});

describe('NotificationController effects', () => {
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

  it('polls immediately and every sixty seconds only while the document is visible', async () => {
    vi.useFakeTimers();
    render(createElement(NotificationHarness));

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
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['a malformed successful payload', response({unexpected: true})],
    ['a non-OK payload', response([notification], 503)],
  ])('ignores %s without acknowledgement or presentation', async (
    _scenario,
    pollResponse,
  ) => {
    fetchMock.mockResolvedValueOnce(pollResponse);

    render(createElement(NotificationHarness));

    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(postedAckIds(fetchMock)).toEqual([]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: 'Сповіщення, 0 нових',
    })).toBeVisible();
  });

  it('aborts an acknowledgement request when the controller unmounts', async () => {
    let acknowledgementSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((
      _url: string,
      init?: RequestInit,
    ) => {
      if (init?.method === 'GET') return Promise.resolve(response([notification]));
      acknowledgementSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const view = render(createElement(NotificationHarness));

    await waitFor(() => expect(acknowledgementSignal).toBeDefined());
    view.unmount();

    expect(acknowledgementSignal?.aborted).toBe(true);
  });

  it('re-acks a duplicate delivered while the center is open without queueing a toast', async () => {
    hidden = true;
    fetchMock
      .mockResolvedValueOnce(response([notification]))
      .mockResolvedValueOnce(response(undefined))
      .mockResolvedValueOnce(response([{...notification, currentTitle: 'Оновлена назва'}]))
      .mockResolvedValueOnce(response(undefined));
    vi.useFakeTimers();
    render(createElement(NotificationHarness));

    fireEvent.click(screen.getByRole('button', {name: 'Сповіщення, 0 нових'}));
    hidden = false;
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    await act(async () => {});
    expect(screen.getByText(/Планування/)).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await act(async () => {});
    expect(screen.getByText(/Оновлена назва/)).toBeVisible();

    expect(postedAckIds(fetchMock)).toEqual([
      notification.id,
      notification.id,
    ]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('acknowledges dismissed redelivery without restoring it to the client state', async () => {
    fetchMock
      .mockResolvedValueOnce(response([notification]))
      .mockResolvedValueOnce(response(undefined))
      .mockResolvedValueOnce(response([notification]))
      .mockResolvedValueOnce(response(undefined));
    vi.useFakeTimers();
    render(createElement(NotificationHarness));

    await act(async () => {});
    expect(screen.getByRole('status')).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: 'Відхилити сповіщення'}));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    await act(async () => {});
    expect(postedAckIds(fetchMock)).toEqual([
      notification.id,
      notification.id,
    ]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {
      name: 'Сповіщення, 0 нових',
    }));
    expect(screen.queryByText(/Планування/)).not.toBeInTheDocument();
  });

  it('retains notification data across route navigation while closing the center', async () => {
    fetchMock
      .mockResolvedValueOnce(response([notification]))
      .mockResolvedValueOnce(response(undefined));
    const view = render(createElement(NotificationHarness, {pathname: '/schedule'}));
    await screen.findByRole('status');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', {name: 'Сповіщення, 0 нових'}));
    expect(screen.getByRole('region', {name: 'Сповіщення'})).toBeVisible();

    view.rerender(createElement(NotificationHarness, {pathname: '/my-bookings'}));

    await waitFor(() => expect(screen.queryByRole('region', {
      name: 'Сповіщення',
    })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', {name: 'Сповіщення, 0 нових'}));
    expect(screen.getByText(/Планування/)).toBeVisible();
  });

  it('resets the four-second toast timer while a modal owner is active', async () => {
    fetchMock
      .mockResolvedValueOnce(response([notification]))
      .mockResolvedValueOnce(response(undefined));
    vi.useFakeTimers();
    render(createElement(ToastModalHarness));
    await act(async () => {});
    expect(screen.getByRole('status')).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: 'Відкрити фільтр'}));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Закрити фільтр'}));
    await act(async () => {});
    expect(screen.getByRole('status')).toBeVisible();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_999);
    });
    expect(screen.getByRole('status')).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
