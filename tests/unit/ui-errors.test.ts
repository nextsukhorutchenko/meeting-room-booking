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

  it.each([
    '/schedule?roomId=r1&query=quiet%26sunny',
    '/my-bookings?scope=future&label=100%25',
    '/schedule?label=%D0%A2%D0%B8%D1%85%D0%B0%20%D0%BA%D1%96%D0%BC%D0%BD%D0%B0%D1%82%D0%B0',
    '/schedule?label=Тиха кімната',
  ])('preserves the exact encoded search and is idempotent for %s', (value) => {
    expect(safeReturnTo(value)).toBe(value);
    expect(safeReturnTo(safeReturnTo(value))).toBe(value);
  });

  it.each([
    [
      'C0 NUL',
      '/schedule?query=%00',
      '/schedule?query=%2500',
    ],
    [
      'C0 horizontal tab',
      '/schedule?query=%09',
      '/schedule?query=%2509',
    ],
    [
      'C0 line feed',
      '/schedule?query=%0A',
      '/schedule?query=%250A',
    ],
    [
      'C0 unit separator',
      '/my-bookings?query=%1F',
      '/my-bookings?query=%251F',
    ],
    [
      'DEL',
      '/my-bookings?query=%7F',
      '/my-bookings?query=%257F',
    ],
    [
      'mixed text and C0',
      '/schedule?label=quiet%20room%0Asecond',
      '/schedule?label=quiet%20room%250Asecond',
    ],
  ])(
    'rejects once-decoded %s but preserves its double-encoded form',
    (_label, encodedControl, doubleEncoded) => {
      expect(safeReturnTo(encodedControl)).toBe('/schedule');
      expect(safeReturnTo(doubleEncoded)).toBe(doubleEncoded);
      expect(safeReturnTo(safeReturnTo(doubleEncoded))).toBe(doubleEncoded);
    },
  );

  it.each([
    'https://example.com',
    '//example.com',
    'javascript:alert(1)',
    '/schedule-evil',
    '\\schedule',
    '/schedule%2Fother',
    '/schedule%5Cother',
    '/schedule#details',
    '/schedule/./my-bookings',
    '/schedule/../my-bookings',
    '/schedule/%2e/my-bookings',
    '/schedule/%2e%2e/my-bookings',
    '/my-bookings/%2E%2E/schedule',
  ])('rejects unsafe return destination %s', (value) => {
    expect(safeReturnTo(value)).toBe('/schedule');
  });

  it.each([
    '/schedule%',
    '/schedule?query=%',
    '/schedule?query=%2',
    '/schedule?query=%E0%A4%A',
  ])('rejects malformed escapes in %s', (value) => {
    expect(safeReturnTo(value)).toBe('/schedule');
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
