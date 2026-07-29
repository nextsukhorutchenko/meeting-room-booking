'use client';

import {CalendarDays, ListChecks} from 'lucide-react';
import Link from 'next/link';
import type {ReactElement, ReactNode} from 'react';
import {AppHeader} from './app-header';

export type AppShellProps = {
  children: ReactNode;
  user: {name: string};
};

export function AppShell({children, user}: AppShellProps): ReactElement {
  return (
    <div className="app-shell">
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
