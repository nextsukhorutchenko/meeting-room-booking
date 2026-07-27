'use client';

import {CalendarX2, LoaderCircle} from 'lucide-react';
import {useCallback, useRef, useState, type FormEvent} from 'react';
import {Dialog} from '../ui/dialog';

export type CancellationSelection = {
  id: string;
  title: string;
};

type ErrorBody = {
  error?: {message?: string};
};

type CancelBookingDialogProps = {
  booking: CancellationSelection;
  onCancelled(): void;
  onClose(): void;
};

export function CancelBookingDialog({
  booking,
  onCancelled,
  onClose,
}: CancelBookingDialogProps) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const keepButtonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    if (!pendingRef.current) {
      setError('');
      onClose();
    }
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) {
      return;
    }

    setError('');
    pendingRef.current = true;
    setPending(true);
    try {
      const response = await fetch(
        `/api/bookings/${encodeURIComponent(booking.id)}`,
        {method: 'DELETE'},
      );
      if (!response.ok) {
        let body: ErrorBody = {};
        try {
          body = await response.json() as ErrorBody;
        } catch {
          // The stable fallback below covers malformed upstream responses.
        }
        setError(body.error?.message ?? 'Unable to cancel the booking.');
        return;
      }

      onCancelled();
    } catch {
      setError('Unable to cancel the booking. Try again.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog
      initialFocusRef={keepButtonRef}
      label="Cancel booking"
      onClose={close}
      open
    >
      <form
        aria-busy={pending}
        className="booking-form"
        onSubmit={handleSubmit}
      >
        <p className="cancellation-dialog-copy">
          Cancel <strong>{booking.title}</strong>? The time will become
          available for someone else.
        </p>
        {error ? (
          <p className="dialog-alert" role="alert">{error}</p>
        ) : null}
        <div className="dialog-actions">
          <button
            className="secondary-button"
            disabled={pending}
            onClick={close}
            ref={keepButtonRef}
            type="button"
          >
            Keep booking
          </button>
          <button
            className="destructive-button"
            disabled={pending}
            type="submit"
          >
            {pending ? (
              <LoaderCircle
                aria-hidden="true"
                className="cancellation-spinner"
              />
            ) : (
              <CalendarX2 aria-hidden="true" />
            )}
            Cancel booking
          </button>
        </div>
      </form>
    </Dialog>
  );
}
