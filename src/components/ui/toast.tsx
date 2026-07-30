import {CircleCheck} from 'lucide-react';

type ToastProps = {
  message: string;
};

export function Toast({message}: ToastProps) {
  return (
    <div className="app-toast" role="status">
      <CircleCheck aria-hidden="true" />
      {message}
    </div>
  );
}
