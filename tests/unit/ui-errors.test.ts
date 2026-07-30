import {describe, expect, it} from 'vitest';
import {
  localizeApiError,
  safeReturnTo,
  uiErrorByCode,
  uiFieldMessage,
} from '../../src/lib/i18n/ui-errors';
import {
  formatAccessibleSlot,
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatTime,
  formatTimeRange,
} from '../../src/lib/i18n/formatters';

if (false) {
  // @ts-expect-error Locale maps are immutable application contracts.
  uiErrorByCode.AUTH_REQUIRED = 'mutated';
  // @ts-expect-error Locale maps are immutable application contracts.
  uiFieldMessage.email = 'mutated';
}

describe('Ukrainian API error localization', () => {
  it('maps every DomainErrorCode and booking field key', () => {
    expect(uiErrorByCode.BOOKING_CONFLICT).toBe(
      'Цей час уже зайнято. Ми оновили розклад; оберіть доступний варіант.',
    );
    expect(uiErrorByCode.UNKNOWN_TRANSPORT).toBe(
      "Не вдалося зв'язатися із сервісом. Перевірте з'єднання й повторіть.",
    );
    expect(uiFieldMessage.endsAt).toBe(
      'Перевірте час завершення та тривалість до 4 годин.',
    );
  });

  it('uses stable codes and fallback contexts without exposing server messages', () => {
    expect(localizeApiError({code: 'AUTH_REQUIRED', fallback: 'schedule'}))
      .toBe('Сесію завершено. Увійдіть знову, щоб продовжити.');
    expect(localizeApiError({code: 'UNKNOWN', fallback: 'booking'})).toBe(
      'Не вдалося створити бронювання. Спробуйте ще раз.',
    );
    expect(localizeApiError({code: undefined, fallback: 'auth'})).toBe(
      "Не вдалося увійти. Перевірте з'єднання й повторіть.",
    );
    expect(localizeApiError({code: 'UNKNOWN', fallback: 'history'})).toBe(
      'Не вдалося завантажити історію бронювань. Спробуйте ще раз.',
    );
  });

  it('preserves only allowlisted same-origin return URLs and query strings', () => {
    expect(safeReturnTo('/schedule?roomId=r1&day=2026-07-29')).toBe(
      '/schedule?roomId=r1&day=2026-07-29',
    );
    expect(safeReturnTo('/my-bookings?scope=future')).toBe(
      '/my-bookings?scope=future',
    );
    expect(safeReturnTo('https://example.com')).toBe('/schedule');
    expect(safeReturnTo('//example.com')).toBe('/schedule');
    expect(safeReturnTo('/schedule-evil')).toBe('/schedule');
    expect(safeReturnTo('\\schedule')).toBe('/schedule');
    expect(safeReturnTo('/schedule%2Fother')).toBe('/schedule');
    expect(safeReturnTo('/schedule%5Cother')).toBe('/schedule');
    expect(safeReturnTo('/schedule%')).toBe('/schedule');
    expect(safeReturnTo('/schedule#details')).toBe('/schedule');
    expect(safeReturnTo('/schedule/./my-bookings')).toBe('/schedule');
    expect(safeReturnTo('/schedule/../my-bookings')).toBe('/schedule');
    expect(safeReturnTo('/schedule/%2e/my-bookings')).toBe('/schedule');
    expect(safeReturnTo('/schedule/%2e%2e/my-bookings')).toBe('/schedule');
    expect(safeReturnTo('/my-bookings/%2E%2E/schedule')).toBe('/schedule');
  });
});

describe('Ukrainian deterministic formatters', () => {
  const instant = '2026-07-29T06:00:00.000Z';

  it('formats dates and times in the requested zone regardless of browser locale', () => {
    expect(formatDateLong(instant, 'Europe/Kyiv')).toBe(
      'середа, 29 липня 2026 р.',
    );
    expect(formatDateShort(instant, 'Europe/Kyiv')).toBe('ср, 29 лип.');
    expect(formatTime(instant, 'Europe/Kyiv')).toBe('09:00');
    expect(formatTimeRange(
      instant,
      '2026-07-29T07:30:00.000Z',
      'Europe/Kyiv',
    )).toBe('09:00-10:30');
  });

  it('describes a date-crossing slot with user and office context', () => {
    expect(formatAccessibleSlot({
      instant: '2026-07-29T06:00:00.000Z',
      officeInstant: '2026-07-29T06:00:00.000Z',
      officeTimeZone: 'Europe/Kyiv',
      roomName: 'Клен',
      userTimeZone: 'America/Los_Angeles',
    })).toBe(
      'Забронювати вівторок, 28 липня 2026 р., 23:00, America/Los_Angeles; офіс: середа, 29 липня 2026 р., 09:00, Europe/Kyiv; переговорна Клен.',
    );
  });

  it.each([
    [1, '1 хвилина'],
    [2, '2 хвилини'],
    [4, '4 хвилини'],
    [5, '5 хвилин'],
    [21, '21 хвилина'],
    [30, '30 хвилин'],
    [60, '1 година'],
    [90, '1 година 30 хвилин'],
    [120, '2 години'],
    [240, '4 години'],
  ])('formats %i minutes as %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});
