import {Globe2} from 'lucide-react';
import {areTimeZonesEquivalent} from '../../lib/time/browser-zone';
import {uiCopy} from '../../lib/i18n/ui-copy';

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
    <p className="timezone-label timezone-notice" data-testid="timezone-notice">
      <Globe2 aria-hidden="true" className="size-4" />
      <span className="timezone-notice-content">
        <span>
          {uiCopy.officeHours}: {hourLabel(officeOpenHour)}–
          {hourLabel(officeCloseHour)}
        </span>
        <span>{officeTimeZone}</span>
      </span>
    </p>
  );
}
