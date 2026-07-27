import {UserRoundCheck} from 'lucide-react';

type BookingBlockProps = {
  authorName: string;
  height: number;
  isOwn: boolean;
  title: string;
  top: number;
};

export function BookingBlock({
  authorName,
  height,
  isOwn,
  title,
  top,
}: BookingBlockProps) {
  return (
    <article
      aria-label={`${title}, booked by ${authorName}${isOwn ? ', yours' : ''}`}
      className={isOwn ? 'booking-block booking-own' : 'booking-block'}
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
    </article>
  );
}
