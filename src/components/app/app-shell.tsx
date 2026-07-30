'use client';

import {CalendarDays, ListChecks} from 'lucide-react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useRef, type ReactElement, type ReactNode} from 'react';
import {AppHeader} from './app-header';
import {NotificationController} from './notification-controller';
import {
  PresentationCoordinator,
  usePresentationCoordinator,
} from './presentation-coordinator';

export type AppShellProps = {
  children: ReactNode;
  user: {name: string};
};

export function AppShell({children, user}: AppShellProps): ReactElement {
  const pathname = usePathname();
  return (
    <PresentationCoordinator pathname={pathname}>
      <NotificationController pathname={pathname}>
        <AppShellContent user={user}>{children}</AppShellContent>
      </NotificationController>
    </PresentationCoordinator>
  );
}

function AppShellContent({children, user}: AppShellProps): ReactElement {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const {registerBackground} = usePresentationCoordinator();

  return (
    <div
      className="app-shell"
      ref={(element) => {
        backgroundRef.current = element;
        registerBackground(element);
      }}
    >
      <a className="skip-link" href="#main-content">
        Перейти до основного вмісту
      </a>
      <AppHeader userName={user.name} />
      <main
        aria-label="Основний вміст"
        className="app-shell-main"
        id="main-content"
      >
        {children}
      </main>
      <nav aria-label="Нижня навігація" className="bottom-nav">
        <Link className="bottom-nav-link" href="/schedule">
          <CalendarDays aria-hidden="true" />
          <span>Розклад</span>
        </Link>
        <Link className="bottom-nav-link" href="/my-bookings">
          <ListChecks aria-hidden="true" />
          <span>Мої бронювання</span>
        </Link>
      </nav>
    </div>
  );
}
