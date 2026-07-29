'use client';

import {Bell, X} from 'lucide-react';
import {createPortal} from 'react-dom';
import {useCallback, useEffect, useState, type MouseEvent} from 'react';
import type {DueNotification} from '../../modules/notifications/notification.service';
import type {ResponsiveMode} from '../schedule/schedule-types';
import {
  usePresentationCoordinator,
  usePresentationSurface,
} from './presentation-coordinator';

const pollIntervalMilliseconds = 60_000;

function isDueNotification(value: unknown): value is DueNotification {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const notification = value as Partial<DueNotification>;
  return (
    typeof notification.id === 'string' &&
    typeof notification.roomName === 'string' &&
    typeof notification.currentTitle === 'string' &&
    typeof notification.endsAt === 'string' &&
    !Number.isNaN(Date.parse(notification.endsAt)) &&
    typeof notification.nextAuthorName === 'string'
  );
}

function isNotificationList(value: unknown): value is DueNotification[] {
  return Array.isArray(value) && value.every(isDueNotification);
}

function notificationData(value: unknown): DueNotification[] | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const data = (value as {data?: unknown}).data;
  return isNotificationList(data) ? data : null;
}

function message(notification: DueNotification): string {
  return `${notification.currentTitle} ends soon in ` +
    `${notification.roomName}. ${notification.nextAuthorName} is next.`;
}

type NotificationBellProps = {
  mode?: ResponsiveMode;
};

export function NotificationBell({mode = 'expanded'}: NotificationBellProps) {
  const [notifications, setNotifications] = useState<DueNotification[]>([]);
  const [expanded, setExpanded] = useState(mode !== 'mobile');
  const [surface, setSurface] = useState<HTMLElement | null>(null);
  const {modalOwner, request} = usePresentationCoordinator();
  const mobilePresentation = mode === 'mobile';
  const notificationOwnerActive = usePresentationSurface(
    'notifications',
    surface,
  );
  const modalActive = mobilePresentation && expanded && notificationOwnerActive;

  const poll = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/notifications', {
        cache: 'no-store',
        method: 'GET',
        signal,
      });
      const body: unknown = await response.json();
      const data = notificationData(body);
      if (!response.ok || !data) {
        return;
      }
      if (data.length > 0) {
        if (!mobilePresentation) setExpanded(true);
        setNotifications((current) => {
          const knownIds = new Set(current.map(({id}) => id));
          return [
            ...current,
            ...data.filter(({id}) => !knownIds.has(id)),
          ];
        });
        await Promise.all(data.map(async ({id}) => {
          await fetch('/api/notifications', {
            body: JSON.stringify({notificationId: id}),
            headers: {'content-type': 'application/json'},
            method: 'POST',
            signal,
          });
        }));
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        return;
      }
    }
  }, [mobilePresentation]);

  useEffect(() => {
    const controllers = new Set<AbortController>();
    let interval: number | undefined;

    const requestPoll = (): void => {
      const controller = new AbortController();
      controllers.add(controller);
      void poll(controller.signal).finally(() => {
        controllers.delete(controller);
      });
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
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        stopInterval();
        return;
      }
      startVisiblePolling();
    };

    if (!document.hidden) {
      startVisiblePolling();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      for (const controller of controllers) {
        controller.abort();
      }
    };
  }, [poll]);

  useEffect(() => {
    if (!mobilePresentation && modalOwner === 'notifications') {
      request({type: 'CLOSE_NOTIFICATIONS'});
    }
  }, [mobilePresentation, modalOwner, request]);

  const unreadCount = notifications.length;
  const bellLabel = unreadCount > 0 ?
    `Notifications, ${unreadCount} unread` :
    'Notifications';

  function toggleNotifications(event: MouseEvent<HTMLButtonElement>) {
    if (!mobilePresentation) {
      setExpanded((current) => !current);
      return;
    }
    if (modalActive) {
      if (request({type: 'CLOSE_NOTIFICATIONS'}) === 'ACCEPTED') {
        setExpanded(false);
      }
      return;
    }
    if (request({bell: event.currentTarget, type: 'OPEN_NOTIFICATIONS'}) ===
      'ACCEPTED') {
      setExpanded(true);
    }
  }

  const presentation = (
    <div
      aria-label="Booking notifications"
      aria-modal={modalActive || undefined}
      className="notification-toast-region"
      ref={setSurface}
      role={modalActive ? 'dialog' : 'region'}
    >
      {(!mobilePresentation || modalActive) && expanded ? notifications.map((notification) => (
        <div
          aria-live="polite"
          className="notification-toast"
          key={notification.id}
          role="status"
        >
          <Bell aria-hidden="true" />
          <span>{message(notification)}</span>
          <button
            aria-label="Dismiss notification"
            className="notification-dismiss"
            onClick={() => setNotifications((current) =>
              current.filter(({id}) => id !== notification.id),
            )}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      )) : null}
    </div>
  );

  return (
    <div className="notification-control">
      <button
        aria-expanded={mobilePresentation ? modalActive : expanded}
        aria-label={bellLabel}
        className="notification-bell"
        onClick={toggleNotifications}
        type="button"
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 ? (
          <span aria-hidden="true" className="notification-indicator">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>
      {modalActive && typeof document !== 'undefined' ?
        createPortal(presentation, document.body) :
        presentation}
    </div>
  );
}
