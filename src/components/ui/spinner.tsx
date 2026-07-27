import {LoaderCircle} from 'lucide-react';

type SpinnerProps = {
  label?: string;
};

export function Spinner({label = 'Loading schedule'}: SpinnerProps) {
  return (
    <div className="spinner" role="status">
      <LoaderCircle aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
