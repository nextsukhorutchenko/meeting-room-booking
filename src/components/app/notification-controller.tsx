'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import type {DueNotification} from '../../modules/notifications/notification.service';
import {usePresentationCoordinator} from './presentation-coordinator';

const pollIntervalMilliseconds = 60_000;
const toastDurationMilliseconds = 4_000;

export type RetainedNotification = {
  data: DueNotification;
  seen: boolean;
  ack: 'pending' | 'acked' | 'failed';
};

export type NotificationClientState = {
  retainedById: ReadonlyMap<string, RetainedNotification>;
  dismissedIds: ReadonlySet<string>;
  toastQueue: readonly string[];
  activeToastId: string | null;
  centerOpen: boolean;
};

export type NotificationEvent =
  | {type: 'POLL_VALID'; items: readonly DueNotification[]}
  | {type: 'ACK_OK'; id: string}
  | {type: 'ACK_ERROR'; id: string}
  | {type: 'TOAST_SHOW_NEXT'}
  | {type: 'TOAST_TIMEOUT'; id: string}
  | {type: 'CENTER_OPEN'}
  | {type: 'CENTER_CLOSE'}
  | {type: 'DISMISS'; id: string}
  | {type: 'MODAL_OPEN'}
  | {type: 'MODAL_CLOSE'};

export const emptyNotificationState: NotificationClientState = {
  activeToastId: null,
  centerOpen: false,
  dismissedIds: new Set(),
  retainedById: new Map(),
  toastQueue: [],
};

function queuedBeforeActive(state: NotificationClientState): string[] {
  if (!state.activeToastId || !state.retainedById.has(state.activeToastId)) {
    return [...state.toastQueue];
  }
  return [state.activeToastId, ...state.toastQueue.filter(
    (id) => id !== state.activeToastId,
  )];
}

function updateAck(
  state: NotificationClientState,
  id: string,
  ack: RetainedNotification['ack'],
): NotificationClientState {
  const retained = state.retainedById.get(id);
  if (!retained) return state;
  const retainedById = new Map(state.retainedById);
  retainedById.set(id, {...retained, ack});
  return {...state, retainedById};
}

export function notificationReducer(
  state: NotificationClientState,
  event: NotificationEvent,
): NotificationClientState {
  switch (event.type) {
    case 'POLL_VALID': {
      const retainedById = new Map(state.retainedById);
      let toastQueue = [...state.toastQueue];
      for (const item of event.items) {
        if (state.dismissedIds.has(item.id)) continue;
        const retained = retainedById.get(item.id);
        if (retained) {
          retainedById.set(item.id, {
            ack: 'pending',
            data: item,
            seen: state.centerOpen || retained.seen,
          });
          if (state.centerOpen) {
            toastQueue = toastQueue.filter((id) => id !== item.id);
          }
          continue;
        }
        retainedById.set(item.id, {
          ack: 'pending',
          data: item,
          seen: state.centerOpen,
        });
        if (!state.centerOpen) toastQueue.push(item.id);
      }
      return {...state, retainedById, toastQueue};
    }
    case 'ACK_OK':
      return updateAck(state, event.id, 'acked');
    case 'ACK_ERROR':
      return updateAck(state, event.id, 'failed');
    case 'TOAST_SHOW_NEXT': {
      if (state.activeToastId || state.centerOpen) return state;
      const nextId = state.toastQueue.find((id) => state.retainedById.has(id));
      if (!nextId) return {...state, toastQueue: []};
      const retainedById = new Map(state.retainedById);
      const retained = retainedById.get(nextId);
      if (retained) retainedById.set(nextId, {...retained, seen: true});
      return {
        ...state,
        activeToastId: nextId,
        retainedById,
        toastQueue: state.toastQueue.filter((id) => id !== nextId),
      };
    }
    case 'TOAST_TIMEOUT':
      return state.activeToastId === event.id ? {
        ...state,
        activeToastId: null,
      } : state;
    case 'CENTER_OPEN':
      return state.centerOpen ? state : {
        ...state,
        activeToastId: null,
        centerOpen: true,
        toastQueue: queuedBeforeActive(state),
      };
    case 'CENTER_CLOSE':
      return state.centerOpen ? {...state, centerOpen: false} : state;
    case 'DISMISS': {
      const retainedById = new Map(state.retainedById);
      retainedById.delete(event.id);
      const dismissedIds = new Set(state.dismissedIds);
      dismissedIds.add(event.id);
      return {
        ...state,
        activeToastId: state.activeToastId === event.id ? null : state.activeToastId,
        dismissedIds,
        retainedById,
        toastQueue: state.toastQueue.filter((id) => id !== event.id),
      };
    }
    case 'MODAL_OPEN':
      return state.activeToastId ? {
        ...state,
        activeToastId: null,
        toastQueue: queuedBeforeActive(state),
      } : state;
    case 'MODAL_CLOSE':
      return state;
  }
}

type NotificationContextValue = {
  dispatch: Dispatch<NotificationEvent>;
  state: NotificationClientState;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('NotificationController is required for notifications.');
  }
  return context;
}

function isDueNotification(value: unknown): value is DueNotification {
  if (!value || typeof value !== 'object') return false;
  const notification = value as Partial<DueNotification>;
  return typeof notification.id === 'string' &&
    typeof notification.roomName === 'string' &&
    typeof notification.currentTitle === 'string' &&
    typeof notification.endsAt === 'string' &&
    !Number.isNaN(Date.parse(notification.endsAt)) &&
    typeof notification.nextAuthorName === 'string';
}

function notificationData(value: unknown): DueNotification[] | null {
  if (!value || typeof value !== 'object') return null;
  const data = (value as {data?: unknown}).data;
  return Array.isArray(data) && data.every(isDueNotification) ? data : null;
}

export function NotificationController({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname?: string | null;
}) {
  const [state, dispatch] = useReducer(notificationReducer, emptyNotificationState);
  const {modalOpen} = usePresentationCoordinator();
  const pathnameRef = useRef(pathname);

  const acknowledge = useCallback(async (id: string, signal: AbortSignal) => {
    try {
      const response = await fetch('/api/notifications', {
        body: JSON.stringify({notificationId: id}),
        headers: {'content-type': 'application/json'},
        method: 'POST',
        signal,
      });
      dispatch({id, type: response.ok ? 'ACK_OK' : 'ACK_ERROR'});
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        dispatch({id, type: 'ACK_ERROR'});
      }
    }
  }, []);

  const poll = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await fetch('/api/notifications', {
        cache: 'no-store',
        method: 'GET',
        signal,
      });
      const data = notificationData(await response.json());
      if (!response.ok || !data) return;
      dispatch({items: data, type: 'POLL_VALID'});
      await Promise.all(data.map(({id}) => acknowledge(id, signal)));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        return;
      }
    }
  }, [acknowledge]);

  useEffect(() => {
    const controllers = new Set<AbortController>();
    let interval: number | undefined;
    const requestPoll = (): void => {
      const controller = new AbortController();
      controllers.add(controller);
      void poll(controller.signal).finally(() => controllers.delete(controller));
    };
    const stopInterval = (): void => {
      if (interval !== undefined) {
        window.clearInterval(interval);
        interval = undefined;
      }
    };
    const startVisiblePolling = (): void => {
      stopInterval();
      requestPoll();
      interval = window.setInterval(requestPoll, pollIntervalMilliseconds);
    };
    const onVisibilityChange = (): void => {
      if (document.hidden) {
        stopInterval();
      } else {
        startVisiblePolling();
      }
    };
    if (!document.hidden) startVisiblePolling();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      for (const controller of controllers) controller.abort();
    };
  }, [poll]);

  useEffect(() => {
    if (pathname === undefined || pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    dispatch({type: 'CENTER_CLOSE'});
  }, [pathname]);

  useEffect(() => {
    dispatch({type: modalOpen ? 'MODAL_OPEN' : 'MODAL_CLOSE'});
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen && !state.centerOpen && !state.activeToastId &&
      state.toastQueue.length > 0) {
      dispatch({type: 'TOAST_SHOW_NEXT'});
    }
  }, [modalOpen, state.activeToastId, state.centerOpen, state.toastQueue]);

  useEffect(() => {
    if (!state.activeToastId || modalOpen || state.centerOpen) return;
    const id = state.activeToastId;
    const timeout = window.setTimeout(() => {
      dispatch({id, type: 'TOAST_TIMEOUT'});
    }, toastDurationMilliseconds);
    return () => window.clearTimeout(timeout);
  }, [modalOpen, state.activeToastId, state.centerOpen]);

  return (
    <NotificationContext.Provider value={{dispatch, state}}>
      {children}
    </NotificationContext.Provider>
  );
}
