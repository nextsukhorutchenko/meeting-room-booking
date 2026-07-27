import {CalendarX2, UserRoundCheck} from 'lucide-react';

type BookingBlockProps = {
  authorName: string;
  bookingId: string;
  height: number;
  isHighlighted: boolean;
  isOwn: boolean;
  onCancel(booking: {id: string; title: string}): void;
  title: string;
  top: number;
};

export function BookingBlock({
  authorName,
  bookingId,
  height,
  isHighlighted,
  isOwn,
  onCancel,
  title,
  top,
}: BookingBlockProps) {
  return (
    <article
      aria-label={`${title}, booked by ${authorName}${isOwn ? ', yours' : ''}`}
      className={[
        'booking-block',
        isOwn ? 'booking-own' : '',
        isHighlighted ? 'booking-highlighted' : '',
      ].filter(Boolean).join(' ')}
      data-highlighted={isHighlighted ? 'true' : undefined}
      style={{height: Math.max(height - 4, 32), top: top + 2}}
    >
      <strong>{title}</strong>
      <div className="booking-block-meta">
        <span>{authorName}</span>
        {isOwn ? (
          <span className="booking-owner-label">
            <UserRoundCheck aria-hidden="true" />
            Yours
          </span>
        ) : null}
      </div>
      {isOwn ? (
        <button
          aria-label={`Cancel ${title}`}
          className="booking-cancel-button"
          onClick={() => onCancel({id: bookingId, title})}
          title="Cancel booking"
          type="button"
        >
          <CalendarX2 aria-hidden="true" />
        </button>
      ) : null}
    </article>
  );
}
