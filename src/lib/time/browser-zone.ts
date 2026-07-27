export const APP_LOCALE = 'en-US';

function canonicalTimeZone(timeZone: string): string | null {
  try {
    return Intl.DateTimeFormat(APP_LOCALE, {timeZone})
      .resolvedOptions()
      .timeZone;
  } catch {
    return null;
  }
}

export function getBrowserTimeZone(officeTimeZone: string): string {
  try {
    const browserTimeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone;
    return canonicalTimeZone(browserTimeZone) ?? officeTimeZone;
  } catch {
    return officeTimeZone;
  }
}

export function areTimeZonesEquivalent(
  firstTimeZone: string,
  secondTimeZone: string,
): boolean {
  const canonicalFirst = canonicalTimeZone(firstTimeZone);
  if (!canonicalFirst) {
    return firstTimeZone === secondTimeZone;
  }
  const canonicalSecond =
    canonicalTimeZone(secondTimeZone) ?? canonicalFirst;
  return canonicalFirst === canonicalSecond;
}

export function formatInUserZone(
  instant: string | Date,
  userTimeZone: string,
  options: Intl.DateTimeFormatOptions,
  officeTimeZone = userTimeZone,
): string {
  const value = typeof instant === 'string' ? new Date(instant) : instant;
  try {
    return Intl.DateTimeFormat(APP_LOCALE, {
      ...options,
      timeZone: userTimeZone,
    }).format(value);
  } catch {
    try {
      return Intl.DateTimeFormat(APP_LOCALE, {
        ...options,
        timeZone: officeTimeZone,
      }).format(value);
    } catch {
      return Intl.DateTimeFormat(APP_LOCALE, options).format(value);
    }
  }
}
