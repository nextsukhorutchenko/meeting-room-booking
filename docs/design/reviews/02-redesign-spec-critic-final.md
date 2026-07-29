# Final scoped quality gate: 02-redesign-spec

- **Дата gate:** 2026-07-29
- **Reviewer role:** незалежний critic для scoped closure check
- **Reviewed revision:** `4869c4a5207ea24e615ccf5809b4dd8b45942f4e`
- **Scope:** лише C2-M1-C2-M4 і C2-S1-C2-S4 з
  `docs/design/reviews/02-redesign-spec-critic-2.md:79-243`, плюс перевірка
  нових формулювань у зачеплених секціях на critical contradiction
- **Not performed:** третій повний product/spec review
- **Verdict:** **APPROVED**
- **Weighted total:** **92.04/100**
- **Critical findings:** **0**
- **Open must-fix findings:** **0**

## 1. Gate result

| Gate | Result | Evidence |
| --- | --- | --- |
| Critical findings = `0` | PASS | У scoped diff не виявлено втрати business/API contract або нової critical суперечності. |
| Must-fix findings = `0` | PASS | C2-M1-C2-M4 закриті нормативними рішеннями та tests. |
| Weighted total `>=85` | PASS | `92.04/100`. |
| Every category `>=70` | PASS | Найнижча категорія - scope/risk, `82/100`. |
| Implementable/testable | PASS | Ownership, ordering, geometry, values, focus і expected test outcomes визначені без ключового invention. |

**Final gate: PASS. Verdict: APPROVED.**

## 2. Scoped finding closure

### C2-M1 - PASS

**Finding:** visible projector міг трактувати валідні hidden-day bookings із
weekly API як malformed.

**Closure evidence:**

- Spec прямо фіксує full office-week API input і двофазний pipeline
  (`docs/design/02-redesign-spec.md:790-795`).
- Phase A валідовує всі seven-day bookings і overlap у full `7 x 20` matrix
  до filtering (`docs/design/02-redesign-spec.md:797-810`).
- Phase B лише після successful validation відбирає visible days; валідні
  hidden bookings не є error і не займають visible coordinates
  (`docs/design/02-redesign-spec.md:812-829`).
- Agenda використовує той самий full-week validator, а не weaker one-day path
  (`docs/design/02-redesign-spec.md:858-880`).
- Hidden-before/after, malformed-visible, malformed-hidden і boundary fixtures
  нормативні (`docs/design/02-redesign-spec.md:846-856`,
  `docs/design/02-redesign-spec.md:2248-2274`).

**Result:** C2-M1 closed. Порядок validate -> filter -> project однозначний і
сумісний із незміненим weekly API.

### C2-M2 - PASS

**Finding:** coordinator не охоплював filter modal і booking-to-cancellation
handoff, що дозволяло nested dialogs або undefined focus/inert state.

**Closure evidence:**

- `ModalOwner` тепер exhaustive для `room-filter`, `booking`, `cancellation`,
  `notifications` і `null` (`docs/design/02-redesign-spec.md:1481-1497`).
- Coordinator є єдиним owner role/aria/inert/focus; filter surface controlled,
  а domain state лишається у page controllers
  (`docs/design/02-redesign-spec.md:1499-1509`,
  `docs/design/02-redesign-spec.md:1638-1657`,
  `docs/design/02-redesign-spec.md:1685-1689`).
- Active-modal ordering спочатку de-modalizes/hides outgoing surface, потім
  activates incoming surface без intermediate paint; denied events не мають
  side effects (`docs/design/02-redesign-spec.md:1511-1528`).
- Filter open/apply/close, booking -> cancellation, Keep, error-close, success,
  direct cancellation, notification і route transitions мають exact owner,
  aria/inert і focus outcomes (`docs/design/02-redesign-spec.md:1530-1546`).
- Resize while cancellation owns presentation і toast suppression for every
  owner також визначені (`docs/design/02-redesign-spec.md:1548-1570`).
- Unit/browser gates перевіряють exactly one `aria-modal`, no inert focus,
  restore targets і suppression (`docs/design/02-redesign-spec.md:2226-2229`,
  `docs/design/02-redesign-spec.md:2311-2324`,
  `docs/design/02-redesign-spec.md:2494-2498`).

**Result:** C2-M2 closed. Новий handoff не створює nested modal і не залишає
implementer-owned focus decision.

### C2-M3 - PASS

**Finding:** mobile 48px row одночасно вимагав room/filter і суперечливу
кількість full timezone lines.

**Closure evidence:**

- Room/action row має exact 48px two-line fit і окремий 44x44 filter track;
  long room truncation та повне альтернативне представлення визначені
  (`docs/design/02-redesign-spec.md:529-548`).
- Full IANA timezone content винесено в окремий auto-height `ZoneNotice` з
  двома visible lines та `overflow-wrap:anywhere`
  (`docs/design/02-redesign-spec.md:549-555`,
  `docs/design/02-redesign-spec.md:685-703`).
- Normal-zoom 320px long-room/long-IANA budget дорівнює `296px`, у межах
  brief `<=300px`; equivalent-zone budget `252px`
  (`docs/design/02-redesign-spec.md:557-580`).
- 200% zoom окремо пріоритизує auto-height reflow без clipping/overflow, а не
  помилково зберігає normal-zoom density (`docs/design/02-redesign-spec.md:592-602`).
- AC і unit/E2E gates містять exact long fixture та обидва zoom contracts
  (`docs/design/02-redesign-spec.md:2230-2233`,
  `docs/design/02-redesign-spec.md:2286-2289`,
  `docs/design/02-redesign-spec.md:2444-2446`).

**Result:** C2-M3 closed. У touched geometry немає суперечності між line count,
full IANA visibility, normal-zoom top і 200% reflow.

### C2-M4 - PASS

**Finding:** notification, отримане при open center, могло одночасно бути
видимим, unseen і queued for later toast.

**Closure evidence:**

- `POLL_VALID` має окремі exhaustive branches для `centerOpen=false/true`
  (`docs/design/02-redesign-spec.md:1450-1455`).
- Open-center delivery одразу `seen=true`, badge не росте, toast не enqueue;
  duplicate лише оновлює metadata і повторює independent ack
  (`docs/design/02-redesign-spec.md:1455-1458`).
- Close/navigation не синтезують toast для seen items; persistent state і reset
  boundaries визначені (`docs/design/02-redesign-spec.md:1461-1479`).
- Presentation contract повторює badge/queue outcome
  (`docs/design/02-redesign-spec.md:1602-1606`).
- AC та tests охоплюють first/duplicate while open, close, navigation і ack
  independence (`docs/design/02-redesign-spec.md:2234-2236`,
  `docs/design/02-redesign-spec.md:2338-2349`).

**Result:** C2-M4 closed. Reachable poll-while-open transition має один
детермінований state outcome.

### C2-S1 - PASS

Expanded closed state тепер лишається тим самим visible
`AdaptiveBookingSurface` із `role="region"` і guidance; medium/compact closed
state hidden та unfocusable (`docs/design/02-redesign-spec.md:449-454`,
`docs/design/02-redesign-spec.md:1027-1055`). AC/test повторюють обидві
гілки (`docs/design/02-redesign-spec.md:2131-2133`,
`docs/design/02-redesign-spec.md:2280-2287`).

### C2-S2 - PASS

96.85px gate тепер задає inner dimensions, exact two-line layout, status
icon/text no-shrink і 100-character title fixture; усі bounds мають бути
всередині trigger без overlap (`docs/design/02-redesign-spec.md:944-1003`).
AC-049 робить цей fit release condition
(`docs/design/02-redesign-spec.md:2237-2238`).

### C2-S3 - PASS

Jump day value є office ISO date; time value - exact UTC ISO instant зі stable
slot index. Same/different-zone visible й accessible labels, date crossing і
per-day DST recomputation визначені (`docs/design/02-redesign-spec.md:1912-1935`).
AC/test coverage explicit (`docs/design/02-redesign-spec.md:2154-2157`,
`docs/design/02-redesign-spec.md:2363-2370`).

### C2-S4 - PASS

Decision log тепер містить окремі normative D7-D16 для всіх scoped рішень
(`docs/design/02-redesign-spec.md:2566-2585`). Open latitude прямо виключає
validation/filter order, modal ownership, mobile geometry/reflow, timezone
labels і notification open-center lifecycle
(`docs/design/02-redesign-spec.md:2587-2606`).

## 3. New contradiction check

Перевірені лише змінені contracts, що закривали scoped findings:

- full-week validation -> visible filtering -> table/agenda projection;
- room filter and booking/cancellation modal ownership;
- 320px normal-zoom geometry and 200% reflow;
- notification poll/open/close/navigation;
- expanded closed booking surface;
- compact booking block bounds;
- jump-control values/labels;
- decision log and test gates.

**Result:** нової critical або must-fix суперечності в цих секціях не
виявлено. Додані acceptance criteria і tests відповідають нормативним state/
geometry contracts; жоден scoped blocker не перенесено в implementation
latitude.

## 4. Final weighted scorecard

Weights are unchanged from critic cycles 1 and 2. Scores outside the scoped
categories are not based on a new full review; they retain prior evidence and
receive only scoped adjustments supported above.

| Category | Weight | Score | Weighted contribution |
| --- | ---: | ---: | ---: |
| Відповідність PDF | 10 | 96 | 9.60 |
| Збереження реалізованої поведінки | 15 | 94 | 14.10 |
| Швидкість бронювання | 10 | 94 | 9.40 |
| Читабельність календаря | 10 | 92 | 9.20 |
| Desktop UX | 8 | 94 | 7.52 |
| Tablet UX | 8 | 90 | 7.20 |
| Mobile UX | 10 | 90 | 9.00 |
| WCAG 2.2 AA | 12 | 91 | 10.92 |
| Технічна реалістичність | 7 | 90 | 6.30 |
| Обсяг/ризик змін | 5 | 82 | 4.10 |
| Тестованість | 5 | 94 | 4.70 |
| **Total** | **100** |  | **92.04** |

## 5. Final verdict

| Condition | Final value | Result |
| --- | ---: | --- |
| Critical | `0` | PASS |
| Must-fix | `0` | PASS |
| Total | `92.04 >= 85` | PASS |
| Minimum category | `82 >= 70` | PASS |
| Implementable/testable | yes | PASS |

**APPROVED.** Spec status may be set to `Approved after critic gate`.
