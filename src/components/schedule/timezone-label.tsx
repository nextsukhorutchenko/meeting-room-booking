import {Globe2} from 'lucide-react';
import {areTimeZonesEquivalent} from '../../lib/time/browser-zone';

type TimezoneLabelProps = {
  officeCloseHour: number;
  officeOpenHour: number;
  officeTimeZone: string;
  userTimeZone: string;
};

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function TimezoneLabel({
  officeCloseHour,
  officeOpenHour,
  officeTimeZone,
  userTimeZone,
}: TimezoneLabelProps) {
  if (areTimeZonesEquivalent(officeTimeZone, userTimeZone)) {
    return null;
  }

  return (
    <p className="timezone-label">
      <Globe2 aria-hidden="true" className="size-4" />
      Office hours: {hourLabel(officeOpenHour)}–
      {hourLabel(officeCloseHour)} {officeTimeZone}
    </p>
  );
}
