# Roomwork: специфікація редизайну

- **Статус:** Revised for critic cycle 2
- **Дата:** 2026-07-29
- **Продукт:** Roomwork
- **Пояснення бренду:** Бронювання переговорних
- **Мова інтерфейсу:** українська (`uk-UA`)
- **Документ:** `<html lang="uk">`
- **Формат часу:** 24-годинний
- **Обсяг:** дизайн і frontend-архітектура без production code, нових API,
  моделей даних або backend-функцій.

## 1. Autonomous coordinator approval

Користувач заздалегідь уповноважив автономного координатора:

- самостійно обрати дизайн-напрям;
- продовжувати без проміжного підтвердження;
- приймати адаптивні, візуальні, семантичні та компонентні рішення;
- виправляти знайдені під час self-review недоліки;
- зупинятися лише через відсутній обов'язковий артефакт, небезпечну дію,
  необхідність змінити бізнес-вимоги або реальний блокер.

Цей дозвіл пояснює відсутність проміжного approval gate. Він не робить
специфікацію затвердженою: поточний статус документа -
**Revised for critic cycle 2**, а не Approved.

## 2. Джерела і пріоритет рішень

Специфікація синтезує:

1. `spec-uk.pdf` як первинний контракт продукту.
2. `docs/design/01-current-state-audit.md` як перевірений опис реалізованої
   поведінки, UI-станів і регресійних ризиків.
3. `docs/design/research/official-guidance.md` як основу для адаптивної моделі,
   WCAG 2.2 AA та рішення щодо семантики розкладу.
4. `README.md`, поточні UI-модулі, unit, integration та E2E тести як фактичні
   технічні контракти.
5. Наданий brief як обмеження редизайну й автономного процесу.

Вбудована в PDF службова примітка про `tg-spec-gen-2-uk` не є продуктовою
вимогою. `package.json` через неї не змінюється. API routes, error codes,
query parameter names, technical IDs та формат payload лишаються незмінними.

## 3. Обраний дизайн-напрям

### 3.1 Рішення

Напрям - **calm productivity**: світла нейтральна основа, глибокий бірюзовий
brand accent, сині інформаційні та зелені success/ownership стани, помаранчевий
поточний час, мінімальне elevation і висока щільність без дрібного тексту.

Основний розклад:

- expanded desktop: семиденна нативна таблиця;
- medium: триденна нативна таблиця;
- tablet portrait: дводенна нативна таблиця з date strip;
- mobile і 200% zoom compact mode: одноденний хронологічний agenda list.

Expanded layout використовує три області: supporting room pane, центральний
timetable і contextual booking pane. Medium лишає timetable видимим, але
показує одночасно або room pane, або booking pane. Tablet і mobile відкривають
booking flow як modal sheet.

### 3.2 Відхилені альтернативи

| Варіант | Причина відхилення |
| --- | --- |
| Стиснути сім днів на всіх ширинах | На `768`, `390` і при 200% zoom текст та hit targets стають непридатними; порушується reflow. |
| Повний `role="grid"` з roving focus | Потребує окремої spreadsheet-подібної keyboard-моделі, яку продукт не вимагає; збільшує ризик і не покращує mobile agenda. |
| Універсальний modal dialog на всіх ширинах | На desktop закриває контекст календаря й додає зайві focus transitions. |
| Card-first dashboard | Послаблює основний JTBD, створює зайві вкладені поверхні та відсуває розклад нижче першого viewport. |

## 4. Product goals

1. Дати користувачу змогу знайти кімнату й доступний час без прокручування
   службового chrome перед розкладом.
2. Скоротити основний flow до: вибір кімнати, вибір вільного старту, назва й
   тривалість, підтвердження.
3. Зробити доступність слота очевидною до hover і однаково зрозумілою для
   mouse, keyboard та touch.
4. Зберегти повний контекст розкладу під час desktop booking flow.
5. Забезпечити окремі, а не випадково стиснуті, desktop, medium, tablet і mobile
   режими.
6. Уніфікувати бренд, мову, типографіку, кольори, control states і feedback на
   всіх маршрутах.
7. Досягти WCAG 2.2 AA як release gate, включно з `320px`, actual 200% zoom,
   forced colors, focus not obscured і product target `44x44 CSS px`.
8. Зберегти всі поточні бізнес-правила, API-контракти, URL restoration,
   timezone/DST, race protection, pagination і notification delivery.

### 4.1 Вимірювані UX-цілі

Метрики вимірюються через `getBoundingClientRect().top` від верхнього краю
CSS viewport після завершення first load, без відкритого modal, toast або
transient error banner. `schedule-scrollport` означає верх рамки scrollport;
`schedule-body-first-row` - верх першої body row після sticky header.

- `1440x900`: `schedule-scrollport.top <= 152px`;
  `schedule-body-first-row.top <= 208px`.
- `1024x768`: `schedule-scrollport.top <= 152px`;
  `schedule-body-first-row.top <= 208px`.
- `768x1024`: `schedule-scrollport.top <= 216px`;
  `schedule-body-first-row.top <= 272px`.
- `390x844`, `360x800`, `320x800`:
  `agenda-first-body-item.top <= 288px`, що виконує brief gate `<=300px`.
- На `1440x900` між `schedule-body-first-row.top` і нижнім краєм scrollport
  повністю видно 12 body rows по `52px`, тобто 6 робочих годин. Sticky table
  header не входить у ці 12 rows.
- Базовий 30-хвилинний booking flow після вибору room і за умови, що target
  date/time вже у видимому range, має рівно три product actions: активувати
  start slot, ввести title, активувати `Забронювати`. Focus movement, Tab і
  text keystrokes усередині одного field не рахуються окремими product actions.
  Зміна date або duration є однією додатковою optional action кожна.
- Жодна основна дія не залежить від hover, swipe, drag-and-drop або кольору.

## 5. Non-goals

Редизайн не додає:

- recurring bookings;
- редагування, перенесення або reschedule;
- drag-and-drop;
- native iOS/Android застосунки;
- нові backend routes, fields, status values або notification channels;
- email resend, MFA, password reset або user profile;
- room administration;
- нову аналітику;
- FullCalendar або інший готовий календар;
- важку UI-бібліотеку;
- runtime font download;
- dark mode;
- декоративні hero, gradients, glassmorphism, blobs або nested cards.

## 6. Незмінні бізнес-контракти

| Контракт | Вимога редизайну |
| --- | --- |
| Реєстрація | Ім'я непорожнє; email trim + case-insensitive unique; пароль 8-72; server validation. |
| Сесія | Зберігається після reload; signed-out route redirect не змінюється. |
| Verification | Після реєстрації сесія існує, але бронювання до verification повертає `EMAIL_NOT_VERIFIED`. |
| Кімнати | Шість seeded rooms; назва, поверх, місткість; фільтр minimum capacity. |
| Офіс | `OFFICE_TIMEZONE`, `OFFICE_OPEN_HOUR`, `OFFICE_CLOSE_HOUR` лишаються env-configurable; default `Europe/Kyiv`, `09:00-19:00`. |
| Відображення часу | Дані зберігаються в UTC; UI показує user browser timezone; різницю з office timezone пояснено видимим текстом. |
| Розклад | 30-хвилинні слоти; поточний день і час; week/day navigation; `Today`; зайняті слоти видимі всім. |
| Створення | Title після trim має 1-100 символів; start/end кратні 30 хв; duration 30-240 хв; лише майбутнє й office hours. |
| Перетин | Half-open `[startsAt, endsAt)`; adjacency дозволена; server overlap і room-lock race protection не змінюються. |
| Conflict | `BOOKING_CONFLICT`; draft не очищається; timetable оновлюється; користувач повторно обирає тільки те, що стало невалідним. |
| Скасування | Лише власне майбутнє бронювання; confirmation; API ownership gate лишається. |
| My Bookings | Future: nearest first. Past: latest first. Незалежні сторінки по 20, load more, deep link до room/week/day/bookingId. |
| URL | `roomId`, `weekStart`, `day`, `bookingId` зберігають поточні назви й back/forward behavior. |
| Notifications | Immediate + 60-second visible-page polling, acknowledgement, lease та client ID deduplication не змінюються. |
| Error contract | Error codes, HTTP status і payload fields не перекладаються та не перейменовуються. UI локалізує лише видимий текст. |

## 7. Jobs to be done

### JTBD-1: знайти вільну кімнату

Коли мені потрібна переговорна на конкретний час, я хочу швидко порівняти
доступність кімнати за місткістю й датою, щоб забронювати відповідний слот без
перебору форм.

**Успіх:** кімната, date range, timezone і вільні/зайняті інтервали видимі в
одному робочому контексті.

### JTBD-2: створити бронювання

Коли я бачу вільний старт, я хочу одразу задати назву й тривалість до 4 годин,
щоб завершити бронювання без повторного введення кімнати, дати чи часу.

**Успіх:** room/date/start prefilled; end options обмежені наступним booking,
office close і 4 годинами.

### JTBD-3: відновитися після конфлікту

Коли інший користувач випередив мене, я хочу побачити оновлений розклад і
зберегти введену назву, щоб обрати інший валідний час без початку flow заново.

**Успіх:** `BOOKING_CONFLICT` видимий; title і start збережені; end збережений,
якщо ще валідний, інакше контрольовано замінений на перший валідний варіант з
оголошенням зміни.

### JTBD-4: керувати власними бронюваннями

Коли мої плани змінюються, я хочу знайти найближче бронювання, перейти до його
контексту або скасувати його з підтвердженням.

**Успіх:** найближче бронювання перше й візуально пріоритетне; row link і
Cancel є окремими sibling controls.

### JTBD-5: не пропустити handoff

Коли моє бронювання завершується перед наступним, я хочу отримати одне
ненав'язливе повідомлення, щоб вчасно звільнити кімнату.

**Успіх:** bell count, читабельний текст, dismiss; polling не відбирає focus і
не перекриває booking actions.

## 8. Бренд, локаль і контент

### 8.1 Єдина назва

- Primary brand: `Roomwork`.
- Descriptor: `Бронювання переговорних`.
- Browser title: `Roomwork - Бронювання переговорних`.
- Metadata description: `Бронюйте переговорні та керуйте своїм розкладом.`
- Auth, verify, app shell і page headings використовують той самий бренд.
- `Meeting Room Booking` не лишається у видимому UI.

### 8.2 Локалізація

- `APP_LOCALE` стає `uk-UA`.
- `<html lang="uk">`.
- Week starts Monday.
- Date examples: `ср, 29 лип.`, `29 липня 2026`.
- Time: `09:00-10:30`, без AM/PM.
- User-generated room names, booking titles та author names не перекладаються.
- API/error codes і technical IDs не виводяться як основний текст, але
  лишаються доступними для логів, тестів і branch logic.

### 8.3 Основна UI copy

| English surface | Українська copy |
| --- | --- |
| Schedule | Розклад |
| My Bookings | Мої бронювання |
| Today | Сьогодні |
| Room | Переговорна |
| Minimum capacity | Мінімальна місткість |
| Any | Будь-яка |
| Book / Create booking | Забронювати |
| Booking details | Деталі бронювання |
| Title | Назва |
| End time | Час завершення |
| Cancel | Закрити |
| Cancel booking | Скасувати бронювання |
| Keep booking | Залишити бронювання |
| Upcoming bookings | Майбутні |
| Past bookings | Минулі |
| Load more | Показати ще |
| Yours | Ваше |
| Occupied | Зайнято |
| Available | Вільно |
| Log out | Вийти |
| Notifications | Сповіщення |

### 8.4 UI mapping для незмінних error codes

Frontend оголошує exhaustive map:

```ts
type UiErrorCode =
  | DomainErrorCode
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_TRANSPORT';

const uiErrorDescriptors = {
  // every key below
} satisfies Record<UiErrorCode, UiErrorDescriptor>;
```

Build/typecheck падає, якщо `DomainErrorCode` розширено без UI decision.

| Code | Видиме повідомлення |
| --- | --- |
| `AUTH_REQUIRED` | Сесію завершено. Увійдіть знову, щоб продовжити. |
| `EMAIL_TAKEN` | Обліковий запис із цим email уже існує. |
| `EMAIL_NOT_VERIFIED` | Підтвердьте email, щоб бронювати переговорні. |
| `FORBIDDEN_ORIGIN` | Запит відхилено з міркувань безпеки. Оновіть сторінку й повторіть дію. |
| `INVALID_CREDENTIALS` | Неправильний email або пароль. |
| `PAYLOAD_TOO_LARGE` | Надіслані дані завеликі. Скоротіть введений текст. |
| `RATE_LIMITED` | Забагато спроб. Зачекайте й повторіть. |
| `VALIDATION_FAILED` | Перевірте введені дані. |
| `ROOM_NOT_FOUND` | Переговорну не знайдено. Оновіть список і виберіть іншу. |
| `BOOKING_IN_PAST` | Не можна забронювати час у минулому. |
| `BOOKING_OUTSIDE_OFFICE_HOURS` | Оберіть час у межах робочих годин офісу. |
| `BOOKING_CONFLICT` | Цей час уже зайнято. Ми оновили розклад; оберіть доступний варіант. |
| `BOOKING_FORBIDDEN` | Можна скасувати лише власне бронювання. |
| `BOOKING_NOT_FOUND` | Бронювання не знайдено або вже скасовано. |
| `SERVICE_UNAVAILABLE` | Сервіс тимчасово недоступний. Спробуйте ще раз. |
| `VERIFICATION_INVALID_OR_EXPIRED` | Посилання недійсне, прострочене або вже використане. |
| `INTERNAL_ERROR` | Сталася внутрішня помилка. Спробуйте ще раз. |
| `UNKNOWN_TRANSPORT` | Не вдалося зв'язатися із сервісом. Перевірте з'єднання й повторіть. |

`AUTH_REQUIRED` на authenticated client request не показує stale page error:

1. Capture `pathname + search` до `returnTo`.
2. Reject control characters, backslash, scheme/host, leading `//` and hash;
   parse against the current origin, require same origin and pathname exactly
   `/schedule` або `/my-bookings`. Preserve its query string only. Decode/
   re-encode once; decoded pathname must still equal the allowlist member.
3. Abort protected page requests, прибрати stale booking actions і перейти на
   `/login?returnTo={encodeURIComponent(safePath)}`.
4. Після login redirect only to validated internal `returnTo`; invalid value
   -> `/schedule`.

Initial signed-out navigation формує той самий safe `returnTo`. API code,
status і payload не змінюються. `FORBIDDEN_ORIGIN` ніколи не redirect-ить і не
повторює mutation автоматично; показує assertive localized alert.

Return tests allow `/schedule`, `/schedule?roomId=r1&day=2026-07-29` and
`/my-bookings?scope=future`; reject `/schedule-evil`, `/my-bookings/other`,
`//host/x`, `https://host/x`, `\schedule`, encoded slash/backslash, control
characters and malformed percent encoding. Every rejected value falls back to
`/schedule`.

### 8.5 Field-key localization

UI ніколи не порівнює й не показує English `error.message` або
`error.fields[key]`. Code визначає branch, а stable field key визначає
localized field copy.

| Actual field key | Localized field message |
| --- | --- |
| `name` | Введіть ім'я до 100 символів. |
| `email` | Введіть коректний email до 254 символів. |
| `password` | Пароль має містити від 8 до 72 символів. |
| `token` | Посилання підтвердження недійсне. |
| `title` | Назва має містити від 1 до 100 символів. |
| `roomId` | Виберіть переговорну. |
| `startsAt` | Перевірте дату й час початку. |
| `endsAt` | Перевірте час завершення та тривалість до 4 годин. |
| `bookingId` | Не вдалося визначити бронювання. |
| `userId` | Сесію користувача не підтверджено. |
| `cancelledAt` | Не вдалося визначити час скасування. |
| `scope` | Виберіть коректний розділ бронювань. |
| `cursor` | Не вдалося продовжити список. Оновіть сторінку. |
| `limit` | Не вдалося визначити розмір сторінки. |
| `now` | Не вдалося перевірити поточний час. |
| `minCapacity` | Місткість має бути цілим невід'ємним числом. |
| `weekStart` | Початок тижня має бути датою понеділка. |
| `officeTimeZone` | Часовий пояс офісу має бути коректним IANA timezone. |
| `body` | Перевірте формат надісланих даних. |

Unknown field key переходить у form-level `Перевірте введені дані` і
телеметричний technical log без raw value у UI.

### 8.6 Ukrainian formatters і pluralization

Єдиний pure formatter module володіє:

- `formatDateLong`: `середа, 29 липня 2026 р.`;
- `formatDateShort`: `ср, 29 лип.`;
- `formatTime`: `09:00`;
- `formatTimeRange`: `09:00-10:30`;
- `formatAccessibleSlot`: full date, time, timezone, room;
- `formatDuration`: `30 хвилин`, `1 година`, `1 година 30 хвилин`,
  `2 години`, `4 години`.

`Intl.DateTimeFormat('uk-UA', {hourCycle:'h23'})` і
`Intl.PluralRules('uk-UA')` є normative. Forms:

- hour: `година` for `one`, `години` for `few`, `годин` for `many/other`;
- minute: `хвилина`, `хвилини`, `хвилин` за тими самими categories.

Tests покривають `1,2,4,5,21` для обох units, 30-minute increments до 4 годин,
Monday week start, browser locale `fr-FR` при app locale `uk-UA`, DST і
date-crossing accessible names.

## 9. Інформаційна архітектура

```text
Public
|- / -> /login або /schedule
|- /login
|- /register
`- /verify?token=...

Authenticated app shell
|- /schedule?roomId&weekStart&day&bookingId
|  |- Room discovery
|  |- Date navigation
|  |- Timetable / multi-day timetable / day agenda
|  |- Booking composer
|  `- Cancellation confirmation
|- /my-bookings
|  |- Next booking
|  |- Future groups
|  |- Past groups
|  `- Cancellation confirmation
`- Global notification center
```

Primary navigation має рівно два destinations: `Розклад` і `Мої бронювання`.
Bell, account name і `Вийти` є utilities, не navigation destinations.

## 10. Повний screen inventory

| ID | Route/surface | Access | Primary task | Обов'язкові стани |
| --- | --- | --- | --- | --- |
| S01 | `/` redirect | Public | Визначити destination за session | auth resolving, redirect login, redirect schedule |
| S02 | `/login` | Signed out | Увійти | idle, field focus, pending, invalid credentials, rate limited, network/server error |
| S03 | `/register` | Signed out | Створити account | idle, per-field validation, form error, pending, success redirect |
| S04 | `/verify` | Public/session-independent | Підтвердити email | pending, success, expired/consumed, missing token, unavailable |
| S05 | `/schedule` expanded | Authenticated | Знайти й забронювати | rooms loading/empty/error, schedule loading/empty/error/data, selected slot, conflict, success |
| S06 | `/schedule` medium | Authenticated | 3-day booking | room pane, filter mode, booking pane, same data states |
| S07 | `/schedule` tablet | Authenticated | 2-day booking | date strip, filter sheet, booking side sheet, same data states |
| S08 | `/schedule` mobile | Authenticated | Day agenda booking | compact header, date strip, filter sheet, agenda, booking bottom/full sheet |
| S09 | Contextual booking pane | Expanded/medium | Створити booking без втрати timetable | empty instruction, draft, no end times, validation, pending, conflict refresh, refresh error |
| S10 | Booking modal sheet | Tablet/mobile | Створити booking | ті самі form states; inert background; scroll/keyboard-safe |
| S11 | Cancellation dialog | All | Підтвердити destructive action | idle, pending, error, success/close |
| S12 | `/my-bookings` | Authenticated | Огляд і керування | independent future/past loading, empty, error, data, load more, cancellation |
| S13 | Notification center popover | Expanded/medium/tablet | Переглянути й dismiss | zero, unread, expanded, collapsed, multiple, polling silent failure |
| S14 | Notification sheet | Mobile | Переглянути й dismiss | ті самі notification states; modal focus contract |
| S15 | Success toast/status region | Authenticated | Підтвердити завершення дії | created, cancelled; timed dismissal; focus not moved |
| S16 | Global shell error | Authenticated | Показати logout або page failure | visible alert, retry where request supports retry |

## 11. Adaptive layout contract

Breakpoints визначаються шириною content viewport, а не device detection.
Resize не втрачає room, week, day, selected booking, booking draft або scroll
anchor.

| Mode | Width | Schedule form | Pane model |
| --- | ---: | --- | --- |
| Expanded | `>=1360px` | 7-day native table | `248px / minmax(0,1fr) / 320px`; room і booking panes non-modal |
| Medium | `900-1359px` | 3-day native table | Default `224px / minmax(0,1fr)`; on selection `minmax(0,1fr) / 320px`, room pane замінюється booking pane |
| Tablet | `600-899px` | 2-day native table, date strip | Single main pane; filters modal sheet; booking modal right sheet `min(384px,100vw)` |
| Mobile | `<600px` | 1-day agenda list | Single main pane; filter sheet; booking bottom sheet, full-screen при висоті `<720px` |

Для 3-day і 2-day modes `day` з URL є anchor. Window починається з anchor і
показує наступні 2 або 1 office dates. Якщо window вийшов би за Sunday, він
зсувається назад і закінчується Sunday. Anchor лишається selected date й має
`aria-current="date"`.

### 11.1 Expanded `1440x900`

- App header: `64px`, sticky top, one row.
- Workspace: `height: calc(100dvh - 64px)`, no page-level vertical scroll.
- Columns: room pane `248px`, timetable flexible with minimum `742px`,
  booking pane `320px`.
- Room і booking panes мають власний vertical scroll лише коли content не
  вміщується.
- Timetable toolbar + room summary: `72px`.
- Timetable header: `56px`, sticky inside schedule scrollport.
- Time gutter: `64px`, sticky left.
- Slot row: `52px`; 20 rows = `1040px`; vertical scroll відбувається тільки
  всередині timetable.
- Seven days fit without horizontal scroll at `1440px`.
- Vertical budget: header `64` + workspace top padding `8` + combined
  navigation/room/timezone row `72` + bottom gap `8` =
  `schedule-scrollport.top 152px`; sticky header `56` =
  `schedule-body-first-row.top 208px`. Available body height до `900px` -
  `692px`, тому `12 x 52 = 624px` повністю видимі.
- Contextual pane завжди займає 320px. Без selection він показує heading
  `Деталі бронювання`, room summary і status `Оберіть вільний час у розкладі`.

Full horizontal equation at `1440px`:

```text
central = viewport 1440
  - outer padding (16 * 2)
  - gaps (8 * 2)
  - dividers (1 * 2)
  - room pane 248
  - booking pane 320
  = 822px

day width = (central 822 - time gutter 64) / 7 = 108.28px
```

At the expanded lower bound `1360px`, central width is `742px`, and day width
is `(742 - 64) / 7 = 96.85px`. Section 13.7 defines the exact compact content
that fits this lower bound.

### 11.2 Medium `1024x768`

- Header: `64px`.
- Default columns: room pane `224px` + central 3-day timetable.
- Date strip містить сім дат і змінює 3-day window.
- Після slot selection room pane прибирається, з'являється non-modal booking
  pane `320px`; central timetable лишається видимим і не стає inert.
- Booking pane має `Назад до переговорних`, але close booking не змінює
  selected room/date.
- Верх timetable не нижче `176px`; page-level horizontal scroll відсутній.
- Table scrollport прокручується вертикально й не змушує прокручувати весь
  document.
- Vertical budget: header `64` + top padding `8` + combined
  navigation/summary `72` + gap `8` = `schedule-scrollport.top 152px`; sticky
  header `56` = `schedule-body-first-row.top 208px`.

Medium geometry uses outer padding `16px` per side, one `8px` gap and one
`1px` divider:

```text
1200 default: 1200 - 32 - 8 - 1 - room 224 = central 935px
1200 selected: 1200 - 32 - 8 - 1 - booking 320 = central 839px
1024 default: 1024 - 32 - 8 - 1 - room 224 = central 759px
1024 selected: 1024 - 32 - 8 - 1 - booking 320 = central 663px
900 default: 900 - 32 - 8 - 1 - room 224 = central 635px
900 selected: 900 - 32 - 8 - 1 - booking 320 = central 539px
```

At `900px` selected mode each day receives
`(539 - 64) / 3 = 158.33px`. Room pane і booking pane ніколи не показуються
одночасно у medium mode. Pane swap не змінює selected room, day, week,
booking draft або `visibleTimeAnchor`.

### 11.3 Tablet `768x1024`

- Compact top app bar: `56px`; brand, active destination, bell, account menu.
- Schedule header і controls мають фіксований budget нижче.
- Date strip: сім office dates у внутрішньому horizontal scrollport; selected
  date завжди brought into view без animated scroll при reduced motion.
- Одночасно видно selected day і наступний день. Якщо selected day - Sunday,
  показуються Saturday + Sunday, а selected day лишається URL anchor.
- Previous/next day та `Сьогодні` лишаються окремими кнопками; жодна дія не
  залежить від swipe.
- Room summary - одна `56px` control row; `Фільтри` відкриває modal sheet із
  room list і capacity.
- Vertical budget: app bar `56` + main top padding `8` + title/Today row `44`
  + date navigation `52` + combined room/filter/timezone row `48` + bottom gap
  `8` = `schedule-scrollport.top 216px`; sticky header `56` =
  `schedule-body-first-row.top 272px`.
- Booking відкривається як right modal sheet шириною `384px`, full height,
  з `aria-modal="true"` і inert background.
- Немає horizontal overflow document; table займає доступну ширину.

### 11.4 Mobile `390x844`, `360x800`, `320x800`

- Top app bar: `56px`; `Roomwork`, bell, account menu.
- Bottom navigation: `56px + env(safe-area-inset-bottom)`; два destinations.
- Main content має bottom padding, рівний nav + `16px`, щоб focus і остання
  agenda action не перекривалися.
- Title/Today row має `44px`: heading `Бронювання переговорних` `20px/28px`
  зліва, видима button `Сьогодні` `44px` справа.
- Date navigation row має `52px`: previous `44px`, internal date strip,
  next `44px`. Date buttons `56x52px`; при content width `288px`
  (`320 - 16 * 2`) видно три dates.
- Combined room/filter/timezone row має `48px`. Зліва room name + capacity;
  справа `Фільтри` `44px`. Якщо zones різні, second compact line у межах тих
  самих `48px` показує user zone та office zone.
- Agenda date heading має `24px`.
- Exact settled vertical budget:

```text
app bar                                      56
main top padding                              8
title + Today                                44
date navigation                              52
room/filter/timezone                         48
agenda date heading                          24
gaps: 8px after title, date, filter, heading 32
                                             ---
agenda-first-body-item.top                  264px
```

`264px <= 288px <= 300px`. Зарезервовані додаткові `24px` до acceptance limit
покривають 1px borders і font rounding; реалізація не може використати цей
reserve для нової control row.
- Agenda - не fixed-height timeline. Це chronological list із 30-хвилинними
  start rows. Busy bookings, що охоплюють кілька слотів, рендеряться один раз
  із повним range.
- Вільна row містить час і видиму text action `Забронювати`.
- Після зміни room/day один раз позиціонується найближчий future slot або
  поточний booking; user scroll після цього не перехоплюється.
- Booking - bottom sheet з max-height `min(88dvh, 720px)`. При viewport height
  нижче `720px`, відкритій keyboard або `320px` width це full-screen sheet.
- Page-level horizontal overflow заборонений. Horizontal overflow дозволено
  лише всередині date strip.

### 11.5 Reflow і 200% zoom

Actual 200% browser zoom має активувати той layout, який відповідає effective
CSS viewport. На `1440x900` при 200% effective width становить `720px`, тому
очікується tablet 2-day single-pane presentation, а не стиснута 7-day table.
Жоден breakpoint не залежить від device pixel ratio.

## 12. App shell

### 12.1 Expanded і medium header

Зліва направо:

1. Link `Roomwork`; descriptor `Бронювання переговорних` другим рядком тільки
   в expanded mode (`>=1360px`).
2. Primary nav: `Розклад`, `Мої бронювання`; active destination має
   `aria-current="page"`, icon і 2px bottom indicator.
3. Utilities: user name, notification bell, account menu.

`Вийти` переноситься в account menu, щоб header не розширювався через довге
ім'я. В expanded mode account button показує обрізане до 20 characters видиме
ім'я; у medium `900-1359px` показує initials. В обох режимах accessible name
містить повне ім'я.

### 12.2 Tablet header

Brand зліва; inline primary nav `Розклад` і `Мої бронювання` по центру; bell та
account menu справа. Labels не ховаються, active destination має
`aria-current="page"` і 2px indicator. Якщо user name не вміщується, account
button показує initials, але primary nav не переноситься й не переходить у
hamburger.

### 12.3 Mobile shell

Top bar лишає brand і utilities. Bottom nav містить icon + label для обох
destinations. Active state має icon fill/weight, text і top indicator, не лише
колір. Safe-area обов'язковий.

### 12.4 Shell focus order

Skip link `Перейти до основного вмісту` є першим focusable element. Далі brand,
primary nav, bell, account, main content. Bottom navigation іде після main у
DOM, але fixed visual placement не змінює reading order.

## 13. Schedule workspace

### 13.1 Supporting room pane

Компонент містить:

- heading `Переговорні`;
- capacity stepper/input із label `Мінімальна місткість`;
- `Скинути` тільки коли filter активний;
- room list із назвою, поверхом і місткістю;
- selected room з check icon, 2px leading border і `aria-current="true"`;
- loading skeleton rows;
- empty state `Немає переговорних з такою місткістю` + `Скинути фільтр`;
- error state `Не вдалося завантажити переговорні` + `Повторити`.

Room row - button minimum `52px`, не card. Зміна room:

- оновлює `roomId` у URL через push;
- очищає linked `bookingId`, slot selection і cancellation;
- зберігає active day/week;
- не показує stale booking controls для старої кімнати;
- abort/sequence guards і далі відкидають delayed response.

### 13.2 Schedule navigation

- Expanded: previous week icon, `Сьогодні`, next week icon, date range.
- Medium/tablet/mobile: previous day, date strip, next day, `Сьогодні`.
- Icon buttons мають tooltip і українське accessible name.
- Date strip button показує short weekday + day number; selected має
  `aria-current="date"`; today має visible dot і accessible suffix `сьогодні`.
- Окрема button `Сьогодні` має видимий text label у кожному mode.
- У 3-day/2-day mode активація date button робить цю date anchor за правилом
  section 11 і не виконує окремого fetch на кожну видиму column.
- URL source of truth: `weekStart` Monday у office timezone; `day` завжди
  належить відповідному week.

### 13.3 Room and timezone summary

Над timetable/agenda завжди видно:

- room name;
- floor;
- capacity;
- user timezone abbreviation.

Якщо user і office timezone не equivalent, показати:

`Час показано для {userTimeZone}. Робочі години офісу: 09:00-19:00
{officeTimeZone}.`

Текст не ховається у tooltip. На mobile він рендериться двома compact lines:
`Ваш час: {userTimeZone}` і `Офіс: 09:00-19:00 {officeTimeZone}`. Disclosure
для timezone notice не використовується.

`weekStart` і `day` описують office dates, бо server перевіряє office hours.
Усі actionable time labels, booking ranges і accessible names обчислюються з
UTC instant у `userTimeZone`. Коли zones equivalent, table має один спільний
visible time gutter. Коли zones різні:

- day header показує office date як context і user-local range, наприклад
  `Ср, 29 лип. офісу` та `08:00-18:00 Europe/Berlin`;
- кожна whole-hour row показує user-local time всередині відповідної day
  column, а спільний gutter не показує оманливий єдиний user time;
- DST conversion виконується окремо для кожного day/instant, тому clocks у
  різних columns можуть відрізнятися;
- mobile agenda heading називає office date, а кожний item показує повну
  user-local date і time, якщо user date відрізняється.

Це зберігає current per-day DST behavior і не змінює UTC payload.

### 13.4 Timetable semantics: остаточне рішення

Expanded, medium і tablet використовують нативний `<table>`, а не
`role="grid"`.

#### 13.4.1 Header і clock contract

```html
<table>
  <caption>Розклад переговорної ...</caption>
  <thead>
    <tr>
      <th id="clock-column" scope="col">...</th>
      <th id="day-2026-07-29" scope="col">...</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th id="office-slot-0" scope="row">...</th>
      <td headers="office-slot-0 day-2026-07-29">...</td>
    </tr>
  </tbody>
</table>
```

Коли `userTimeZone` equivalent до `officeTimeZone`:

- corner header: `Ваш час ({userTimeZone})`;
- кожний `th scope="row"` показує shared user clock `09:00`, `09:30`, ...;
- day header показує повну user-local date;
- cell не дублює visible clock, але accessible name включає date/time з
  відповідних headers.

Коли zones різні:

- corner header: `Офісний час ({officeTimeZone})`;
- кожний `th scope="row"` явно показує office clock + zone abbreviation,
  наприклад `09:00 EEST`;
- кожний day header має дві видимі lines: office date
  `Ср, 29 лип. (офіс)` і повний user-local range з датами та zone,
  `Вт, 28 лип., 23:00 - ср, 29 лип., 09:00 America/Los_Angeles`;
- кожна free/past cell показує visible user-local clock; якщо local date
  відрізняється від office date, cell також показує short local date;
- booking-start cell показує повний user-local date/time range;
- `headers` завжди посилається на office row header і day column header;
- accessible name не покладається тільки на header inference:
  `Вільно: ср, 29 липня 2026, 08:00 Europe/Berlin; офісний слот 09:00
  Europe/Kyiv; переговорна Oak`;
- booking accessible name так само містить full user-local start/end, office
  slot/date, title, author і `Ваше` або `Зайнято`.

UTC instant конвертується окремо для кожного day/slot. Заборонено отримувати
clocks додаванням одного fixed offset до всього week. DOM/accessibility tests
обов'язково покривають equivalent zones, US-only DST week, Kyiv-only DST week
і date-crossing zone.

Normative immutable timezone fixtures:

| ID | Office / user zone | Office slots and expected user-local clocks |
| --- | --- | --- |
| `TZ-EQUIVALENT` | `Europe/Kyiv` / `Europe/Kyiv` | `2026-07-29T06:00:00Z` = `29 лип., 09:00` in both; shared-clock branch |
| `TZ-US-ONLY` | `Europe/Kyiv` / `America/Los_Angeles` | office `2026-03-06 09:00` = `2026-03-06T07:00:00Z` = user `5 бер., 23:00 PST`; office `2026-03-09 09:00` = `2026-03-09T07:00:00Z` = user `9 бер., 00:00 PDT` |
| `TZ-KYIV-ONLY` | `Europe/Kyiv` / `America/Los_Angeles` | office `2026-03-27 09:00` = `2026-03-27T07:00:00Z` = user `27 бер., 00:00 PDT`; office `2026-03-30 09:00` = `2026-03-30T06:00:00Z` = user `29 бер., 23:00 PDT` |
| `TZ-DATE-CROSS` | `Europe/Kyiv` / `America/Los_Angeles` | office `2026-07-29 09:00` = `2026-07-29T06:00:00Z` = user `28 лип., 23:00 PDT`; both dates visible and in accessible name |

Tests assert these exact instants, dates, `09:00` office row labels and
IANA-zone full accessible names; abbreviations may follow platform `Intl`
output only where visible copy above explicitly shows an example.

#### 13.4.2 Normative `rowSpan` projection

Перед render pure projector виконує:

1. Створює matrix `20 x visibleDayCount`; indices `0..19` відповідають office
   starts `09:00..18:30`.
2. Конвертує кожне booking у office zone і перевіряє: valid instants,
   start/end в одному office day, 30-minute alignment, duration `1..8` slots,
   range усередині `09:00-19:00`, day є у visible range.
3. Сортує bookings за office day, start, ID.
4. Для booking зі start index `i` і span `n` вимагає, щоб matrix cells
   `i..i+n-1` цього day були empty. Cell `i` стає `booking-start`; наступні
   `n-1` - `booking-continuation` з тим самим booking ID.
5. Будь-який overlap, cross-day range, misalignment, out-of-bounds span або
   invalid instant переводить весь timetable у `schedule-data-error`. Table з
   потенційно зміщеними columns і booking actions не рендериться.
6. Для кожної body row renderer завжди емітить один `th scope="row"`. Для
   кожного visible day:
   - `booking-start` -> один `td rowSpan={n}` із booking trigger;
   - `booking-continuation` -> не емітить `td` лише для цього самого day;
   - empty -> один ordinary `td` із free, past або unavailable content.
   Cells інших days продовжують емітуватися в цій row.
7. Adjacent bookings мають окремі `booking-start` cells; жодна cell не
   пропускається між ними.

Нормативні invariants:

- кожний office slot/day coordinate покритий рівно один раз звичайним cell або
  booking span;
- output table має 20 body rows;
- `rowSpan === durationMinutes / 30`;
- actionable free cell містить рівно один native button;
- `td` не отримує `tabindex`; `th` не входить у Tab order. Єдиний виняток -
  transient `tabindex="-1"` на row header для unavailable jump fallback
  section 23.2; attribute прибирається on blur;
- caption завжди visually hidden і доступне screen reader;
- `role="grid"`, `gridcell`, custom arrow-key navigation відсутні;
- current-time line `aria-hidden="true"`; current row має visually hidden
  status `Поточний час {user-local time}`.

Tests: mixed-column simultaneous spans, adjacency, 30/60/240 minutes, malformed
overlap, misalignment, cross-day і out-of-hours data.

### 13.5 Mobile day agenda semantics

`projectDayAgenda` є pure function над `officeDay`, office hours, `now`,
validated non-overlapping bookings і load state.

```html
<section aria-labelledby="agenda-date">
  <h2 id="agenda-date">...</h2>
  <ol aria-label="Розклад на ...">
    <li><!-- free start або busy booking --></li>
  </ol>
</section>
```

Projection:

1. Створює 20 atomic office slots `09:00..18:30`.
2. Валідовує booking preconditions з section 13.4.2 для одного office day.
   Malformed data -> один `schedule-data-error`, без partial list або actions.
3. Ітерує slot indices `0..19`:
   - booking start -> один busy item із `spanSlots`, title, full user-local
     range, author, `Ваше|Зайнято`; continuation indices пропускаються;
   - uncovered start у минулому -> один past item із visible `Минув`;
   - uncovered future start -> один free item із visible
     `Забронювати`.
4. Set atomic coordinates, покритих free/past items і busy spans, дорівнює
   точно `{0..19}`; перетинів і пропусків немає.

Load behavior:

- first loading -> 20-row skeleton projection без actions;
- refresh із settled data -> old projection + busy status overlay;
- load error без data -> error state + Retry, без agenda rows/actions;
- zero bookings -> 20 free/past items відповідно до `now`;
- fully booked day -> busy items, spans яких сумарно покривають 20 slots.

`Зараз, {time}` є non-focusable separator перед item, який містить current
instant. Full user-local date показується в кожному item, якщо вона
відрізняється від office date.

#### 13.5.1 Deterministic auto-position

Controller increment `positionEpoch` тільки на initial settled load, explicit
room change, capacity filter, що змінив selected room, day change або initial
deep link. Background refresh, conflict refresh із тією самою selection,
notification poll і resize не increment epoch.

Для кожного epoch agenda виконує рівно один `scrollIntoView({block:"start",
behavior:"auto"})` до першої наявної цілі:

1. deep-linked `bookingId` на цьому day;
2. active selected start;
3. booking, де `startsAt <= now < endsAt`;
4. nearest future free start;
5. next future busy item;
6. office-open item index `0`;
7. agenda heading, якщо rows відсутні через error.

Auto-position не рухає keyboard focus. Після `positionedEpoch ===
positionEpoch` user scroll не скидається. Deep link на інший day спочатку
оновлює day/epoch, потім застосовує rule 1.

### 13.6 Free-slot affordance

Free-slot action ніколи не є hover-only.

Expanded/medium/tablet default:

- повна cell button area, minimum height `52px`;
- завжди видимий `Plus` icon `16px`;
- label `Вільно` видимий при day column `>=104px`;
- при вужчій column label visually hidden, але icon, border inset і cursor
  лишаються видимими;
- hover/focus додає text `Забронювати` без зміни cell dimensions;
- disabled/past/occupied cell не рендерить button.

Mobile default:

- час зліва;
- text button `Забронювати` справа;
- minimum row і button target `52px`.

### 13.7 Booking block legibility

Кожний booking block є одним native `<button>` details trigger на всю площу.
Для 30 хв trigger має `min-height:48px` у `52px` row і весь target перевищує
`44px`. У 7-day table немає inline Cancel або іншого nested control.

Container-width hierarchy:

| Day content width | Visible block content |
| ---: | --- |
| `<128px` | title `13/16`, range `12/16`, compact text `Ваше` або `Зайнято` |
| `128-191px` | title, range, ownership/status, author initial + full accessible author |
| `>=192px` | title, range, ownership/status, full author name |

Height hierarchy:

- 30-minute: максимум дві text lines + compact status glyph/text;
- `>=60` minutes: author metadata додається, якщо width rule її дозволяє;
- full title, full author, room, user/office time і Cancel відкриваються в
  `AdaptiveBookingSurface` details mode.

Own booking details mode містить `Скасувати бронювання` target `>=44x44px`.
Other booking details mode не містить Cancel. Mobile agenda own-upcoming row
містить sibling Cancel `44x44px`, бо agenda row width не обмежена 7-day
column; row details trigger і Cancel лишаються siblings.

100-character unbroken title не розширює day column; повний title доступний у
details mode через `overflow-wrap:anywhere`.

Own booking:

- label `Ваше` + `UserRoundCheck`;
- solid 2px green leading border;
- own background.

Other booking:

- label `Зайнято` + `CalendarClock`;
- 1px blue border;
- distinct background.

У monochrome/forced colors own має double leading border і `Ваше`; other має
solid single border і `Зайнято`. Відмінність не залежить лише від кольору.

Bounding-box gate на expanded lower bound `1360px`: day content width
`96.85px`, trigger width дорівнює cell width, trigger height `48px`, title/range
boxes не перетинаються, inline Cancel count дорівнює zero.

## 14. Booking flow

### 14.1 Stable `AdaptiveBookingSurface`

Існує рівно один surface subtree без conditional wrapper type, portal або
viewport-dependent `key`:

```text
AppShell
|- AppHeader [registered inert target]
|- ScheduleWorkspace
|  |- ScheduleBackground [registered inert target]
|  |  |- RoomFilterSurface
|  |  `- ScheduleMain
|  `- AdaptiveBookingSurface [always same DOM nodes]
|     |- BookingBackdrop
|     `- BookingPanel
|        |- SurfaceHeading
|        `- BookingComposer
`- BottomNav [registered inert target]
```

`AdaptiveBookingSurface` і `BookingPanel` монтуються один раз разом із
`ScheduleWorkspace`. Closed state використовує `hidden`; open state не змінює
component type або DOM ancestry.

CSS, а не JavaScript, визначає placement:

- `>=1360px`: static third grid track `320px`;
- `900-1359px`: static second grid track `320px`, room track hidden;
- `600-899px`: `position:fixed` right sheet `min(384px,100vw)`;
- `<600px`: fixed bottom/full-screen sheet за section 11.4.

JS `responsiveMode` після hydration визначає тільки behavior:

- `expanded|medium`: `role="region"`, no `aria-modal`, no backdrop, no inert;
- `tablet|mobile`: `role="dialog"`, `aria-modal="true"`, backdrop visible,
  `PresentationCoordinator` робить registered background targets inert.

Changing `role`, `aria-modal`, classes і inert siblings не remount-ить form.

#### 14.1.1 SSR і hydration

- Server snapshot responsive mode - `unresolved`, не `mobile`.
- SSR виводить CSS-sized `ScheduleViewportSkeleton` з `aria-busy="true"` і
  hidden closed `AdaptiveBookingSurface`; жодних slot/details buttons немає.
- CSS media queries одразу резервують правильні pane tracks і vertical
  geometry до hydration.
- `useResponsiveMode` у first client layout phase читає `matchMedia` й монтує
  рівно один semantic `Timetable` або `DayAgenda`.
- Selection не може існувати до client interaction, бо до resolved mode немає
  interactive schedule target.
- Gate: до resolved mode count free-slot buttons = `0`; hydration warnings =
  `0`; route-load CLS from schedule shell `<=0.05`; no wrong-mode interactive
  frame приймає pointer або keyboard input.

#### 14.1.2 Focus transition on resize

Non-modal -> modal, коли surface open:

1. Capture `document.activeElement`.
2. Якщо focus уже всередині stable surface, включно з dynamic Retry, той самий
   DOM node зберігає focus.
3. Якщо focus у timetable/header, до встановлення inert зберегти logical
   invoker і перевести focus за повним priority order: first enabled invalid
   control; `Повторити оновлення` у `conflictError`; title у
   `editing|conflictRefreshing|startUnavailable`; details heading у `details`;
   surface heading у `submitting`.
4. Встановити modal role/aria та inert background.

Modal -> non-modal, коли surface open:

1. Спочатку прибрати inert і `aria-modal`.
2. Якщо focus у surface, зберегти той самий DOM node.
3. Якщо focus став `body` через browser/AT transition, відновити той самий
   priority target.
4. Не повертати focus у timetable, бо surface лишається open.

Resize не змінює title, endsAt, options, field errors, form error, pending,
request IDs, conflict generation або logical invoker. Test зберігає
`isSameNode` для focused title/Retry в обох resize directions; окремий test
перевіряє modal transition, коли focus був у timetable.

### 14.2 Typed booking controller

`ScheduleWorkspace` володіє одним `bookingReducer`; `BookingComposer` є
controlled presentational component без `useState`, fetch, code parsing,
generation refs або end-option recomputation.

Normative state:

```ts
type BookingControllerState =
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
```

Controller effects alone:

- execute `POST /api/bookings`;
- parse unchanged stable error code/field keys;
- execute conflict schedule refresh;
- recompute end options;
- publish schedule/toast/live messages;
- abort requests on unmount/navigation;
- revalidate affected room/week after stale mutation success.

Events і transitions:

| Event | Valid from | Transition / owner action |
| --- | --- | --- |
| `SELECT_SLOT(selection, options)` | any non-submitting state | increment selection generation; `editing`; title `""`; `endsAt=options[0].endsAt` (30 min default); focus title |
| `OPEN_DETAILS(booking)` | closed/editing/details | `details`; store booking snapshot; discard an editing draft only after the user explicitly activates this trigger; no create request |
| `TITLE_CHANGED(value)` | editing/error states | reducer updates controlled title, clears title error |
| `END_CHANGED(endsAt)` | editing/error states | accept only member of current options |
| `SUBMIT` | editing with valid title/end | allocate create request ID; `submitting`; controller POST |
| `CREATE_OK(requestId, booking)` | matching submitting | close draft; refresh affected schedule; success status/focus |
| `CREATE_DOMAIN_ERROR(requestId, code, fields)` | matching submitting | localized field/form state; `BOOKING_CONFLICT` allocates conflict generation and enters `conflictRefreshing` |
| `CREATE_TRANSPORT_ERROR(requestId)` | matching submitting | `editing` + localized transport alert |
| `REFRESH_OK(conflictGeneration, schedule)` | matching conflictRefreshing | replace schedule; recompute options; `editing` with `END_RETAINED` or `END_REPLACED`; no options -> `startUnavailable` |
| `REFRESH_ERROR(conflictGeneration)` | matching conflictRefreshing | `conflictError`; old schedule/title/end retained |
| `RETRY_REFRESH` | conflictError | increment conflict generation; `conflictRefreshing` |
| `CLOSE` | details or non-submitting draft | increment selection generation; closed; focus invoker fallback |
| `CLOSE` | submitting | ignored; close controls disabled |
| `NAVIGATE_ROOM_WEEK_DAY` | any open state | increment selection generation, abort create/refresh, close; clear linked booking where existing URL contract requires |
| any response with stale request/generation | any | no reducer mutation, no toast, no focus change |

`END_RETAINED` і `END_REPLACED` є reducer outcomes, не external mutable events:

- retained: selected end remains in new options;
- replaced: reducer sets `endsAt` to first option and polite message
  `Час завершення змінено відповідно до доступності`;
- zero options: `endsAt=""`, `startUnavailable`, title retained.

Якщо stale `CREATE_OK` означає, що server міг commit booking після app
navigation, controller не закриває новішу surface і не показує success toast.
Він запускає background revalidation тільки для room/week із stale request.
Stale error не має side effects.

### 14.3 Entry і form

1. Користувач активує visible free-slot button.
2. Controller створює `StartSlotSelection` із `roomId`, `roomName`, UTC
   `startsAt`, user-zone labels.
3. `buildBookingEndTimeOptions` обчислює options до найранішої межі: start +
   4 години, office close, next booking.
4. Reducer обирає перший option, тобто 30 хвилин, за замовчуванням.
5. Stable surface відкривається; initial focus переходить у `Назва`.

Room, date і start показані read-only та не вводяться повторно.

Baseline product-action matrix після selected room і visible target:

| Input | Action 1 | Action 2 | Action 3 |
| --- | --- | --- | --- |
| Mouse | click whole free slot | type title | click `Забронювати` |
| Touch | tap whole free slot | type title через OS keyboard | tap `Забронювати` |
| Keyboard | jump/navigation, потім `Enter` на free slot | type title | `Enter`/`Space` на `Забронювати` |

Tab/focus movement, jump select changes і text keystrokes не є окремими
product actions; вони вимірюються окремим keyboard-cost gate section 23.2.
Будь-яка зміна default `30 хв` додає optional fourth product action і не
входить у baseline.

Поля:

- `Назва`, required, `maxLength=100`;
- `Час завершення`, select із labels `10:30 (30 хв)`, `11:00 (1 год)` і далі
  кроком 30 хв;
- hidden request values room/start/end не редагуються напряму.

Actions:

- primary `Забронювати`;
- secondary `Закрити`;
- close icon із tooltip `Закрити`.

Validation:

- empty trimmed title -> inline `Введіть назву бронювання`, focus title;
- server field error пов'язаний через `aria-describedby` і `aria-invalid`;
- no end option -> `Цей час більше недоступний. Оберіть інший слот`;
- pending блокує duplicate submit, close і повторний slot selection лише на час
  запиту; pending label `Бронюємо...`.

### 14.4 Conflict

На `BOOKING_CONFLICT`:

1. Pane/sheet лишається відкритим.
2. Title, start selection і current end зберігаються.
3. Alert показує conflict copy.
4. Старий timetable лишається видимим, але має busy overlay/status
   `Оновлюємо доступність`.
5. Reducer increment conflict generation; controller запитує exact active
   room/week captured selection.
6. Delayed old response і response після close/navigation ігноруються.
7. Після success timetable замінюється атомарно.
8. Reducer recompute end options. Якщо selected end ще валідний, він лишається.
   Якщо ні, reducer обирає перший валідний end і polite status оголошує
   `Час завершення змінено відповідно до оновленої доступності`.
9. Якщо start зайнятий, end select disabled, title збережений, primary disabled,
   а slot у timetable отримує conflict/highlight state.
10. Refresh error зберігає старий timetable і draft; button
    `Повторити оновлення` запускає ту саму generation-safe операцію.

### 14.5 Success

- response success закриває composer;
- schedule refresh;
- polite status/toast `Бронювання створено`;
- focus повертається на створений booking block; якщо block ще не змонтований,
  на day heading;
- URL room/week/day лишаються;
- toast не перекриває pane actions або mobile bottom nav.

### 14.6 Close

- Non-modal pane: close повертає focus на invoking slot і лишає timetable
  position.
- Modal sheet: background inert; Escape і visible close працюють, якщо submit
  не pending.
- Якщо invoking slot зник після refresh, fallback: той самий time cell, далі
  next available slot, далі day heading.
- User-initiated close очищає draft. Resize між modes draft не очищає.

## 15. Cancellation

Cancellation state і DELETE request завжди parent-owned. `ScheduleWorkspace`
та `MyBookingsController` кожен instantiate shared typed
`useCancellationController`; `CancellationDialog` є presentational і не
виконує fetch.

```ts
type CancellationState =
  | {status: 'closed'; generation: number}
  | {
      status: 'confirming' | 'submitting' | 'error';
      booking: {id: string; title: string; roomId?: string; weekStart?: string};
      generation: number;
      requestId: number | null;
      error: string;
    };
```

| Event | Transition / side effect owner |
| --- | --- |
| `OPEN_CANCEL(booking)` | parent increments generation, stores booking, opens modal; focus Keep |
| `CLOSE_CANCEL` | confirming/error -> closed; pending -> ignored |
| `SUBMIT_CANCEL` | confirming/error -> submitting, allocate request ID; parent DELETE |
| `DELETE_OK(requestId)` | matching request: parent applies surface-specific success policy, closes, status/focus |
| `DELETE_ERROR(requestId, code)` | matching request: localized stable error, dialog remains open |
| `NAVIGATE_OR_UNMOUNT` | increment generation, abort request, invalidate responses |
| stale response | no dialog/list/toast/focus mutation |

Matching schedule success preserves old block until active schedule refetch
settles. Matching My Bookings success removes future row immediately. Stale
DELETE success may have committed; controller revalidates affected schedule або
history on the current destination without showing a stale toast.

- Cancel доступний тільки для own upcoming booking.
- Booking row/block і Cancel є sibling controls; немає nested interactive
  elements. У 7-day timetable Cancel існує тільки в booking details surface,
  не в compact block.
- Dialog heading `Скасувати бронювання`.
- Copy: `Скасувати "{title}"? Цей час стане доступним для інших.`
- Initial focus: `Залишити бронювання`.
- Destructive action: `Скасувати бронювання`.
- Pending блокує Escape, X, duplicate request і обидві actions; label
  `Скасовуємо...`.
- Error лишається у відкритому dialog.
- Success прибирає history row одразу; schedule зберігає старий block до
  завершення active refetch, як у поточному контракті.
- Focus after history cancellation переходить до наступного row link, а якщо
  рядків немає - до section heading.

## 16. My Bookings

### 16.1 Structure

Page heading: `Мої бронювання`.

Future і past лишаються окремими data sections та завантажуються незалежно.
Візуальний порядок:

1. `Найближче бронювання` - перший future item, без дублювання в наступній
   групі.
2. Решта future, grouped by local user-zone date.
3. Past, grouped by month і date, latest first.

На mobile sections послідовні. На `>=1024px` future займає основну column,
past - нижче, не side-by-side, щоб chronological scan не ламався.

### 16.2 Nearest booking

Це перший list row із підвищеним visual priority, а не hero/card:

- label `Найближче`;
- date/time, title, room;
- status `Майбутнє`;
- full-row link до schedule;
- sibling Cancel.

### 16.3 Grouping і rows

- Group heading: `Сьогодні`, `Завтра` або повна локалізована date.
- Row minimum `72px`.
- Visible data: date, time range, room, title, textual status.
- Full-row link відновлює `roomId`, `weekStart`, `day`, `bookingId`.
- Cancel target `44x44px` і не накриває row link.
- Past statuses: `Завершено`, `Скасовано`; future: `Майбутнє`.
- `Показати ще` окремо для future/past, якщо `nextCursor`.
- Grouping є derived view над уже відсортованими API items; API pagination і
  cursor order не змінюються.

### 16.4 Independent states

- Future loading не приховує settled past.
- Future error не приховує settled past і навпаки.
- Load-more error зберігає existing rows і button `Повторити`.
- Empty future: `Немає майбутніх бронювань` + link `Знайти вільний час`.
- Empty past: `Історія бронювань порожня`.

## 17. Auth і verification

### 17.1 Auth layout

- Brand header над form: `Roomwork`, descriptor `Бронювання переговорних`.
- Form column width `min(440px, calc(100vw - 32px))`.
- На desktop top offset `96px`, а не vertical center із великим порожнім
  простором.
- Один bordered panel, radius `8px`; без decorative split hero.
- Login heading `Увійти`.
- Register heading `Створити обліковий запис`.
- Links: `Немає облікового запису? Зареєструватися` і
  `Вже маєте обліковий запис? Увійти`.

### 17.2 Fields

- Visible labels завжди присутні.
- Login email: `autocomplete="username"`, `type="email"`,
  `inputmode="email"`.
- Login password: `autocomplete="current-password"`.
- Registration: `name`, `email`, `new-password`.
- Paste, autofill, password managers і browser zoom не блокуються.
- Password hint: `Від 8 до 72 символів`.
- Submit pending не очищає fields.
- Server field errors inline; form-level alert above first field.
- Invalid submit focus: first invalid field. Form-level auth failure focus:
  alert container `tabindex="-1"`.

### 17.3 Verification

Стани:

- pending: `Підтверджуємо email` + static/progress indicator;
- success: `Email підтверджено` + `Перейти до розкладу`;
- expired: `Посилання недійсне або прострочене` + `Повернутися до розкладу`;
- missing token: `Посилання неповне`;
- unavailable: `Не вдалося підтвердити email`.

Token, як і зараз, прибирається з browser history одразу після capture.
Success і errors оголошуються через live region без повторного request.
Редизайн не додає resend.

## 18. Notifications

### 18.1 Separate lifecycle state

`NotificationController` монтується один раз в authenticated `AppShell` і
переживає client navigation між `/schedule` та `/my-bookings`. Full reload або
logout очищує client-only state.

```ts
type RetainedNotification = {
  data: DueNotification;
  seen: boolean;
  ack: 'pending' | 'acked' | 'failed';
};

type NotificationClientState = {
  retainedById: Map<string, RetainedNotification>;
  dismissedIds: Set<string>;
  toastQueue: string[];
  activeToastId: string | null;
  centerOpen: boolean;
};
```

Five concepts are independent:

1. **Server delivery/ack:** every valid GET item triggers POST ack, включно з
   duplicate redelivery. Ack success only changes `ack`; it не removes client
   item і не changes badge/toast.
2. **Client retained item:** valid first-seen ID is retained until explicit
   Dismiss або full reload/logout.
3. **Badge:** count of retained `seen=false` items, label `{n} нових`, не server
   acknowledgement count.
4. **Toast:** one transient presentation of retained item; timeout не changes
   retained/seen/badge.
5. **Dismiss:** removes retained item, queue/active toast; adds ID to
   `dismissedIds` for current client session. Redelivery still gets ack but не
   resurrects UI.

Transitions:

| Event | State transition |
| --- | --- |
| `POLL_VALID(items)` | merge new IDs, `seen=false`, `ack=pending`, enqueue each new non-dismissed ID once; POST ack for every delivered ID |
| `ACK_OK(id)` | retained ack -> `acked`; no presentation change |
| `ACK_ERROR(id)` | retained ack -> `failed`; no user alert; later redelivery retries ack |
| duplicate redelivery | no duplicate retained/toast/badge; ack attempted again |
| `TOAST_SHOW_NEXT` | when no modal/center and no active toast, dequeue first retained ID |
| `TOAST_TIMEOUT(id)` | clear active only; retained/seen/badge unchanged |
| `CENTER_OPEN` | `centerOpen=true`; all retained `seen=true`; clear active toast and queue |
| `CENTER_CLOSE` | `centerOpen=false`; retained items stay |
| `DISMISS(id)` | remove retained, queue/active; remember dismissed ID; focus fallback |
| `MODAL_OPEN` | active toast returns to front of queue, timer discarded; visual toast hidden |
| `MODAL_CLOSE` | if all modals closed and center closed, show queue head with fresh 4s timer |
| route navigation | state/queue/timer survive in persistent AppShell |
| unmount/logout/full reload | abort polls/acks; client state cleared |

Polling лишається immediate + every `60_000ms` only while visible. Visibility
hide pauses interval й active toast timer; visibility return polls immediately
і resumes toast with fresh 4s timer. Malformed/failed GET і ack failure не
створюють assertive UI.

### 18.2 `PresentationCoordinator`

Global context у `AppShell` володіє тільки presentation state:

```ts
type ModalOwner = null | 'booking' | 'cancellation' | 'notifications';
```

Він:

- реєструє inert background targets і stable modal surfaces;
- серіалізує modal owner: одночасно active максимум один modal;
- публікує `modalOwner` NotificationController для toast suppression;
- закриває non-modal popovers перед відкриттям modal;
- не володіє notification items, booking draft, cancellation request або page
  data.

Booking surface при resize реєструє/звільняє owner без remount. Notification
sheet не відкривається, доки cancellation/booking modal active; bell лишається
недоступним через inert. Non-modal desktop notification popover не стає modal
owner.

### 18.3 Presentation і focus

- Bell target `44x44px`.
- Accessible name: `Сповіщення` або `Сповіщення, {n} нових`.
- Badge cap `9+`; badge не є єдиним сигналом.
- Expanded/medium/tablet: anchored non-modal popover, width `360px`, max-height
  `min(480px, calc(100dvh - 88px))`.
- Mobile: modal bottom sheet із heading `Сповіщення`.
- Notification copy:
  `"{currentTitle}" скоро завершиться в {roomName}. Далі -
  {nextAuthorName}.`
- Кожний item має `Dismiss` як `Закрити сповіщення`, target `44x44px`.
- Dismiss focused item -> focus next notification; якщо його немає - bell.

Popover:

- bell toggle opens/closes;
- `Escape` closes and returns focus to bell;
- pointer down + up on same outside target closes без примусового focus return;
- route navigation closes popover, retained state survives;
- focus не trapped.

Mobile sheet:

- modal owner `notifications`, inert background, focus heading;
- X, Escape і backdrop click close; backdrop closes only when pointer down/up
  both hit backdrop;
- close returns focus to bell;
- Tab/Shift+Tab trapped.

Opening either popover or sheet dispatches `CENTER_OPEN`, тому badge стає zero,
але list items лишаються до Dismiss. Toast timeout ніколи не mark seen і не
dismiss item.

## 19. State matrix

| Surface | Loading/pending | Empty | Error/conflict | Success/data | Disabled/protection |
| --- | --- | --- | --- | --- | --- |
| App shell | session resolving до route render | N/A | logout inline alert | user/nav/bell | account actions disabled while logout pending |
| Login | form busy, button `Входимо...` | N/A | field/form alert | redirect schedule | duplicate submit blocked |
| Register | form busy, `Створюємо...` | N/A | per-field + form alert | session + redirect | duplicate submit blocked |
| Verify | progress status | missing token | expired/invalid/unavailable | verified + link | request deduped |
| Rooms | 5 skeleton rows | no capacity match | alert + Retry | list + selected room | select disabled without valid rooms |
| Timetable | old data preserved with overlay on refresh; skeleton only on first load | no bookings still shows free slots | schedule alert + Retry; no free actions without data | native table | past/occupied cells non-interactive |
| Day agenda | row skeleton on first load | no bookings still shows free starts | schedule alert + Retry | chronological list | past/occupied rows non-interactive |
| Booking composer | submit pending; conflict refresh status | no end options | field, verification, conflict, refresh/network alert | created status | primary disabled without valid end or during refresh |
| Cancellation | destructive pending | N/A | stable dialog alert | removed/refreshed + status | all close/submit paths blocked pending |
| Future bookings | independent skeleton | no future + CTA | section error / load-more retry | grouped nearest first | load-more blocked pending |
| Past bookings | independent skeleton | empty history | section error / load-more retry | grouped latest first | load-more blocked pending |
| Notifications | background polling invisible | bell count zero | malformed/failure silent | badge, popover/sheet, polite toast | dedupe + visibility-aware polling |
| Success status | N/A | absent | N/A | created/cancelled, 4s or manual dismiss | never steals focus |

### 19.1 Skeleton and overlay rules

- Skeleton використовується тільки на first load без usable data.
- Refresh не замінює timetable/history білим екраном або full spinner.
- Busy overlay пропускає читання old data, але блокує нове submit тільки там,
  де stale availability небезпечна.
- Reduced motion замінює rotating spinner статичним icon + text.

## 20. Component boundaries і data/state ownership

### 20.1 Boundary map

| Component | Responsibility | Owns state | Не володіє |
| --- | --- | --- | --- |
| `RootLayout` | `lang`, metadata, global tokens | none | auth/session/request state |
| `AppShell` | persistent header/nav/main/bottom-nav composition | account menu open | page domain state |
| `PresentationCoordinator` | serialize modal owner, inert targets, toast suppression | `modalOwner`, surface/inert registrations | booking, cancellation, notification data |
| `NotificationController` | poll, validate, dedupe, ack and retained lifecycle | state from section 18.1, poll/ack controllers | notification markup, schedule state |
| `NotificationCenter` | render bell/popover/sheet from controlled props | none | polling, retained items, modal arbitration |
| `ScheduleWorkspace` | page controller and single source of truth | `minCapacity`, rooms, selected room, week/day, user zone, schedule requests/sequences, `bookingReducer`, cancellation controller, toast publication, conflict generations, visible-time anchor | field DOM, modal arbitration |
| `RoomPicker` | room list і capacity controls | none | room fetch, selected room |
| `RoomFilterSurface` | place `RoomPicker` у pane або modal sheet | filter sheet open/closed | filter values, room data |
| `ScheduleNavigation` | date controls/date strip | internal scroll position only | week/day source of truth |
| `useResponsiveMode` | behavior mode after hydration only | external-store snapshot `unresolved/expanded/medium/tablet/mobile` | placement, domain state |
| `ScheduleViewport` | render exactly one 7/3/2/day renderer | none; receives responsive mode | fetches, URL, domain selection |
| `Timetable` | semantic table and slot rendering | none | requests, form draft |
| `DayAgenda` | semantic chronological list and epoch-bounded visual positioning | `positionedEpoch` ref only | requests, form draft, focus |
| `AdaptiveBookingSurface` | one stable DOM subtree; CSS places pane/sheet/dialog | element refs only | form/controller state, fetch |
| `BookingComposer` | controlled fields, summary, messages and commands | none | draft, errors, pending, requests, conflict logic |
| `BookingBlock` | one whole-block details trigger plus fit-dependent metadata | none | disclosure, cancellation request |
| `CancellationDialog` | controlled confirmation presentation | none | pending, error, DELETE request |
| `MyBookingsController` | two paginated queries and parent cancellation controller | future, past, cancellation state, toast, user zone | grouping markup |
| `BookingGroups` | derive next/date/month groups | none | fetching/cursors |
| `AuthForm` variants | submit and field feedback | field values/browser DOM, pending, errors | session persistence |
| `VerificationStatus` | one-shot token lifecycle | verification state, request ref | resend |

### 20.2 Ownership invariants

1. `ScheduleWorkspace` лишається єдиним власником URL-backed selection.
2. `useResponsiveMode` використовує `useSyncExternalStore` і `matchMedia` для
   exact boundaries: expanded `width >= 1360`, medium
   `900 <= width < 1360`, tablet `600 <= width < 900`, mobile `width < 600`.
   Server snapshot - `unresolved`; він не видає mobile behavior.
3. У DOM одночасно існує рівно один із `Timetable` або `DayAgenda`; CSS не
   приховує duplicate semantic renderers.
4. Responsive mode ніколи не запускає другий rooms/schedule fetch.
5. `visibleTimeAnchor` є UTC instant найближчої верхньої видимої row. Renderer
   оновлює його на settled scroll, а новий renderer відновлює найближчу row без
   переміщення focus.
6. `AdaptiveBookingSurface`, його `BookingPanel` і `BookingComposer` є одними
   й тими самими DOM nodes до і після resize; CSS змінює placement, JS -
   тільки dialog/inert/focus behavior після hydration.
7. Один typed `bookingReducer` у `ScheduleWorkspace` володіє selection, draft,
   end options, pending, create request ID, conflict generation і stale
   handling. `BookingComposer` лише dispatches typed events.
8. `bookingId` highlight очищається при explicit room/week/day navigation, але
   зберігається при initial deep-link restoration.
9. Room/filter response, schedule response і conflict response мають окремі
   AbortController/sequence guards.
10. Cancellation state і DELETE request належать відповідному page controller;
    `CancellationDialog` не має локального request/error state.
11. My Bookings future/past errors і cursors не зливаються в один state.
12. Grouping не змінює API order і не дублює nearest booking.
13. Localized UI message визначається frontend mapping; raw code зберігається
   для branch logic/tests.

### 20.3 Presentation state machine

```text
NoSelection
-> SelectFreeSlot
-> DraftOpen
-> SubmitPending
-> Created -> NoSelection

SubmitPending
-> ConflictRefresh
-> DraftOpen(valid end)
-> DraftOpen(adjusted end)
-> StartUnavailable

ConflictRefresh
-> RefreshError
-> RetryRefresh

DraftOpen
-> Close -> NoSelection
-> Resize -> DraftOpen in the same AdaptiveBookingSurface DOM subtree
```

Room/week/day change завжди переходить у `NoSelection`. Browser resize не
змінює domain state.

## 21. Design tokens

Tokens задаються як CSS custom properties. Компоненти не використовують
hardcoded hex, spacing, radius, shadow або duration поза token definition.

### 21.1 Semantic colors

Contrast ratios нижче розраховані для вказаної foreground/background пари.
Normal text target - `>=4.5:1`; large text і meaningful graphics -
`>=3:1`.

| Token | Value | Usage / contrast intent |
| --- | --- | --- |
| `--color-canvas` | `#F7F8FA` | page background |
| `--color-surface` | `#FFFFFF` | controls, panes, table |
| `--color-surface-subtle` | `#F1F5F9` | low-emphasis rows; decorative only |
| `--color-text` | `#17202A` | primary on white, `16.45:1` |
| `--color-text-muted` | `#475569` | secondary on white, `7.58:1` |
| `--color-text-subtle` | `#64748B` | minimum normal text on white, `4.76:1` |
| `--color-brand` | `#0F766E` | primary action on white, `5.47:1`; white on brand, `5.47:1` |
| `--color-brand-hover` | `#115E59` | white text, `7.58:1` |
| `--color-brand-pressed` | `#134E4A` | white text, `9.48:1` |
| `--color-brand-soft` | `#CCFBF1` | selected surface |
| `--color-selected-text` | `#115E59` | on brand soft, `6.73:1` |
| `--color-info` | `#1D4ED8` | on info soft, `6.16:1` |
| `--color-info-soft` | `#EFF6FF` | other booking/info background |
| `--color-success` | `#166534` | on success soft, `6.81:1` |
| `--color-success-soft` | `#F0FDF4` | success background |
| `--color-warning` | `#92400E` | on warning soft, `6.84:1` |
| `--color-warning-soft` | `#FFFBEB` | warning/current context |
| `--color-danger` | `#B42318` | on danger soft, `5.98:1`; white on danger, `6.57:1` |
| `--color-danger-soft` | `#FFF1F2` | error/conflict background |
| `--color-conflict-text` | `#881337` | on danger soft, `8.71:1` |
| `--color-own-text` | `#14532D` | on own surface, `8.65:1` |
| `--color-own-surface` | `#ECFDF5` | own booking |
| `--color-own-border` | `#15803D` | own meaningful boundary |
| `--color-other-text` | `#1E3A8A` | on info soft, `9.52:1` |
| `--color-other-border` | `#2563EB` | other booking meaningful boundary |
| `--color-current` | `#9A3412` | on current soft, `6.88:1` |
| `--color-current-soft` | `#FFF7ED` | current day/time context |
| `--color-border-control` | `#64748B` | control outline on white, `4.76:1` |
| `--color-border-strong` | `#64748B` | meaningful table/control boundary on white, `4.76:1` |
| `--color-border-subtle` | `#CBD5E1` | decorative divider only, never sole control boundary |
| `--color-disabled-bg` | `#CBD5E1` | disabled surface |
| `--color-disabled-text` | `#475569` | on disabled bg, `5.10:1` |
| `--color-focus` | `#0F766E` | 2px inner focus ring |
| `--color-focus-outer` | `#FFFFFF` | 2px separation ring |

No opacity знижує contrast тексту. Status surfaces використовують text + icon
+ border/shape.

### 21.2 Typography

Font stack:

```css
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

| Token | Size / line-height | Weight | Use |
| --- | --- | ---: | --- |
| `--type-page-title` | `28px / 36px` | 700 | desktop page title |
| `--type-page-title-compact` | `20px / 28px` | 700 | mobile page title |
| `--type-section` | `20px / 28px` | 650 | section headings |
| `--type-subsection` | `16px / 24px` | 650 | pane/group heading |
| `--type-body` | `16px / 24px` | 400 | body/forms |
| `--type-label` | `14px / 20px` | 600 | field/control labels |
| `--type-compact` | `13px / 18px` | 500 | timetable title |
| `--type-meta` | `12px / 16px` | 500 | timetable metadata; minimum UI text |

Letter spacing - `0`. Font size не масштабується через viewport units.
User-generated unbroken text використовує `overflow-wrap:anywhere` у details,
але не змінює fixed timetable geometry.

### 21.3 Spacing

8px base:

| Token | Value |
| --- | ---: |
| `--space-0` | `0` |
| `--space-1` | `8px` |
| `--space-2` | `16px` |
| `--space-3` | `24px` |
| `--space-4` | `32px` |
| `--space-5` | `40px` |
| `--space-6` | `48px` |
| `--space-8` | `64px` |

Компоненти не додають випадкові `6`, `10`, `14`, `18` px gaps.

### 21.4 Radii, borders, elevation

| Token | Value | Use |
| --- | --- | --- |
| `--radius-sm` | `4px` | tags, compact state labels |
| `--radius-md` | `8px` | inputs, buttons, popovers, panels |
| `--radius-lg` | `12px` | modal sheet top corners only |
| `--border-default` | `1px` | controls/dividers |
| `--border-emphasis` | `2px` | selected, focus-adjacent, own booking |
| `--shadow-popover` | `0 8px 24px rgba(23,32,42,.14)` | floating menu/popover |
| `--shadow-modal` | `0 16px 40px rgba(23,32,42,.20)` | dialog/sheet |

Page sections і panes не є floating cards. Elevation немає на static timetable,
room pane, history sections або auth page background.

### 21.5 Motion

| Token | Value | Use |
| --- | ---: | --- |
| `--motion-fast` | `150ms` | color/border state |
| `--motion-standard` | `200ms` | popover opacity |
| `--motion-emphasized` | `250ms` | sheet translate |
| `--ease-standard` | `cubic-bezier(.2,0,0,1)` | all UI motion |

Не анімуються layout dimensions timetable, slot height, table columns або text.
`prefers-reduced-motion: reduce` встановлює duration `0ms`, прибирає translate,
smooth scroll і spinner rotation; loading лишається text + static icon.

## 22. Exact component states і visible affordances

### 22.1 Buttons

| State | Visual | Behavior |
| --- | --- | --- |
| Default primary | brand bg, white label/icon | enabled |
| Hover | brand-hover bg | no size/layout change |
| Focus-visible | 2px white outer + 2px brand ring, offset 2px | always visible |
| Pressed | brand-pressed bg, no scale transform | action executes once |
| Disabled | disabled bg/text, visible label | no pointer/keyboard action |
| Loading | static/animated progress icon per motion preference + verb in progress | `aria-busy`, disabled |
| Destructive | danger bg, white text | only confirmed destructive action |
| Icon-only | `44x44px`, tooltip on hover/focus, explicit `aria-label` | familiar Lucide icon |

### 22.2 Inputs/selects

- Height minimum `44px`.
- Default 1px control border `#64748B`.
- Hover 2px strong/brand-neutral border without geometry shift via inset ring.
- Focus uses dual focus ring.
- Error uses danger border + icon + inline text + `aria-invalid`.
- Disabled uses disabled tokens and remains readable.
- Placeholder не замінює label.

### 22.3 Tags/status

Status chip radius `4px`, icon + text. `Ваше`, `Зайнято`, `Майбутнє`,
`Завершено`, `Скасовано`, `Конфлікт`, `Обране` не передаються лише hue.

### 22.4 Panels and sheets

- Non-modal pane: no backdrop, no `aria-modal`, no focus trap; visible heading
  і close.
- Modal sheet/dialog: backdrop, actual inert app root, focus trap, Escape,
  visible close, heading as accessible name.
- Sheet content scrolls; heading і action row sticky only if they do not obscure
  focus. `scroll-padding-block` reserves header/action heights.

### 22.5 Toasts

- Success uses icon + text, `role="status"`.
- Error tied to active form uses inline `role="alert"`, not toast.
- Desktop position under header top-right.
- Mobile position above bottom nav.
- Maximum one visual toast at a time; later messages queue.
- Auto-dismiss 4 seconds; status stays in DOM long enough for announcement.

## 23. Keyboard, focus і screen-reader model

### 23.1 Global

- `Tab` follows DOM order; `Shift+Tab` reverses.
- Skip link reaches `<main id="main-content">`.
- Every visible action keyboard-operable.
- No keyboard shortcut is required to complete a task.
- Focus indicator never removed.

### 23.2 Timetable

- Native table reading semantics; no composite grid.
- Tab stops inside the table are free-slot buttons and whole-booking details
  triggers. У 7-day table немає окремого Cancel.
- Arrow keys are not captured.
- Week/day navigation buttons are before table in DOM.
- Table caption names room, visible date range і timezone.
- Each free-slot accessible name:
  `Забронювати {date}, {time}, переговорна {room}`.
- Booking accessible name:
  `{title}, {start}-{end}, автор {name}, Ваше|Зайнято`.

Native table не отримує часткової APG grid behavior. Щоб keyboard user не
проходив до `140` slot/booking triggers, перед scrollport є focus-only
`ScheduleJumpControls`:

1. Skip link `До пошуку часу` є першим focusable element у `<main>` і
   переміщує focus на select `День`.
2. Далі в DOM рівно: `День`, `Час` із 20 office slots, button `Перейти`.
3. `Перейти` фокусує free-slot або booking details trigger у точній
   day/time cell. Якщо slot past/non-interactive - фокусує відповідний
   `th scope="row"` через programmatic `tabindex="-1"` і оголошує
   `Цей час недоступний`; якщо schedule error - фокус лишається на button і
   alert пояснює unavailable schedule.
4. Skip link `Після розкладу` перед scrollport переміщує focus на перший
   control після `AdaptiveBookingSurface`/schedule region.

Exact paths: без активації skip link `Tab` проходить
`До пошуку часу -> День -> Час -> Перейти`, тобто рівно три `Tab` від first
main target до jump button. З активацією skip link: `Enter` ставить focus на
`День`, потім рівно два `Tab` до `Перейти`. Activation jump ставить focus на
target без обходу проміжних cells. Select підтримують native typing/arrow
keys, але timetable arrow keys не перехоплюються. Ці navigation keystrokes не
рахуються як product actions.
Після jump основний booking path має рівно три product actions:
`Enter` на free slot, введення title як одна text-entry action, `Enter` на
`Забронювати`; default end вже `30 хв`. Зміна дня/end є опційною.

### 23.3 Agenda

- Heading, then ordered list.
- Buttons have time/room in accessible names.
- `Зараз` separator не focusable.
- Auto-position does not move keyboard focus; only visual scroll.

### 23.4 Non-modal booking pane

- Slot activation moves focus to title.
- Tab can leave pane and return to timetable naturally.
- Escape closes only while focus is inside pane and submit is not pending.
- Close returns focus by deterministic fallback policy.

### 23.5 Modal sheet/dialog

- Outside app root is `inert`.
- `role="dialog"` + `aria-modal="true"` only when inert is active.
- Initial focus: booking title; cancellation `Залишити бронювання`; long
  notification sheet heading with `tabindex="-1"`.
- Tab/Shift+Tab cycle through all dynamically added controls.
- Escape and visible close.
- Close restores invoker or documented fallback.

### 23.6 Live regions

- `role="status"`/polite: booking success, cancellation success, adjusted end
  time, loading completion, notifications.
- `role="alert"`: submit failure, conflict, auth failure, unavailable service.
- Polling success does not steal focus.
- Repeated identical status is deduplicated.

## 24. WCAG 2.2 AA release gate

Release не допускається, доки виконано:

1. Normal text contrast `>=4.5:1`; large text `>=3:1`.
2. Meaningful control boundary, focus indicator і status graphic `>=3:1`.
3. Status/ownership/current/selected/conflict не color-only.
4. WCAG 2.5.8 minimum лишається `24x24 CSS px`, але суворіший product gate
   вимагає `>=44x44 CSS px` для всіх standalone controls, включно з bell,
   chevrons, dismiss, date buttons, free slots і cancel.
5. `320px` width: no page-level horizontal scroll; date strip є єдиним
   дозволеним internal horizontal scroll.
6. Actual 200% zoom: no loss, clipping, overlap або недоступні controls.
7. Focus not obscured sticky header, bottom nav, toast, sheet actions або
   on-screen keyboard.
8. Browser zoom не вимкнений.
9. Forced colors: system colors зберігають focus, selected, own/other,
   conflict, current time, input boundaries.
10. Reduced motion: no essential information через animation; no spinner
    rotation або smooth auto-scroll.
11. Modal background inert для pointer, keyboard і virtual cursor.
12. Auth supports paste, autofill, password manager; login identifier
    `autocomplete="username"`.
13. No `role="grid"` without full APG behavior. Ця версія використовує native
    table/list, тому APG grid keys не реалізуються й не заявляються.
14. Screen-reader text names room/date/time/action без залежності від visual
    position.

### 24.1 Forced-colors contract

У `@media (forced-colors: active)`:

- surfaces: `Canvas`, text: `CanvasText`;
- enabled controls: `1px solid ButtonText`, text `ButtonText`;
- disabled controls: `1px solid GrayText`, text `GrayText`, visible
  `Недоступно` where the state is not already named;
- links: `LinkText`; visited color не є єдиним state signal;
- focus: `2px solid Highlight`, `2px` outer separation in `Canvas`;
- selected date/room: `2px solid Highlight`, text `Обране` або check icon;
- today but not selected: `2px dotted ButtonText` + text `Сьогодні`;
- own booking: double `ButtonText` leading border + `Ваше`;
- other booking: single solid `ButtonText` border + `Зайнято`;
- conflict: dashed `Highlight` border + icon/text `Конфлікт`;
- invalid input: `2px dashed Highlight`, error icon і associated error text;
- modal/sheet: `2px solid CanvasText`; backdrop uses `Canvas` and must leave
  the dialog boundary detectable without transparency;
- toast/popover: `1px solid CanvasText`; success/error icon plus text remains;
- current-time line: `Highlight`, 2px;
- SVG icons inherit `currentColor`;
- `forced-color-adjust:none` використовується тільки для elements, де system
  colors задані явно.

Automated gate перевіряє computed system colors, border styles, visible state
text/icons і `2px` focus outline для enabled, disabled, selected, today,
own/other, conflict, invalid, modal, toast and current-time fixtures.
Manual Windows High Contrast pass підтверджує, що backdrop не приховує dialog
boundary і жоден box shadow не є єдиною межею surface.

## 25. Migration plan

### Phase 1: contract freeze

- Зафіксувати поточні API, URL, timezone, race, pagination і notification tests.
- Додати locale copy map без зміни error codes.
- Визначити obsolete geometry assertions окремим списком.
- Gate: exhaustive `DomainErrorCode`/field-key typecheck і unchanged API
  integration suite green. Rollback: locale module can be removed without
  touching routes or domain services.

### Phase 2: token foundation and shell

- Додати semantic tokens.
- Уніфікувати shared Button, Field, Alert, Dialog, Toast, Spinner.
- Оновити `lang`, metadata, app/auth brand і navigation.
- Не змінювати schedule behavior.
- Gate: auth/verify/shell screenshots at `320`, desktop and forced colors;
  existing behavior tests green. Rollback: components can return to old
  classes while semantic tokens remain additive.

### Phase 3: schedule semantics

- Винести controller state з current `ScheduleClient` без зміни ownership.
- Замінити partial ARIA grid на native `Timetable`.
- Додати `DayAgenda`.
- Зберегти timezone conversion, end-time options і URL restoration.
- Gate: reducer transition table, normative `rowSpan`, pure 20-slot agenda,
  timezone and race unit suites green before removing old renderer. Rollback:
  old renderer stays behind an implementation-only branch until this gate,
  never mounted simultaneously in release markup.

### Phase 4: adaptive panes

- Додати RoomPane, ScheduleNavigation/date strip і responsive viewport.
- Додати одну stable `AdaptiveBookingSurface`; CSS placement і hydrated
  behavior mode не створюють alternate pane/sheet trees.
- Перевірити `isSameNode`, exact focus transitions і draft/pending preservation
  в обох resize directions.
- Gate: six viewport geometry equations and adaptive E2E pass. Rollback:
  revert placement CSS and behavior hook together, not controller state.

### Phase 5: secondary surfaces

- Перегрупувати My Bookings як derived view.
- Уніфікувати auth/verify.
- Перенести notification presentation без зміни polling.
- Gate: parent-owned cancellation and five-part notification lifecycle tests
  green; delivery/ack integration assertions unchanged. Rollback:
  presentation can revert independently from controller lifecycle.

### Phase 6: accessibility hardening

- Inert modal background, deterministic focus fallback.
- Forced colors, reduced motion, focus scroll padding.
- `320px`, 200% zoom, long text, locale і touch target gates.
- Додати bounded `ScheduleJumpControls` без `role="grid"`.
- Gate: mandatory keyboard/NVDA, 200%, forced-colors and target measurements.

### Phase 7: cleanup

- Розділити monolithic styling за component ownership, не змішуючи Tailwind і
  raw literals усередині одного component.
- Видалити obsolete classes і geometry tests тільки після replacement coverage.
- Не залишати compatibility dead code або dual renderers поза defined modes.
- Gate: full command set, source hygiene, no stale locators/placeholders and
  final diff review. Rollback point - last green phase commit; API/data
  migrations відсутні.

## 26. Acceptance criteria

### Product і language

- **AC-001:** Усі видимі system labels українською; user data без перекладу.
- **AC-002:** `<html lang="uk">`, `uk-UA`, Monday week start, 24-hour time.
- **AC-003:** `Roomwork` + `Бронювання переговорних` узгоджені в metadata, auth,
  verify й app shell.
- **AC-004:** API routes, error codes, technical IDs, query params і payload
  fields не змінені.

### Schedule

- **AC-005:** `1440x900` має room pane, 7-day timetable, booking pane; seven
  days без horizontal scroll.
- **AC-006:** `1024x768` має 3-day timetable; selection показує non-modal
  booking pane й лишає timetable видимим.
- **AC-007:** `768x1024` має 2-day table/date strip, а не mobile one-day
  fallback.
- **AC-008:** `390x844`, `360x800`, `320x800` мають compact header, date strip,
  filter sheet і day agenda.
- **AC-009:** Schedule scrollport/body top і six-hour visibility відповідають
  exact inequalities та vertical budgets section 4.1/11.
- **AC-010:** Expanded schedule scrolls internally; document не scrolls через
  1040px timetable.
- **AC-011:** Free-slot affordance visible before hover; mobile має text action.
- **AC-012:** 30-minute booking block показує readable title, range і
  `Ваше|Зайнято`; author завжди доступний у full accessible name/details, а
  inline metadata з'являється лише за fit thresholds section 13.7.
- **AC-013:** Own/other/current/selected/conflict відмінні text/icon/shape, не
  лише кольором.
- **AC-014:** Native table має truthful headers/rowSpan; mobile agenda -
  chronological list; `role="grid"` відсутній.
- **AC-036:** `ScheduleJumpControls` дає bounded path до exact day/time target:
  максимум три `Tab` від main-entry target до `Перейти`, без arrow-key capture
  або partial grid behavior.

### Booking і cancellation

- **AC-015:** Selection pre-fills room/date/start і end options 30-240 хв.
- **AC-016:** End options зупиняються на next booking, office close або 4 h.
- **AC-017:** Pending захищає від duplicate create/cancel.
- **AC-018:** `BOOKING_CONFLICT` зберігає title/start, refreshes active schedule,
  recomputes end options і лишає retry.
- **AC-019:** Conflict refresh failure не очищає draft або old schedule.
- **AC-020:** Success refreshes schedule, announces status і restores logical
  focus.
- **AC-021:** Cancel існує тільки для own upcoming booking й потребує
  confirmation.
- **AC-037:** У 7-day table whole booking block є details trigger
  `>=44x44`; inline Cancel відсутній. Cancel міститься в details/booking
  surface; mobile agenda own-upcoming row містить sibling Cancel.
- **AC-038:** Default end є першим valid option `+30 хв`; baseline booking
  має рівно три product actions за section 23.2.
- **AC-039:** Один typed reducer/controller володіє create/conflict/stale
  lifecycle, а cancellation request/state належить parent controller; обидва
  presentational forms не виконують fetch.

### My Bookings, auth, notifications

- **AC-022:** Nearest future booking має найвищий priority без duplicate row.
- **AC-023:** Future/past independently load/error/empty/paginate; ordering не
  змінено.
- **AC-024:** Row link deep-links room/week/day/bookingId; Cancel sibling.
- **AC-025:** Auth field errors inline; login uses `username` autocomplete;
  paste/autofill працюють.
- **AC-026:** Verification має pending/success/expired/invalid/unavailable і не
  додає resend.
- **AC-027:** Notification polling/dedupe/ack/visibility behavior збережено;
  bell label містить unread count.
- **AC-028:** Toast/popover/sheet не перекриває booking controls і не краде
  focus.
- **AC-040:** Server ack, retained item, unseen badge, transient toast і
  explicit dismiss змінюються незалежно за section 18; один
  `PresentationCoordinator` серіалізує modal owner.

### Accessibility і quality

- **AC-029:** Усі standalone controls `>=44x44 CSS px`; compact booking block
  сам є whole-block `>=44px` operable trigger і не містить nested control.
- **AC-030:** `320px`, actual 200% zoom, forced colors і reduced motion gates
  проходять.
- **AC-031:** Focus-visible не obscured; modal background inert; focus
  restoration deterministic.
- **AC-032:** Text/background і non-text contrast відповідають section 24.
- **AC-033:** Long 100-character unbroken title не створює overflow.
- **AC-034:** No page-level horizontal overflow на всіх required viewports.
- **AC-035:** Existing server, interval, race, timezone, pagination,
  notification й auth tests лишаються green.
- **AC-041:** `AdaptiveBookingSurface` зберігає DOM identity, controlled
  state, request/generation IDs і specified focus target при every breakpoint
  resize; SSR не видає interactive wrong-mode UI.
- **AC-042:** Agenda projection створює exact partition slot indices `0..19`
  або один schedule-data-error state; deterministic auto-position виконується
  не більше одного разу на defined epoch.
- **AC-043:** Error and field localization є exhaustive typed mappings;
  `AUTH_REQUIRED` зберігає лише validated same-origin return URL.
- **AC-044:** Same-zone і different-zone headers/cells відповідають section
  13.4; equivalent, US-only DST, Kyiv-only DST і date-crossing fixtures green.

## 27. Complete test plan

### 27.1 Static and unit

1. Source hygiene: BOM, zero-width, bidi controls, unused code.
2. `RootLayout`: `lang="uk"` і localized metadata.
3. Token test: усі component colors refer to semantic variables; contrast
   script перевіряє declared foreground/background pairs.
4. `Timetable`:
   - native `<table>`;
   - 20 time rows для `09:00-19:00`;
   - 7/3/2 day headers;
   - `scope` і caption;
   - normative `rowSpan` matrix invariants, adjacency, 30/60/240 minutes,
     office edges, overlap/off-grid/cross-day whole-schedule failure;
   - no `role="grid"`/`gridcell`;
   - free action visible class/content;
   - own/other labels;
   - current/deep-link states;
   - same-zone shared clock and different-zone office row/user cell labels.
5. `DayAgenda`:
   - pure projection partitions exact slot indices `0..19`;
   - busy multi-slot item once, continuation skipped;
   - explicit `20`, `1` and `0` free-start fixtures, zero bookings, fully
     booked day, all-past day, current-running booking and 4-hour booking;
   - malformed overlap/off-grid/cross-day -> one data error, zero slot actions;
   - initial skeleton exactly 20 rows; refresh retains old list;
   - every positioning epoch/fallback and no focus/user-scroll reset.
6. Responsive mode:
   - exact snapshots at `599/600/899/900/1359/1360 CSS px`;
   - server `unresolved` snapshot has noninteractive skeleton, no mobile
     assumption or hydration warning;
   - one semantic renderer in DOM;
   - one `AdaptiveBookingSurface` subtree passes `isSameNode` in both resize
     directions;
   - resize preserves booking draft, errors, pending/request IDs, conflict
     generation і visible time anchor;
   - exact outside/inside focus transitions in section 14.1;
   - resize does not refetch rooms/schedule.
7. `ScheduleWorkspace` existing race tests:
   - superseded room/week response ignored;
   - popstate delayed response ignored;
   - filtered room reactivation does not show stale controls;
   - cancelled block preserved until refresh;
   - conflict refresh generation and retry;
   - day/week navigation clears failed conflict;
   - stale create success only revalidates its room/week, without closing a
     newer surface, toast or focus change.
8. `bookingReducer` + presentational `BookingComposer`:
   - every event/transition and invalid-event no-op from section 14.2;
   - `BookingComposer` dispatches only and has no request/local draft state;
   - end option selection updates summary/payload;
   - default first option is exactly `+30 min`; 30 min through 4 h;
   - selected end retained if valid;
   - removed end resets to first valid and announces;
   - no end disables submit;
   - title required/max 100;
   - `EMAIL_NOT_VERIFIED`;
   - `BOOKING_CONFLICT`;
   - duplicate submit blocked.
9. Dialog/sheet:
   - inert toggled with modal;
   - Tab loop includes dynamic Retry;
   - Escape/X policy during pending;
   - invoker/fallback focus.
10. Parent cancellation controllers and presentational dialog:
    - every event/transition and stale response from section 15;
    - schedule retains cancelled block until refresh;
    - history removes successful cancellation immediately;
    - no inline Cancel in 7-day block; own-upcoming mobile agenda row has the
      sibling Cancel.
11. My Bookings:
   - independent future/past states;
   - nearest not duplicated;
   - user-zone grouping;
   - cursor append/dedupe;
   - load-more retry;
   - link before sibling Cancel.
12. Notification lifecycle and `PresentationCoordinator`:
    - immediate/60-second visible polling;
    - malformed/failed ignored;
    - ack, retained, badge, toast and dismiss mutate independently;
    - duplicate redelivery after dismiss re-acks without resurrection;
    - route persistence and full-reload/logout clearing;
    - dismiss focus fallback;
    - one modal owner; queued toast suppression/resumption while modal open.
13. Auth/verify:
    - Ukrainian labels;
    - autocomplete tokens;
    - field associations;
    - pending and every verify state.
14. Locale:
    - exhaustive `satisfies Record<UiErrorCode, ...>` and
      `Record<BookingFieldKey, ...>` fail compilation on missing member;
    - safe `AUTH_REQUIRED` `returnTo` allow/reject cases;
    - no raw English API message rendered;
    - uk-UA `h23` dates/ranges and plural cases `1, 2, 4, 5, 21`;
    - 30-minute increments, equivalent zones, US-only DST, Kyiv-only DST and
      user/office date crossing.
15. `ScheduleJumpControls`:
    - DOM order, three-Tab bound, exact free/busy target;
    - past and schedule-error fallbacks;
    - no arrow interception or grid role.

### 27.2 Integration/API regression

Run existing suites unchanged in contract:

- auth register/login/logout/session/verification/rate limits;
- room list/filter and schedule route;
- booking validation, adjacency, past, office hours, title;
- simultaneous booking race produces exactly one row;
- owner-only cancellation;
- future/past cursor pagination;
- notification lease, due calculation, dedupe/ack;
- UTC, user zone, office zone and DST transitions.

UI translation must not change expected API codes.

### 27.2.1 Test migration manifest

Existing files are updated in place unless the responsibility column requires
a new pure-unit file. Renaming production modules does not justify dropping an
assertion.

| Existing test/file | Required cycle-2 responsibility |
| --- | --- |
| `tests/unit/week-grid.test.tsx` | Migrate locators to native `Timetable`; normative `rowSpan`, whole-block details trigger, clock semantics, no grid role |
| `tests/unit/schedule-toolbar.test.tsx` | Exact date-strip modes, Today and jump-controls order/bound |
| `tests/unit/schedule-client.test.tsx` | `bookingReducer`, generations, stale create/conflict, stable surface DOM/focus, no resize refetch |
| `tests/unit/booking-dialog.test.tsx` | Become controlled `BookingComposer` assertions; default 30m, field mapping, no fetch/local draft |
| `tests/unit/booking-block.test.tsx` | 48px whole trigger, compact/fit metadata thresholds, no nested Cancel |
| `tests/unit/cancel-booking-dialog.test.tsx` | Presentational dialog + parent controller transitions/stale response |
| `tests/unit/booking-list.test.tsx` | Priority/grouping/cursors, row link + sibling mobile/history Cancel |
| `tests/unit/room-filter.test.tsx` | Parent filter values and modal/non-modal placement behavior |
| `tests/unit/notification-bell.test.tsx` | Five independent lifecycle concepts + `PresentationCoordinator` |
| `tests/unit/verify-page.test.tsx`, `verify-clean-start.test.ts` | Ukrainian states, token history cleanup, unchanged one-shot lifecycle |
| `src/lib/time/browser-zone.test.ts`, `tests/unit/office-time.test.ts` | uk-UA formatters, plural rules, all four zone scenarios and crossing |
| new `tests/unit/day-agenda.test.tsx` | Pure 20-slot projection, every fallback/epoch, error suppression |
| new `tests/unit/ui-errors.test.ts` | Exhaustive code/field map, unknown transport, safe auth return URL |
| `tests/integration/*-api.test.ts`, `booking-race.test.ts` | Keep codes, English machine payload messages and backend behavior unchanged |
| `e2e/schedule.spec.ts`, `mobile.spec.ts` | Geometry, table/agenda, jump controls, reflow |
| `e2e/booking.spec.ts`, `transition.spec.ts` | Three-action default flow, adaptive identity/focus, create/conflict races |
| `e2e/cancellation.spec.ts`, `my-bookings.spec.ts` | Parent-owned cancel outcomes, grouping/deep link |
| `e2e/notifications.spec.ts` | ack/retained/badge/toast/dismiss and modal suppression |
| `e2e/locale.spec.ts`, `timezone.spec.ts` | Ukrainian copy/formatters and deterministic zone fixtures |
| `e2e/smoke.spec.ts`, `auth.setup.ts` | brand/lang/auth return/session state |
| `e2e/exploratory/*.spec.ts` | Replace obsolete English/grid/geometry locators; no release-critical assertion remains exploratory-only |

### 27.3 Deterministic E2E viewports

Required Playwright projects:

| Project | Viewport | Critical assertions |
| --- | --- | --- |
| expanded | `1440x900` | 3 panes, 7 days, internal scroll, 6 visible hours, non-modal booking |
| medium | `1024x768` | 3 days, room-to-booking pane swap, timetable remains visible |
| tablet | `768x1024` | 2 days, date strip, filter sheet, right booking sheet |
| mobile-lg | `390x844` | compact shell/date/filter/agenda/bottom sheet |
| mobile | `360x800` | same flow, no overlap |
| reflow | `320x800` | no document overflow, 3 visible date buttons, full-screen booking sheet |

Усі шість projects виконують лише shared critical path: seeded session,
initial schedule render, exact geometry/overflow/target measurements,
free-slot -> default 30m create for the project's native pointer mode,
Ukrainian brand/copy і zero page-error/hydration warnings. Expanded additionally
executes the same three product actions with mouse and keyboard; `mobile-lg`
executes them with Playwright `hasTouch: true`. Інші stateful flows не
множаться на всю matrix:

| Canonical project | Additional deterministic scenario |
| --- | --- |
| expanded | 2h `rowSpan`, conflict/retry/stale create, non-modal cancellation, My Bookings deep link, bounded keyboard jump |
| medium | room-to-booking pane replacement and timetable visibility |
| tablet | right modal transition, outside-focus resize to/from medium, filter sheet |
| mobile-lg | notification queue/modal suppression and mobile sibling Cancel |
| mobile | agenda epoch fallbacks, keyboard/safe-area overlap |
| reflow | 200% equivalent compact flow, long title, full-screen sheet, forced colors |

Fixture contract:

1. Playwright runs `workers: 1`; seed project runs once; authenticated
   `storageState` is created only by `e2e/auth.setup.ts`.
2. `e2e/fixtures.ts` allocates a unique test prefix for user, room, booking and
   notification records; `afterEach` deletes only that prefix. Tests never
   depend on rows from a previous test.
3. Each test captures one `scenarioNow` before database setup. Ordinary
   bookings use a Monday at least 14 days after `scenarioNow`; assertions derive
   labels through the same test-only office/user-zone oracle, not wall clock.
4. DST scenarios use immutable instants/dates named in
   `e2e/timezone.spec.ts`: equivalent zones, US-only transition, Kyiv-only
   transition and user/office date crossing. They do not use current date.
5. Conflict race uses a database barrier: create competing booking after the
   client request is observed but before its commit response. No arbitrary
   timeout is permitted.
6. Notification due fixtures derive both bookings and lease state from the
   captured `scenarioNow`; poll visibility changes use fake/controlled clock
   where available and event assertions, never sleep-based 60-second waits.
7. Cleanup runs on success/failure; seed and auth identities are read-only
   outside their owner setup. Retry receives fresh prefixed data.

### 27.4 Accessibility browser gates

1. Full keyboard pass без mouse:
   login -> room -> jump day/time -> slot -> default booking -> My Bookings ->
   cancel.
2. Automated Tab trace proves the section 23.2 three-Tab jump bound; no focus
   in inert background and no timetable arrow interception.
3. Focus not obscured checks at each sticky/fixed surface.
4. Actual Chrome 200% zoom at `1440x900`; screenshot + keyboard flow.
5. `320px` CSS viewport at 100%.
6. Playwright `forcedColors: active` plus manual Windows High Contrast
   screenshot for schedule, booking sheet, errors й focus.
7. `prefers-reduced-motion: reduce`; zero essential animation, static loading.
8. Screen reader:
   - NVDA + Chrome on Windows for table headers, slot names, dialog and live
     regions;
   - VoiceOver + Safari spot check for mobile agenda/sheet if environment
     доступне; NVDA pass є mandatory local gate.
9. Contrast calculation for every token pair and visual spot check for text
   rendered over status surfaces.
10. Programmatic target measurement: every standalone control bounding box at
    least `44x44`; every compact booking whole-trigger height at least `44px`
    and contains no nested interactive descendant.
11. Resize focus tests assert `isSameNode`, state/request-generation retention,
    inert order and exact inside/outside fallback targets.

### 27.5 Visual regression evidence

Capture settled schedule and default booking-open state for all six viewports.
Capture loading, empty, error, conflict, success, notification, cancellation,
modal and forced-color variants only in their canonical project from section
27.3; this keeps state fixture scope deterministic without losing a release
state. Compare:

- no overlap/clipping;
- timetable/agenda top;
- stable headers/columns;
- long title;
- user vs office timezone;
- own/other;
- notification with open page;
- bottom nav/safe area.

Every capture records project, state fixture ID, `scenarioNow`, office zone,
user zone and expected responsive mode in snapshot metadata. A screenshot
without the paired geometry/semantic assertions is evidence only, not a pass.

### 27.6 Required commands

```powershell
docker compose --env-file .env.example config --quiet
npm run db:generate
npm run lint
npm run typecheck
npm run check:source
npm test
npm run test:integration
npm run build
npm run test:e2e
```

Obsolete current-design assertions про `44px` slot, `934px` mobile board,
English labels і `<=768px` one-day fallback змінюються лише разом із
replacement assertions з цього plan. Behavioral tests не видаляються.

## 28. Ризики і mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Table `rowSpan` помилково зміщує cells | Неправдиві day/time relations | Pure occupancy model + unit snapshots по adjacency, 30/60/240 min і day edges |
| Responsive renderer дублює fetch/state | Stale або подвійні requests | One `ScheduleWorkspace`; renderers presentational only |
| Pane-to-sheet resize remounts form | Втрата title/end/request state | One stable `AdaptiveBookingSurface`; CSS placement; `isSameNode` E2E |
| Conflict response перезаписує нову navigation | Неправильний schedule | Existing request sequence + conflict generation |
| Stale create succeeded on server | Newer surface closes or schedule lies | Request ID no-op plus room/week background revalidation |
| Cancellation dialog owns fetch | Schedule/history diverge | Parent reducer/request; controlled presentational dialog |
| Translation ламає tests або error branching | Regression auth/booking | Branch by unchanged code, assert localized copy окремо |
| Internal timetable scroll ховає focus | WCAG 2.4.11 failure | `scroll-padding`, focus E2E, no overlay over scrollport |
| Sticky header/bottom nav/toast overlap | Недоступні actions | Reserved layout space + modal toast suppression |
| Forced colors стирає status backgrounds | Own/other/conflict indistinguishable | Text + icon + border-style contract |
| 30-minute block перевантажений | Нечитабельність | 52px row, min type sizes, details surface, long-text tests |
| Native table creates excessive Tab cost | Keyboard path impractical | Three-control jump path; no partial APG grid |
| Date strip internal scroll стає swipe-only | Keyboard/touch failure | Prev/next/Today buttons remain visible |
| My Bookings grouping порушує cursor order | Missing/duplicate rows | Group only after append/dedupe; nearest removed once by ID |
| Notification presentation змінює delivery | Duplicate/lost item | Independent ack/retained/badge/toast/dismiss state and existing integration tests |
| CSS migration має великий blast radius | Cross-screen regressions | Token-first phases, per-surface screenshots, remove old classes last |

## 29. Decision log and open implementation latitude

### 29.1 Normative decision log

| ID | Decision | Не дозволено реалізатору |
| --- | --- | --- |
| D1 | Одна stable `AdaptiveBookingSurface` DOM subtree; CSS placement, hydrated JS behavior | Alternate pane/sheet trees, keyed remount, portal switch |
| D2 | Один typed booking reducer у `ScheduleWorkspace` | Draft/pending/conflict state in `BookingComposer` |
| D3 | Cancellation request/state parent-owned | Fetch або error state у confirmation dialog |
| D4 | Compact booking block цілком є details trigger | Inline/nested Cancel у 7-day cell |
| D5 | Native table + bounded jump controls | Partial `role="grid"` or captured arrows |
| D6 | Same-zone shared user clock; different-zone office row + user-local day/cell | Unlabelled mixed-zone times |
| D7 | Normative validated `rowSpan` projection; malformed input fails whole schedule view | Best-effort shifted cells |
| D8 | Mobile agenda - pure exact 20-slot partition | DOM-derived merging or duplicate continuation rows |
| D9 | Default end `+30 хв`, maximum 4h; three baseline product actions | Different implicit duration/action count |
| D10 | Error/field localization exhaustive by unchanged code/key | Branching on or rendering raw English message |
| D11 | Notification ack/retained/badge/toast/dismiss independent; one presentation coordinator | Badge driven by ack or multiple simultaneous modals |
| D12 | Breakpoints `1360/900/600` and exact geometry budgets | Framework-default breakpoints or viewport-font scaling |

### 29.2 Open implementation latitude

Відкритих product assumptions немає. Реалізатор може обрати лише:

- concrete file split і names усередині component boundaries section 20;
- CSS Modules/Tailwind organization, якщо всі values походять із tokens і
  stable surface DOM/placement contract не змінюється;
- відповідний Lucide icon у межах заданого accessible name;
- skeleton shimmer shape (або static block у reduced motion) у заданій
  row count/geometry;
- test helper/module placement, якщо manifest responsibilities і deterministic
  fixture ownership збережені.

Ця latitude не охоплює copy, breakpoints, state ownership, events,
focus transitions, timezone labels, target dimensions, API identifiers,
notification lifecycle або fallback order. Зміна business contract section 6,
API/error identifier, delivery rule чи non-goal потребує окремого product
decision і нової специфікації.
