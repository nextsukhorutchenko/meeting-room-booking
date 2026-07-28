import '@testing-library/jest-dom/vitest';
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {BookingBlock} from '../../src/components/schedule/booking-block';

describe('BookingBlock', () => {
  it('exposes the linked highlighted booking as the current item', () => {
    render(
      <BookingBlock
        authorName="Demo Organizer"
        bookingId="booking-1"
        height={36}
        isHighlighted
        isOwn={false}
        onCancel={vi.fn()}
        timeLabel="10:00-10:30"
        title="Planning"
        top={0}
      />,
    );

    expect(screen.getByRole('article', {name: /Planning/}))
      .toHaveAttribute('aria-current', 'true');
  });
});
