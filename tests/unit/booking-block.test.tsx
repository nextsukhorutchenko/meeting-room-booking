import '@testing-library/jest-dom/vitest';
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {BookingBlock} from '../../src/components/schedule/booking-block';

describe('BookingBlock', () => {
  it('exposes the linked highlighted booking as the current item', () => {
    render(
      <BookingBlock
        accessibleName={
          'Вибрати бронювання Planning; зайнято; ваш час: ' +
          'понеділок, 2 березня 2026 р., 10:00 - ' +
          'понеділок, 2 березня 2026 р., 10:30, Europe/Kyiv.'
        }
        bookingId="booking-1"
        isHighlighted
        isOwn={false}
        onOpenDetails={vi.fn()}
        timeLabel="10:00-10:30"
        title="Planning"
      />,
    );

    expect(screen.getByRole('button', {
      name: /2 березня 2026.*10:00.*10:30.*Europe\/Kyiv/,
    }))
      .toHaveAttribute('aria-current', 'true');
    expect(screen.queryByRole('button', {name: /Cancel/}))
      .not.toBeInTheDocument();
  });
});
