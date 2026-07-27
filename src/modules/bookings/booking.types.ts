export type CreateBookingInput = {
  userId: string;
  roomId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
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

export interface BookingService {
  create(input: CreateBookingInput): Promise<BookingView>;
}
