import {redirect} from 'next/navigation';
import {AppHeader} from '../../components/app/app-header';
import {ScheduleClient} from '../../components/schedule/schedule-client';
import {getOptionalUser} from '../../modules/auth/auth.service';

export default async function SchedulePage() {
  const user = await getOptionalUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <>
      <AppHeader userName={user.name} />
      <main className="schedule-page">
        <div className="schedule-title-row">
          <div>
            <p className="schedule-eyebrow">Rooms</p>
            <h1>Schedule</h1>
          </div>
        </div>
        <ScheduleClient />
      </main>
    </>
  );
}
