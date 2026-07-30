'use client';

import {Bell, X} from 'lucide-react';
import {createPortal} from 'react-dom';
import {useState, type MouseEvent} from 'react';
import type {ResponsiveMode} from '../schedule/schedule-types';
import {
  useNotifications,
  type RetainedNotification,
} from './notification-controller';
import {
  usePresentationCoordinator,
  usePresentationCoordinatorAvailable,
  usePresentationSurface,
} from './presentation-coordinator';
import {useFocusContainment} from '../ui/use-focus-containment';

export type NotificationCenterProps = {
  mode: ResponsiveMode;
  notifications: readonly RetainedNotification[];
  onDismiss(id: string): void;
  onOpenChange(open: boolean): void;
  open: boolean;
  toast?: RetainedNotification | null;
};

function message(notification: RetainedNotification): string {
  const {currentTitle, nextAuthorName, roomName} = notification.data;
  return `Зустріч ${currentTitle} у кімнаті ${roomName} скоро завершиться. ` +
    `Наступний користувач: ${nextAuthorName}.`;
}

export function NotificationCenter({
  mode,
  notifications,
  onDismiss,
  onOpenChange,
  open,
  toast = null,
}: NotificationCenterProps) {
  const [surface, setSurface] = useState<HTMLElement | null>(null);
  const {modalOwner, request} = usePresentationCoordinator();
  const hasCoordinator = usePresentationCoordinatorAvailable();
  const mobile = mode === 'mobile';
  const notificationOwnerActive = usePresentationSurface(
    'notifications',
    mobile ? surface : null,
  );
  const modalActive = mobile && open && notificationOwnerActive &&
    (!hasCoordinator || modalOwner === 'notifications');
  const showCenter = mobile ? modalActive : open;
  const unreadCount = notifications.filter(({seen}) => !seen).length;

  function closeCenter(): void {
    if (!mobile) {
      onOpenChange(false);
      return;
    }
    if (request({type: 'CLOSE_NOTIFICATIONS'}) === 'ACCEPTED') {
      onOpenChange(false);
    }
  }

  function toggle(event: MouseEvent<HTMLButtonElement>): void {
    if (!mobile) {
      onOpenChange(!open);
      return;
    }
    if (modalActive) {
      closeCenter();
      return;
    }
    if (request({bell: event.currentTarget, type: 'OPEN_NOTIFICATIONS'}) ===
      'ACCEPTED') {
      onOpenChange(true);
    }
  }
  useFocusContainment({
    active: modalActive,
    container: surface,
    onEscape: closeCenter,
  });

  const center = showCenter ? (
    <section
      aria-label="Сповіщення"
      aria-modal={modalActive || undefined}
      className={modalActive ? 'notification-sheet' : 'notification-popover'}
      ref={setSurface}
      role={modalActive ? 'dialog' : 'region'}
    >
      <div className="notification-center-heading">
        <h2>Сповіщення</h2>
        <button
          aria-label="Закрити сповіщення"
          className="notification-dismiss"
          onClick={closeCenter}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      </div>
      {notifications.length > 0 ? (
        <ul className="notification-list">
          {notifications.map((notification) => (
            <li className="notification-item" key={notification.data.id}>
              <p>{message(notification)}</p>
              <button
                aria-label="Відхилити сповіщення"
                className="notification-dismiss"
                onClick={() => onDismiss(notification.data.id)}
                type="button"
              >
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="notification-empty">Нових сповіщень немає.</p>}
    </section>
  ) : null;

  return (
    <div className="notification-control">
      <button
        aria-expanded={showCenter}
        aria-label={`Сповіщення, ${unreadCount} нових`}
        className="notification-bell"
        onClick={toggle}
        type="button"
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 ? (
          <span aria-hidden="true" className="notification-indicator">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>
      {!mobile && center}
      {mobile && center && typeof document !== 'undefined' ?
        createPortal(center, document.body) : null}
      {toast ? (
        <div aria-live="polite" className="notification-toast-region">
          <div className="notification-toast" role="status">
            <Bell aria-hidden="true" />
            <span>{message(toast)}</span>
            <button
              aria-label="Відхилити сповіщення"
              className="notification-dismiss"
              onClick={() => onDismiss(toast.data.id)}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ConnectedNotificationCenter({mode}: {mode: ResponsiveMode}) {
  const {dispatch, state} = useNotifications();
  const notifications = [...state.retainedById.values()];
  const toast = state.activeToastId ?
    state.retainedById.get(state.activeToastId) ?? null : null;
  return (
    <NotificationCenter
      mode={mode}
      notifications={notifications}
      onDismiss={(id) => dispatch({id, type: 'DISMISS'})}
      onOpenChange={(open) => dispatch({type: open ? 'CENTER_OPEN' : 'CENTER_CLOSE'})}
      open={state.centerOpen}
      toast={toast}
    />
  );
}
