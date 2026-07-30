'use client';

import {CalendarX2, LoaderCircle} from 'lucide-react';
import {useRef, type FormEvent} from 'react';
import {Dialog} from '../ui/dialog';
import {uiCopy} from '../../lib/i18n/ui-copy';

export type CancellationDialogProps = {
  booking: {id: string; title: string};
  error: string;
  pending: boolean;
  onCloseError(): void;
  onConfirm(): void;
  onKeep(): void;
};

export type CancellationSelection = CancellationDialogProps['booking'];

export function CancellationDialog({
  booking,
  error,
  onCloseError,
  onConfirm,
  onKeep,
  pending,
}: CancellationDialogProps) {
  const keepButtonRef = useRef<HTMLButtonElement>(null);
  const close = error ? onCloseError : onKeep;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) onConfirm();
  }

  return (
    <Dialog
      initialFocusRef={keepButtonRef}
      label={uiCopy.cancelBooking}
      onClose={pending ? () => undefined : close}
      open
      owner="cancellation"
    >
      <form aria-busy={pending || undefined} className="booking-form" onSubmit={submit}>
        <p className="cancellation-dialog-copy">
          Скасувати <strong>{booking.title}</strong>? Цей час знову стане
          доступним для інших.
        </p>
        {error ? <p className="dialog-alert" role="alert">{error}</p> : null}
        <div className="dialog-actions">
          <button
            className="secondary-button"
            disabled={pending}
            onClick={onKeep}
            ref={keepButtonRef}
            type="button"
          >
            {uiCopy.keepBooking}
          </button>
          <button className="destructive-button" disabled={pending} type="submit">
            {pending ? <LoaderCircle aria-hidden="true" className="cancellation-spinner" /> : <CalendarX2 aria-hidden="true" />}
            {uiCopy.cancelBooking}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
