'use client';

import {CalendarDays, ListChecks} from 'lucide-react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {LogoutButton} from '../auth/logout-button';
import {NotificationBell} from './notification-bell';

type AppHeaderProps = {userName: string};

export function AppHeader({userName}: AppHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-identity">
          <Link className="app-brand" href="/schedule">
            Roomwork
          </Link>
          <span className="app-descriptor">Бронювання переговорних</span>
        </div>
        <nav aria-label="Основна навігація" className="app-nav">
          <Link
            aria-current={pathname === '/schedule' ? 'page' : undefined}
            className="app-nav-link"
            href="/schedule"
          >
            <CalendarDays aria-hidden="true" className="size-4" />
            Розклад
          </Link>
          <Link
            aria-current={pathname === '/my-bookings' ? 'page' : undefined}
            className="app-nav-link"
            href="/my-bookings"
          >
            <ListChecks aria-hidden="true" className="size-4" />
            Мої бронювання
          </Link>
        </nav>
        <div className="app-account">
          <span className="app-user-name">{userName}</span>
          <NotificationBell />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
