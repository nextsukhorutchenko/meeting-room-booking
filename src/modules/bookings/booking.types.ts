export type CreateBookingInput = {
  userId: string;
  roomId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
};

export type CancelBookingInput = {
  bookingId: string;
  userId: string;
  cancelledAt: Date;
};

export type CreatedBooking = {
  id: string;
  roomId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  author: {
    id: string;
    name: string;
  };
};

export type BookingView = {
  id: string;
  roomId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  author: {
    id: string;
    name: string;
  };
  isOwn: boolean;
};

export type BookingListItem = {
  id: string;
  room: {
    id: string;
    name: string;
  };
  title: string;
  startsAt: string;
  endsAt: string;
  status: 'upcoming' | 'completed' | 'cancelled';
};

export type BookingPage = {
  items: BookingListItem[];
  nextCursor: string | null;
};

export type ListUserBookingsInput = {
  userId: string;
  scope: 'future' | 'past';
  cursor?: string;
  limit: number;
  now: Date;
};

export interface BookingService {
  cancel(input: CancelBookingInput): Promise<void>;
  create(input: CreateBookingInput): Promise<BookingView>;
  listUserBookings(input: ListUserBookingsInput): Promise<BookingPage>;
}
