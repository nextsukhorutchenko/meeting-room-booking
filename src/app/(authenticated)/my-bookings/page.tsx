import {BookingList} from '../../../components/bookings/booking-list';
import {readAppEnv} from '../../../lib/config/env';

export default function MyBookingsPage() {
  const {officeTimeZone} = readAppEnv();

  return (
    <div className="booking-history-page">
      <div className="booking-history-header">
        <p className="schedule-eyebrow">Особисті</p>
        <h1>Мої бронювання</h1>
      </div>
      <BookingList officeTimeZone={officeTimeZone} />
    </div>
  );
}
