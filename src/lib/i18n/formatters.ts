const locale = 'uk-UA';
const pluralRules = new Intl.PluralRules(locale);

function formatDate(
  instant: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, {timeZone, ...options}).format(
    new Date(instant),
  );
}

function unitLabel(value: number, one: string, few: string, many: string): string {
  switch (pluralRules.select(value)) {
    case 'one':
      return one;
    case 'few':
      return few;
    default:
      return many;
  }
}

export function formatDateLong(instant: string, timeZone: string): string {
  return formatDate(instant, timeZone, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(instant: string, timeZone: string): string {
  return formatDate(instant, timeZone, {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  });
}

export function formatTime(instant: string, timeZone: string): string {
  return formatDate(instant, timeZone, {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
  });
}

export function formatTimeRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
): string {
  return `${formatTime(startsAt, timeZone)}-${formatTime(endsAt, timeZone)}`;
}

export function formatAccessibleSlot(input: {
  instant: string;
  officeInstant: string;
  officeTimeZone: string;
  roomName: string;
  userTimeZone: string;
}): string {
  return [
    `Забронювати ${formatDateLong(input.instant, input.userTimeZone)},`,
    `${formatTime(input.instant, input.userTimeZone)}, ${input.userTimeZone};`,
    `офіс: ${formatDateLong(input.officeInstant, input.officeTimeZone)},`,
    `${formatTime(input.officeInstant, input.officeTimeZone)},`,
    `${input.officeTimeZone}; переговорна ${input.roomName}.`,
  ].join(' ');
}

export function formatDuration(minutes: number): string {
  const totalMinutes = Math.max(0, Math.trunc(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} ${unitLabel(hours, 'година', 'години', 'годин')}`);
  }
  if (remainingMinutes > 0 || parts.length === 0) {
    parts.push(
      `${remainingMinutes} ${unitLabel(
        remainingMinutes,
        'хвилина',
        'хвилини',
        'хвилин',
      )}`,
    );
  }

  return parts.join(' ');
}
