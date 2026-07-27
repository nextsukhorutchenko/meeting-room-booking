import {redirect} from 'next/navigation';
import {AppHeader} from '../../components/app/app-header';
import {BookingList} from '../../components/bookings/booking-list';
import {readAppEnv} from '../../lib/config/env';
import {getOptionalUser} from '../../modules/auth/auth.service';

export default async function MyBookingsPage() {
  const user = await getOptionalUser();
  if (!user) {
    redirect('/login');
  }
  const {officeTimeZone} = readAppEnv();

  return (
    <>
      <AppHeader currentPage="my-bookings" userName={user.name} />
      <main className="booking-history-page">
        <div className="booking-history-header">
          <p className="schedule-eyebrow">Personal</p>
          <h1>My Bookings</h1>
        </div>
        <BookingList officeTimeZone={officeTimeZone} />
      </main>
    </>
  );
}
