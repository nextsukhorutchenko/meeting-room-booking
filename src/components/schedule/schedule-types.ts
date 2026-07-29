export type ResponsiveMode =
  | 'unresolved'
  | 'expanded'
  | 'medium'
  | 'tablet'
  | 'mobile';

export type RoomSummary = {
  id: string;
  name: string;
  floor: number;
  capacity: number;
};

export type ScheduleBooking = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  author: {id: string; name: string};
  isOwn: boolean;
};

export type ScheduleData = {
  room: RoomSummary;
  officeTimeZone: string;
  officeWeekStart: string;
  range: {startsAt: string; endsAt: string};
  bookings: readonly ScheduleBooking[];
};

export type VisibleDayCount = 2 | 3 | 7;
