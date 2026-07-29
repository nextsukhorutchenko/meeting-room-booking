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

export type ScheduleDataErrorReason =
  | 'duplicate-id'
  | 'invalid-field'
  | 'invalid-instant'
  | 'invalid-order'
  | 'outside-week'
  | 'cross-day'
  | 'misaligned'
  | 'outside-hours'
  | 'invalid-duration'
  | 'overlap';

export type ValidateFullScheduleWeekInput = {
  bookings: readonly ScheduleBooking[];
  weekStart: string;
  officeOpenHour: number;
  officeCloseHour: number;
  officeTimeZone: string;
};

export type NormalizedScheduleBooking = ScheduleBooking & {
  officeDay: string;
  startSlotIndex: number;
  spanSlots: number;
};

export type ValidatedScheduleWeek = {
  bookings: readonly NormalizedScheduleBooking[];
  occupancyByDay: ReadonlyMap<string, readonly (string | null)[]>;
};

export type TimetableCell =
  | {kind: 'empty'; day: string; slotIndex: number}
  | {kind: 'booking-start'; booking: NormalizedScheduleBooking}
  | {kind: 'booking-continuation'; bookingId: string};

export type TimetableProjection = {
  days: readonly string[];
  rows: readonly {
    slotIndex: number;
    cells: readonly TimetableCell[];
  }[];
};

export type DayAgendaItem =
  | {kind: 'free'; slotIndex: number; startsAt: string}
  | {kind: 'past'; slotIndex: number; startsAt: string}
  | {kind: 'busy'; slotIndex: number; booking: NormalizedScheduleBooking};

export type DayAgendaProjection = {
  officeDay: string;
  items: readonly DayAgendaItem[];
  coveredSlotIndices: readonly number[];
};
