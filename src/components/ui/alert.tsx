import {CircleAlert} from 'lucide-react';

type AlertProps = {
  message: string;
};

export function Alert({message}: AlertProps) {
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
      role="alert"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
