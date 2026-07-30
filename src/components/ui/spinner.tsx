import {LoaderCircle} from 'lucide-react';
import {uiCopy} from '../../lib/i18n/ui-copy';

type SpinnerProps = {
  label?: string;
};

export function Spinner({label = uiCopy.loadingSchedule}: SpinnerProps) {
  return (
    <div
      aria-label={label}
      aria-live="polite"
      className="spinner"
      role="status"
    >
      <LoaderCircle aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
