import {redirect} from 'next/navigation';
import {LogoutButton} from '../../components/auth/logout-button';
import {getOptionalUser} from '../../modules/auth/auth.service';

export default async function SchedulePage() {
  const user = await getOptionalUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <p className="text-sm font-semibold text-slate-950 sm:text-base">
            Meeting Room Booking
          </p>
          <div className="flex min-w-0 items-center gap-3">
            <p className="truncate text-sm text-slate-600">{user.name}</p>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-950">Schedule</h1>
      </main>
    </>
  );
}
