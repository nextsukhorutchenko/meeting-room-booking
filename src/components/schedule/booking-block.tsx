import {CalendarClock, UserRoundCheck} from 'lucide-react';

type BookingBlockProps = {
  authorName: string;
  bookingId: string;
  isHighlighted: boolean;
  isOwn: boolean;
  onOpenDetails?(invoker: HTMLElement): void;
  timeLabel: string;
  title: string;
};

export function BookingBlock({
  authorName,
  bookingId,
  isHighlighted,
  isOwn,
  onOpenDetails,
  timeLabel,
  title,
}: BookingBlockProps) {
  return (
    <button
      aria-current={isHighlighted ? 'true' : undefined}
      aria-label={
        `${title}; ${timeLabel}; ${isOwn ? 'Ваше' : 'Зайнято'}; ` +
        `організатор ${authorName}`
      }
      className={[
        'booking-block',
        isOwn ? 'booking-own' : '',
        isHighlighted ? 'booking-highlighted' : '',
      ].filter(Boolean).join(' ')}
      data-highlighted={isHighlighted ? 'true' : undefined}
      data-booking-id={bookingId}
      onClick={(event) => onOpenDetails?.(event.currentTarget)}
      type="button"
    >
      <span data-booking-title>{title}</span>
      <div className="booking-block-meta">
        <span className="booking-time-label">{timeLabel}</span>
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
      </div>
    </button>
  );
}
