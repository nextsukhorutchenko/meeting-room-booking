import {DateTime, IANAZone} from 'luxon';
import {formatInUserZone} from '../../lib/time/browser-zone';

const minimumDurationMinutes = 30;
const maximumDurationMinutes = 4 * 60;

export type BookingEndTimeOption = {
  durationLabel: string;
  durationMinutes: number;
  endsAt: string;
  endTimeLabel: string;
  rangeLabel: string;
};

export type BookingAvailabilityInterval = {
  endsAt: string;
  startsAt: string;
};

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  const hoursText = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return remainder === 0 ? hoursText : `${hoursText} ${remainder} min`;
}

function timeLabel(instant: string, userTimeZone: string): string {
  return formatInUserZone(instant, userTimeZone, {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
  });
}

function toUtcIso(value: DateTime): string {
  return value.toUTC().toISO() ?? '';
}

export function buildBookingEndTimeOptions(input: {
  bookings: readonly BookingAvailabilityInterval[];
  officeCloseHour: number;
  officeTimeZone: string;
  startsAt: string;
  userTimeZone: string;
}): readonly BookingEndTimeOption[] {
  if (!IANAZone.isValidZone(input.officeTimeZone)) return [];

  const startsAt = DateTime.fromISO(input.startsAt, {setZone: true});
  if (!startsAt.isValid) return [];

  const officeStart = startsAt.setZone(input.officeTimeZone);
  const officeClose = officeStart.startOf('day').set({
    hour: input.officeCloseHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  if (!officeClose.isValid) return [];

  const selectedStart = startsAt.toUTC();
  let nextBookingStart: DateTime | undefined;

  for (const booking of input.bookings) {
    const bookingStart = DateTime.fromISO(booking.startsAt, {setZone: true});
    const bookingEnd = DateTime.fromISO(booking.endsAt, {setZone: true});
    if (!bookingStart.isValid || !bookingEnd.isValid) continue;

    const bookingStartUtc = bookingStart.toUTC();
    const bookingEndUtc = bookingEnd.toUTC();
    if (bookingStartUtc <= selectedStart && bookingEndUtc > selectedStart) {
      return [];
    }

    if (
      bookingStartUtc > selectedStart &&
      bookingEndUtc > bookingStartUtc &&
      (!nextBookingStart || bookingStartUtc < nextBookingStart)
    ) {
      nextBookingStart = bookingStartUtc;
    }
  }

  const latestEnd = [
    selectedStart.plus({minutes: maximumDurationMinutes}),
    officeClose.toUTC(),
    nextBookingStart,
  ].reduce<DateTime | undefined>((earliest, candidate) => {
    if (!candidate) return earliest;
    if (!earliest || candidate < earliest) return candidate;
    return earliest;
  }, undefined);

  const firstEnd = selectedStart.plus({minutes: minimumDurationMinutes});
  if (!latestEnd || latestEnd < firstEnd) return [];

  const startIso = toUtcIso(selectedStart);
  const options: BookingEndTimeOption[] = [];
  for (
    let durationMinutes = minimumDurationMinutes;
    durationMinutes <= maximumDurationMinutes;
    durationMinutes += minimumDurationMinutes
  ) {
    const end = selectedStart.plus({minutes: durationMinutes});
    if (end > latestEnd) break;

    const endsAt = toUtcIso(end);
    options.push({
      durationLabel: durationLabel(durationMinutes),
      durationMinutes,
      endsAt,
      endTimeLabel: timeLabel(endsAt, input.userTimeZone),
      rangeLabel: `${timeLabel(startIso, input.userTimeZone)}-${timeLabel(
        endsAt,
        input.userTimeZone,
      )}`,
    });
  }

  return options;
}
