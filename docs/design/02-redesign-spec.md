# Roomwork: специфікація редизайну

- **Статус:** Proposed for critic
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
специфікацію затвердженою: поточний статус документа - **Proposed for critic**,
а не Approved.

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

- На `1440x900` верх timetable не нижче `176px` від viewport top.
- На `1024x768` верх timetable не нижче `176px`.
- На `768x1024` верх timetable не нижче `216px`.
- На `390x844`, `360x800` і `320x800` перша agenda row починається не нижче
  `240px`.
- На `1440x900` у внутрішньому scrollport одночасно видно щонайменше 6
  робочих годин.
- Основний desktop booking flow потребує не більше трьох змістовних дій після
  вибору кімнати: вибрати старт, заповнити/перевірити форму, підтвердити.
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

| Code | Видиме повідомлення |
| --- | --- |
| `BOOKING_CONFLICT` | Цей час уже зайнято. Ми оновили розклад; оберіть доступний варіант. |
| `BOOKING_IN_PAST` | Не можна забронювати час у минулому. |
| `BOOKING_OUTSIDE_OFFICE_HOURS` | Оберіть час у межах робочих годин офісу. |
| `EMAIL_NOT_VERIFIED` | Підтвердьте email, щоб бронювати переговорні. |
| `BOOKING_FORBIDDEN` | Можна скасувати лише власне бронювання. |
| `BOOKING_NOT_FOUND` | Бронювання не знайдено або вже скасовано. |
| `ROOM_NOT_FOUND` | Переговорну не знайдено. Оновіть список і виберіть іншу. |
| `INVALID_CREDENTIALS` | Неправильний email або пароль. |
| `EMAIL_TAKEN` | Обліковий запис із цим email уже існує. |
| `RATE_LIMITED` | Забагато спроб. Зачекайте й повторіть. |
| `VERIFICATION_INVALID_OR_EXPIRED` | Посилання недійсне, прострочене або вже використане. |
| `PAYLOAD_TOO_LARGE`, `VALIDATION_FAILED` | Перевірте введені дані. |
| `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR` | Сервіс тимчасово недоступний. Спробуйте ще раз. |

Unknown code отримує стабільний локалізований fallback відповідного surface.
Raw server message не повинен витісняти локалізовану copy або відкривати
technical details.

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
| Expanded | `>=1200px` | 7-day native table | `248px / minmax(0,1fr) / 320px`; room і booking panes non-modal |
| Medium | `900-1199px` | 3-day native table | Default `224px / minmax(0,1fr)`; on selection `minmax(0,1fr) / 320px`, room pane замінюється booking pane |
| Tablet | `600-899px` | 2-day native table, date strip | Single main pane; filters modal sheet; booking modal right sheet `min(384px,100vw)` |
| Mobile | `<600px` | 1-day agenda list | Single main pane; filter sheet; booking bottom sheet, full-screen при висоті `<720px` |

Для 3-day і 2-day modes `day` з URL є anchor. Window починається з anchor і
показує наступні 2 або 1 office dates. Якщо window вийшов би за Sunday, він
зсувається назад і закінчується Sunday. Anchor лишається selected date й має
`aria-current="date"`.

### 11.1 Expanded `1440x900`

- App header: `64px`, sticky top, one row.
- Workspace: `height: calc(100dvh - 64px)`, no page-level vertical scroll.
- Columns: room pane `248px`, timetable flexible with minimum `760px`,
  booking pane `320px`.
- Room і booking panes мають власний vertical scroll лише коли content не
  вміщується.
- Timetable toolbar + room summary: максимум `96px`.
- Timetable header: `56px`, sticky inside schedule scrollport.
- Time gutter: `64px`, sticky left.
- Slot row: `52px`; 20 rows = `1040px`; vertical scroll відбувається тільки
  всередині timetable.
- Seven days fit without horizontal scroll at `1440px`.
- Верх timetable не нижче `176px`; у scrollport видно щонайменше 12 slot rows,
  тобто 6 годин.
- Contextual pane завжди займає 320px. Без selection він показує heading
  `Деталі бронювання`, room summary і status `Оберіть вільний час у розкладі`.

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

### 11.3 Tablet `768x1024`

- Compact top app bar: `56px`; brand, active destination, bell, account menu.
- Schedule header і controls: максимум `160px`.
- Date strip: сім office dates у внутрішньому horizontal scrollport; selected
  date завжди brought into view без animated scroll при reduced motion.
- Одночасно видно selected day і наступний день. Якщо selected day - Sunday,
  показуються Saturday + Sunday, а selected day лишається URL anchor.
- Previous/next day та `Сьогодні` лишаються окремими кнопками; жодна дія не
  залежить від swipe.
- Room summary - одна `56px` control row; `Фільтри` відкриває modal sheet із
  room list і capacity.
- Верх timetable не нижче `216px`.
- Booking відкривається як right modal sheet шириною `384px`, full height,
  з `aria-modal="true"` і inert background.
- Немає horizontal overflow document; table займає доступну ширину.

### 11.4 Mobile `390x844`, `360x800`, `320x800`

- Top app bar: `56px`; `Roomwork`, bell, account menu.
- Bottom navigation: `56px + env(safe-area-inset-bottom)`; два destinations.
- Main content має bottom padding, рівний nav + `16px`, щоб focus і остання
  agenda action не перекривалися.
- Page heading `Бронювання переговорних` - `20px`, без eyebrow.
- Compact date/navigation region: максимум `112px`.
- Date strip - внутрішньо scrollable, із `64px` date buttons; при `320px`
  одночасно видно щонайменше три дати. `Сьогодні` і chevrons видимі поза
  scrollable частиною.
- Filter row: selected room + capacity summary; одна кнопка `Фільтри`,
  minimum `44px`.
- Agenda починається не нижче `240px`.
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
   при `>=1200px`.
2. Primary nav: `Розклад`, `Мої бронювання`; active destination має
   `aria-current="page"`, icon і 2px bottom indicator.
3. Utilities: user name, notification bell, account menu.

`Вийти` переноситься в account menu, щоб header не розширювався через довге
ім'я. При `>=1200px` account button показує обрізане до 20 characters видиме
ім'я; при `900-1199px` показує initials. В обох режимах accessible name містить
повне ім'я.

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

Обов'язкова структура:

```html
<table>
  <caption>Розклад переговорної ...</caption>
  <thead>
    <tr>
      <th scope="col">Час</th>
      <th scope="col">...</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">09:00</th>
      <td><!-- booking або free-slot button --></td>
    </tr>
  </tbody>
</table>
```

Правила:

- кожний 30-хвилинний start - окремий table row;
- day headers - `th scope="col"`, time labels - `th scope="row"`;
- booking на кілька слотів використовує truthful `rowSpan`;
- occupied continuation cells не дублюються;
- actionable free cell містить один native `button`;
- cell, `td`, `th` не отримують `tabindex`;
- `role="grid"`, `gridcell`, `row` та custom arrow-key navigation видаляються;
- keyboard model - стандартний document/table flow і Tab між controls;
- Arrow keys не перехоплюються та зберігають browser scroll behavior;
- caption завжди visually hidden і доступне screen reader; visible room/date
  summary над table не дублюється всередині table;
- поточний день має `aria-current="date"` на header;
- deep-linked booking має `aria-current="true"` і visible `Обране` label;
- current-time line `aria-hidden="true"`; окремий visually hidden status у
  current row повідомляє `Поточний час {time}`.

Цей контракт тестується DOM assertions: `<table>`, header scopes, row count,
`rowSpan`, відсутність `role="grid"` і відсутність arrow-key handlers.

### 13.5 Mobile day agenda semantics

Mobile використовує:

```html
<section aria-labelledby="agenda-date">
  <h2 id="agenda-date">...</h2>
  <ol aria-label="Розклад на ...">
    <li><!-- free start або busy booking --></li>
  </ol>
</section>
```

- chronological DOM order;
- free item: `<time>` + button `Забронювати`;
- busy item: title, range, author, ownership/status text;
- booking тривалістю 30-240 хв з'являється один раз;
- past free slots показують `Минув` як non-interactive text тільки для
  поточної дати; future dates не мають цього label;
- now marker є list separator `Зараз, {time}` і не забирає focus;
- empty bookings не означає empty agenda: free times усе одно видимі;
- якщо schedule data відсутні через error, booking actions не рендеряться.

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

Для 30-хвилинного block:

- visual height minimum `48px` усередині `52px` row;
- title `13px/16px`, semibold, одна line;
- metadata `12px/16px`: range + author;
- title не менше 13px, metadata не менше 12px;
- cancel icon для own booking - окремий `44x44px` target, який не накриває
  title;
- якщо available width не вміщує всі дані, block activation відкриває read-only
  details у contextual pane/sheet; visible block лишає title + range, а author
  має видимий avatar/initial + accessible full text;
- unbroken 100-character title не розширює column і доступний повністю в
  details surface.

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

## 14. Booking flow

### 14.1 Entry

1. Користувач активує visible free-slot button.
2. Controller створює `StartSlotSelection` із `roomId`, `roomName`, UTC
   `startsAt`, user-zone labels.
3. `buildBookingEndTimeOptions` обчислює 30-хвилинні end options до найранішої
   межі: start + 4 години, office close, next booking.
4. Expanded/medium показує non-modal booking pane; tablet/mobile - modal sheet.
5. Initial focus переходить у `Назва`.

Room, date і start не вводяться повторно. Вони показані read-only summary.

### 14.2 Form

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

### 14.3 Conflict

На `BOOKING_CONFLICT`:

1. Pane/sheet лишається відкритим.
2. Title, start selection і current end зберігаються.
3. Alert показує conflict copy.
4. Старий timetable лишається видимим, але має busy overlay/status
   `Оновлюємо доступність`.
5. Controller increment request sequence/refresh generation і запитує active
   room/week.
6. Delayed old response і response після close/navigation ігноруються.
7. Після success timetable замінюється атомарно.
8. End options recompute. Якщо selected end ще валідний, він лишається. Якщо
   ні, обирається перший валідний end і polite status оголошує
   `Час завершення змінено відповідно до оновленої доступності`.
9. Якщо start зайнятий, end select disabled, title збережений, primary disabled,
   а slot у timetable отримує conflict/highlight state.
10. Refresh error зберігає старий timetable і draft; button
    `Повторити оновлення` запускає ту саму generation-safe операцію.

### 14.4 Success

- response success закриває composer;
- schedule refresh;
- polite status/toast `Бронювання створено`;
- focus повертається на створений booking block; якщо block ще не змонтований,
  на day heading;
- URL room/week/day лишаються;
- toast не перекриває pane actions або mobile bottom nav.

### 14.5 Close

- Non-modal pane: close повертає focus на invoking slot і лишає timetable
  position.
- Modal sheet: background inert; Escape і visible close працюють, якщо submit
  не pending.
- Якщо invoking slot зник після refresh, fallback: той самий time cell, далі
  next available slot, далі day heading.
- User-initiated close очищає draft. Resize між modes draft не очищає.

## 15. Cancellation

- Cancel доступний тільки для own upcoming booking.
- Booking row/block і Cancel є sibling controls; немає nested interactive
  elements.
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

### 18.1 Data behavior

`NotificationCenter` зберігає:

- immediate poll;
- interval `60_000ms` лише коли document visible;
- GET response validation;
- ID deduplication;
- POST acknowledgement після прийняття valid item;
- abort on unmount;
- silent malformed/failed polling response.

### 18.2 Presentation

- Bell target `44x44px`.
- Accessible name: `Сповіщення` або `Сповіщення, {n} непрочитаних`.
- Badge cap `9+`; badge не є єдиним сигналом.
- Expanded/medium/tablet: anchored non-modal popover, width `360px`, max-height
  `min(480px, calc(100dvh - 88px))`.
- Mobile: modal bottom sheet із heading `Сповіщення`.
- Notification copy:
  `"{currentTitle}" скоро завершиться в {roomName}. Далі -
  {nextAuthorName}.`
- Кожний item має `Dismiss` як `Закрити сповіщення`, target `44x44px`.
- Новий item додає badge і polite toast. Якщо modal booking/cancellation sheet
  відкритий, toast не показується поверх нього; badge оновлюється, а toast
  з'являється після close.
- Dismiss focused item -> focus next notification; якщо його немає - bell.
- Polling error не створює assertive alert.

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
| `AppShell` | header/nav/main/bottom nav composition | account menu open, compact nav presentation | notifications, page data |
| `NotificationCenter` | poll, validate, dedupe, ack, display | notifications, expanded, request controllers | schedule state |
| `ScheduleWorkspace` | controller і single source of truth | `minCapacity`, rooms, selected room, week/day, user zone, schedule request state, request sequence, start selection, cancellation, toast, refresh generations, visible time anchor | field DOM і responsive rendering |
| `RoomPicker` | room list і capacity controls | none | room fetch, selected room |
| `RoomFilterSurface` | place `RoomPicker` у pane або modal sheet | filter sheet open/closed | filter values, room data |
| `ScheduleNavigation` | date controls/date strip | internal scroll position only | week/day source of truth |
| `useResponsiveMode` | subscribe to CSS-width media queries | external-store snapshot `expanded/medium/tablet/mobile` | domain state |
| `ScheduleViewport` | render exactly one 7/3/2/day renderer | none; receives responsive mode | fetches, URL, domain selection |
| `Timetable` | semantic table and slot rendering | none | requests, form draft |
| `DayAgenda` | semantic chronological list | one-time scroll anchor ref | requests, form draft |
| `BookingComposer` | shared form model for pane/sheet | title, endsAt, field/form errors, pending | schedule fetch, conflict generation |
| `BookingPane` | non-modal shell | none | form state |
| `BookingSheet` | modal/inert/focus shell | none | form state |
| `BookingBlock` | booking presentation and own cancel affordance | details disclosure only | cancellation request |
| `CancellationDialog` | confirmation request | pending, error | parent list/schedule data |
| `MyBookingsController` | two independent paginated queries | future, past, cancellation, toast, user zone | grouping markup |
| `BookingGroups` | derive next/date/month groups | none | fetching/cursors |
| `AuthForm` variants | submit and field feedback | field values/browser DOM, pending, errors | session persistence |
| `VerificationStatus` | one-shot token lifecycle | verification state, request ref | resend |

### 20.2 Ownership invariants

1. `ScheduleWorkspace` лишається єдиним власником URL-backed selection.
2. `useResponsiveMode` використовує `useSyncExternalStore` і `matchMedia` для
   exact boundaries `1200`, `900`, `600 CSS px`. Server snapshot - `mobile`;
   client snapshot оновлюється після hydration без markup mismatch.
3. У DOM одночасно існує рівно один із `Timetable` або `DayAgenda`; CSS не
   приховує duplicate semantic renderers.
4. Responsive mode ніколи не запускає другий rooms/schedule fetch.
5. `visibleTimeAnchor` є UTC instant найближчої верхньої видимої row. Renderer
   оновлює його на settled scroll, а новий renderer відновлює найближчу row без
   переміщення focus.
6. `BookingComposer` не remount при pane-to-sheet resize; draft keyed by
   `roomId + startsAt`, не viewport.
7. Conflict refresh належить controller, а не presentational pane.
8. `bookingId` highlight очищається при explicit room/week/day navigation, але
   зберігається при initial deep-link restoration.
9. Room/filter response, schedule response і conflict response мають окремі
   AbortController/sequence guards.
10. My Bookings future/past errors і cursors не зливаються в один state.
11. Grouping не змінює API order і не дублює nearest booking.
12. Localized UI message визначається frontend mapping; raw code зберігається
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
-> Resize -> DraftOpen in new shell
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
- Tab stops: free-slot buttons, booking details controls, own Cancel.
- Arrow keys are not captured.
- Week/day navigation buttons are before table in DOM.
- Table caption names room, visible date range і timezone.
- Each free-slot accessible name:
  `Забронювати {date}, {time}, переговорна {room}`.
- Booking accessible name:
  `{title}, {start}-{end}, автор {name}, Ваше|Зайнято`.

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
- controls: 1px `ButtonText`;
- focus: `2px solid Highlight`, outer separation `Canvas`;
- selected: `2px solid Highlight` + text `Обране`;
- own booking: double `ButtonText` leading border + `Ваше`;
- other booking: single solid border + `Зайнято`;
- conflict: dashed border + `Конфлікт`;
- current-time line: `Highlight`, 2px;
- SVG icons inherit `currentColor`;
- `forced-color-adjust:none` використовується тільки для elements, де system
  colors задані явно.

## 25. Migration plan

### Phase 1: contract freeze

- Зафіксувати поточні API, URL, timezone, race, pagination і notification tests.
- Додати locale copy map без зміни error codes.
- Визначити obsolete geometry assertions окремим списком.

### Phase 2: token foundation and shell

- Додати semantic tokens.
- Уніфікувати shared Button, Field, Alert, Dialog, Toast, Spinner.
- Оновити `lang`, metadata, app/auth brand і navigation.
- Не змінювати schedule behavior.

### Phase 3: schedule semantics

- Винести controller state з current `ScheduleClient` без зміни ownership.
- Замінити partial ARIA grid на native `Timetable`.
- Додати `DayAgenda`.
- Зберегти timezone conversion, end-time options і URL restoration.

### Phase 4: adaptive panes

- Додати RoomPane, ScheduleNavigation/date strip і responsive viewport.
- Додати shared BookingComposer, non-modal pane та modal sheet shells.
- Перевірити resize зі збереженим draft.

### Phase 5: secondary surfaces

- Перегрупувати My Bookings як derived view.
- Уніфікувати auth/verify.
- Перенести notification presentation без зміни polling.

### Phase 6: accessibility hardening

- Inert modal background, deterministic focus fallback.
- Forced colors, reduced motion, focus scroll padding.
- `320px`, 200% zoom, long text, locale і touch target gates.

### Phase 7: cleanup

- Розділити monolithic styling за component ownership, не змішуючи Tailwind і
  raw literals усередині одного component.
- Видалити obsolete classes і geometry tests тільки після replacement coverage.
- Не залишати compatibility dead code або dual renderers поза defined modes.

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
- **AC-009:** Timetable/agenda top відповідає межам section 11.
- **AC-010:** Expanded schedule scrolls internally; document не scrolls через
  1040px timetable.
- **AC-011:** Free-slot affordance visible before hover; mobile має text action.
- **AC-012:** 30-minute booking показує readable title, time і author/ownership.
- **AC-013:** Own/other/current/selected/conflict відмінні text/icon/shape, не
  лише кольором.
- **AC-014:** Native table має truthful headers/rowSpan; mobile agenda -
  chronological list; `role="grid"` відсутній.

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

### Accessibility і quality

- **AC-029:** Усі interactive targets `>=44x44 CSS px`.
- **AC-030:** `320px`, actual 200% zoom, forced colors і reduced motion gates
  проходять.
- **AC-031:** Focus-visible не obscured; modal background inert; focus
  restoration deterministic.
- **AC-032:** Text/background і non-text contrast відповідають section 24.
- **AC-033:** Long 100-character unbroken title не створює overflow.
- **AC-034:** No page-level horizontal overflow на всіх required viewports.
- **AC-035:** Existing server, interval, race, timezone, pagination,
  notification й auth tests лишаються green.

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
   - multi-slot `rowSpan`;
   - no `role="grid"`/`gridcell`;
   - free action visible class/content;
   - own/other labels;
   - current/deep-link states.
5. `DayAgenda`:
   - chronological order;
   - busy multi-slot item once;
   - free action text;
   - past state;
   - no action when schedule unavailable.
6. Responsive mode:
   - exact snapshots at `599/600/899/900/1199/1200 CSS px`;
   - one semantic renderer in DOM;
   - resize preserves booking draft і visible time anchor;
   - resize does not refetch rooms/schedule.
7. `ScheduleWorkspace` existing race tests:
   - superseded room/week response ignored;
   - popstate delayed response ignored;
   - filtered room reactivation does not show stale controls;
   - cancelled block preserved until refresh;
   - conflict refresh generation and retry;
   - day/week navigation clears failed conflict.
8. `BookingComposer`:
   - end option selection updates summary/payload;
   - 30 min through 4 h;
   - selected end retained if valid;
   - removed end resets to first valid and announces;
   - no end disables submit;
   - title required/max 100;
   - `EMAIL_NOT_VERIFIED`;
   - `BOOKING_CONFLICT`;
   - duplicate submit blocked;
   - resize does not clear draft.
9. Dialog/sheet:
   - inert toggled with modal;
   - Tab loop includes dynamic Retry;
   - Escape/X policy during pending;
   - invoker/fallback focus.
10. My Bookings:
   - independent future/past states;
   - nearest not duplicated;
   - user-zone grouping;
   - cursor append/dedupe;
   - load-more retry;
   - link before sibling Cancel.
11. Notifications:
    - immediate/60-second visible polling;
    - malformed/failed ignored;
    - dedupe/ack;
    - dismiss focus fallback;
    - toast suppression while modal open.
12. Auth/verify:
    - Ukrainian labels;
    - autocomplete tokens;
    - field associations;
    - pending and every verify state.

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

Кожний project перевіряє:

- sign in/session persistence;
- room and capacity filter;
- previous/next/Today URL;
- free slot -> title/end -> create;
- 2-hour multi-slot block;
- conflict draft preservation + refreshed schedule;
- own cancel confirmation;
- My Bookings deep link/highlight;
- notification without overlap;
- no page errors/hydration warnings.

### 27.4 Accessibility browser gates

1. Full keyboard pass без mouse:
   login -> room -> date -> slot -> booking -> My Bookings -> cancel.
2. Tab count/order documented; no focus in inert background.
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
10. Programmatic target measurement: every visible control bounding box at
    least `44x44`.

### 27.5 Visual regression evidence

Capture settled, loading, empty, error, conflict, success, modal і forced-color
screens for all six viewports. Compare:

- no overlap/clipping;
- timetable/agenda top;
- stable headers/columns;
- long title;
- user vs office timezone;
- own/other;
- notification with open page;
- bottom nav/safe area.

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
| Pane-to-sheet resize remounts form | Втрата title/end | `BookingComposer` вище responsive shell, keyed selection |
| Conflict response перезаписує нову navigation | Неправильний schedule | Existing request sequence + conflict generation |
| Translation ламає tests або error branching | Regression auth/booking | Branch by unchanged code, assert localized copy окремо |
| Internal timetable scroll ховає focus | WCAG 2.4.11 failure | `scroll-padding`, focus E2E, no overlay over scrollport |
| Sticky header/bottom nav/toast overlap | Недоступні actions | Reserved layout space + modal toast suppression |
| Forced colors стирає status backgrounds | Own/other/conflict indistinguishable | Text + icon + border-style contract |
| 30-minute block перевантажений | Нечитабельність | 52px row, min type sizes, details surface, long-text tests |
| Date strip internal scroll стає swipe-only | Keyboard/touch failure | Prev/next/Today buttons remain visible |
| My Bookings grouping порушує cursor order | Missing/duplicate rows | Group only after append/dedupe; nearest removed once by ID |
| Notification presentation змінює delivery | Duplicate/lost item | Preserve polling/ack component state and existing unit tests |
| CSS migration має великий blast radius | Cross-screen regressions | Token-first phases, per-surface screenshots, remove old classes last |

## 29. Open assumptions

Відкритих припущень немає. Breakpoints, responsive behavior, semantic model,
copy language, token values, component boundaries, state ownership, focus
policy, migration order і test gates визначені цим документом.

Зміна будь-якого business contract із section 6, API/error identifier,
notification delivery rule або non-goal потребує окремого product decision і
нової специфікації. Візуальна реалізація в межах наведених tokens і measurable
criteria може уточнювати micro-layout, але не може змінювати key decisions.
