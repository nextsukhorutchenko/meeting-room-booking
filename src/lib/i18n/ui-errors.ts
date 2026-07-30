import type {DomainErrorCode} from '../http/domain-error';

export type UiErrorCode =
  | DomainErrorCode
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_TRANSPORT';

export type UiFieldKey =
  | 'name'
  | 'email'
  | 'password'
  | 'token'
  | 'title'
  | 'roomId'
  | 'startsAt'
  | 'endsAt'
  | 'bookingId'
  | 'userId'
  | 'cancelledAt'
  | 'scope'
  | 'cursor'
  | 'limit'
  | 'now'
  | 'minCapacity'
  | 'weekStart'
  | 'officeTimeZone'
  | 'body';

export type BookingFieldKey = Extract<
  UiFieldKey,
  'title' | 'roomId' | 'startsAt' | 'endsAt'
>;

export const uiErrorByCode: Readonly<Record<UiErrorCode, string>> = {
  AUTH_REQUIRED: 'Сесію завершено. Увійдіть знову, щоб продовжити.',
  EMAIL_TAKEN: 'Обліковий запис із цим email уже існує.',
  EMAIL_NOT_VERIFIED: 'Підтвердьте email, щоб бронювати переговорні.',
  FORBIDDEN_ORIGIN:
    'Запит відхилено з міркувань безпеки. Оновіть сторінку й повторіть дію.',
  INVALID_CREDENTIALS: 'Неправильний email або пароль.',
  PAYLOAD_TOO_LARGE: 'Надіслані дані завеликі. Скоротіть введений текст.',
  RATE_LIMITED: 'Забагато спроб. Зачекайте й повторіть.',
  VALIDATION_FAILED: 'Перевірте введені дані.',
  ROOM_NOT_FOUND: 'Переговорну не знайдено. Оновіть список і виберіть іншу.',
  BOOKING_IN_PAST: 'Не можна бронювати час у минулому.',
  BOOKING_OUTSIDE_OFFICE_HOURS:
    'Оберіть час у межах робочих годин офісу.',
  BOOKING_CONFLICT:
    'Цей час уже зайнято. Ми оновили розклад; оберіть доступний варіант.',
  BOOKING_FORBIDDEN: 'Можна скасувати лише власне бронювання.',
  BOOKING_NOT_FOUND: 'Бронювання не знайдено або вже скасовано.',
  SERVICE_UNAVAILABLE: 'Сервіс тимчасово недоступний. Спробуйте ще раз.',
  VERIFICATION_INVALID_OR_EXPIRED:
    'Посилання недійсне, прострочене або вже використане.',
  INTERNAL_ERROR: 'Сталася внутрішня помилка. Спробуйте ще раз.',
  UNKNOWN_TRANSPORT:
    "Не вдалося зв'язатися із сервісом. Перевірте з'єднання й повторіть.",
};

export const uiFieldMessage: Readonly<Record<UiFieldKey, string>> = {
  name: "Введіть ім'я до 100 символів.",
  email: 'Введіть коректний email до 254 символів.',
  password: 'Пароль має містити від 8 до 72 символів.',
  token: 'Посилання підтвердження недійсне.',
  title: 'Назва має містити від 1 до 100 символів.',
  roomId: 'Виберіть переговорну.',
  startsAt: 'Перевірте дату й час початку.',
  endsAt: 'Перевірте час завершення та тривалість до 4 годин.',
  bookingId: 'Не вдалося визначити бронювання.',
  userId: 'Сесію користувача не підтверджено.',
  cancelledAt: 'Не вдалося визначити час скасування.',
  scope: 'Виберіть коректний розділ бронювань.',
  cursor: 'Не вдалося продовжити список. Оновіть сторінку.',
  limit: 'Не вдалося визначити розмір сторінки.',
  now: 'Не вдалося перевірити поточний час.',
  minCapacity: 'Місткість має бути цілим невід’ємним числом.',
  weekStart: 'Початок тижня має бути датою понеділка.',
  officeTimeZone: 'Часовий пояс офісу має бути коректним IANA timezone.',
  body: 'Перевірте формат надісланих даних.',
};

const fallbackByContext = {
  auth: "Не вдалося увійти. Перевірте з'єднання й повторіть.",
  booking: 'Не вдалося створити бронювання. Спробуйте ще раз.',
  cancellation: 'Не вдалося скасувати бронювання. Спробуйте ще раз.',
  history: 'Не вдалося завантажити історію бронювань. Спробуйте ще раз.',
  rooms: 'Не вдалося завантажити переговорні. Спробуйте ще раз.',
  schedule: 'Не вдалося завантажити розклад. Спробуйте ще раз.',
} as const;

function isUiErrorCode(code: string): code is UiErrorCode {
  return Object.hasOwn(uiErrorByCode, code);
}

export function localizeApiError(input: {
  code: string | undefined;
  fallback:
    | 'auth'
    | 'booking'
    | 'cancellation'
    | 'history'
    | 'rooms'
    | 'schedule';
}): string {
  if (input.code && isUiErrorCode(input.code)) {
    return uiErrorByCode[input.code];
  }

  return fallbackByContext[input.fallback];
}

const fallbackReturnTo = '/schedule';
const unsafeCharacter = /[\u0000-\u001F\u007F\\#]/;
const unsafeDecodedSearchCharacter = /[\u0000-\u001F\u007F]/;
const dotSegment = /(^|\/)\.{1,2}(?=\/|$)/;
const allowedReturnPathnames = new Set(['/schedule', '/my-bookings']);

export function safeReturnTo(value: string | null): string {
  if (
    !value ||
    unsafeCharacter.test(value) ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return fallbackReturnTo;
  }

  const searchIndex = value.indexOf('?');
  const encodedPathname = searchIndex === -1 ?
    value :
    value.slice(0, searchIndex);
  const encodedSearch = searchIndex === -1 ? '' : value.slice(searchIndex);
  let pathname: string;
  let decodedSearch: string;
  try {
    pathname = decodeURIComponent(encodedPathname);
    decodedSearch = decodeURIComponent(encodedSearch);
  } catch {
    return fallbackReturnTo;
  }

  if (
    unsafeCharacter.test(pathname) ||
    unsafeDecodedSearchCharacter.test(decodedSearch) ||
    pathname.startsWith('//') ||
    !pathname.startsWith('/')
  ) {
    return fallbackReturnTo;
  }
  if (dotSegment.test(pathname) || !allowedReturnPathnames.has(pathname)) {
    return fallbackReturnTo;
  }

  return `${pathname}${encodedSearch}`;
}
