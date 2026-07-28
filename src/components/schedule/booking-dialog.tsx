'use client';

import {CalendarDays, Clock3, MapPin} from 'lucide-react';
import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {Button} from '../ui/button';
import {Dialog} from '../ui/dialog';
import type {BookingSelection} from './booking-selection';

export type {BookingSelection} from './booking-selection';

type ErrorBody = {
  error?: {
    code?: string;
    fields?: Record<string, string>;
    message?: string;
  };
};

type BookingDialogProps = {
  onClose(): void;
  onCreated(): void;
  selection: BookingSelection | null;
};

export function BookingDialog({
  onClose,
  onCreated,
  selection,
}: BookingDialogProps) {
  const [formError, setFormError] = useState('');
  const [titleError, setTitleError] = useState('');
  const [endsAt, setEndsAt] = useState(
    selection?.endTimeOptions[0]?.endsAt ?? '',
  );
  const [previousEndTimeOptions, setPreviousEndTimeOptions] = useState(
    selection?.endTimeOptions,
  );
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  if (selection?.endTimeOptions !== previousEndTimeOptions) {
    setPreviousEndTimeOptions(selection?.endTimeOptions);
    if (!selection?.endTimeOptions.some((option) => option.endsAt === endsAt)) {
      setEndsAt(selection?.endTimeOptions[0]?.endsAt ?? '');
    }
  }
  const selectedEndTime = selection?.endTimeOptions.find(
    (option) => option.endsAt === endsAt,
  );

  const close = useCallback(() => {
    if (!pendingRef.current) {
      setFormError('');
      setTitleError('');
      onClose();
    }
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || !selectedEndTime || pendingRef.current) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    if (!title) {
      setTitleError('Title is required');
      titleRef.current?.focus();
      return;
    }

    setFormError('');
    setTitleError('');
    pendingRef.current = true;
    setPending(true);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          roomId: selection.roomId,
          title,
          startsAt: selection.startsAt,
          endsAt: selectedEndTime.endsAt,
        }),
      });
      const body = await response.json() as ErrorBody;
      if (!response.ok) {
        setTitleError(body.error?.fields?.title ?? '');
        setFormError(
          body.error?.code === 'EMAIL_NOT_VERIFIED' ?
            'Verify your email before booking a room.' :
            body.error?.message ?? 'Unable to create the booking.',
        );
        return;
      }

      onCreated();
    } catch {
      setFormError('Unable to create the booking. Try again.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog
      initialFocusRef={titleRef}
      label={`Book ${selection?.roomName ?? 'room'}`}
      onClose={close}
      open={selection !== null}
    >
      {selection ? (
        <form
          aria-busy={pending}
          className="booking-form"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="booking-summary">
            <p>
              <MapPin aria-hidden="true" />
              {selection.roomName}
            </p>
            <p>
              <CalendarDays aria-hidden="true" />
              {selection.dateLabel}
            </p>
            <p>
              <Clock3 aria-hidden="true" />
              {selectedEndTime?.rangeLabel ?? selection.startTimeLabel}{' '}
              {selection.timeZoneLabel}
            </p>
          </div>
          {selection.endTimeOptions.length === 0 ? (
            <p className="dialog-alert" role="alert">
              This start time is no longer available. Choose another slot.
            </p>
          ) : null}
          {formError ? (
            <p className="dialog-alert" role="alert">{formError}</p>
          ) : null}
          <label className="control-field">
            <span>Title</span>
            <input
              aria-describedby={titleError ? 'booking-title-error' : undefined}
              aria-invalid={titleError ? true : undefined}
              maxLength={100}
              name="title"
              ref={titleRef}
              type="text"
            />
          </label>
          <label className="control-field">
            <span>End time</span>
            <select
              name="endsAt"
              onChange={(event) => setEndsAt(event.target.value)}
              value={endsAt}
            >
              {selection.endTimeOptions.map((option) => (
                <option key={option.endsAt} value={option.endsAt}>
                  {option.endTimeLabel} ({option.durationLabel})
                </option>
              ))}
            </select>
          </label>
          {titleError ? (
            <p className="field-error" id="booking-title-error">
              {titleError}
            </p>
          ) : null}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={pending}
              onClick={close}
              type="button"
            >
              Cancel
            </button>
            <Button disabled={!selectedEndTime} pending={pending} type="submit">
              Create booking
            </Button>
          </div>
        </form>
      ) : null}
    </Dialog>
  );
}
