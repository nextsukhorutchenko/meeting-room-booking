import {ScheduleWorkspace} from
  '../../../components/schedule/schedule-workspace';
import {readAppEnv} from '../../../lib/config/env';

export default function SchedulePage() {
  const {
    officeCloseHour,
    officeOpenHour,
    officeTimeZone,
  } = readAppEnv();

  return (
    <div className="schedule-page">
      <div className="schedule-title-row">
        <div>
          <p className="schedule-eyebrow">Переговорні</p>
          <h1>Розклад</h1>
        </div>
      </div>
      <ScheduleWorkspace
        officeCloseHour={officeCloseHour}
        officeOpenHour={officeOpenHour}
        officeTimeZone={officeTimeZone}
      />
    </div>
  );
}
