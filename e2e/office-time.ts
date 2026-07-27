import {DateTime} from 'luxon';

export const OFFICE_TIME_ZONE = 'Europe/Kyiv';

export function officeMonday(
  weeksFromCurrent = 0,
  now: DateTime<boolean> = DateTime.now(),
): string {
  return now
    .setZone(OFFICE_TIME_ZONE)
    .startOf('week')
    .plus({weeks: weeksFromCurrent})
    .toFormat('yyyy-LL-dd');
}

export function officeSlot(
  weekStart: string,
  dayOffset: number,
  hour: number,
  minute = 0,
): DateTime {
  return DateTime.fromISO(weekStart, {zone: OFFICE_TIME_ZONE})
    .plus({days: dayOffset})
    .set({hour, minute, second: 0, millisecond: 0});
}

export function officeTodayLabel(
  now: DateTime<boolean> = DateTime.now(),
): string {
  return now.setZone(OFFICE_TIME_ZONE).toFormat('ccc, LLL d');
}
