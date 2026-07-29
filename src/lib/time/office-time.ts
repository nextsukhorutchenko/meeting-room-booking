import {DateTime, IANAZone} from 'luxon';
import {DomainError} from '../http/domain-error';

export interface Clock {
  now(): Date;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function invalidOfficeWeek(): DomainError {
  return new DomainError({
    code: 'VALIDATION_FAILED',
    message: 'weekStart must be an ISO Monday date',
    status: 400,
    fields: {weekStart: 'Must be an ISO Monday date'},
  });
}

function invalidOfficeTimeZone(): DomainError {
  return new DomainError({
    code: 'VALIDATION_FAILED',
    message: 'officeTimeZone must be a valid IANA time zone',
    status: 400,
    fields: {officeTimeZone: 'Must be a valid IANA time zone'},
  });
}

export function assertOfficeTimeZone(officeTimeZone: string): void {
  if (!IANAZone.isValidZone(officeTimeZone)) {
    throw invalidOfficeTimeZone();
  }
}

export function officeWeekBounds(
  weekStart: string,
  officeTimeZone: string,
): {startsAt: Date; endsAt: Date} {
  assertOfficeTimeZone(officeTimeZone);

  if (!isoDatePattern.test(weekStart)) {
    throw invalidOfficeWeek();
  }

  const startsAt = DateTime.fromISO(weekStart, {zone: officeTimeZone});
  if (!startsAt.isValid || startsAt.weekday !== 1) {
    throw invalidOfficeWeek();
  }

  const endsAt = startsAt.plus({weeks: 1});
  return {
    startsAt: startsAt.toUTC().toJSDate(),
    endsAt: endsAt.toUTC().toJSDate(),
  };
}

export function officeDaySlotStarts(input: {
  officeDay: string;
  officeOpenHour: number;
  officeCloseHour: number;
  officeTimeZone: string;
}): readonly DateTime[] {
  assertOfficeTimeZone(input.officeTimeZone);

  if (
    !isoDatePattern.test(input.officeDay) ||
    !Number.isInteger(input.officeOpenHour) ||
    !Number.isInteger(input.officeCloseHour) ||
    input.officeOpenHour < 0 ||
    input.officeCloseHour > 24 ||
    input.officeCloseHour <= input.officeOpenHour
  ) {
    return [];
  }

  const officeDay = DateTime.fromISO(input.officeDay, {
    zone: input.officeTimeZone,
  });
  if (!officeDay.isValid) return [];

  const slotCount = (input.officeCloseHour - input.officeOpenHour) * 2;
  return Array.from({length: slotCount}, (_, index) =>
    officeDay.startOf('day').set({
      hour: input.officeOpenHour,
      minute: index * 30,
      second: 0,
      millisecond: 0,
    }),
  );
}
