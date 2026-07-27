export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function areTimeZonesEquivalent(
  firstTimeZone: string,
  secondTimeZone: string,
): boolean {
  const canonicalFirst = new Intl.DateTimeFormat('en-US', {
    timeZone: firstTimeZone,
  }).resolvedOptions().timeZone;
  const canonicalSecond = new Intl.DateTimeFormat('en-US', {
    timeZone: secondTimeZone,
  }).resolvedOptions().timeZone;
  return canonicalFirst === canonicalSecond;
}

export function formatInUserZone(
  instant: string | Date,
  userTimeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const value = typeof instant === 'string' ? new Date(instant) : instant;
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: userTimeZone,
  }).format(value);
}
