import {DateTime} from 'luxon';
import {DomainError} from '../../lib/http/domain-error';
import {assertOfficeTimeZone} from '../../lib/time/office-time';

const minimumDurationMinutes = 30;
const maximumDurationMinutes = 4 * 60;

export type ValidatedInterval = {
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
};

export type BookingIntervalInput = {
  startsAt: Date;
  endsAt: Date;
  now: Date;
  officeTimeZone: string;
  officeOpenHour: number;
  officeCloseHour: number;
};

function validationError(
  message: string,
  fields: Record<string, string>,
): DomainError {
  return new DomainError({
    code: 'VALIDATION_FAILED',
    message,
    status: 400,
    fields,
  });
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function isAlignedToHalfHour(value: DateTime): boolean {
  if (value.second !== 0 || value.millisecond !== 0) {
    return false;
  }

  return value.minute === 0 || value.minute === 30;
}

function assertValidDate(value: Date, field: 'startsAt' | 'endsAt' | 'now') {
  if (!isValidDate(value)) {
    throw validationError('Booking times must be valid dates', {
      [field]: 'Must be a valid date',
    });
  }
}

export function overlaps(
  candidateStart: Date,
  candidateEnd: Date,
  existingStart: Date,
  existingEnd: Date,
): boolean {
  return candidateStart < existingEnd && candidateEnd > existingStart;
}

export function validateBookingInterval(
  input: BookingIntervalInput,
): ValidatedInterval {
  assertValidDate(input.startsAt, 'startsAt');
  assertValidDate(input.endsAt, 'endsAt');
  assertValidDate(input.now, 'now');
  assertOfficeTimeZone(input.officeTimeZone);

  const officeStart = DateTime.fromJSDate(input.startsAt, {
    zone: input.officeTimeZone,
  });
  const officeEnd = DateTime.fromJSDate(input.endsAt, {
    zone: input.officeTimeZone,
  });

  if (!isAlignedToHalfHour(officeStart)) {
    throw validationError('Booking times must align to a 30-minute slot', {
      startsAt: 'Must align to a 30-minute slot',
    });
  }
  if (!isAlignedToHalfHour(officeEnd)) {
    throw validationError('Booking times must align to a 30-minute slot', {
      endsAt: 'Must align to a 30-minute slot',
    });
  }

  const durationMinutes =
    (input.endsAt.getTime() - input.startsAt.getTime()) / (60 * 1000);
  if (
    durationMinutes < minimumDurationMinutes ||
    durationMinutes > maximumDurationMinutes
  ) {
    throw validationError('Booking duration must be 30 to 240 minutes', {
      endsAt: 'Duration must be 30 to 240 minutes',
    });
  }

  if (input.startsAt <= input.now) {
    throw new DomainError({
      code: 'BOOKING_IN_PAST',
      message: 'Booking start must be in the future',
      status: 422,
      fields: {startsAt: 'Must be in the future'},
    });
  }

  const officeOpensAt = officeStart.startOf('day').set({
    hour: input.officeOpenHour,
  });
  const officeClosesAt = officeStart.startOf('day').set({
    hour: input.officeCloseHour,
  });
  if (officeStart < officeOpensAt) {
    throw new DomainError({
      code: 'BOOKING_OUTSIDE_OFFICE_HOURS',
      message: 'Booking must be within office hours',
      status: 422,
      fields: {startsAt: 'Must be within office hours'},
    });
  }
  if (officeEnd > officeClosesAt) {
    throw new DomainError({
      code: 'BOOKING_OUTSIDE_OFFICE_HOURS',
      message: 'Booking must be within office hours',
      status: 422,
      fields: {endsAt: 'Must be within office hours'},
    });
  }

  return {
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    durationMinutes,
  };
}
