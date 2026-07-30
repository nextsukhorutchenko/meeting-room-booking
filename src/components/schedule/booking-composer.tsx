'use client';

import {CalendarDays, Clock3, MapPin} from 'lucide-react';
import {useLayoutEffect, useRef} from 'react';
import {uiCopy} from '../../lib/i18n/ui-copy';
import {Button} from '../ui/button';
import type {BookingControllerState} from './booking-controller';

export type BookingComposerProps = {
  state: Extract<BookingControllerState, {selection: unknown}>;
  onClose(): void;
  onEndChange(endsAt: string): void;
  onRetryRefresh(): void;
  onSubmit(): void;
  onTitleChange(value: string): void;
};

export function BookingComposer({
  onClose,
  onEndChange,
  onRetryRefresh,
  onSubmit,
  onTitleChange,
  state,
}: BookingComposerProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const selectedEndTime = state.endOptions.find(
    (option) => option.endsAt === state.endsAt,
  );
  const pending = state.status === 'submitting' ||
    state.status === 'conflictRefreshing';
  const canSubmit = state.status === 'editing' && Boolean(selectedEndTime);

  useLayoutEffect(() => {
    titleRef.current?.focus();
  }, [state.selectionGeneration]);

  return (
    <form
      aria-busy={pending || undefined}
      className="booking-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!selectedEndTime) return;
        onSubmit();
        if (!state.title.trim()) {
          titleRef.current?.focus();
        }
      }}
    >
      <div className="booking-summary">
        <p><MapPin aria-hidden="true" />{state.selection.roomName}</p>
        <p><CalendarDays aria-hidden="true" />{state.selection.dateLabel}</p>
        <p>
          <Clock3 aria-hidden="true" />
          {selectedEndTime?.rangeLabel ?? state.selection.startTimeLabel}{' '}
          {state.selection.timeZoneLabel}
        </p>
      </div>
      {state.status === 'startUnavailable' ? (
        <p className="dialog-alert" role="alert">
          Цей час початку більше недоступний. Оберіть інший слот.
        </p>
      ) : null}
      {state.formError ? (
        <p className="dialog-alert" role="alert">{state.formError}</p>
      ) : null}
      {state.status === 'conflictError' ? (
        <button className="secondary-button" onClick={onRetryRefresh} type="button">
          Оновити доступність
        </button>
      ) : null}
      <label className="control-field">
        <span>{uiCopy.title}</span>
        <input
          aria-describedby={state.fieldErrors.title ? 'booking-title-error' : undefined}
          aria-invalid={state.fieldErrors.title ? true : undefined}
          disabled={pending}
          maxLength={100}
          name="title"
          onChange={(event) => onTitleChange(event.target.value)}
          ref={titleRef}
          type="text"
          value={state.title}
        />
      </label>
      <label className="control-field">
        <span>{uiCopy.endTime}</span>
        <select
          disabled={pending || state.endOptions.length === 0}
          name="endsAt"
          onChange={(event) => onEndChange(event.target.value)}
          value={state.endsAt}
        >
          {state.endOptions.map((option) => (
            <option key={option.endsAt} value={option.endsAt}>
              {option.endTimeLabel} ({option.durationLabel})
            </option>
          ))}
        </select>
      </label>
      {state.fieldErrors.title ? (
        <p className="field-error" id="booking-title-error">
          {state.fieldErrors.title}
        </p>
      ) : null}
      <p aria-live="polite" className="booking-live-message">
        {state.liveMessage}
      </p>
      <div className="booking-actions">
        <button
          className="secondary-button"
          disabled={pending}
          onClick={onClose}
          type="button"
        >
          {uiCopy.close}
        </button>
        <Button disabled={!canSubmit} pending={state.status === 'submitting'} type="submit">
          {uiCopy.book}
        </Button>
      </div>
    </form>
  );
}
