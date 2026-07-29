import {DateTime, IANAZone} from 'luxon';
import {officeDaySlotStarts} from '../../lib/time/office-time';
import type {
  DayAgendaItem,
  DayAgendaProjection,
  NormalizedScheduleBooking,
  ScheduleBooking,
  ScheduleDataErrorReason,
  TimetableCell,
  TimetableProjection,
  ValidateFullScheduleWeekInput,
  ValidatedScheduleWeek,
} from './schedule-types';

const slotMinutes = 30;
const maximumDurationSlots = 8;

export type ProjectionResult<T> =
  | {ok: true; value: T}
  | {ok: false; error: 'schedule-data-error'; reason: ScheduleDataErrorReason};

export type ProjectTimetableInput = ValidateFullScheduleWeekInput & {
  visibleDays: readonly string[];
};

export type ProjectDayAgendaInput = ValidateFullScheduleWeekInput & {
  now: string;
  officeDay: string;
  userTimeZone: string;
};

function dataError(
  reason: ScheduleDataErrorReason,
): ProjectionResult<never> {
  return {ok: false, error: 'schedule-data-error', reason};
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isUtcInstant(value: string): boolean {
  return value.endsWith('Z') && DateTime.fromISO(value, {setZone: true}).isValid;
}

function hasBookingFields(value: unknown): value is ScheduleBooking {
  if (!value || typeof value !== 'object') return false;

  const booking = value as Partial<ScheduleBooking>;
  return (
    typeof booking.id === 'string' &&
    booking.id.length > 0 &&
    typeof booking.title === 'string' &&
    typeof booking.startsAt === 'string' &&
    typeof booking.endsAt === 'string' &&
    typeof booking.isOwn === 'boolean' &&
    Boolean(booking.author) &&
    typeof booking.author?.id === 'string' &&
    typeof booking.author?.name === 'string'
  );
}

function isAlignedToSlot(value: DateTime): boolean {
  return (
    value.second === 0 &&
    value.millisecond === 0 &&
    (value.minute === 0 || value.minute === slotMinutes)
  );
}

function validConfiguration(input: ValidateFullScheduleWeekInput): boolean {
  if (
    !IANAZone.isValidZone(input.officeTimeZone) ||
    !isDateOnly(input.weekStart) ||
    !Number.isInteger(input.officeOpenHour) ||
    !Number.isInteger(input.officeCloseHour) ||
    input.officeOpenHour < 0 ||
    input.officeCloseHour > 24 ||
    input.officeCloseHour <= input.officeOpenHour
  ) {
    return false;
  }

  const weekStart = DateTime.fromISO(input.weekStart, {
    zone: input.officeTimeZone,
  });
  return weekStart.isValid && weekStart.weekday === 1;
}

function officeWeekDays(input: ValidateFullScheduleWeekInput): readonly string[] {
  const weekStart = DateTime.fromISO(input.weekStart, {
    zone: input.officeTimeZone,
  });
  return Array.from({length: 7}, (_, index) =>
    weekStart.plus({days: index}).toFormat('yyyy-LL-dd'),
  );
}

function validateBooking(
  booking: ScheduleBooking,
  input: ValidateFullScheduleWeekInput,
  weekStartsAt: DateTime,
  weekEndsAt: DateTime,
): ProjectionResult<NormalizedScheduleBooking> {
  if (!isUtcInstant(booking.startsAt) || !isUtcInstant(booking.endsAt)) {
    return dataError('invalid-instant');
  }

  const startsAt = DateTime.fromISO(booking.startsAt, {setZone: true}).toUTC();
  const endsAt = DateTime.fromISO(booking.endsAt, {setZone: true}).toUTC();
  if (startsAt.toMillis() >= endsAt.toMillis()) {
    return dataError('invalid-order');
  }
  if (
    startsAt.toMillis() < weekStartsAt.toMillis() ||
    endsAt.toMillis() > weekEndsAt.toMillis()
  ) {
    return dataError('outside-week');
  }

  const officeStart = startsAt.setZone(input.officeTimeZone);
  const officeEnd = endsAt.setZone(input.officeTimeZone);
  const officeDay = officeStart.toFormat('yyyy-LL-dd');
  if (officeDay !== officeEnd.toFormat('yyyy-LL-dd')) {
    return dataError('cross-day');
  }
  if (!isAlignedToSlot(officeStart) || !isAlignedToSlot(officeEnd)) {
    return dataError('misaligned');
  }

  const slotStarts = officeDaySlotStarts({
    officeCloseHour: input.officeCloseHour,
    officeDay,
    officeOpenHour: input.officeOpenHour,
    officeTimeZone: input.officeTimeZone,
  });
  const opensAt = slotStarts[0];
  const closesAt = opensAt?.startOf('day').set({
    hour: input.officeCloseHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  if (!opensAt || !closesAt || officeStart < opensAt || officeEnd > closesAt) {
    return dataError('outside-hours');
  }

  const spanSlots = endsAt.diff(startsAt, 'minutes').minutes / slotMinutes;
  if (
    !Number.isInteger(spanSlots) ||
    spanSlots < 1 ||
    spanSlots > maximumDurationSlots
  ) {
    return dataError('invalid-duration');
  }

  return {
    ok: true,
    value: {
      ...booking,
      officeDay,
      startSlotIndex: (officeStart.hour * 60 + officeStart.minute -
        input.officeOpenHour * 60) / slotMinutes,
      spanSlots,
    },
  };
}

export function validateFullScheduleWeek(
  input: ValidateFullScheduleWeekInput,
): ProjectionResult<ValidatedScheduleWeek> {
  if (!validConfiguration(input) || !Array.isArray(input.bookings)) {
    return dataError('invalid-field');
  }

  const weekStart = DateTime.fromISO(input.weekStart, {
    zone: input.officeTimeZone,
  });
  const weekStartsAt = weekStart.toUTC();
  const weekEndsAt = weekStart.plus({weeks: 1}).toUTC();
  const days = officeWeekDays(input);
  const occupancyByDay = new Map<string, (string | null)[]>(
    days.map((day) => [
      day,
      Array.from(
        {length: (input.officeCloseHour - input.officeOpenHour) * 2},
        () => null,
      ),
    ]),
  );
  const seenIds = new Set<string>();
  const bookings: NormalizedScheduleBooking[] = [];

  for (const candidate of input.bookings) {
    if (!hasBookingFields(candidate)) return dataError('invalid-field');
    if (seenIds.has(candidate.id)) return dataError('duplicate-id');
    seenIds.add(candidate.id);

    const validated = validateBooking(
      candidate,
      input,
      weekStartsAt,
      weekEndsAt,
    );
    if (!validated.ok) return validated;

    const occupancy = occupancyByDay.get(validated.value.officeDay);
    if (!occupancy) return dataError('outside-week');
    for (
      let slotIndex = validated.value.startSlotIndex;
      slotIndex < validated.value.startSlotIndex + validated.value.spanSlots;
      slotIndex += 1
    ) {
      if (occupancy[slotIndex] !== null) return dataError('overlap');
      occupancy[slotIndex] = validated.value.id;
    }
    bookings.push(validated.value);
  }

  return {ok: true, value: {bookings, occupancyByDay}};
}

function buildTimetableRows(
  days: readonly string[],
  bookings: readonly NormalizedScheduleBooking[],
  slotCount: number,
): TimetableProjection {
  const starts = new Map<string, NormalizedScheduleBooking>();
  const continuations = new Map<string, string>();
  for (const booking of bookings) {
    starts.set(`${booking.officeDay}:${booking.startSlotIndex}`, booking);
    for (
      let slotIndex = booking.startSlotIndex + 1;
      slotIndex < booking.startSlotIndex + booking.spanSlots;
      slotIndex += 1
    ) {
      continuations.set(`${booking.officeDay}:${slotIndex}`, booking.id);
    }
  }

  return {
    days,
    rows: Array.from({length: slotCount}, (_, slotIndex) => ({
      slotIndex,
      cells: days.map((day): TimetableCell => {
        const key = `${day}:${slotIndex}`;
        const booking = starts.get(key);
        if (booking) return {kind: 'booking-start', booking};
        const bookingId = continuations.get(key);
        if (bookingId) return {kind: 'booking-continuation', bookingId};
        return {kind: 'empty', day, slotIndex};
      }),
    })),
  };
}

export function projectTimetable(
  input: ProjectTimetableInput,
): ProjectionResult<TimetableProjection> {
  const validated = validateFullScheduleWeek(input);
  if (!validated.ok) return validated;

  const visibleSet = new Set(input.visibleDays);
  const visibleBookings = validated.value.bookings.filter(({officeDay}) =>
    visibleSet.has(officeDay),
  );
  return {
    ok: true,
    value: buildTimetableRows(
      input.visibleDays,
      visibleBookings,
      (input.officeCloseHour - input.officeOpenHour) * 2,
    ),
  };
}

export function projectDayAgenda(
  input: ProjectDayAgendaInput,
): ProjectionResult<DayAgendaProjection> {
  const validated = validateFullScheduleWeek(input);
  if (!validated.ok) return validated;
  if (
    !IANAZone.isValidZone(input.userTimeZone) ||
    !isUtcInstant(input.now) ||
    !validated.value.occupancyByDay.has(input.officeDay)
  ) {
    return dataError('invalid-field');
  }

  const now = DateTime.fromISO(input.now, {setZone: true}).toUTC();
  const slotStarts = officeDaySlotStarts({
    officeCloseHour: input.officeCloseHour,
    officeDay: input.officeDay,
    officeOpenHour: input.officeOpenHour,
    officeTimeZone: input.officeTimeZone,
  });
  const bookingsByStartSlot = new Map<number, NormalizedScheduleBooking>(
    validated.value.bookings
      .filter(({officeDay}) => officeDay === input.officeDay)
      .map((booking) => [booking.startSlotIndex, booking]),
  );
  const coveredSlotIndices: number[] = [];
  const items: DayAgendaItem[] = [];

  for (let slotIndex = 0; slotIndex < slotStarts.length; slotIndex += 1) {
    const booking = bookingsByStartSlot.get(slotIndex);
    if (booking) {
      items.push({kind: 'busy', slotIndex, booking});
      for (
        let coveredSlot = slotIndex;
        coveredSlot < slotIndex + booking.spanSlots;
        coveredSlot += 1
      ) {
        coveredSlotIndices.push(coveredSlot);
      }
      slotIndex += booking.spanSlots - 1;
      continue;
    }

    const startsAt = slotStarts[slotIndex].toUTC().toISO() ?? '';
    items.push({
      kind: slotStarts[slotIndex].toUTC() <= now ? 'past' : 'free',
      slotIndex,
      startsAt,
    });
    coveredSlotIndices.push(slotIndex);
  }

  return {
    ok: true,
    value: {officeDay: input.officeDay, items, coveredSlotIndices},
  };
}
