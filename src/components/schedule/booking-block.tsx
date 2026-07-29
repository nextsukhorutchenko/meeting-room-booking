import {CalendarClock, UserRoundCheck} from 'lucide-react';
import type {CSSProperties} from 'react';

type BookingBlockProps = {
  accessibleName: string;
  bookingId: string;
  isHighlighted: boolean;
  isOwn: boolean;
  onOpenDetails?(invoker: HTMLElement): void;
  style?: CSSProperties;
  timeLabel: string;
  title: string;
};

export function BookingBlock({
  accessibleName,
  bookingId,
  isHighlighted,
  isOwn,
  onOpenDetails,
  style,
  timeLabel,
  title,
}: BookingBlockProps) {
  return (
    <button
      aria-current={isHighlighted ? 'true' : undefined}
      aria-label={accessibleName}
      className={[
        'booking-block',
        isOwn ? 'booking-own' : '',
        isHighlighted ? 'booking-highlighted' : '',
      ].filter(Boolean).join(' ')}
      data-highlighted={isHighlighted ? 'true' : undefined}
      data-booking-id={bookingId}
      onClick={(event) => onOpenDetails?.(event.currentTarget)}
      style={style}
      type="button"
    >
      <span className="booking-block-heading">
        <span data-booking-title>{title}</span>
        {isOwn ? (
          <span className="booking-owner-label">
            <UserRoundCheck aria-hidden="true" />
            Ваше
          </span>
        ) : (
          <span className="booking-other-label">
            <CalendarClock aria-hidden="true" />
            Зайнято
          </span>
        )}
      </span>
      <span className="booking-block-meta">
        <span className="booking-time-label">{timeLabel}</span>
      </span>
    </button>
  );
}
