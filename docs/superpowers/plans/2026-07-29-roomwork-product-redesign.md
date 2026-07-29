# Roomwork Product Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перебудувати Roomwork у швидкий, україномовний і доступний продукт для бронювання переговорних за правилами Concept A, не змінюючи API, бізнес-логіку або модель даних.

**Architecture:** Зберегти server routes і domain services, а поточний великий `ScheduleClient` поступово розділити на page controller, pure full-week projection, адаптивні native table/list renderers та controlled presentation surfaces. Єдиний persistent authenticated `AppShell` утримує notification lifecycle і `PresentationCoordinator`; CSS розділяється за відповідальністю поступово, коли відповідний production surface отримує replacement coverage.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Luxon, Lucide React, Vitest, Testing Library, Playwright, Prisma/PostgreSQL, plain global CSS with semantic custom properties.

## Global Constraints

- Source of truth: `docs/design/02-redesign-spec.md`; visual grammar: Concept A rules in `docs/design/05-concept-decision.md`.
- Application code remains TypeScript; Google TypeScript Style expectations apply.
- Preserve exact public routes `/login`, `/register`, `/verify`, `/schedule`, `/my-bookings` and API routes under `/api`.
- Preserve query parameters `roomId`, `weekStart`, `day`, `bookingId`, `scope`, `cursor`, `limit` and existing request/response payload fields.
- Preserve UTC storage, office calculations in `Europe/Kyiv`, browser-zone display, half-open intervals `[startsAt, endsAt)`, 30-minute alignment, office hours, maximum four-hour booking, concurrency protection and overlap rejection.
- Preserve room filtering, schedule request race guards, deep-link restoration, future/past cursor pagination and notification delivery/ack behavior.
- Backend services, Prisma schema and migrations are out of scope; integration tests freeze their behavior.
- All visible system copy is Ukrainian; user-entered names, room names and booking titles are not translated.
- Use `uk-UA`, Monday week start, 24-hour time, `<html lang="uk">`, `Roomwork` and `Бронювання переговорних`.
- Use the system font stack; no external font request is introduced.
- Components consume semantic CSS variables; hardcoded color, spacing,
  dimension, grid-track length, flex-basis, border, font-size, line-height,
  letter-spacing, radius, shadow, transform-length and duration values live
  only in token definitions.
- Responsive modes are exact: expanded `>=1360px`, medium `900-1359px`, tablet `600-899px`, mobile `<600px`; server snapshot is `unresolved`.
- Render exactly one schedule semantic surface: native 7/3/2-day `<table>` or one-day `<ol>` agenda. Do not add `role="grid"` or custom arrow-key grid behavior.
- Product targets are at least `44x44 CSS px`; free-slot rows are `52px`; 30-minute booking triggers are at least `48px` high.
- Modal background is inert, focus restoration is deterministic, and at most one element has `aria-modal="true"` after every committed transition.
- `prefers-reduced-motion`, `forced-colors`, 320px reflow, actual 200% zoom and long unbroken content are release gates.
- Do not replace semantic or behavioral assertions with screenshot-only checks. Screenshots are supporting evidence after DOM, state and geometry assertions pass.
- Implementers are sequential. Each task receives a fresh task-scoped requirements review and code-quality review before the next implementer starts.
- Every task stages only the paths listed in that task. Do not stage unrelated worktree changes.

---

## Future File Structure

The following map is normative. Create a file in the first task that owns it;
do not scaffold empty modules in advance.

```text
src/
  app/
    (authenticated)/
      layout.tsx                         persistent authenticated AppShell
      my-bookings/page.tsx              unchanged /my-bookings route
      schedule/page.tsx                 unchanged /schedule route
    styles/
      agenda.css                        mobile chronological schedule
      auth.css                          login/register/verify surfaces
      base.css                          reset, document, shared typography
      booking-surface.css               composer/details/sheet placement
      manifest.css                      sole ordered global stylesheet entry
      my-bookings.css                   grouped history layout
      notifications.css                 bell, center, toast host
      schedule-layout.css               workspace, room rail, navigation
      shell.css                         authenticated header/bottom nav
      timetable.css                     native table, cells, booking blocks
      tokens.css                        only literal design values
      ui.css                            shared controls and state surfaces
    globals.css                         first-loaded Tailwind/legacy source
  components/
    app/
      app-shell.tsx                     persistent authenticated composition
      notification-center.tsx           controlled notification presentation
      notification-controller.tsx       poll/ack/retained state owner
      presentation-coordinator.tsx      sole modal owner, inert and focus handoff
    auth/
      auth-shell.tsx                    shared Roomwork auth composition
    bookings/
      booking-groups.tsx                pure derived history grouping
      booking-list.tsx                  My Bookings data/cancellation controller
      cancellation-dialog.tsx           controlled confirmation form
    schedule/
      adaptive-booking-surface.tsx      one stable pane/sheet/dialog subtree
      booking-block.tsx                 whole-block details trigger
      booking-composer.tsx              controlled booking form
      booking-controller.ts             reducer, events and pure outcomes
      day-agenda.tsx                    semantic mobile agenda and positioning
      room-filter-surface.tsx            controlled pane/modal placement
      room-picker.tsx                   controlled room/capacity controls
      schedule-navigation.tsx           week/day/date strip/jump controls
      schedule-projection.ts             full-week validation and projection
      schedule-types.ts                  shared UI schedule contracts
      schedule-viewport.tsx             exactly one resolved renderer
      schedule-workspace.tsx            URL, request and domain-state owner
      timetable.tsx                     native 7/3/2-day table
      use-responsive-mode.ts             hydration-safe external-store mode
  lib/
    i18n/
      formatters.ts                      uk-UA date/time/duration/plural helpers
      ui-copy.ts                         visible static copy
      ui-errors.ts                       exhaustive error/field localization
tests/
  unit/
    adaptive-booking-surface.test.tsx
    app-shell.test.tsx
    auth-surfaces.test.tsx
    booking-controller.test.ts
    booking-groups.test.ts
    day-agenda.test.tsx
    design-contrast.test.ts
    design-token-contract.test.ts
    e2e-projects.test.ts
    notification-controller.test.ts
    presentation-coordinator.test.tsx
    responsive-mode.test.tsx
    schedule-projection.test.ts
    timetable.test.tsx
    ui-errors.test.ts
scripts/
  check-design-contrast.ts             WCAG token-pair calculator
  check-design-tokens.ts               manifest and literal-policy lint
e2e/
  accessibility.spec.ts
  geometry.spec.ts
docs/design/
  06-implementation-evidence.md
  evidence/final/
```

Existing tests are migrated in place according to section 27.2.1 of the
approved spec. Existing API and integration test files are not renamed.

## Global Style Manifest and Ownership

`src/app/layout.tsx` imports exactly one global style entry:

```ts
import './styles/manifest.css';
```

No page or component imports a global stylesheet. `manifest.css` is the
deterministic cascade manifest. It contains only `@import` statements in this
exact order, adding a line only in the task that creates the corresponding
file:

```css
@import "../globals.css";
@import "./tokens.css";
@import "./base.css";
@import "./ui.css";
@import "./shell.css";
@import "./auth.css";
@import "./schedule-layout.css";
@import "./timetable.css";
@import "./agenda.css";
@import "./booking-surface.css";
@import "./notifications.css";
@import "./my-bookings.css";
```

`globals.css` is deliberately first so an imported, task-owned replacement
always wins without `!important` or selector escalation. Import order also
encodes ownership:

| Stylesheet | Exclusive selector responsibility | First owning task |
| --- | --- | ---: |
| `globals.css` | Tailwind entry and selectors not yet migrated; never receives new product selectors | 1 |
| `tokens.css` | all literal colors, spacing, dimensions (including grid-track, flex-basis and transform lengths), type metrics, radii, borders, shadows and durations | 1 |
| `base.css` | document reset, system font, typography defaults, reduced-motion and forced-colors global behavior | 1, hardened in 11 |
| `ui.css` | Button, Field, Alert, Dialog primitives, focus geometry, spinner and generic state surfaces | 1, dialog handoff in 8 |
| `shell.css` | authenticated header, navigation, account area, skip link and bottom navigation | 2 |
| `auth.css` | login, register and verification composition | 2 |
| `schedule-layout.css` | page/workspace tracks, room/filter rail, navigation, timezone summary and load-state placement | 3 |
| `timetable.css` | native table, time gutter, cells and booking-block fit | 5 |
| `agenda.css` | one-day list, date strip, jump controls and mobile row geometry | 6 |
| `booking-surface.css` | adaptive booking composer/details and cancellation sheet/dialog presentation | 7, 8 |
| `notifications.css` | bell, badge, center, popover/sheet and toast host | 9 |
| `my-bookings.css` | nearest/grouped history, row link and sibling Cancel column | 10 |

Every task that creates an owning stylesheet must:

1. Add its import once at the table-defined position in `manifest.css`.
2. Include `manifest.css` and `globals.css` in Files and staging.
3. Run the replacement unit/component tests with the new sheet loaded.
4. After those tests pass, move that surface's selectors out of `globals.css`
   in the same task; the task does not leave duplicate old/new selectors.
5. Run `npm run check:design-tokens`, the focused tests, `npm run build` and
   `git diff --check` after deletion.

Task 11 audits this contract and may delete an empty `globals.css`/Tailwind
entry when no utility class remains. It does not migrate selectors owned by
Tasks 2-10.

## Interface Ledger

These signatures are shared contracts between tasks. A later task must consume
the exact names and fields defined here.

```ts
export type ResponsiveMode =
  | 'unresolved'
  | 'expanded'
  | 'medium'
  | 'tablet'
  | 'mobile';

export type RoomSummary = {
  id: string;
  name: string;
  floor: number;
  capacity: number;
};

export type ScheduleBooking = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  author: {id: string; name: string};
  isOwn: boolean;
};

export type ScheduleData = {
  room: RoomSummary;
  officeTimeZone: string;
  officeWeekStart: string;
  range: {startsAt: string; endsAt: string};
  bookings: readonly ScheduleBooking[];
};

export type ProjectionResult<T> =
  | {ok: true; value: T}
  | {ok: false; error: 'schedule-data-error'; reason: ScheduleDataErrorReason};

export type VisibleDayCount = 2 | 3 | 7;

export type ProjectTimetableInput = ValidateFullScheduleWeekInput & {
  visibleDays: readonly string[];
};

export type ProjectDayAgendaInput = ValidateFullScheduleWeekInput & {
  now: string;
  officeDay: string;
};

export function validateFullScheduleWeek(
  input: ValidateFullScheduleWeekInput,
): ProjectionResult<ValidatedScheduleWeek>;

export function projectTimetable(
  input: ProjectTimetableInput,
): ProjectionResult<TimetableProjection>;

export function projectDayAgenda(
  input: ProjectDayAgendaInput,
): ProjectionResult<DayAgendaProjection>;

export type ModalOwner =
  | null
  | 'room-filter'
  | 'booking'
  | 'cancellation'
  | 'notifications';

export type BookingRefreshOkEvent = {
  type: 'REFRESH_OK';
  conflictGeneration: number;
  options: readonly BookingEndTimeOption[];
};
```

---

### Task 1: Freeze Contracts and Add the Locale/Token Foundation

**Responsibility:** Add exhaustive Ukrainian UI mapping, deterministic
formatters and additive semantic tokens without changing API payloads or
schedule behavior.

**Files:**
- Create: `src/lib/i18n/ui-copy.ts`
- Create: `src/lib/i18n/ui-errors.ts`
- Create: `src/lib/i18n/formatters.ts`
- Create: `src/app/styles/tokens.css`
- Create: `src/app/styles/base.css`
- Create: `src/app/styles/ui.css`
- Create: `src/app/styles/manifest.css`
- Create: `scripts/check-design-tokens.ts`
- Create: `tests/unit/design-token-contract.test.ts`
- Create: `tests/unit/ui-errors.test.ts`
- Create: `tests/unit/root-layout.test.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `package.json`
- Modify: `src/lib/time/browser-zone.test.ts`
- Modify: `tests/unit/office-time.test.ts`
- Verify unchanged: `tests/integration/auth-api.test.ts`
- Verify unchanged: `tests/integration/booking-api.test.ts`
- Verify unchanged: `tests/integration/booking-race.test.ts`
- Verify unchanged: `tests/integration/my-bookings-api.test.ts`
- Verify unchanged: `tests/integration/notification-api.test.ts`
- Verify unchanged: `tests/integration/schedule-api.test.ts`

**Interfaces:**
- Consumes: `DomainErrorCode` from `src/lib/http/domain-error.ts`; existing
  server field keys and ISO instants.
- Produces:

```ts
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

export const uiErrorByCode: Readonly<Record<UiErrorCode, string>>;
export const uiFieldMessage: Readonly<Record<UiFieldKey, string>>;
export function localizeApiError(input: {
  code: string | undefined;
  fallback: 'auth' | 'booking' | 'cancellation' | 'rooms' | 'schedule';
}): string;
export function safeReturnTo(value: string | null): string;
export function formatDateLong(instant: string, timeZone: string): string;
export function formatDateShort(instant: string, timeZone: string): string;
export function formatTime(instant: string, timeZone: string): string;
export function formatTimeRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
): string;
export function formatAccessibleSlot(input: {
  instant: string;
  officeInstant: string;
  officeTimeZone: string;
  roomName: string;
  userTimeZone: string;
}): string;
export function formatDuration(minutes: number): string;

export type DesignTokenViolation = {
  file: string;
  line: number;
  property: string;
  value: string;
  category:
    | 'border'
    | 'color'
    | 'dimension'
    | 'duration'
    | 'flex-basis'
    | 'font-size'
    | 'grid-track'
    | 'letter-spacing'
    | 'line-height'
    | 'radius'
    | 'shadow'
    | 'spacing'
    | 'transform-length';
};

export function findDesignTokenViolations(input: {
  css: string;
  file: string;
}): readonly DesignTokenViolation[];
```

- Produces CSS variables under `:root`, including
  `--color-canvas`, `--color-surface`, `--color-text`,
  `--color-text-muted`, `--color-border`, `--color-accent`,
  `--color-accent-strong`, `--color-today`, `--color-danger`,
  `--space-1` through `--space-8`, `--radius-control`,
  `--radius-surface`, `--shadow-overlay`, `--motion-none`, `--motion-fast` and
  `--font-sans`.

- [ ] **Step 1: Write failing locale and layout tests**

```ts
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
});

it('renders the Ukrainian document contract', () => {
  const tree = RootLayout({children: <main />});
  expect(tree.props.lang).toBe('uk');
  expect(metadata.title).toBe('Roomwork — Бронювання переговорних');
});

it('keeps the style manifest ordered', () => {
  const importOrder = [
    '../globals.css',
    './tokens.css',
    './base.css',
    './ui.css',
    './shell.css',
    './auth.css',
    './schedule-layout.css',
    './timetable.css',
    './agenda.css',
    './booking-surface.css',
    './notifications.css',
    './my-bookings.css',
  ];
  const expectedExistingImports = importOrder.filter((path) =>
    path === '../globals.css' ||
    existsSync(resolve('src/app/styles', path.slice(2))),
  );
  expect(readManifestImports()).toEqual(expectedExistingImports);
});

it.each([
  ['grid-track', '.rail { grid-template-columns: 248px minmax(0, 1fr); }'],
  ['grid-track', '.shell { grid-template-rows: 56px minmax(0, 1fr); }'],
  ['flex-basis', '.rail { flex-basis: 248px; }'],
  ['border', '.control { border: 1px solid currentColor; }'],
  ['border', '.control { border-width: 1px; }'],
  ['font-size', '.meta { font-size: 13px; }'],
  ['line-height', '.meta { line-height: 18px; }'],
  ['letter-spacing', '.label { letter-spacing: 0.02em; }'],
  ['transform-length', '.popover { transform: translateX(12px); }'],
  ['transform-length', '.scene { transform: perspective(600px); }'],
  ['color', '.control { color: #123456; }'],
  ['spacing', '.control { padding: 10px; }'],
  ['dimension', '.control { width: 52px; }'],
  ['radius', '.control { border-radius: 6px; }'],
  ['shadow', '.popover { box-shadow: 0 8px 24px rgb(0 0 0 / 14%); }'],
  ['duration', '.control { transition-duration: 180ms; }'],
] as const)('rejects the %s literal fixture', (category, css) => {
  expect(findDesignTokenViolations({css, file: 'fixture.css'})).toContainEqual(
    expect.objectContaining({category}),
  );
});

it('allows only the documented structural and focus literals', () => {
  const css = `
    .structure {
      margin: 0;
      padding: 0px;
      width: 100%;
      min-height: 100dvh;
      max-inline-size: 100cqw;
      flex-basis: 50%;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      grid-template-rows: auto minmax(0, 1fr);
      line-height: 1;
      transform: translate(-50%, -50%);
    }
    .structure:focus-visible {
      outline-width: 2px;
      outline-offset: 2px;
    }
  `;

  expect(findDesignTokenViolations({css, file: 'allowed.css'})).toEqual([]);
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/design-token-contract.test.ts tests/unit/ui-errors.test.ts tests/unit/root-layout.test.tsx src/lib/time/browser-zone.test.ts tests/unit/office-time.test.ts
```

Expected: FAIL because `manifest.css`, the token lint and `src/lib/i18n/*` do
not exist and the root layout is still English.

- [ ] **Step 3: Implement exhaustive mappings, formatters and additive tokens**

Use compile-time exhaustiveness rather than parsing English server messages:

```ts
export const uiErrorByCode = {
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
} satisfies Record<UiErrorCode, string>;
```

Define the complete field map:

```ts
export const uiFieldMessage = {
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
} satisfies Record<UiFieldKey, string>;
```

Unknown field keys become the form-level `Перевірте введені дані` message and
are never rendered raw. Implement `safeReturnTo` by decoding once, rejecting
control characters, backslashes, hashes, schemes/hosts, leading `//`, malformed
percent encoding and decoded path escapes, parsing against the current origin,
requiring the pathname to equal `/schedule` or `/my-bookings`, then returning
that pathname with its query string. Every rejection returns `/schedule`.

Import `tokens.css`, `base.css` and `ui.css` from `layout.tsx` before
`globals.css` through the sole `manifest.css` contract above; RootLayout
imports only the manifest. Keep legacy rules in `globals.css` until their
owning task has replacement coverage. Set `lang="uk"`, localized metadata and
the system stack `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
sans-serif`.

Implement `check-design-tokens.ts` as a deterministic CSS declaration lint.
The default command scans every `src/app/styles/*.css` file except
`tokens.css`; `--include-legacy` additionally scans `globals.css` and is the
Task 11 zero-legacy gate. It reports:

- color literals: hex, `rgb[a]()`, `hsl[a]()`, `oklch()`, `lab()` and named
  colors other than forced-color system values `Canvas`, `CanvasText`,
  `ButtonText`, `GrayText`, `LinkText` and `Highlight`; CSS semantic keywords
  `transparent`, `currentColor` and `inherit` are also allowed;
- spacing literals in `margin*`, `padding*`, `gap`, `row-gap` and
  `column-gap`;
- dimension literals in `inset*`, `top`, `right`, `bottom`, `left`,
  `width`, `height`, `inline-size`, `block-size` and every physical/logical
  `min-*`/`max-*` size;
- track lengths in `grid-template-columns` and `grid-template-rows`;
- `flex-basis` lengths;
- lengths in physical/logical `border*` shorthands and
  `border-*-width`/`border-width`, plus `outline` shorthands, except the exact
  focus allowlist below;
- `font-size`, `line-height` and `letter-spacing` literals;
- `border-radius` literals;
- `box-shadow`/`text-shadow` literals;
- every length value in `transform` or the individual `translate` property,
  including nested `translate*()` and `perspective()` functions;
- `transition*`/`animation-duration` time literals.

Parse each declaration with a CSS value AST so literals nested inside
`calc()`, `min()`, `max()`, `clamp()`, `minmax()` or transform functions cannot
bypass classification. The allowlist is closed and property-aware:

- exact `0` and `0px` are accepted in every governed declaration;
- percentages, viewport units (`vw`, `vh`, `vi`, `vb`, `vmin`, `vmax`,
  `svw`, `svh`, `svi`, `svb`, `svmin`, `svmax`, `lvw`, `lvh`, `lvi`, `lvb`,
  `lvmin`, `lvmax`, `dvw`, `dvh`, `dvi`, `dvb`, `dvmin`, `dvmax`) and
  container units (`cqw`, `cqh`, `cqi`, `cqb`, `cqmin`, `cqmax`) are accepted
  only in physical/logical size, min/max-size, inset, grid-track and
  `flex-basis` declarations;
- grid keywords, `fr` tracks and positive integer counts used only as the
  first argument of `repeat()` are accepted; pixel/rem/em track sizes,
  including a `248px` rail, require tokens;
- only exact unitless `line-height: 1` is accepted; `13px` font size and every
  other numeric type metric require tokens;
- transform percentages are accepted only for centering forms
  `translate(-50%, -50%)`, `translateX(-50%)` and `translateY(-50%)`; other
  translate lengths require tokens;
- raw `2px` is accepted only by `outline-width` and `outline-offset` when the
  selector contains `:focus-visible`; `1px` borders and every other nonzero
  border/outline length require tokens.

Media-query breakpoints are the approved responsive contract and are not
declaration values. CSS-wide and layout keywords without literal numeric/color
values remain valid. The parser returns file, line, property, value and
category, and exits nonzero on a violation. The RED fixtures above prove that
`248px` rails, `1px` borders and `13px` type cannot bypass tokens. Add:

```json
"check:design-tokens": "tsx scripts/check-design-tokens.ts"
```

- [ ] **Step 4: Load the manifest foundation and remove its legacy selectors**

Run the focused Task 1 tests with RootLayout importing only `manifest.css`.
After they pass, move document/body/reset/system-font rules into `base.css`;
move `.control-field*`, `.primary-button*`, `.secondary-button*`,
`.destructive-button*`, `.icon-button*`, `.alert*`, `.spinner*` and generic
focus-visible declarations into `ui.css`. Leave dialog, shell, auth, schedule,
booking, notification and history selectors for their declared owning tasks.
Remove the migrated declarations from `globals.css` and confirm their selector
families do not remain there.

```powershell
npx vitest run --config vitest.config.ts tests/unit/design-token-contract.test.ts tests/unit/ui-errors.test.ts tests/unit/root-layout.test.tsx src/lib/time/browser-zone.test.ts tests/unit/office-time.test.ts
```

Expected before selector deletion: PASS.

- [ ] **Step 5: Verify the focused foundation and source hygiene**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/design-token-contract.test.ts tests/unit/ui-errors.test.ts tests/unit/root-layout.test.tsx src/lib/time/browser-zone.test.ts tests/unit/office-time.test.ts
npm run check:design-tokens
npm run build
git diff --check
npm run typecheck
npm run lint
npm run check:source
```

Expected: all commands PASS, `npm run build` completes successfully and
`git diff --check` exits `0` with no whitespace-error output; no API route or
service file appears in the diff.

- [ ] **Step 6: Run the frozen backend contract suite**

Run with a pre-validated isolated `TEST_DATABASE_URL`:

```powershell
npm run test:integration
```

Expected: existing integration behavior remains green without assertion
changes to machine codes, payload fields, timezone, overlap, concurrency or
pagination.

- [ ] **Step 7: Commit only Task 1 paths**

```powershell
git add src/app/layout.tsx src/app/globals.css src/app/styles/manifest.css src/app/styles/tokens.css src/app/styles/base.css src/app/styles/ui.css scripts/check-design-tokens.ts package.json src/lib/i18n/ui-copy.ts src/lib/i18n/ui-errors.ts src/lib/i18n/formatters.ts src/lib/time/browser-zone.test.ts tests/unit/design-token-contract.test.ts tests/unit/ui-errors.test.ts tests/unit/root-layout.test.tsx tests/unit/office-time.test.ts
git commit -m "feat: add Roomwork locale and design foundation"
```

---

### Task 2: Build the Persistent App Shell and Localize Auth/Verify

**Responsibility:** Establish the persistent authenticated route group and the
responsive Roomwork shell while preserving all route URLs and auth lifecycle.

**Files:**
- Create: `src/app/(authenticated)/layout.tsx`
- Move: `src/app/schedule/page.tsx` to `src/app/(authenticated)/schedule/page.tsx`
- Move: `src/app/my-bookings/page.tsx` to `src/app/(authenticated)/my-bookings/page.tsx`
- Create: `src/components/app/app-shell.tsx`
- Create: `src/components/auth/auth-shell.tsx`
- Create: `src/app/styles/shell.css`
- Create: `src/app/styles/auth.css`
- Create: `tests/unit/app-shell.test.tsx`
- Create: `tests/unit/auth-surfaces.test.tsx`
- Modify: `src/app/styles/manifest.css`
- Modify: `src/app/globals.css`
- Modify: `src/components/app/app-header.tsx`
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/components/auth/register-form.tsx`
- Modify: `src/components/auth/logout-button.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/register/page.tsx`
- Modify: `src/app/verify/page.tsx`
- Modify: `tests/unit/verify-page.test.tsx`
- Modify: `tests/unit/verify-clean-start.test.ts`
- Modify: `e2e/smoke.spec.ts`
- Modify: `e2e/auth.setup.ts`

**Interfaces:**
- Consumes: tokens and i18n functions from Task 1; `getOptionalUser()` and
  existing auth API contracts.
- Produces:

```ts
export type AppShellProps = {
  children: ReactNode;
  user: {name: string};
};

export function AppShell(props: AppShellProps): ReactElement;
export function AuthShell(props: {
  children: ReactNode;
  heading: string;
}): ReactElement;
```

The authenticated layout is the only server owner of session redirect and
wraps both routes in one client `AppShell`, so later notification state can
survive client navigation.

- [ ] **Step 1: Write failing shell, auth and route-preservation tests**

```ts
it('renders Ukrainian navigation and a mobile bottom navigation', () => {
  render(<AppShell user={{name: 'Олена'}}><main>Вміст</main></AppShell>);
  expect(screen.getAllByRole('link', {name: 'Розклад'})).toHaveLength(2);
  expect(screen.getAllByRole('link', {name: 'Мої бронювання'})).toHaveLength(2);
  expect(screen.getByText('Бронювання переговорних')).toBeVisible();
});

it('uses password-manager compatible login fields', () => {
  render(<LoginForm />);
  expect(screen.getByLabelText('Електронна пошта'))
    .toHaveAttribute('autocomplete', 'username');
  expect(screen.getByLabelText('Пароль'))
    .toHaveAttribute('autocomplete', 'current-password');
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/app-shell.test.tsx tests/unit/auth-surfaces.test.tsx tests/unit/verify-page.test.tsx tests/unit/verify-clean-start.test.ts
```

Expected: FAIL because `AppShell` and `AuthShell` do not exist and visible auth
copy is English.

- [ ] **Step 3: Implement the persistent shell and localized auth surfaces**

Use route groups only; do not alter URLs:

```tsx
export default async function AuthenticatedLayout({
  children,
}: Readonly<{children: ReactNode}>) {
  const user = await getOptionalUser();
  if (!user) redirect('/login');
  return <AppShell user={{name: user.name}}>{children}</AppShell>;
}
```

`AppShell` renders one header, one `<main id="main-content">` slot and one
mobile bottom nav. Keep `NotificationBell` in place until Task 9 replaces its
controller/presentation internals. Remove duplicate `AppHeader` and auth
checks from the moved page files. Translate field labels, buttons, pending,
success, invalid, expired and unavailable verification states; preserve
one-shot token removal and do not add resend.

- [ ] **Step 4: Load the owner styles, pass replacement tests and remove legacy selectors**

Append `shell.css` and then `auth.css` after `ui.css` in `manifest.css`.
Run the focused tests once with the new styles loaded:

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/app-shell.test.tsx tests/unit/auth-surfaces.test.tsx tests/unit/verify-page.test.tsx tests/unit/verify-clean-start.test.ts
```

Expected: PASS. Then move only `.app-header*`, `.app-brand`, `.app-nav*`,
`.app-account*`, `.app-user-name`, `.bottom-nav*`, `.auth-*` and the
login/register/verify form selectors from `globals.css` into their declared
owners. Do not move `.notification-*`; Task 9 owns them. Confirm each import
appears once and the migrated selector families no longer appear in
`globals.css`.

- [ ] **Step 5: Verify shell/auth behavior, style ownership and direct URLs**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/app-shell.test.tsx tests/unit/auth-surfaces.test.tsx tests/unit/verify-page.test.tsx tests/unit/verify-clean-start.test.ts
npm run check:design-tokens
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: PASS; build emits `/schedule` and `/my-bookings`, not route-group
segments; the manifest order is `globals, tokens, base, ui, shell, auth`.

- [ ] **Step 6: Run auth smoke E2E**

Run with a pre-validated isolated `TEST_DATABASE_URL`:

```powershell
npm run build
npx tsx scripts/run-e2e.ts e2e/smoke.spec.ts --project=desktop-auth-smoke --project=mobile-auth-smoke
```

Expected: registration/login/redirect/verify-visible-state paths pass with
Ukrainian labels and no console or hydration errors.

- [ ] **Step 7: Commit only Task 2 paths**

```powershell
git add 'src/app/(authenticated)/layout.tsx' 'src/app/(authenticated)/schedule/page.tsx' 'src/app/(authenticated)/my-bookings/page.tsx' src/app/schedule/page.tsx src/app/my-bookings/page.tsx src/app/login/page.tsx src/app/register/page.tsx src/app/verify/page.tsx src/components/app/app-shell.tsx src/components/app/app-header.tsx src/components/auth/auth-shell.tsx src/components/auth/login-form.tsx src/components/auth/register-form.tsx src/components/auth/logout-button.tsx src/app/styles/manifest.css src/app/styles/shell.css src/app/styles/auth.css src/app/globals.css tests/unit/app-shell.test.tsx tests/unit/auth-surfaces.test.tsx tests/unit/verify-page.test.tsx tests/unit/verify-clean-start.test.ts e2e/smoke.spec.ts e2e/auth.setup.ts
git commit -m "feat: add persistent Roomwork application shell"
```

---

### Task 3: Extract the Adaptive Schedule Workspace, Room Rail and Navigation

**Responsibility:** Separate URL/request ownership from presentation, introduce
hydration-safe responsive mode, and render the Concept A room/navigation rails
without changing API calls or booking behavior.

**Files:**
- Create: `src/components/schedule/schedule-types.ts`
- Create: `src/components/schedule/use-responsive-mode.ts`
- Create: `src/components/schedule/room-picker.tsx`
- Create: `src/components/schedule/room-filter-surface.tsx`
- Create: `src/components/schedule/schedule-navigation.tsx`
- Create: `src/components/schedule/schedule-viewport.tsx`
- Create: `src/components/schedule/schedule-workspace.tsx`
- Create: `src/app/styles/schedule-layout.css`
- Create: `tests/unit/responsive-mode.test.tsx`
- Modify: `src/app/styles/manifest.css`
- Modify: `src/app/globals.css`
- Modify: `src/app/(authenticated)/schedule/page.tsx`
- Modify: `tests/unit/room-filter.test.tsx`
- Modify: `tests/unit/schedule-toolbar.test.tsx`
- Modify: `tests/unit/schedule-client.test.tsx`
- Delete after parity: `src/components/schedule/schedule-client.tsx`
- Delete after parity: `src/components/schedule/schedule-toolbar.tsx`

**Interfaces:**
- Consumes: current `/api/rooms` and
  `/api/rooms/:roomId/schedule?weekStart=` responses; existing URL rules.
- Produces the `ResponsiveMode`, `RoomSummary`, `ScheduleBooking` and
  `ScheduleData` types in the Interface Ledger, plus:

```ts
export function useResponsiveMode(): ResponsiveMode;

export type ScheduleViewportProps = {
  mode: ResponsiveMode;
  selectedDay: string;
  visibleTimeAnchor: string | null;
  onVisibleTimeAnchorChange(value: string): void;
  renderAgenda(): ReactNode;
  renderTimetable(visibleDayCount: VisibleDayCount): ReactNode;
};

export function visibleDayCountForMode(
  mode: ResponsiveMode,
): VisibleDayCount | 1 | null;
```

`ScheduleWorkspace` owns applied/draft capacity, rooms, selected room,
week/day, user zone, independent room/schedule request sequences, booking
state, cancellation state and `visibleTimeAnchor`.

- [ ] **Step 1: Write failing responsive and ownership tests**

```ts
it.each([
  [599, 'mobile'],
  [600, 'tablet'],
  [899, 'tablet'],
  [900, 'medium'],
  [1359, 'medium'],
  [1360, 'expanded'],
])('resolves %ipx to %s', (width, expected) => {
  setMatchMediaWidth(width);
  expect(renderHook(() => useResponsiveMode()).result.current).toBe(expected);
});

it('keeps one rooms request and one schedule request across resize', async () => {
  render(<ScheduleWorkspace {...props} />);
  await settleInitialSchedule();
  setMatchMediaWidth(768);
  setMatchMediaWidth(1440);
  expect(fetchCalls('/api/rooms')).toHaveLength(1);
  expect(fetchCalls('/schedule?weekStart=')).toHaveLength(1);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/responsive-mode.test.tsx tests/unit/room-filter.test.tsx tests/unit/schedule-toolbar.test.tsx tests/unit/schedule-client.test.tsx
```

Expected: FAIL because responsive boundaries, new workspace boundaries and
RoomPicker/Navigation contracts do not exist.

- [ ] **Step 3: Implement the minimum adaptive shell with existing renderers**

Implement `useResponsiveMode` with one `useSyncExternalStore` subscription:

```ts
export function getResponsiveMode(width: number): Exclude<
  ResponsiveMode,
  'unresolved'
> {
  if (width >= 1360) return 'expanded';
  if (width >= 900) return 'medium';
  if (width >= 600) return 'tablet';
  return 'mobile';
}
```

The server snapshot returns `unresolved`. `ScheduleViewport` renders a
noninteractive `aria-busy` skeleton until resolution, then exactly one current
renderer during this extraction step: `WeekGrid` for expanded/medium and
`DaySchedule` for tablet/mobile. Task 5 replaces expanded/medium and adds the
final tablet 2-day table; Task 6 replaces the mobile renderer. Do not mount
both renderers and hide one with CSS.

Extract current fetch, URL, abort and sequence logic into
`schedule-workspace.tsx` without changing endpoint strings or response
guards. Room pane is visible at expanded/medium; tablet/mobile filter trigger
opens a controlled `RoomFilterSurface`. Date strip keeps seven office dates,
with the URL `day` as the 3/2-day anchor.

- [ ] **Step 4: Load schedule layout styles and remove their legacy selectors**

Append `schedule-layout.css` after `auth.css` in `manifest.css`, then run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/responsive-mode.test.tsx tests/unit/room-filter.test.tsx tests/unit/schedule-toolbar.test.tsx tests/unit/schedule-client.test.tsx
```

Expected: PASS. Move `.schedule-page`, `.schedule-title-*`,
`.schedule-eyebrow`, `.schedule-workspace`, `.schedule-toolbar*`,
`.room-context`, `.room-meta*`, `.room-filter*`, `.schedule-navigation*`,
`.timezone-*`, `.schedule-message*`, `.schedule-loading*` and
`.schedule-viewport*` into `schedule-layout.css`. Leave week/timetable,
day/agenda, booking, notification and history selectors for their owning
tasks. Confirm the migrated selector families no longer occur in
`globals.css`.

- [ ] **Step 5: Verify request races, URL restoration and style ownership**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/responsive-mode.test.tsx tests/unit/room-filter.test.tsx tests/unit/schedule-toolbar.test.tsx tests/unit/schedule-client.test.tsx
npm run check:design-tokens
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: PASS, including superseded room/week response, popstate, filter and
deep-link tests; one semantic renderer exists after hydration; manifest order
ends with `schedule-layout.css`.

- [ ] **Step 6: Commit only Task 3 paths**

```powershell
git add src/components/schedule/schedule-types.ts src/components/schedule/use-responsive-mode.ts src/components/schedule/room-picker.tsx src/components/schedule/room-filter-surface.tsx src/components/schedule/schedule-navigation.tsx src/components/schedule/schedule-viewport.tsx src/components/schedule/schedule-workspace.tsx src/components/schedule/schedule-client.tsx src/components/schedule/schedule-toolbar.tsx 'src/app/(authenticated)/schedule/page.tsx' src/app/styles/manifest.css src/app/styles/schedule-layout.css src/app/globals.css tests/unit/responsive-mode.test.tsx tests/unit/room-filter.test.tsx tests/unit/schedule-toolbar.test.tsx tests/unit/schedule-client.test.tsx
git commit -m "refactor: extract adaptive schedule workspace"
```

---

### Task 4: Add Full-Week Validation and Pure Schedule Projection

**Responsibility:** Make one pure validation pipeline the only source for
7/3/2-day table and one-day agenda occupancy without touching backend data.

**Files:**
- Create: `src/components/schedule/schedule-projection.ts`
- Create: `tests/unit/schedule-projection.test.ts`
- Modify: `src/components/schedule/schedule-types.ts`
- Modify: `src/lib/time/office-time.ts`
- Modify: `tests/unit/office-time.test.ts`

**Interfaces:**
- Consumes: `ScheduleBooking`, `ScheduleData`, office week/day, office
  open/close hours, `now`, office zone and user zone.
- Produces:

```ts
export type ScheduleDataErrorReason =
  | 'duplicate-id'
  | 'invalid-field'
  | 'invalid-instant'
  | 'invalid-order'
  | 'outside-week'
  | 'cross-day'
  | 'misaligned'
  | 'outside-hours'
  | 'invalid-duration'
  | 'overlap';

export type ValidateFullScheduleWeekInput = {
  bookings: readonly ScheduleBooking[];
  weekStart: string;
  officeOpenHour: number;
  officeCloseHour: number;
  officeTimeZone: string;
};

export type NormalizedScheduleBooking = ScheduleBooking & {
  officeDay: string;
  startSlotIndex: number;
  spanSlots: number;
};

export type ValidatedScheduleWeek = {
  bookings: readonly NormalizedScheduleBooking[];
  occupancyByDay: ReadonlyMap<string, readonly (string | null)[]>;
};

export type TimetableCell =
  | {kind: 'empty'; day: string; slotIndex: number}
  | {kind: 'booking-start'; booking: NormalizedScheduleBooking}
  | {kind: 'booking-continuation'; bookingId: string};

export type TimetableProjection = {
  days: readonly string[];
  rows: readonly {
    slotIndex: number;
    cells: readonly TimetableCell[];
  }[];
};

export type DayAgendaItem =
  | {kind: 'free'; slotIndex: number; startsAt: string}
  | {kind: 'past'; slotIndex: number; startsAt: string}
  | {kind: 'busy'; slotIndex: number; booking: NormalizedScheduleBooking};

export type DayAgendaProjection = {
  officeDay: string;
  items: readonly DayAgendaItem[];
  coveredSlotIndices: readonly number[];
};
```

- [ ] **Step 1: Write the full failing matrix**

```ts
it('validates hidden days before filtering a three-day window', () => {
  const result = projectTimetable({
    ...baseInput,
    bookings: [validMonday, validThursday, validSunday],
    visibleDays: ['2026-07-29', '2026-07-30', '2026-07-31'],
  });
  expect(result).toMatchObject({ok: true});
  if (result.ok) {
    expect(renderedBookingIds(result.value)).toEqual([validThursday.id]);
    expect(result.value.rows).toHaveLength(20);
  }
});

it('rejects an overlap on a hidden day atomically', () => {
  expect(projectTimetable({
    ...baseInput,
    bookings: [hiddenMondayA, hiddenMondayOverlap, validThursday],
    visibleDays: ['2026-07-29', '2026-07-30'],
  })).toEqual({ok: false, error: 'schedule-data-error', reason: 'overlap'});
});

it('partitions agenda coordinates exactly once', () => {
  const result = projectDayAgenda({...agendaInput, bookings: [fourHourBooking]});
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.coveredSlotIndices).toEqual(
      Array.from({length: 20}, (_, index) => index),
    );
  }
});
```

Also name explicit tests for duplicate ID, missing field, invalid UTC instant,
`startsAt >= endsAt`, outside week, cross-day, off-grid, outside hours,
duration 0/9 slots, visible overlap, 30/60/240 minutes and adjacent half-open
bookings.

- [ ] **Step 2: Run the pure tests and confirm RED**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/schedule-projection.test.ts tests/unit/office-time.test.ts
```

Expected: FAIL because the projection module and its result types do not
exist.

- [ ] **Step 3: Implement Phase A validation before Phase B filtering**

Use one entry point and never infer opaque ID format:

```ts
export function projectTimetable(
  input: ProjectTimetableInput,
): ProjectionResult<TimetableProjection> {
  const validated = validateFullScheduleWeek(input);
  if (!validated.ok) return validated;
  const visibleSet = new Set(input.visibleDays);
  const visibleBookings = validated.value.bookings.filter(
    ({officeDay}) => visibleSet.has(officeDay),
  );
  return {
    ok: true,
    value: buildTimetableRows(input.visibleDays, visibleBookings),
  };
}
```

Generate UTC slot instants from each office day independently with Luxon.
Never add one fixed timezone offset across the week. `projectDayAgenda` calls
the same validator, filters only after success, emits each busy booking once
and proves `coveredSlotIndices` equals `0..19`.

- [ ] **Step 4: Verify pure projection and unchanged interval contracts**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/schedule-projection.test.ts tests/unit/office-time.test.ts tests/unit/booking-interval.test.ts tests/unit/end-time-options.test.ts
npm run typecheck
npm run lint
```

Expected: all tests PASS, including `endsAt === nextBooking.startsAt` and the
four-hour/office-close/next-booking end-option bounds.

- [ ] **Step 5: Commit only Task 4 paths**

```powershell
git add src/components/schedule/schedule-projection.ts src/components/schedule/schedule-types.ts src/lib/time/office-time.ts tests/unit/schedule-projection.test.ts tests/unit/office-time.test.ts
git commit -m "feat: add deterministic schedule projection"
```

---

### Task 5: Replace the Desktop/Tablet Renderer with a Native Timetable

**Responsibility:** Render Concept A as a truthful 7/3/2-day native table with
persistent free actions, correct row spans, timezone headers and whole-block
details triggers.

**Files:**
- Create: `src/components/schedule/timetable.tsx`
- Create: `src/app/styles/timetable.css`
- Create: `tests/unit/timetable.test.tsx`
- Modify: `src/app/styles/manifest.css`
- Modify: `src/app/globals.css`
- Modify: `src/components/schedule/schedule-viewport.tsx`
- Modify: `src/components/schedule/booking-block.tsx`
- Modify: `tests/unit/booking-block.test.tsx`
- Modify: `tests/unit/week-grid.test.tsx`
- Modify: `tests/unit/schedule-client.test.tsx`
- Delete after replacement tests pass: `src/components/schedule/week-grid.tsx`

**Interfaces:**
- Consumes: `projectTimetable`, `TimetableProjection`,
  `StartSlotSelection`, `VisibleDayCount`, `ScheduleBooking`.
- Produces:

```ts
export type TimetableProps = {
  bookings: readonly ScheduleBooking[];
  highlightedBookingId: string | null;
  now: string;
  officeCloseHour: number;
  officeOpenHour: number;
  officeTimeZone: string;
  onOpenDetails(booking: ScheduleBooking, invoker: HTMLElement): void;
  onSelectSlot(selection: StartSlotSelection, invoker: HTMLElement): void;
  room: RoomSummary;
  userTimeZone: string;
  visibleDays: readonly string[];
  weekStart: string;
};

export function Timetable(props: TimetableProps): ReactElement;
```

- [ ] **Step 1: Write failing semantic and fit tests**

```ts
it('renders a native seven-day table with twenty row headers', () => {
  render(<Timetable {...props} visibleDays={sevenDays} />);
  expect(screen.getByRole('table', {
    name: /Розклад переговорної Maple/,
  })).toBeVisible();
  expect(screen.getAllByRole('rowheader')).toHaveLength(20);
  expect(screen.getAllByRole('columnheader')).toHaveLength(8);
  expect(screen.queryByRole('grid')).not.toBeInTheDocument();
});

it('renders one four-hour booking cell with rowSpan eight', () => {
  render(<Timetable {...props} bookings={[fourHourBooking]} />);
  expect(screen.getByRole('cell', {name: /Планування кварталу/}))
    .toHaveAttribute('rowspan', '8');
});

it('keeps long title, range and status inside a 96.85px day cell', () => {
  const trigger = renderCompactLongBooking();
  expect(trigger.querySelector('[data-booking-title]')).toBeVisible();
  expect(trigger).toHaveTextContent('09:00–09:30');
  expect(trigger).toHaveTextContent('Зайнято');
  expect(trigger.querySelector('[aria-label^="Скасувати"]')).toBeNull();
});
```

- [ ] **Step 2: Run timetable tests and confirm RED**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/timetable.test.tsx tests/unit/week-grid.test.tsx tests/unit/booking-block.test.tsx
```

Expected: FAIL because `Timetable` does not exist and old `WeekGrid` uses
partial grid semantics and old geometry.

- [ ] **Step 3: Implement the native table and Concept A states**

Render headers explicitly:

```tsx
<table className="timetable">
  <caption className="visually-hidden">{caption}</caption>
  <thead>
    <tr>
      <th id="clock-column" scope="col">{clockHeading}</th>
      {dayHeaders.map((day) => (
        <th id={`day-${day.officeDate}`} key={day.officeDate} scope="col">
          <TimetableDayHeader day={day} />
        </th>
      ))}
    </tr>
  </thead>
  <tbody>{rows}</tbody>
</table>
```

Every row emits one `th scope="row"`. Empty actionable cells contain exactly
one native button with a persistent Plus icon and visible `Вільно` when the
container permits. Booking-start cells use `rowSpan={spanSlots}` and one
whole-area `BookingBlock` button; continuation cells are omitted only for
their own day. Add text/icon/border distinctions for own, other, selected and
current states. Different-zone headers and accessible names include full
office/user date, time and IANA zone.

- [ ] **Step 4: Switch resolved 7/3/2 modes and remove the old renderer**

`ScheduleViewport` maps expanded to 7 days, medium to 3 and tablet to 2.
Derive visible days from URL anchor `day`; do not fetch a narrower dataset.
Delete `week-grid.tsx` only after migrated `week-grid.test.tsx` passes against
`Timetable`.

- [ ] **Step 5: Load timetable styles and remove the replaced grid selectors**

Append `timetable.css` after `schedule-layout.css` in `manifest.css`. Run the
Task 5 focused tests once with the native table and new sheet loaded. After
they pass, move `.schedule-grid-shell`, `.week-grid*`,
`.schedule-day-headers`, `.schedule-days`, `.day-header*`,
`.schedule-time-gutter`, `.schedule-time-row`, `.schedule-day-column*`,
`.free-slot-button*`, `.booking-block*` and `.current-time-line*` from
`globals.css` into `timetable.css`. Do not move day-agenda or booking-surface
selectors. Confirm no listed legacy family remains in `globals.css`.

```powershell
npx vitest run --config vitest.config.ts tests/unit/timetable.test.tsx tests/unit/week-grid.test.tsx tests/unit/booking-block.test.tsx tests/unit/schedule-client.test.tsx
```

Expected before selector deletion: PASS.

- [ ] **Step 6: Verify native semantics, timezone fixtures and controller races**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/timetable.test.tsx tests/unit/week-grid.test.tsx tests/unit/booking-block.test.tsx tests/unit/schedule-client.test.tsx tests/unit/schedule-projection.test.ts tests/unit/office-time.test.ts
npm run check:design-tokens
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: PASS for 7/3/2 days, same-zone, US-only DST, Kyiv-only DST,
date-crossing, rowSpan adjacency, deep-link highlight, no `role="grid"` and an
ordered manifest ending in `timetable.css`.

- [ ] **Step 7: Commit only Task 5 paths**

```powershell
git add src/components/schedule/timetable.tsx src/components/schedule/schedule-viewport.tsx src/components/schedule/booking-block.tsx src/components/schedule/week-grid.tsx src/app/styles/manifest.css src/app/styles/timetable.css src/app/globals.css tests/unit/timetable.test.tsx tests/unit/week-grid.test.tsx tests/unit/booking-block.test.tsx tests/unit/schedule-client.test.tsx
git commit -m "feat: render native adaptive timetable"
```

---

### Task 6: Add the One-Day Mobile Agenda and Bounded Jump Controls

**Responsibility:** Replace the mobile renderer with a complete chronological
agenda, deterministic one-time positioning and a bounded keyboard path.

**Files:**
- Create: `src/components/schedule/day-agenda.tsx`
- Create: `src/app/styles/agenda.css`
- Create: `tests/unit/day-agenda.test.tsx`
- Create: `tests/unit/e2e-projects.test.ts`
- Modify: `src/app/styles/manifest.css`
- Modify: `src/app/globals.css`
- Modify: `test-config/playwright-configs.ts`
- Modify: `src/components/schedule/schedule-navigation.tsx`
- Modify: `src/components/schedule/schedule-viewport.tsx`
- Modify: `src/components/schedule/schedule-workspace.tsx`
- Modify: `tests/unit/schedule-toolbar.test.tsx`
- Modify: `tests/unit/schedule-client.test.tsx`
- Modify: `e2e/mobile.spec.ts`
- Modify: `e2e/timezone.spec.ts`
- Delete after replacement tests pass: `src/components/schedule/day-schedule.tsx`

**Interfaces:**
- Consumes: `projectDayAgenda`, full-week bookings, selected office day,
  `StartSlotSelection`, current time, URL deep-link and `positionEpoch`.
- Produces:

```ts
export type DayAgendaProps = {
  bookings: readonly ScheduleBooking[];
  highlightedBookingId: string | null;
  now: string;
  officeCloseHour: number;
  officeDay: string;
  officeOpenHour: number;
  officeTimeZone: string;
  onCancel(booking: ScheduleBooking, invoker: HTMLElement): void;
  onOpenDetails(booking: ScheduleBooking, invoker: HTMLElement): void;
  onSelectSlot(selection: StartSlotSelection, invoker: HTMLElement): void;
  positionEpoch: number;
  room: RoomSummary;
  selectedStartsAt: string | null;
  userTimeZone: string;
  weekStart: string;
};

export type ScheduleJumpTarget = {
  officeDay: string;
  slotIndex: number;
  startsAt: string;
  label: string;
};
```

- [ ] **Step 1: Write failing agenda, positioning and jump tests**

```ts
it('renders a four-hour booking once and covers all twenty slots', () => {
  render(<DayAgenda {...props} bookings={[fourHourBooking]} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(13);
  expect(screen.getAllByText('Планування кварталу')).toHaveLength(1);
  expect(screen.getByRole('list', {name: /Розклад на/})).toBeVisible();
});

it('positions once per epoch without moving focus', () => {
  const {rerender} = render(<DayAgenda {...props} positionEpoch={4} />);
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  rerender(<DayAgenda {...props} positionEpoch={4} />);
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(document.activeElement).toBe(focusedBeforeRender);
});

it('labels date-crossing jump values with user and office context', () => {
  render(<ScheduleNavigation {...dateCrossingProps} />);
  expect(screen.getByRole('option', {
    name: /28 лип.*23:00.*офіс.*29 лип.*09:00/,
  })).toHaveValue('2026-07-29T06:00:00.000Z');
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/day-agenda.test.tsx tests/unit/schedule-toolbar.test.tsx tests/unit/schedule-client.test.tsx
```

Expected: FAIL because `DayAgenda`, epoch positioning and ISO jump targets do
not exist.

- [ ] **Step 3: Implement agenda semantics and deterministic positioning**

Render a `<section aria-labelledby>` containing one `<ol>`. Free/past rows
cover one atomic slot; busy rows cover `spanSlots` and appear once. Own
upcoming booking rows contain sibling details and Cancel buttons, each at least
44px; no nested interactive element is allowed.

Use this exact fallback order once per epoch:

```ts
const target =
  deepLinkedBooking ??
  selectedStart ??
  currentBooking ??
  nearestFutureFree ??
  nextFutureBusy ??
  officeOpenItem ??
  agendaHeading;
target?.scrollIntoView({behavior: 'auto', block: 'start'});
```

Increment `positionEpoch` only for initial settled load, explicit room change,
capacity filter that changes room, day change or initial deep link. Do not
increment it for resize, notification poll, background refresh or conflict
refresh of the same selection.

- [ ] **Step 4: Implement mobile geometry and jump controls**

At normal 320px width use a 56px app row, 88px three-date strip, 48px
room/action row, and a 40px two-line timezone notice when zones differ. The
first agenda body item must satisfy `top <= 296px`; full
`America/Argentina/Buenos_Aires` remains visible. At actual 200% zoom allow
vertical growth with no clipping or horizontal overflow.

`ScheduleJumpControls` uses native day/time selects and one `Перейти` button.
Option values are exact UTC ISO slot instants; no arrow key is intercepted.

- [ ] **Step 5: Load agenda styles and remove the old mobile selectors**

Append `agenda.css` after `timetable.css` in `manifest.css`. Run the focused
Task 6 unit tests with the new agenda and sheet loaded. After they pass, move
`.mobile-day-controls`, `.mobile-schedule`, `.day-schedule*`,
`.day-row-time`, `.day-row-end-time` and their media-query rules from
`globals.css` into `agenda.css`; add the new agenda/jump selectors only there.
Confirm none of those legacy families remains in `globals.css`.

```powershell
npx vitest run --config vitest.config.ts tests/unit/day-agenda.test.tsx tests/unit/schedule-toolbar.test.tsx tests/unit/schedule-client.test.tsx
```

Expected before selector deletion: PASS.

- [ ] **Step 6: Establish the scoped responsive Playwright projects and prove selection**

Modify `createDeterministicPlaywrightConfig()` in
`test-config/playwright-configs.ts` in this task, before any booking/transition
E2E task runs. Preserve `seed`, `auth-setup`, `desktop-new-york`,
`desktop-new-york-fr`, `desktop-auth-smoke` and `mobile-auth-smoke`. Replace
`desktop-kyiv`/`mobile-kyiv` with these authenticated projects and exact
matches:

```ts
const responsiveProjectMatches = {
  expanded: [
    '**/booking.spec.ts',
    '**/cancellation.spec.ts',
    '**/my-bookings.spec.ts',
    '**/notifications.spec.ts',
    '**/schedule.spec.ts',
    '**/transition.spec.ts',
  ],
  medium: ['**/booking.spec.ts', '**/schedule.spec.ts'],
  tablet: [
    '**/booking.spec.ts',
    '**/cancellation.spec.ts',
    '**/schedule.spec.ts',
    '**/transition.spec.ts',
  ],
  'mobile-lg': [
    '**/booking.spec.ts',
    '**/cancellation.spec.ts',
    '**/mobile.spec.ts',
    '**/my-bookings.spec.ts',
    '**/notifications.spec.ts',
    '**/transition.spec.ts',
  ],
  mobile: [
    '**/booking.spec.ts',
    '**/cancellation.spec.ts',
    '**/mobile.spec.ts',
    '**/my-bookings.spec.ts',
  ],
  reflow: ['**/booking.spec.ts', '**/mobile.spec.ts'],
} as const;
```

All six depend on `auth-setup`, use the shared storage state and
`Europe/Kyiv`. Their exact viewports are `1440x900`, `1024x768`, `768x1024`,
`390x844` with touch, `360x800` and `320x800`. The project unit test asserts
the names, viewports, dependencies and every `testMatch` entry.

With a pre-validated `TEST_DATABASE_URL`, prove that Playwright lists the
mobile test under the new mobile project:

```powershell
$list = npx playwright test --config playwright.config.ts e2e/mobile.spec.ts --project=mobile-lg --list | Out-String
if ($list -notmatch '\[mobile-lg\].*mobile\.spec\.ts') {
  throw 'mobile-lg did not list e2e/mobile.spec.ts'
}
```

Expected: the assertion exits zero and the list contains at least one
`[mobile-lg] ... mobile.spec.ts` entry.

- [ ] **Step 7: Switch mobile mode, delete the old renderer and verify**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/day-agenda.test.tsx tests/unit/e2e-projects.test.ts tests/unit/schedule-toolbar.test.tsx tests/unit/schedule-client.test.tsx tests/unit/schedule-projection.test.ts tests/unit/office-time.test.ts
npm run check:design-tokens
npm run typecheck
npm run lint
npm run build
git diff --check
```

Then run with a pre-validated isolated `TEST_DATABASE_URL`:

```powershell
npx tsx scripts/run-e2e.ts e2e/mobile.spec.ts e2e/timezone.spec.ts --project=mobile-lg --project=desktop-new-york
```

Expected: unit tests and E2E pass; one agenda exists on mobile, old
`DaySchedule` is absent, and no page-level horizontal overflow occurs.

- [ ] **Step 8: Commit only Task 6 paths**

```powershell
git add src/components/schedule/day-agenda.tsx src/components/schedule/day-schedule.tsx src/components/schedule/schedule-navigation.tsx src/components/schedule/schedule-viewport.tsx src/components/schedule/schedule-workspace.tsx src/app/styles/manifest.css src/app/styles/agenda.css src/app/globals.css test-config/playwright-configs.ts tests/unit/day-agenda.test.tsx tests/unit/e2e-projects.test.ts tests/unit/schedule-toolbar.test.tsx tests/unit/schedule-client.test.tsx e2e/mobile.spec.ts e2e/timezone.spec.ts
git commit -m "feat: add deterministic mobile day agenda"
```

---

### Task 7: Introduce the Typed Booking Controller and Stable Adaptive Surface

**Responsibility:** Move draft/create/conflict ownership into one reducer and
render one stable controlled booking pane/sheet subtree across all breakpoints.

**Files:**
- Create: `src/components/schedule/booking-controller.ts`
- Create: `src/components/schedule/booking-composer.tsx`
- Create: `src/components/schedule/adaptive-booking-surface.tsx`
- Create: `src/app/styles/booking-surface.css`
- Create: `tests/unit/booking-controller.test.ts`
- Create: `tests/unit/adaptive-booking-surface.test.tsx`
- Modify: `src/app/styles/manifest.css`
- Modify: `src/app/globals.css`
- Modify: `src/components/schedule/schedule-workspace.tsx`
- Modify: `src/components/schedule/booking-selection.ts`
- Modify: `src/modules/bookings/end-time-options.ts`
- Modify: `tests/unit/end-time-options.test.ts`
- Modify: `tests/unit/booking-dialog.test.tsx`
- Modify: `tests/unit/schedule-client.test.tsx`
- Modify: `e2e/booking.spec.ts`
- Modify: `e2e/transition.spec.ts`
- Delete after replacement tests pass: `src/components/schedule/booking-dialog.tsx`

**Interfaces:**
- Consumes: `StartSlotSelection`, `BookingEndTimeOption`, `DomainErrorCode`,
  `BookingFieldKey`, full current schedule, `buildBookingEndTimeOptions` and
  unchanged `POST /api/bookings`.
- Produces:

```ts
export type BookingControllerState =
  | {status: 'closed'; selectionGeneration: number}
  | {
      status: 'details';
      booking: ScheduleBooking;
      selectionGeneration: number;
    }
  | {
      status:
        | 'editing'
        | 'submitting'
        | 'conflictRefreshing'
        | 'conflictError'
        | 'startUnavailable';
      selection: StartSlotSelection;
      title: string;
      endsAt: string;
      endOptions: readonly BookingEndTimeOption[];
      fieldErrors: Partial<Record<BookingFieldKey, string>>;
      formError: string;
      liveMessage: string;
      selectionGeneration: number;
      createRequestId: number | null;
      conflictGeneration: number;
    };

export type BookingControllerEvent =
  | {type: 'SELECT_SLOT'; selection: StartSlotSelection;
      options: readonly BookingEndTimeOption[]}
  | {type: 'OPEN_DETAILS'; booking: ScheduleBooking}
  | {type: 'TITLE_CHANGED'; value: string}
  | {type: 'END_CHANGED'; endsAt: string}
  | {type: 'SUBMIT'; requestId: number}
  | {type: 'CREATE_OK'; requestId: number; booking: ScheduleBooking}
  | {type: 'CREATE_DOMAIN_ERROR'; requestId: number;
      code: DomainErrorCode;
      fields: Partial<Record<BookingFieldKey, string>>}
  | {type: 'CREATE_TRANSPORT_ERROR'; requestId: number}
  | BookingRefreshOkEvent
  | {type: 'REFRESH_ERROR'; conflictGeneration: number}
  | {type: 'RETRY_REFRESH'}
  | {type: 'CLOSE'}
  | {type: 'NAVIGATE_ROOM_WEEK_DAY'};

export function bookingReducer(
  state: BookingControllerState,
  event: BookingControllerEvent,
): BookingControllerState;

export type ConflictRefreshSuccessPorts = {
  activeConflictGeneration: number;
  buildOptions(schedule: ScheduleData): readonly BookingEndTimeOption[];
  commitSchedule(schedule: ScheduleData): void;
  dispatch(event: BookingRefreshOkEvent): void;
};

export function applyConflictRefreshSuccess(
  input: {conflictGeneration: number; schedule: ScheduleData},
  ports: ConflictRefreshSuccessPorts,
): void;
```

- [ ] **Step 1: Write the reducer and controlled-form RED tests**

```ts
it('defaults a new selection to the first thirty-minute option', () => {
  const state = bookingReducer(closedState, {
    type: 'SELECT_SLOT',
    selection,
    options,
  });
  expect(state).toMatchObject({
    status: 'editing',
    endsAt: options[0].endsAt,
    title: '',
  });
});

it('retains the title and replaces a removed end after conflict refresh', () => {
  const state = bookingReducer(conflictRefreshingState, {
    type: 'REFRESH_OK',
    conflictGeneration: 3,
    options: refreshedOptions,
  });
  expect(state).toMatchObject({
    status: 'editing',
    title: 'Планування',
    endsAt: refreshedOptions[0].endsAt,
    liveMessage: 'Час завершення змінено відповідно до доступності',
  });
});

it('commits refreshed schedule before dispatching reducer options', async () => {
  await applyConflictRefreshSuccess({
    conflictGeneration: 3,
    schedule: refreshedSchedule,
  }, {
    activeConflictGeneration: 3,
    buildOptions: () => refreshedOptions,
    commitSchedule,
    dispatch,
  });
  expect(commitSchedule).toHaveBeenCalledWith(refreshedSchedule);
  expect(commitSchedule.mock.invocationCallOrder[0]).toBeLessThan(
    dispatch.mock.invocationCallOrder[0],
  );
  expect(dispatch).toHaveBeenCalledWith({
    type: 'REFRESH_OK',
    conflictGeneration: 3,
    options: refreshedOptions,
  });
});

it('keeps the same composer node and draft while resizing', () => {
  const {rerender} = render(<AdaptiveBookingSurface {...tabletProps} />);
  const title = screen.getByLabelText('Назва');
  rerender(<AdaptiveBookingSurface {...expandedProps} />);
  expect(screen.getByLabelText('Назва').isSameNode(title)).toBe(true);
  expect(title).toHaveValue('Планування');
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/booking-controller.test.ts tests/unit/adaptive-booking-surface.test.tsx tests/unit/booking-dialog.test.tsx tests/unit/schedule-client.test.tsx tests/unit/end-time-options.test.ts
```

Expected: FAIL because the typed reducer and stable surface do not exist.

- [ ] **Step 3: Implement reducer and controlled composer**

`BookingComposer` receives state plus callbacks only; it has no `fetch`,
generation ref, end-option recomputation or local draft `useState`.

```ts
export type BookingComposerProps = {
  state: Extract<BookingControllerState, {selection: StartSlotSelection}>;
  onClose(): void;
  onEndChange(endsAt: string): void;
  onRetryRefresh(): void;
  onSubmit(): void;
  onTitleChange(value: string): void;
};
```

Validate trimmed title and option membership before dispatching `SUBMIT`.
Pending disables selection, close and duplicate submit. Map stable error codes
through Task 1; do not render raw server messages.

- [ ] **Step 4: Implement controller effects and stable placement**

`ScheduleWorkspace` alone allocates request IDs, posts, refreshes the captured
room/week after conflict and ignores stale request/generation responses. A
stale committed success only revalidates its captured room/week; it does not
close a newer surface, toast or move focus.

The conflict-refresh success effect uses one exact sequence:

```ts
function applyConflictRefreshSuccess(input: {
  conflictGeneration: number;
  schedule: ScheduleData;
}, ports: ConflictRefreshSuccessPorts): void {
  if (input.conflictGeneration !== ports.activeConflictGeneration) return;
  ports.commitSchedule(input.schedule);
  const options = ports.buildOptions(input.schedule);
  ports.dispatch({
    type: 'REFRESH_OK',
    conflictGeneration: input.conflictGeneration,
    options,
  });
}
```

`ScheduleData` belongs to workspace state and is never part of the reducer
event. React batches the schedule commit and reducer dispatch; the reducer
decides retained/replaced/no-option state from the supplied options.

`AdaptiveBookingSurface` always renders the same backdrop/panel/composer
ancestry. CSS places it as expanded 320px region, medium 320px region, tablet
right sheet and mobile bottom/full-screen sheet. Expanded closed state shows
guidance; medium/tablet/mobile closed state is hidden and unfocusable.

- [ ] **Step 5: Load booking-surface styles and remove replaced composer selectors**

Append `booking-surface.css` after `agenda.css` in `manifest.css`. Run the
focused Task 7 unit/component tests with the sheet loaded. After they pass,
move `.booking-form*`, `.booking-summary*` and any old booking-dialog composer
selectors into `booking-surface.css`. Leave `.dialog-*` and
`.cancellation-dialog-*` for Task 8. Confirm the migrated selectors no longer
occur in `globals.css`.

```powershell
npx vitest run --config vitest.config.ts tests/unit/booking-controller.test.ts tests/unit/adaptive-booking-surface.test.tsx tests/unit/booking-dialog.test.tsx tests/unit/schedule-client.test.tsx
```

Expected before selector deletion: PASS.

- [ ] **Step 6: Prove Task 7 lists desktop and mobile booking/transition cases**

With a pre-validated `TEST_DATABASE_URL`, run:

```powershell
$list = npx playwright test --config playwright.config.ts e2e/booking.spec.ts e2e/transition.spec.ts --project=expanded --project=mobile-lg --list | Out-String
$required = @(
  '\[expanded\].*booking\.spec\.ts',
  '\[expanded\].*transition\.spec\.ts',
  '\[mobile-lg\].*booking\.spec\.ts',
  '\[mobile-lg\].*transition\.spec\.ts'
)
$missing = @($required | Where-Object { $list -notmatch $_ })
if ($missing.Count -gt 0) { throw "Missing scoped E2E evidence: $($missing -join ', ')" }
```

Expected: all four exact project/file patterns are present. A zero-test or
desktop-only listing fails before the real run.

- [ ] **Step 7: Verify unit, create/conflict E2E and API regression**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/booking-controller.test.ts tests/unit/adaptive-booking-surface.test.tsx tests/unit/booking-dialog.test.tsx tests/unit/schedule-client.test.tsx tests/unit/end-time-options.test.ts
npm run check:design-tokens
npm run typecheck
npm run lint
npm run build
git diff --check
```

Then run with a pre-validated isolated `TEST_DATABASE_URL`:

```powershell
npx tsx scripts/run-e2e.ts e2e/booking.spec.ts e2e/transition.spec.ts --project=expanded --project=mobile-lg
npm run test:integration
```

Expected: 30-minute default and multi-slot create pass, conflict retains draft,
retry works, exact `endsAt` persists, server overlap/race behavior is unchanged.

- [ ] **Step 8: Commit only Task 7 paths**

```powershell
git add src/components/schedule/booking-controller.ts src/components/schedule/booking-composer.tsx src/components/schedule/adaptive-booking-surface.tsx src/components/schedule/booking-dialog.tsx src/components/schedule/booking-selection.ts src/components/schedule/schedule-workspace.tsx src/modules/bookings/end-time-options.ts src/app/styles/manifest.css src/app/styles/booking-surface.css src/app/globals.css tests/unit/booking-controller.test.ts tests/unit/adaptive-booking-surface.test.tsx tests/unit/booking-dialog.test.tsx tests/unit/schedule-client.test.tsx tests/unit/end-time-options.test.ts e2e/booking.spec.ts e2e/transition.spec.ts
git commit -m "feat: add adaptive booking controller"
```

---

### Task 8: Serialize Modal Presentation and Move Cancellation to Parent Controllers

**Responsibility:** Make one coordinator own filter/booking/cancellation/
notification modal semantics, inertness and focus; make cancellation dialogs
fully controlled.

**Files:**
- Create: `src/components/app/presentation-coordinator.tsx`
- Create: `src/components/bookings/cancellation-dialog.tsx`
- Create: `tests/unit/presentation-coordinator.test.tsx`
- Modify: `src/components/app/app-shell.tsx`
- Modify: `src/components/ui/dialog.tsx`
- Modify: `src/components/schedule/adaptive-booking-surface.tsx`
- Modify: `src/components/schedule/room-filter-surface.tsx`
- Modify: `src/components/schedule/schedule-workspace.tsx`
- Modify: `src/components/bookings/booking-list.tsx`
- Modify: `src/app/styles/ui.css`
- Modify: `src/app/styles/booking-surface.css`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/booking-list.test.tsx`
- Modify: `tests/unit/cancel-booking-dialog.test.tsx`
- Modify: `tests/unit/room-filter.test.tsx`
- Modify: `tests/unit/schedule-client.test.tsx`
- Modify: `e2e/cancellation.spec.ts`
- Modify: `e2e/transition.spec.ts`
- Delete after replacement tests pass: `src/components/bookings/cancel-booking-dialog.tsx`

**Interfaces:**
- Consumes: `ResponsiveMode`, booking surface state, parent-owned cancellation
  pending/error and invoker refs.
- Produces:

```ts
export type CancellationPresentationOrigin =
  | {kind: 'booking'; cancelTrigger: HTMLElement}
  | {kind: 'schedule'; invoker: HTMLElement}
  | {kind: 'history'; invoker: HTMLElement};

export type PresentationCommand =
  | {type: 'OPEN_FILTER'; trigger: HTMLElement}
  | {type: 'APPLY_FILTER'}
  | {type: 'CLOSE_FILTER'}
  | {type: 'OPEN_BOOKING'}
  | {type: 'OPEN_CANCEL_FROM_BOOKING'; trigger: HTMLElement}
  | {type: 'OPEN_CANCEL_DIRECT'; origin: CancellationPresentationOrigin}
  | {type: 'KEEP_CANCEL'}
  | {type: 'CANCEL_ERROR_CLOSE'}
  | {type: 'CANCEL_SUCCESS'}
  | {type: 'OPEN_NOTIFICATIONS'; bell: HTMLElement}
  | {type: 'CLOSE_NOTIFICATIONS'}
  | {type: 'ROUTE_NAVIGATION'};

export type PresentationContextValue = {
  modalOwner: ModalOwner;
  modalOpen: boolean;
  request(command: PresentationCommand): 'ACCEPTED' | 'DENIED';
  registerBackground(element: HTMLElement | null): void;
};
```

- [ ] **Step 1: Write failing owner, handoff and controlled-cancel tests**

```ts
it('never commits two aria-modal surfaces during booking to cancellation', () => {
  render(<CoordinatorHarness mode="tablet" />);
  openBooking();
  openCancellationFromBooking();
  expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
  expect(screen.getByRole('dialog', {name: 'Скасувати бронювання'}))
    .toBeVisible();
  expect(bookingSurface()).toHaveAttribute('data-suspended', 'true');
});

it('restores the exact booking cancel trigger after Keep', async () => {
  const trigger = openCancellationFromBooking();
  await userEvent.click(screen.getByRole('button', {
    name: 'Залишити бронювання',
  }));
  expect(document.activeElement?.isSameNode(trigger)).toBe(true);
});

it('keeps DELETE outside the presentational dialog', async () => {
  render(<CancellationDialog {...props} />);
  await userEvent.click(screen.getByRole('button', {
    name: 'Скасувати бронювання',
  }));
  expect(props.onConfirm).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/presentation-coordinator.test.tsx tests/unit/cancel-booking-dialog.test.tsx tests/unit/room-filter.test.tsx tests/unit/schedule-client.test.tsx
```

Expected: FAIL because modal ownership is distributed and the existing cancel
dialog owns its request.

- [ ] **Step 3: Implement synchronous owner transitions and inert registry**

`PresentationCoordinator` is the only code that sets modal owner,
`aria-modal`, background `inert` and presentation focus. Reject
`OPEN_FILTER`, `OPEN_BOOKING`, `OPEN_CANCEL_DIRECT` and
`OPEN_NOTIFICATIONS` while another owner is active. Permit only the
booking-to-cancellation owner handoff.

For owner-to-owner handoff, remove role/aria and suspend the outgoing surface
in the same render transaction before the incoming surface receives
`aria-modal="true"`. Keep app background inert throughout.

- [ ] **Step 4: Move cancellation request state to page controllers**

`CancellationDialog` receives:

```ts
export type CancellationDialogProps = {
  booking: {id: string; title: string};
  error: string;
  pending: boolean;
  onCloseError(): void;
  onConfirm(): void;
  onKeep(): void;
};
```

`ScheduleWorkspace` retains a cancelled block until schedule refresh.
`BookingList` removes a successfully cancelled upcoming row immediately.
Both allocate request IDs, block duplicate DELETE, ignore stale responses and
publish localized error/success state. Add `booking-list.test.tsx` assertions
that the first confirm owns exactly one DELETE, pending blocks a duplicate,
stale success cannot remove a newer row, successful cancellation immediately
removes only the matching future row and failure retains the row with localized
error.

- [ ] **Step 5: Migrate dialog/cancellation presentation out of legacy CSS**

Run the focused Task 8 unit/component suite first. After it passes, move
`.dialog-backdrop`, `.dialog-panel`, `.dialog-heading*`, `.dialog-alert` and
shared focus/containment rules into `ui.css`; move `.dialog-actions`,
`.cancellation-dialog-*` and adaptive cancellation suspension rules into
`booking-surface.css`. Remove those selectors from `globals.css` in this task
and confirm no duplicate family remains. `manifest.css` order is unchanged
because both owner sheets already load.

```powershell
npx vitest run --config vitest.config.ts tests/unit/presentation-coordinator.test.tsx tests/unit/cancel-booking-dialog.test.tsx tests/unit/room-filter.test.tsx tests/unit/schedule-client.test.tsx tests/unit/booking-list.test.tsx
```

Expected before selector deletion: PASS.

- [ ] **Step 6: Prove Task 8 lists desktop and mobile cancellation transitions**

With a pre-validated `TEST_DATABASE_URL`, run:

```powershell
$list = npx playwright test --config playwright.config.ts e2e/cancellation.spec.ts e2e/transition.spec.ts --project=expanded --project=mobile-lg --list | Out-String
$required = @(
  '\[expanded\].*cancellation\.spec\.ts',
  '\[expanded\].*transition\.spec\.ts',
  '\[mobile-lg\].*cancellation\.spec\.ts',
  '\[mobile-lg\].*transition\.spec\.ts'
)
$missing = @($required | Where-Object { $list -notmatch $_ })
if ($missing.Count -gt 0) { throw "Missing scoped E2E evidence: $($missing -join ', ')" }
```

Expected: all four project/file patterns are listed.

- [ ] **Step 7: Verify modal frames, focus and cancellation outcomes**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/presentation-coordinator.test.tsx tests/unit/cancel-booking-dialog.test.tsx tests/unit/room-filter.test.tsx tests/unit/schedule-client.test.tsx tests/unit/booking-list.test.tsx
npm run check:design-tokens
npm run typecheck
npm run lint
npm run build
git diff --check
```

Then run with a pre-validated isolated `TEST_DATABASE_URL`:

```powershell
npx tsx scripts/run-e2e.ts e2e/cancellation.spec.ts e2e/transition.spec.ts --project=expanded --project=mobile-lg
```

Expected: exactly one active modal for every owner, no focus escape, Keep/error
close restore the exact trigger, success uses schedule/history fallback and
duplicate cancellation is blocked.

- [ ] **Step 8: Commit only Task 8 paths**

```powershell
git add src/components/app/presentation-coordinator.tsx src/components/app/app-shell.tsx src/components/ui/dialog.tsx src/components/bookings/cancellation-dialog.tsx src/components/bookings/cancel-booking-dialog.tsx src/components/bookings/booking-list.tsx src/components/schedule/adaptive-booking-surface.tsx src/components/schedule/room-filter-surface.tsx src/components/schedule/schedule-workspace.tsx src/app/styles/ui.css src/app/styles/booking-surface.css src/app/globals.css tests/unit/presentation-coordinator.test.tsx tests/unit/cancel-booking-dialog.test.tsx tests/unit/room-filter.test.tsx tests/unit/schedule-client.test.tsx tests/unit/booking-list.test.tsx e2e/cancellation.spec.ts e2e/transition.spec.ts
git commit -m "feat: coordinate modal and cancellation presentation"
```

---

### Task 9: Separate Notification Lifecycle from Presentation

**Responsibility:** Preserve polling/ack behavior while independently modeling
retained, seen, toast, dismiss and modal presentation state across authenticated
client navigation.

**Files:**
- Create: `src/components/app/notification-controller.tsx`
- Create: `src/components/app/notification-center.tsx`
- Create: `src/app/styles/notifications.css`
- Create: `tests/unit/notification-controller.test.ts`
- Modify: `src/app/styles/manifest.css`
- Modify: `src/app/globals.css`
- Modify: `src/components/app/app-shell.tsx`
- Modify: `src/components/app/presentation-coordinator.tsx`
- Modify: `tests/unit/notification-bell.test.tsx`
- Modify: `tests/unit/presentation-coordinator.test.tsx`
- Modify: `e2e/notifications.spec.ts`
- Delete after replacement tests pass: `src/components/app/notification-bell.tsx`

**Interfaces:**
- Consumes: existing immediate/60-second `/api/notifications` GET and ack POST
  contract; `modalOpen`/owner requests from Task 8.
- Produces:

```ts
export type RetainedNotification = {
  data: DueNotification;
  seen: boolean;
  ack: 'pending' | 'acked' | 'failed';
};

export type NotificationClientState = {
  retainedById: ReadonlyMap<string, RetainedNotification>;
  dismissedIds: ReadonlySet<string>;
  toastQueue: readonly string[];
  activeToastId: string | null;
  centerOpen: boolean;
};

export type NotificationEvent =
  | {type: 'POLL_VALID'; items: readonly DueNotification[]}
  | {type: 'ACK_OK'; id: string}
  | {type: 'ACK_ERROR'; id: string}
  | {type: 'TOAST_SHOW_NEXT'}
  | {type: 'TOAST_TIMEOUT'; id: string}
  | {type: 'CENTER_OPEN'}
  | {type: 'CENTER_CLOSE'}
  | {type: 'DISMISS'; id: string}
  | {type: 'MODAL_OPEN'}
  | {type: 'MODAL_CLOSE'};

export function notificationReducer(
  state: NotificationClientState,
  event: NotificationEvent,
): NotificationClientState;
```

- [ ] **Step 1: Write failing five-lifecycle tests**

```ts
it('marks first delivery seen when the center is already open', () => {
  const next = notificationReducer(openState, {
    type: 'POLL_VALID',
    items: [notification],
  });
  expect(next.retainedById.get(notification.id)?.seen).toBe(true);
  expect(next.toastQueue).toEqual([]);
  expect(unseenCount(next)).toBe(0);
});

it('updates a duplicate while open without queueing and still re-acks', () => {
  deliverWhileOpen(notification);
  deliverWhileOpen({...notification, title: 'Оновлена назва'});
  expect(screen.getByText('Оновлена назва')).toBeVisible();
  expect(postedAckIds()).toEqual([notification.id, notification.id]);
  expect(toastIds()).toEqual([]);
});

it('does not resurrect a dismissed redelivery but acknowledges it', () => {
  const next = reduce(dismissedState, {
    type: 'POLL_VALID',
    items: [notification],
  });
  expect(next.retainedById.has(notification.id)).toBe(false);
  expect(ackEffectIds()).toEqual([notification.id]);
});

it.each(['expanded', 'medium', 'tablet'] as const)(
  'renders %s notification center as a non-modal popover',
  (mode) => {
    render(<NotificationCenter {...props} mode={mode} open />);
    expect(screen.getByRole('region', {name: 'Сповіщення'})).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  },
);

it('renders only mobile notification center as a modal sheet', () => {
  render(<NotificationCenter {...props} mode="mobile" open />);
  expect(screen.getByRole('dialog', {name: 'Сповіщення'}))
    .toHaveAttribute('aria-modal', 'true');
});
```

- [ ] **Step 2: Run notification tests and confirm RED**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/notification-controller.test.ts tests/unit/notification-bell.test.tsx tests/unit/presentation-coordinator.test.tsx
```

Expected: FAIL because one component currently combines delivery and
presentation and does not implement the approved center-open behavior.

- [ ] **Step 3: Implement reducer, effects and persistent controller**

Mount `NotificationController` once inside `AppShell`. Poll immediately and
every `60_000ms` only while visible. On visibility return poll immediately.
Every valid delivered ID starts an independent ack request, including
duplicates and dismissed IDs.

When `centerOpen=true`, new and duplicate items are `seen=true`, visible in the
center, absent from toast queue and never synthesized into a toast after close
or route navigation. Ack result mutates only `ack`. Dismiss removes retained,
queue and active presentation for the client lifetime.

- [ ] **Step 4: Implement controlled center/popover/sheet and suppression**

`expanded`, `medium` and `tablet` render a non-modal popover. Only `mobile`
requests owner `notifications` and renders a modal sheet. Bell is 44px and
named `Сповіщення, {n} нових`. Any non-null modal owner suppresses active
toast and resets its four-second timer; toast resumes only after owner is null
and center is closed. Route navigation closes the center but retains
controller state; logout/full reload clears it.

- [ ] **Step 5: Load notification styles and remove the legacy notification family**

Append `notifications.css` after `booking-surface.css` in `manifest.css`. Run
the Task 9 unit/component suite with the new center loaded. After it passes,
move all `.notification-*` selectors, including bell, badge, popover/sheet,
toast region and dismiss action, from `globals.css` into `notifications.css`.
Confirm no `.notification-*` selector remains in `globals.css`.

```powershell
npx vitest run --config vitest.config.ts tests/unit/notification-controller.test.ts tests/unit/notification-bell.test.tsx tests/unit/presentation-coordinator.test.tsx
```

Expected before selector deletion: PASS.

- [ ] **Step 6: Prove and run expanded/mobile notification coverage**

With a pre-validated `TEST_DATABASE_URL`, run:

```powershell
$list = npx playwright test --config playwright.config.ts e2e/notifications.spec.ts --project=expanded --project=mobile-lg --list | Out-String
if ($list -notmatch '\[expanded\].*notifications\.spec\.ts' -or
    $list -notmatch '\[mobile-lg\].*notifications\.spec\.ts') {
  throw 'Notification E2E was not listed for expanded and mobile-lg'
}
```

Expected: both project/file patterns are listed.

- [ ] **Step 7: Verify lifecycle, route persistence and backend ack contract**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/notification-controller.test.ts tests/unit/notification-bell.test.tsx tests/unit/presentation-coordinator.test.tsx tests/unit/notification-service.test.ts
npm run check:design-tokens
npm run typecheck
npm run lint
npm run build
git diff --check
```

Then run with a pre-validated isolated `TEST_DATABASE_URL`:

```powershell
npx tsx scripts/run-e2e.ts e2e/notifications.spec.ts --project=expanded --project=mobile-lg
npm run test:integration
```

Expected: polling/dedupe/ack integration remains green; badge, retained list,
toast and dismiss change independently; every modal owner suppresses toasts.

- [ ] **Step 8: Commit only Task 9 paths**

```powershell
git add src/components/app/notification-controller.tsx src/components/app/notification-center.tsx src/components/app/notification-bell.tsx src/components/app/app-shell.tsx src/components/app/presentation-coordinator.tsx src/app/styles/manifest.css src/app/styles/notifications.css src/app/globals.css tests/unit/notification-controller.test.ts tests/unit/notification-bell.test.tsx tests/unit/presentation-coordinator.test.tsx e2e/notifications.spec.ts
git commit -m "feat: separate notification lifecycle and presentation"
```

---

### Task 10: Redesign My Bookings as an Accessible Derived View

**Responsibility:** Add nearest-booking priority and user-zone grouping while
preserving independent pagination, API order and whole-row deep links with a
sibling Cancel action.

**Files:**
- Create: `src/components/bookings/booking-groups.tsx`
- Create: `src/app/styles/my-bookings.css`
- Create: `tests/unit/booking-groups.test.ts`
- Modify: `src/app/styles/manifest.css`
- Modify: `src/app/globals.css`
- Modify: `src/components/bookings/booking-list.tsx`
- Modify: `src/app/(authenticated)/my-bookings/page.tsx`
- Modify: `tests/unit/booking-list.test.tsx`
- Modify: `e2e/my-bookings.spec.ts`

**Interfaces:**
- Consumes: unchanged `BookingPage`, `BookingListItem`, separate future/past
  cursor states, Task 8 parent cancellation and Task 1 formatters.
- Produces:

```ts
export type BookingGroup =
  | {kind: 'nearest'; heading: 'Найближче'; items: readonly BookingListItem[]}
  | {kind: 'date'; heading: string; items: readonly BookingListItem[]}
  | {kind: 'month'; heading: string; items: readonly BookingListItem[]};

export function groupBookings(input: {
  future: readonly BookingListItem[];
  past: readonly BookingListItem[];
  userTimeZone: string;
}): readonly BookingGroup[];
```

- [ ] **Step 1: Write failing grouping, pagination and sibling-action tests**

```ts
it('promotes the nearest future booking without duplicating it', () => {
  const groups = groupBookings({future: [later, nearest], past: [], userTimeZone});
  expect(groups[0]).toMatchObject({kind: 'nearest', items: [nearest]});
  expect(groups.flatMap(({items}) => items).filter(
    ({id}) => id === nearest.id,
  )).toHaveLength(1);
});

it('keeps the row link and Cancel as siblings in tab order', async () => {
  render(<BookingList officeTimeZone="Europe/Kyiv" />);
  await settleFutureBookings();
  const row = screen.getByTestId(`booking-row-${upcoming.id}`);
  expect(row.children[0]).toHaveAttribute('href', expect.stringContaining(
    `bookingId=${upcoming.id}`,
  ));
  expect(row.children[1]).toHaveAccessibleName('Скасувати Планування');
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/booking-groups.test.ts tests/unit/booking-list.test.tsx tests/unit/cancel-booking-dialog.test.tsx
```

Expected: FAIL because grouping/nearest priority and Ukrainian row semantics
do not exist.

- [ ] **Step 3: Implement pure derived groups and quiet operational layout**

Do not reorder items inside each API sequence. Extract exactly one nearest
future item, then group remaining future by user-local date and past by
user-local month. Keep future and past loading/error/empty/cursor states
independent. A load-more failure retains existing rows and exposes a scoped
retry.

The row uses two grid columns: the `<Link>` owns date, time, title, room,
status and all free area; Cancel owns a separate right action column. Do not
overlay or nest controls and do not rely on `stopPropagation`.

- [ ] **Step 4: Load My Bookings styles and remove the history legacy selectors**

Append `my-bookings.css` after `notifications.css` in `manifest.css`. Run the
Task 10 unit/component tests with the grouped view loaded. After they pass,
move `.booking-history-*`, `.booking-list*`, `.booking-status*` and
`.booking-load-more*` from `globals.css` into `my-bookings.css`. Confirm no
listed selector family remains in `globals.css`.

```powershell
npx vitest run --config vitest.config.ts tests/unit/booking-groups.test.ts tests/unit/booking-list.test.tsx tests/unit/cancel-booking-dialog.test.tsx
```

Expected before selector deletion: PASS.

- [ ] **Step 5: Prove Task 10 lists desktop and mobile history/cancellation cases**

With a pre-validated `TEST_DATABASE_URL`, run:

```powershell
$list = npx playwright test --config playwright.config.ts e2e/my-bookings.spec.ts e2e/cancellation.spec.ts --project=expanded --project=mobile-lg --list | Out-String
$required = @(
  '\[expanded\].*my-bookings\.spec\.ts',
  '\[expanded\].*cancellation\.spec\.ts',
  '\[mobile-lg\].*my-bookings\.spec\.ts',
  '\[mobile-lg\].*cancellation\.spec\.ts'
)
$missing = @($required | Where-Object { $list -notmatch $_ })
if ($missing.Count -gt 0) { throw "Missing scoped E2E evidence: $($missing -join ', ')" }
```

Expected: all four exact project/file patterns are listed.

- [ ] **Step 6: Verify derived state, deep link and cancellation**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/booking-groups.test.ts tests/unit/booking-list.test.tsx tests/unit/cancel-booking-dialog.test.tsx
npm run check:design-tokens
npm run typecheck
npm run lint
npm run build
git diff --check
```

Then run with a pre-validated isolated `TEST_DATABASE_URL`:

```powershell
npx tsx scripts/run-e2e.ts e2e/my-bookings.spec.ts e2e/cancellation.spec.ts --project=expanded --project=mobile-lg
```

Expected: nearest row appears once, pagination dedupes by ID, deep link
restores room/week/day/bookingId, row and Cancel keyboard behavior remain
separate.

- [ ] **Step 7: Commit only Task 10 paths**

```powershell
git add src/components/bookings/booking-groups.tsx src/components/bookings/booking-list.tsx 'src/app/(authenticated)/my-bookings/page.tsx' src/app/styles/manifest.css src/app/styles/my-bookings.css src/app/globals.css tests/unit/booking-groups.test.ts tests/unit/booking-list.test.tsx e2e/my-bookings.spec.ts
git commit -m "feat: redesign accessible booking history"
```

---

### Task 11: Complete States, Accessibility, Geometry and Final Evidence

**Responsibility:** Close cross-surface loading/error/empty gaps, complete the
already-established deterministic browser matrix, audit prior task-local CSS
migrations and produce auditable before/after evidence. This task does not
absorb selector migration owned by Tasks 2-10. The controller performs the
broad independent review after this task's scoped review.

**Files:**
- Create: `e2e/accessibility.spec.ts`
- Create: `e2e/geometry.spec.ts`
- Create: `scripts/check-design-contrast.ts`
- Create: `tests/unit/design-contrast.test.ts`
- Create: `docs/design/06-implementation-evidence.md`
- Create: `docs/design/evidence/final/schedule-settled-expanded-1440x900.png`
- Create: `docs/design/evidence/final/booking-open-expanded-1440x900.png`
- Create: `docs/design/evidence/final/schedule-settled-medium-1024x768.png`
- Create: `docs/design/evidence/final/booking-open-medium-1024x768.png`
- Create: `docs/design/evidence/final/schedule-settled-tablet-768x1024.png`
- Create: `docs/design/evidence/final/booking-open-tablet-768x1024.png`
- Create: `docs/design/evidence/final/schedule-settled-mobile-lg-390x844.png`
- Create: `docs/design/evidence/final/booking-open-mobile-lg-390x844.png`
- Create: `docs/design/evidence/final/schedule-settled-mobile-360x800.png`
- Create: `docs/design/evidence/final/booking-open-mobile-360x800.png`
- Create: `docs/design/evidence/final/schedule-settled-reflow-320x800.png`
- Create: `docs/design/evidence/final/booking-open-reflow-320x800.png`
- Create: `docs/design/evidence/final/auth-login-expanded-1440x900.png`
- Create: `docs/design/evidence/final/my-bookings-mobile-lg-390x844.png`
- Create: `docs/design/evidence/final/state-conflict-expanded-1440x900.png`
- Create: `docs/design/evidence/final/state-notifications-mobile-lg-390x844.png`
- Modify: `test-config/playwright-configs.ts`
- Modify: `package.json`
- Modify: `e2e/fixtures.ts`
- Modify: `e2e/impact-map.ts`
- Modify: `e2e/schedule.spec.ts`
- Modify: `e2e/mobile.spec.ts`
- Modify: `e2e/locale.spec.ts`
- Modify: `e2e/timezone.spec.ts`
- Modify: `e2e/transition.spec.ts`
- Modify: `e2e/exploratory/schedule-visual.spec.ts`
- Modify: `e2e/exploratory/mobile-booking.spec.ts`
- Modify: `tests/unit/design-token-contract.test.ts`
- Modify: `tests/unit/e2e-projects.test.ts`
- Modify: `tests/unit/impact-map.test.ts`
- Modify: `tests/unit/source-hygiene.test.ts`
- Modify: `src/app/styles/base.css`
- Modify: `src/app/styles/ui.css`
- Modify: `src/app/styles/shell.css`
- Modify: `src/app/styles/schedule-layout.css`
- Modify: `src/app/styles/timetable.css`
- Modify: `src/app/styles/agenda.css`
- Modify: `src/app/styles/booking-surface.css`
- Modify: `src/app/styles/notifications.css`
- Modify: `src/app/styles/my-bookings.css`
- Modify: `src/app/styles/auth.css`
- Modify: `src/app/styles/manifest.css`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: all Task 1-10 public component contracts and the unchanged test DB
  preflight.
- Produces final `geometry.spec.ts`/`accessibility.spec.ts` allocation across
  the six projects established in Task 6; calculated token-contrast results;
  and a final evidence report mapping AC-001 through AC-049 to tests,
  screenshots and mandatory manual checks.

- [ ] **Step 1: Write failing browser matrix and state assertions**

Extend each Task 6 responsive project's `testMatch` with
`**/geometry.spec.ts` and `**/accessibility.spec.ts`; do not rename or recreate
the projects. Assert their exact viewports remain:

```ts
const responsiveProjects = [
  {name: 'expanded', viewport: {width: 1440, height: 900}},
  {name: 'medium', viewport: {width: 1024, height: 768}},
  {name: 'tablet', viewport: {width: 768, height: 1024}},
  {name: 'mobile-lg', viewport: {width: 390, height: 844}, hasTouch: true},
  {name: 'mobile', viewport: {width: 360, height: 800}},
  {name: 'reflow', viewport: {width: 320, height: 800}},
] as const;
```

Use semantic and inequality gates:

```ts
expect(await page.getByRole('table').getByRole('columnheader').count())
  .toBe(expectedDays + 1);
expect(await page.getByRole('grid').count()).toBe(0);
expect(await page.evaluate(() => document.documentElement.scrollWidth))
  .toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
expect((await firstAgendaItem.boundingBox())?.y).toBeLessThanOrEqual(296);
expect(await page.locator('[aria-modal="true"]').count()).toBe(1);
```

Cover first load, settled empty, independent fetch error, retry, preserved-data
refresh overlay, malformed schedule atomic error, conflict error/retry,
start-unavailable, cancel error, notification empty and My Bookings independent
states.

- [ ] **Step 2: Write calculated contrast and final token-contract RED tests**

Create `check-design-contrast.ts` to parse `tokens.css`, convert sRGB values to
relative luminance and calculate `(lighter + 0.05) / (darker + 0.05)`. It
exports:

```ts
export type ContrastPair = {
  foreground: string;
  background: string;
  kind: 'normal-text' | 'large-text' | 'non-text';
  minimum: 3 | 4.5;
};

export type ContrastResult = ContrastPair & {
  foregroundValue: string;
  backgroundValue: string;
  ratio: number;
  pass: boolean;
};

export function calculateContrastTable(
  tokens: ReadonlyMap<string, string>,
  pairs: readonly ContrastPair[],
): readonly ContrastResult[];
```

The required pair manifest is exhaustive for every semantic text/background
and meaningful non-text use:

```ts
export const contrastPairs = [
  {foreground: '--color-text', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text', background: '--color-canvas',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text-muted', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text-muted', background: '--color-canvas',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text-subtle', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text-subtle', background: '--color-canvas',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-brand', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-surface', background: '--color-brand',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-surface', background: '--color-brand-hover',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-surface', background: '--color-brand-pressed',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-selected-text', background: '--color-brand-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-info', background: '--color-info-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-success', background: '--color-success-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-warning', background: '--color-warning-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-danger', background: '--color-danger-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-surface', background: '--color-danger',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-conflict-text', background: '--color-danger-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-own-text', background: '--color-own-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-other-text', background: '--color-info-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-current', background: '--color-current-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-disabled-text', background: '--color-disabled-bg',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-border-control', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-border-strong', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-brand', background: '--color-brand-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-info', background: '--color-info-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-success', background: '--color-success-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-warning', background: '--color-warning-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-danger', background: '--color-danger-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-conflict-text', background: '--color-danger-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-own-border', background: '--color-own-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-other-border', background: '--color-info-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-current', background: '--color-current-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-focus', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-focus-outer', background: '--color-focus',
    kind: 'non-text', minimum: 3},
] as const satisfies readonly ContrastPair[];
```

`--color-surface-subtle` and `--color-border-subtle` are explicitly reported
as decorative-only exclusions; disabled control boundaries are exempt from
WCAG non-text contrast but their text/background pair remains measured. The
script fails on a missing token, missing pair, ratio below threshold or
non-hex token value and supports `--format markdown` for evidence.

Add:

```json
"check:contrast": "tsx scripts/check-design-contrast.ts"
```

Extend `design-token-contract.test.ts` to require the complete manifest order;
all thirteen literal categories (`color`, `spacing`, `dimension`,
`grid-track`, `flex-basis`, `border`, `font-size`, `line-height`,
`letter-spacing`, `radius`, `shadow`, `transform-length`, `duration`); the
closed zero, structural percentage/viewport/container-unit, grid count/track,
unitless `line-height: 1`, centering-transform and focus-geometry allowlist;
only the two raw `2px` focus declarations; and zero violations from
`npm run check:design-tokens -- --include-legacy`.

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/design-token-contract.test.ts tests/unit/design-contrast.test.ts
```

Expected: RED until the contrast script/reporting and final manifest/token
rules exist.

- [ ] **Step 3: Add accessibility and geometry gates**

`accessibility.spec.ts` checks keyboard order, skip/main entry, visible focus,
dialog containment, inert background, deterministic restoration, 44px targets,
no color-only labels, live-region priority and no unexpected focus movement.

`geometry.spec.ts` checks 7/3/2/1-day modes, six-hour visibility, expanded
internal schedule scroll, long title at 96.85px day width, safe-area clearance,
320px long room/full IANA `top <=296px`, no overlap and no horizontal overflow.
The automated `reflow` project is explicitly `320x800` at Chrome 100% zoom.
It is not evidence for browser zoom. Actual Chrome 200% starts from a physical
`1440x900` window and is a separate mandatory manual gate in Step 6; the
normal-zoom 296px budget applies only to the 320x800 100% fixture.

Use `page.emulateMedia({reducedMotion: 'reduce', forcedColors: 'active'})` to
assert computed system-color borders, 2px focus outline and zero-duration/no
translate animation. Automated checks supplement, but do not replace, the
mandatory NVDA, actual zoom and Windows High Contrast walkthroughs.

- [ ] **Step 4: Finish loading/error/empty CSS and remove only proven legacy**

Add consistent skeleton, busy overlay, alert/retry and empty-state treatment to
the already-owning CSS file from the manifest table. This task may add only
cross-surface state and accessibility rules; it must not move shell, auth,
schedule, timetable, agenda, booking, notification or history selectors that
an earlier task owned. Add:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: var(--motion-none) !important;
    animation-duration: var(--motion-none) !important;
  }
}

@media (forced-colors: active) {
  :where(button, input, select, a):focus-visible {
    outline-color: Highlight;
    outline-style: solid;
    outline-width: 2px;
    outline-offset: 2px;
  }
}
```

Audit `globals.css` after the Task 2-10 migrations. It may contain only the
Tailwind entry and selectors for a demonstrably surviving utility-based
surface. If `rg` finds no utility classes, remove Tailwind and leave
`globals.css` empty; keep its first manifest import stable. Any owner selector
still present is a blocking finding returned to its owning task, not migrated
here. Run `npm run check:design-tokens -- --include-legacy` to enforce zero
governed literals across both manifest-owned sheets and the remaining legacy
file.

- [ ] **Step 5: Run the complete local command suite**

Run:

```powershell
npm ci
npm run db:generate
npm run check:source
npm run check:design-tokens -- --include-legacy
npm run check:contrast
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
docker compose --env-file .env.example config --quiet
```

Generate the auditable contrast table without changing its pass/fail
calculation:

```powershell
npx tsx scripts/check-design-contrast.ts --format markdown | Tee-Object test-results/token-contrast.md
```

Then, with a pre-validated isolated `TEST_DATABASE_URL`:

```powershell
npm run test:integration
npm run test:e2e
```

Expected: every command exits zero. Record `npm ci` and the immediately
following `db:generate` as separate rows, exact test totals, contrast ratios,
duration and any non-blocking warning in
`docs/design/06-implementation-evidence.md`.

- [ ] **Step 6: Perform the deterministic visual and accessibility walkthrough**

Start the built application against the isolated test database and perform
these separate blocking gates:

1. **Responsive 100% visual gate:** inspect `1440x900`, `1024x768`,
   `768x1024`, `390x844`, `360x800` and `320x800` at Chrome 100%. For every
   viewport, capture the settled schedule and the default 30-minute
   booking-open state using the twelve exact filenames in Files.
2. **Actual browser zoom gate:** reset the OS/browser window to `1440x900`,
   set Chrome page zoom to actual 200% through Chrome UI, reload, and verify
   auth, schedule, booking sheet/pane, cancellation and My Bookings have no
   clipped text, incoherent overlap or unreachable control. Record physical
   window, Chrome zoom indicator and pass/fail. Do not reuse the 320x800
   screenshot as zoom evidence.
3. **320px reflow gate:** return Chrome to 100%, set viewport `320x800`, use
   the long-room + `America/Argentina/Buenos_Aires` fixture, and verify full
   IANA text, `agenda-first-body-item.top <=296px`, no horizontal overflow and
   a reachable full-screen booking sheet.
4. **NVDA + Chrome gate (mandatory):** with NVDA browse/table navigation,
   verify the timetable caption, day column headers and office row headers are
   announced for occupied and free cells; same-zone and date-crossing slot
   names include room/date/time/timezone; booking details and Cancel have
   distinct names; booking/cancellation/notification dialogs announce role,
   name and focus; conflict, refreshed-end, success and notification live
   regions announce once at the specified priority. Record NVDA/Chrome
   versions, exact scenario, spoken result summary and pass/fail. A failure is
   release-blocking.
5. **Keyboard gate:** complete auth, room filter, jump controls, default
   booking, booking-to-cancellation handoff, notifications and My Bookings
   without pointer input; record deterministic focus restoration.
6. **Contrast/forced-color gate:** attach
   `test-results/token-contrast.md` containing every required calculated pair,
   then inspect all six viewport/state categories with Chrome forced colors
   and Windows High Contrast. Verify boundaries, focus, own/other/current/
   selected/conflict/invalid states and modal backdrop remain visible without
   shadows or color alone.
7. **Reduced-motion gate:** verify sheets, toasts, current state and spinner
   remain understandable with animation disabled and no smooth auto-scroll.
8. **VoiceOver spot check (optional):** run only when macOS hardware is
   available; record `not available` without weakening the mandatory NVDA
   result.

After the twelve primary captures pass, capture the four additional named
auth, My Bookings, conflict and notification images. The report links each
image to the matching baseline where one exists and records viewport, zoom,
timezone, seed, state and assertion source. Screenshots remain evidence, not
the sole test.

- [ ] **Step 7: Verify impact mapping, stale locators and final source ownership**

Run:

```powershell
npx vitest run --config vitest.config.ts tests/unit/design-token-contract.test.ts tests/unit/design-contrast.test.ts tests/unit/e2e-projects.test.ts tests/unit/impact-map.test.ts tests/unit/source-hygiene.test.ts tests/unit/playwright-agent-contract.test.ts
npm run check:design-tokens -- --include-legacy
npm run check:contrast
rg -n "WeekGrid|DaySchedule|BookingDialog|CancelBookingDialog|role=\"grid\"|Meeting Room Booking|Schedule|My Bookings|Book |Cancel booking|Upcoming|Completed" src tests e2e
rg -n "^@import" src/app/styles/manifest.css
git diff --check
git status --short
```

Expected: impact/source tests PASS; search results contain no deleted component
imports, partial grid semantics or user-visible legacy English. Machine-level
English in API tests remains allowed and is documented in the evidence report.
Manifest output has exactly twelve imports in the Global Style Manifest order;
`globals.css` has no selector family assigned to Tasks 2-10.

- [ ] **Step 8: Commit only final hardening and evidence paths**

```powershell
git add scripts/check-design-contrast.ts package.json test-config/playwright-configs.ts e2e/fixtures.ts e2e/impact-map.ts e2e/schedule.spec.ts e2e/mobile.spec.ts e2e/locale.spec.ts e2e/timezone.spec.ts e2e/transition.spec.ts e2e/accessibility.spec.ts e2e/geometry.spec.ts e2e/exploratory/schedule-visual.spec.ts e2e/exploratory/mobile-booking.spec.ts tests/unit/design-token-contract.test.ts tests/unit/design-contrast.test.ts tests/unit/e2e-projects.test.ts tests/unit/impact-map.test.ts tests/unit/source-hygiene.test.ts src/app/styles/manifest.css src/app/styles/base.css src/app/styles/ui.css src/app/styles/shell.css src/app/styles/schedule-layout.css src/app/styles/timetable.css src/app/styles/agenda.css src/app/styles/booking-surface.css src/app/styles/notifications.css src/app/styles/my-bookings.css src/app/styles/auth.css src/app/globals.css docs/design/06-implementation-evidence.md docs/design/evidence/final/schedule-settled-expanded-1440x900.png docs/design/evidence/final/booking-open-expanded-1440x900.png docs/design/evidence/final/schedule-settled-medium-1024x768.png docs/design/evidence/final/booking-open-medium-1024x768.png docs/design/evidence/final/schedule-settled-tablet-768x1024.png docs/design/evidence/final/booking-open-tablet-768x1024.png docs/design/evidence/final/schedule-settled-mobile-lg-390x844.png docs/design/evidence/final/booking-open-mobile-lg-390x844.png docs/design/evidence/final/schedule-settled-mobile-360x800.png docs/design/evidence/final/booking-open-mobile-360x800.png docs/design/evidence/final/schedule-settled-reflow-320x800.png docs/design/evidence/final/booking-open-reflow-320x800.png docs/design/evidence/final/auth-login-expanded-1440x900.png docs/design/evidence/final/my-bookings-mobile-lg-390x844.png docs/design/evidence/final/state-conflict-expanded-1440x900.png docs/design/evidence/final/state-notifications-mobile-lg-390x844.png
git commit -m "test: harden Roomwork redesign across viewports"
```

---

## Task Execution Protocol

For every task:

1. Dispatch one fresh implementer with only the task text, approved spec and
   current branch state.
2. Require the implementer to run the stated RED command before production
   edits and report the observed failure.
3. Require the implementer to run focused GREEN commands, inspect
   `git diff --check`, stage only task paths and commit.
4. Dispatch a fresh requirements reviewer. Any missing required behavior,
   altered contract or unrelated diff is blocking.
5. Return blocking requirements findings to the same implementer, then run a
   scoped re-review.
6. Dispatch a fresh code-quality reviewer after requirements pass. Bugs,
   accessibility regressions, race hazards, brittle tests and dead code are
   blocking.
7. Return blocking quality findings to the same implementer, rerun focused
   verification and request scoped re-review.
8. Start the next implementer only after both task-scoped gates pass.

After Task 11 passes its scoped reviews, the controller dispatches one broad
independent review over the complete branch. Blocking findings enter a
fix/re-review loop with focused and then full verification. The broad review is
not delegated to Task 11's implementer.

## Planner Self-Review

- Spec coverage: Tasks 1-11 cover AC-001 through AC-049, including localization,
  URL/API preservation, full-week validation, 7/3/2 table, one-day agenda,
  booking/conflict/cancellation ownership, presentation serialization,
  notifications, My Bookings, auth/verify, all states, WCAG, reflow and evidence.
- Backend scope: no route, domain service, Prisma schema or migration is planned
  for modification; existing integration suites are explicit gates.
- CSS ownership: `manifest.css` is the sole import owner with twelve ordered
  imports. Tasks 2, 3, 5, 6, 7, 9 and 10 import their sheet and remove its
  migrated legacy selectors after replacement tests in the same task; Task 8
  moves dialog/cancellation selectors between existing owners. Task 11 audits
  rather than performs those migrations.
- Token contract: Global Constraints, Task 1 parser fixtures and Task 11's
  zero-legacy gate govern the same thirteen literal categories and the same
  closed structural/focus allowlist.
- Type consistency: `ResponsiveMode`, schedule data, projection results,
  `BookingRefreshOkEvent` without `ScheduleData`, modal owner and notification
  events have one definition and matching consumers; the conflict effect
  commits schedule before reducer options.
- Test migration: every existing file named in spec section 27.2.1 is assigned
  to a task; Task 6 establishes exact responsive project matches and Tasks 7,
  8, 9 and 10 prove project/file selection before running scoped E2E.
- Evidence/accessibility: Task 11 names twelve required schedule/booking
  viewport captures plus four additional states, separates 1440x900 Chrome
  200% from 320x800 100%, and makes NVDA, calculated contrast and Windows High
  Contrast blocking gates.
- Execution safety: implementers are sequential, commits are path-scoped, test
  DB commands retain the existing fail-fast preflight, and no destructive
  database reset is prescribed.
- Remaining planning gaps: none.
