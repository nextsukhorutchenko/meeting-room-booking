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
