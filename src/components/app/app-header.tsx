import {CalendarDays, ListChecks} from 'lucide-react';
import Link from 'next/link';
import {LogoutButton} from '../auth/logout-button';

type AppHeaderProps = {
  currentPage: 'schedule' | 'my-bookings';
  userName: string;
};

export function AppHeader({currentPage, userName}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link className="app-brand" href="/schedule">
          Roomwork
        </Link>
        <nav aria-label="Primary navigation" className="app-nav">
          <Link
            aria-current={currentPage === 'schedule' ? 'page' : undefined}
            className="app-nav-link"
            href="/schedule"
          >
            <CalendarDays aria-hidden="true" className="size-4" />
            Schedule
          </Link>
          <Link
            aria-current={currentPage === 'my-bookings' ? 'page' : undefined}
            className="app-nav-link"
            href="/my-bookings"
          >
            <ListChecks aria-hidden="true" className="size-4" />
            My Bookings
          </Link>
        </nav>
        <div className="app-account">
          <span className="app-user-name">{userName}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
