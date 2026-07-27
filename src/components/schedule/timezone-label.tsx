import {Globe2} from 'lucide-react';

type TimezoneLabelProps = {
  officeTimeZone: string;
};

export function TimezoneLabel({officeTimeZone}: TimezoneLabelProps) {
  return (
    <p className="timezone-label">
      <Globe2 aria-hidden="true" className="size-4" />
      Office time: {officeTimeZone}
    </p>
  );
}
