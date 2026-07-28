import {officeSlot} from '../office-time';

const TUESDAY_OFFSET = 1;

export function exploratoryTuesday(weekStart: string): string {
  const date = officeSlot(weekStart, TUESDAY_OFFSET, 10).toISODate();
  if (!date) {
    throw new Error(`Unable to derive Tuesday from week start: ${weekStart}`);
  }
  return date;
}

export function exploratoryMobileSchedulePath(
  roomId: string,
  weekStart: string,
): string {
  const query = new URLSearchParams({
    roomId,
    weekStart,
    day: exploratoryTuesday(weekStart),
  });
  return `/schedule?${query}`;
}
