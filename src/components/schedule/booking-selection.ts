import type {BookingEndTimeOption} from '../../modules/bookings/end-time-options';

export type StartSlotSelection = {
  dateLabel: string;
  roomId: string;
  roomName: string;
  startsAt: string;
  startTimeLabel: string;
  timeZoneLabel: string;
};

export type BookingSelection = StartSlotSelection & {
  endTimeOptions: readonly BookingEndTimeOption[];
};
