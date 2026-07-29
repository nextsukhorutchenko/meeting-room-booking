# Adversarial review: 02-redesign-spec, critic 1

- **Дата review:** 2026-07-29
- **Reviewer role:** незалежний агент-критик; reviewer не писав і не редагував
  `docs/design/02-redesign-spec.md`
- **Reviewed spec:** `docs/design/02-redesign-spec.md` at `5e09bfa`
- **Application baseline used by the audit:** `6b74bde`
- **Verdict:** **FAIL - повернути автору spec**
- **Weighted total:** **70.33/100**
- **Critical findings:** 0
- **Must-fix findings:** 9
- **Should-fix findings:** 6

## 1. Gate verdict

| Gate | Result | Evidence |
| --- | --- | --- |
| No critical findings | PASS | Critical findings відсутні. |
| No must-fix findings | FAIL | Відкриті M1-M9. |
| Weighted total `>=85` | FAIL | `70.33/100`. |
| Every category `>=70` | FAIL | Calendar readability, desktop, mobile, WCAG, technical feasibility, scope/risk and testability are below 70. |
| Implementable and testable without key invention | FAIL | Responsive form ownership, conflict ownership, timezone table semantics, mobile geometry and notification state still require product/architecture decisions. |

**Gate result: FAIL.** Реалізацію не можна починати за правилами brief
(`pasted-text.txt:240-265`). Spec має пройти щонайменше один цикл виправлення і
повторний critic review.

## 2. Weighted score

Weights are critic-defined and sum to 100. Higher weight is assigned to
preserving implemented behavior and WCAG because the product is already
functionally mature (`docs/design/01-current-state-audit.md:722-739`).

| Category | Weight | Score | Weighted contribution | Rationale |
| --- | ---: | ---: | ---: | --- |
| Відповідність PDF | 10 | 92 | 9.20 | Core auth, room, week, timezone, booking, ownership and history requirements are retained (`02-redesign-spec.md:123-141`); the service note is correctly ignored (`02-redesign-spec.md:41-43`). |
| Збереження реалізованої поведінки | 15 | 76 | 11.40 | Contracts are inventoried well, but session-expiry errors, localized field errors, notification acknowledgement/dismissal and responsive focus transitions are incomplete. |
| Швидкість бронювання | 10 | 72 | 7.20 | Room/date/start are prefilled, but default duration is unspecified and native-table Tab traversal can still require dozens of stops. |
| Читабельність календаря | 10 | 64 | 6.40 | Table/list direction is sound, but 7-day density, 44px cancel, per-day clocks and required visible metadata conflict. |
| Desktop UX | 8 | 68 | 5.44 | Three panes fit arithmetically at 1440, but the 30-minute own-booking content contract does not fit the resulting day width. |
| Tablet UX | 8 | 78 | 6.24 | The 2-day/date-strip model is a real tablet solution; resize focus and composer preservation remain unresolved. |
| Mobile UX | 10 | 60 | 6.00 | Agenda is the right pattern, but row completeness, auto-position fallbacks and the `<=240px` top target are not implementable as written. |
| WCAG 2.2 AA | 12 | 67 | 8.04 | Strong contrast, forced-colors and modal intent; unresolved table headers, modal transition focus, excessive Tab stops and notification focus prevent a release gate. |
| Технічна реалістичність | 7 | 58 | 4.06 | Separate pane/sheet shells, composer-owned draft and no-remount invariant contradict each other; conflict ownership is split across components. |
| Обсяг/ризик змін | 5 | 62 | 3.10 | The plan changes shell, schedule semantics, responsive model, all copy, auth, history, notifications and the global CSS system without per-phase rollback gates. |
| Тестованість | 5 | 65 | 3.25 | The plan is broad, but key geometry terms, agenda partitioning, ownership events and notification semantics are not assertable yet. |
| **Total** | **100** |  | **70.33** |  |

## 3. Critical findings

None. The spec does not intentionally remove a PDF business rule, weaken
server overlap/ownership protection, or rename an API contract. The blockers
below are still release-gating must-fix issues because implementers would have
to invent key behavior or would be unable to satisfy simultaneous acceptance
criteria.

## 4. Must-fix findings

### M1. Responsive composer architecture cannot guarantee both one DOM and preserved local state

**Categories:** technical feasibility, tablet, mobile, WCAG
**Severity:** must-fix

The boundary map defines separate `BookingPane` and `BookingSheet` shells while
`BookingComposer` owns title, end time, errors and pending
(`docs/design/02-redesign-spec.md:886-893`). The invariants then require the
composer not to remount during pane-to-sheet resize
(`docs/design/02-redesign-spec.md:902-913`). A conditional switch between two
different shell component types normally replaces that subtree. The suggested
"composer above responsive shell" is not represented in the boundary map and
does not explain where modal role, inert background, portal placement and
scroll ownership live.

Focus behavior across the same transition is also missing. A draft can become a
modal sheet while focus remains in the timetable; that timetable then becomes
inert. Conversely, leaving modal mode must release inert and preserve or restore
focus. The spec only defines open/close focus, not resize focus
(`docs/design/02-redesign-spec.md:1147-1162`).

The responsive renderer itself is feasible: exactly one 7/3/2/day renderer can
be mounted from shared schedule data. However, server snapshot `mobile`
(`docs/design/02-redesign-spec.md:902-907`) means desktop first receives compact
markup and swaps after hydration. "No hydration mismatch" does not prove no
wrong-mode interaction, layout shift or focus loss.

**Required correction:**

1. Define one concrete adaptive surface structure. Either use one stable
   `AdaptiveBookingSurface` DOM subtree whose role/classes change, or hoist the
   complete form state above replaceable shells.
2. Define exact focus behavior for non-modal -> modal and modal -> non-modal
   resize, including when focus is in the timetable, in the form, or on a
   dynamically added Retry control.
3. Define SSR behavior before the client width is known and an acceptance limit
   for wrong-mode interactive content/CLS.
4. Add a test proving the same title, selected end, validation state, pending
   guard and focused logical control survive both resize directions.

### M2. Conflict and cancellation request ownership is contradictory

**Categories:** preservation, technical feasibility, testability
**Severity:** must-fix

`ScheduleWorkspace` is said to own start selection, cancellation, toast,
refresh generations and schedule request state
(`docs/design/02-redesign-spec.md:877-883`). `BookingComposer` separately owns
form errors and pending, while the controller owns conflict refresh
(`docs/design/02-redesign-spec.md:890-914`). The conflict algorithm requires
parsing `BOOKING_CONFLICT`, preserving title/start/end, refreshing, recomputing
end options, changing the selected end and announcing the change
(`docs/design/02-redesign-spec.md:668-687`). No event/command contract identifies
which owner may change composer-owned `endsAt` or when stale submit responses
are ignored.

The current implementation already splits this carefully: the dialog owns form
state and recognizes the conflict (`src/components/schedule/booking-dialog.tsx:46-60`,
`src/components/schedule/booking-dialog.tsx:75-134`), while the schedule
controller owns refresh generation (`src/components/schedule/schedule-client.tsx:556-573`).
The redesign must make that seam more precise, not less.

Cancellation has the same contradiction: parent controllers own cancellation
state, but `CancellationDialog` is declared to own the confirmation request,
pending and error (`docs/design/02-redesign-spec.md:882-895`).

**Required correction:**

- Specify typed events and ownership for `SUBMIT`, `CONFLICT`, `REFRESH_OK`,
  `REFRESH_ERROR`, `END_RETAINED`, `END_REPLACED`, `CLOSE`, navigation and stale
  response.
- State which layer performs create/delete fetches, parses stable codes,
  increments generations, changes `endsAt`, emits live-region messages and
  triggers schedule/history refresh.
- Define cancellation ownership with the same precision.
- Add reducer/controller tests for delayed submit after close/navigation and a
  conflict refresh arriving after a newer selection.

### M3. The 1440 7-day density contract cannot fit the required 30-minute own-booking content

**Categories:** calendar readability, desktop, WCAG
**Severity:** must-fix

At 1440, the panes consume `248 + 320 = 568px`; before gaps, borders or page
padding the timetable can be at most `872px`
(`docs/design/02-redesign-spec.md:323-340`). After the `64px` gutter, a day is
at most about `115px`; at the allowed `760px` timetable minimum it is about
`99px`.

The same 30-minute own booking must fit in a `48px` visual block, show title,
range, author/ownership, and reserve a non-overlapping `44x44px` cancel target
(`docs/design/02-redesign-spec.md:600-629`). AC-012 repeats the visible
title/time/author requirement (`docs/design/02-redesign-spec.md:1287-1290`).
After cancel and normal padding, only roughly 39-55px of text width remains.
The text/status contract cannot be satisfied at the declared minimum geometry.

This is a stricter product target than WCAG's 24px minimum, which is valid, but
the layout must be designed around it. The official guidance explicitly treats
44px as a design target, not an unconditional WCAG requirement
(`docs/design/research/official-guidance.md:182-201`).

**Required correction:**

- Choose the exact 30-minute own-booking compact hierarchy at each day width.
- Either move Cancel to the operable details pane/sheet, relax simultaneous
  panes, increase timetable minimum, or reduce required visible metadata.
- Define width breakpoints for full metadata vs title/range vs details surface.
- Add bounding-box assertions proving title/range and every 44px control do not
  overlap at the narrowest actual 7-day column.

### M4. Different-timezone table semantics contradict the native row-header contract

**Categories:** PDF, calendar readability, WCAG, preservation
**Severity:** must-fix

The native table requires one `Час` column and one `th scope="row"` time label
per 30-minute row (`docs/design/02-redesign-spec.md:511-545`). When user and
office zones differ, the same spec says the shared gutter must not show a
misleading time and each day column must show its own user-local clock because
DST can differ by day (`docs/design/02-redesign-spec.md:495-509`).

Those statements do not define what the row header says or which header a slot
button is associated with. A shared user-time row header can be false for some
columns. A shared office-time row header conflicts with the PDF requirement
that interface time is displayed in the user's zone, summarized at
`docs/design/01-current-state-audit.md:146-157`.

There is a second gap for large zone offsets. Desktop headers show the office
date plus a user-local time range, but only mobile is required to show the full
user-local date when it differs (`docs/design/02-redesign-spec.md:500-507`).
A range such as `23:00-09:00` without both local dates is ambiguous.

Current tests prove that clocks differ across US-only and Kyiv-only DST weeks
(`tests/unit/week-grid.test.tsx:131-183`); this behavior cannot be reduced to one
shared clock during the semantic rewrite.

**Required correction:**

1. Define visible and accessible content for the first column when zones differ.
2. Define header associations and accessible names for free cells and spanned
   booking cells without claiming a false shared user time.
3. Show user-local date(s) when a column crosses or differs from its office
   date, on table as well as agenda.
4. Add table DOM/accessibility tests for equivalent zones, US-only DST,
   Kyiv-only DST and a user zone where the local date differs.

### M5. Timetable/agenda top metrics are ambiguous, and the mobile target is not achievable with the listed regions

**Categories:** desktop, mobile, testability
**Severity:** must-fix

The UX targets say the timetable/first agenda row is "не нижче" 176/216/240px
(`docs/design/02-redesign-spec.md:92-100`). Acceptance refers back to section 11
without naming the measured element (`docs/design/02-redesign-spec.md:1282-1286`).
It is unclear whether the coordinate is an upper bound (`top <= 240`), a lower
bound, the scrollport edge, table header edge, or first body row.

On mobile the listed vertical regions are:

- 56px app bar;
- 28px page-heading line;
- up to 112px date/navigation region;
- a separate filter row with at least a 44px control.

These already total 240px before any margin, gap, border or timezone/room
summary (`docs/design/02-redesign-spec.md:372-395`). Therefore a first agenda
row at `top <=240px` is impossible unless some listed content is included in
another region or omitted.

Expanded scroll math is closer to feasible, but the spec still needs to state
whether the 56px sticky table header counts toward the six visible hours
(`docs/design/02-redesign-spec.md:323-338`).

**Required correction:**

- Express every metric as an inequality and name a testable element, viewport
  origin and settled state.
- Publish an explicit vertical budget for each viewport, including room/timezone
  summary, gaps and borders.
- Define whether "six visible hours" means 12 complete body rows excluding the
  sticky header.
- Revise the mobile target or merge regions so the sum is physically possible.

### M6. Mobile agenda does not define a complete slot partition or complete auto-position policy

**Categories:** mobile, preservation, testability
**Severity:** must-fix

The agenda is described as 30-minute start rows with multi-slot bookings
rendered once (`docs/design/02-redesign-spec.md:372-391`) and as an ordered list
of free or busy items (`docs/design/02-redesign-spec.md:557-578`). It never
states the completeness invariant:

- whether all 20 office starts `09:00...18:30` must be represented;
- whether continuation starts covered by a busy booking are omitted;
- whether every uncovered future start has a Book action;
- how past, busy and unavailable data partition the day without gaps or
  duplicates.

The unit plan checks order and "busy once" but not the complete partition
(`docs/design/02-redesign-spec.md:1353-1358`).

Auto-positioning names "nearest future slot or current booking" but no fallback
when a past day has neither, a future day is fully booked, or the deep-linked
booking is not the currently running booking
(`docs/design/02-redesign-spec.md:386-391`). It also does not define whether
filter-driven room changes count as a new one-time positioning event.

**Required correction:**

- Define a pure day-agenda projection from 20 office slots and non-overlapping
  bookings.
- State exact omission/merge rules and data-error behavior.
- Define ordered auto-position fallbacks for deep link, current booking,
  nearest future free start, next busy item, office open and heading.
- Add 0/1/20 free, fully booked, all-past, current-running, long booking and
  schedule-error tests, including proof that later user scroll is not reset.

### M7. Localization/error mapping is not exhaustive enough to preserve API behavior

**Categories:** preservation, technical feasibility, testability
**Severity:** must-fix

The visible mapping covers most domain codes
(`docs/design/02-redesign-spec.md:235-255`), but the actual union also contains
`AUTH_REQUIRED` and `FORBIDDEN_ORIGIN`
(`src/lib/http/domain-error.ts:1-17`). `INTERNAL_ERROR` is a real transport
fallback emitted outside that union (`src/lib/http/api-response.ts:72-92`).
The spec does not say whether `AUTH_REQUIRED` redirects, preserves the intended
URL, or becomes a localized page error after an authenticated page's session
expires.

`VALIDATION_FAILED.fields` currently contains server-authored English values.
The spec says server field errors are displayed and raw server text must not
replace localized copy (`docs/design/02-redesign-spec.md:250-255`,
`docs/design/02-redesign-spec.md:660-666`), but provides no field-key mapping.

Changing `APP_LOCALE` also affects date strings, accessible names, duration
labels and many role/name selectors. Current exact expectations include English
date/accessibility strings (`tests/unit/week-grid.test.tsx:131-200`) and many
`/^Book /` queries (`tests/unit/schedule-client.test.tsx:183-193`). The test plan
mentions localization generally but not the migration contract.

**Required correction:**

1. Define exhaustive typed handling for every `DomainErrorCode` plus
   `INTERNAL_ERROR` and unknown transport codes.
2. Define `AUTH_REQUIRED` navigation and return-URL behavior and a safe
   `FORBIDDEN_ORIGIN` presentation.
3. Localize by stable field keys, never by matching English field values.
4. Define Ukrainian duration pluralization and date/accessibility formatters.
5. Add tests proving branch logic uses unchanged codes while visible and
   accessible strings use `uk-UA`.

### M8. Notification acknowledgement, unread state, toast lifecycle and modal suppression are conflated

**Categories:** preservation, WCAG, technical feasibility
**Severity:** must-fix

The current client adds valid items to local state and immediately POSTs server
acknowledgement; explicit Dismiss only removes the local item
(`src/components/app/notification-bell.tsx:45-74`,
`src/components/app/notification-bell.tsx:125-170`). Thus server
acknowledgement, local visibility, badge count and user dismissal are separate
concepts.

The redesign adds a persistent popover/sheet, a maximum-one toast queue,
4-second toast auto-dismiss, "unread" badge, explicit item dismiss and delayed
toast presentation while a modal is open
(`docs/design/02-redesign-spec.md:829-845`,
`docs/design/02-redesign-spec.md:1109-1116`). It does not say:

- whether toast timeout changes badge/list state;
- what "unread" means after immediate server acknowledgement;
- whether opening the center marks anything read;
- how an acknowledgement failure affects the retained item;
- who publishes global modal-open state to `NotificationCenter`;
- whether queued toasts survive navigation or multiple modal open/close cycles.

The component boundary explicitly says NotificationCenter does not own schedule
state (`docs/design/02-redesign-spec.md:879-882`), so modal suppression is not
implementable without a declared shared presentation channel.

**Required correction:**

- Define separate server delivery/ack, client retained item, badge, toast queue
  and explicit dismiss states.
- Define all transitions, including ack failure, duplicate redelivery, toast
  timeout, open center, dismiss, modal open/close and unmount.
- Add a global modal/presentation ownership contract that does not couple
  notification delivery to schedule data.
- Specify popover/sheet close, Escape, outside-click and focus-return behavior.

### M9. The speed and keyboard acceptance criteria do not prove the stated booking goal

**Categories:** speed, WCAG, testability
**Severity:** must-fix

The goal claims no more than three meaningful actions after room selection
(`docs/design/02-redesign-spec.md:101-103`), but the form does not specify a
default selected end time (`docs/design/02-redesign-spec.md:645-666`). The
current dialog defaults to the first valid 30-minute option
(`src/components/schedule/booking-dialog.tsx:46-60`). If redesign does not
preserve that default, choosing duration adds another required action.

The native table intentionally exposes every free slot through ordinary Tab
order (`docs/design/02-redesign-spec.md:536-546`,
`docs/design/02-redesign-spec.md:1128-1138`). The baseline exposed 98 buttons,
and the audit already called this inefficient
(`docs/design/01-current-state-audit.md:473-486`). The new test merely says Tab
count/order is documented, with no efficiency threshold
(`docs/design/02-redesign-spec.md:1447-1453`).

**Required correction:**

- Specify the initial end selection and define exactly what counts as an action.
- Add an acceptance test from selected room to created booking for mouse, touch
  and keyboard.
- Provide a non-grid keyboard efficiency mechanism, such as day/time jump
  controls or skip links, or define and justify a bounded maximum Tab count to
  a target slot.
- Preserve native table semantics; do not reintroduce partial ARIA grid
  behavior as a shortcut.

## 5. Should-fix findings

### S1. `rowSpan` is feasible, but its preconditions and projection algorithm need to be normative

**Categories:** technical feasibility, table semantics
**Severity:** should-fix

A native table with multi-slot `rowSpan` is feasible because same-room overlap
is forbidden and bookings are aligned to 30-minute boundaries
(`docs/design/02-redesign-spec.md:133-136`). Spans in different day columns may
cover the same row indices without conflict. A same-day overlapping span is not
a supported visual case and should be treated as invalid schedule data.

The spec currently says only "truthful rowSpan" and acknowledges a pure
occupancy model as mitigation (`docs/design/02-redesign-spec.md:536-555`,
`docs/design/02-redesign-spec.md:1502-1505`).

Make the algorithm normative:

1. Build a 20 x visible-day occupancy matrix.
2. Emit one `td rowSpan={duration/30}` at a booking start.
3. Omit only continuation cells for that same day.
4. Continue emitting cells for all other days in that row.
5. Fail to a schedule data-error state for overlap, misalignment, cross-day or
   out-of-bounds data rather than producing shifted columns.

Add mixed-column spans, adjacency, 30/60/240-minute and malformed-overlap tests.

### S2. Pane geometry should include real gaps, borders and padding

**Categories:** desktop, medium
**Severity:** should-fix

The 1440 three-pane outer widths are arithmetically possible. At 1024 the spec
correctly does **not** show room and booking panes simultaneously; it swaps one
for the other (`docs/design/02-redesign-spec.md:311-316`,
`docs/design/02-redesign-spec.md:342-353`). This should be stated explicitly in
acceptance wording because "supporting room pane + booking pane" otherwise
suggests simultaneous support at medium width.

Publish the full equation including workspace padding, column gaps, borders and
minimum central width at 1200, 1024 and 900px. Add a test that the medium swap
does not change selected room/date or timetable scroll.

### S3. Forced-colors foundation is good but does not cover every component state named by the release gate

**Categories:** WCAG
**Severity:** should-fix

The system-color strategy, own/other border styles and limited
`forced-color-adjust:none` are appropriate
(`docs/design/02-redesign-spec.md:1200-1214`). Add normative treatment for
disabled controls (`GrayText`), links, modal backdrop, selected date vs today,
invalid inputs, toast boundaries and focus on icon-only controls. Require
computed-style/visual assertions that authored shadows/backgrounds disappearing
does not erase a boundary.

### S4. The locale migration needs a test-update manifest, not only a statement that English assertions become obsolete

**Categories:** scope/risk, testability
**Severity:** should-fix

The plan notes that English-label assertions change
(`docs/design/02-redesign-spec.md:1496-1498`) but does not inventory affected
unit/E2E helpers. Add a manifest for formatter tests, role/name selectors,
screenshots, helper labels and API assertions. Keep API-message assertions in
integration tests unchanged while replacing UI selectors with Ukrainian
accessible names.

### S5. Browser test scope is unnecessarily duplicated and lacks deterministic fixture ownership

**Categories:** scope/risk, testability
**Severity:** should-fix

Requiring every one of six viewport projects to run auth persistence, filter,
create, conflict, cancel, history deep link and notification
(`docs/design/02-redesign-spec.md:1421-1445`) multiplies expensive stateful flows
without defining seed/time isolation. Keep one cross-viewport critical booking
flow, then use focused viewport-specific geometry/focus tests. Define the exact
fixture/clock owner for conflict, DST and notification delivery.

### S6. "Open assumptions: none" is false

**Categories:** technical feasibility, testability
**Severity:** should-fix

The document declares no open assumptions
(`docs/design/02-redesign-spec.md:1518-1527`), while M1-M9 identify unresolved
choices. Replace this claim with an explicit decision log. After must-fix
resolution, any remaining implementation latitude should be listed with the
acceptance boundary it may not cross.

## 6. Requested feasibility checks

| Requested check | Result | Review |
| --- | --- | --- |
| Native table + `rowSpan` for multi-slot spans | **Conditionally feasible** | Feasible for non-overlapping same-room data and simultaneous spans in different day columns. Same-day overlap is invalid data. See S1 and M4. |
| 7/3/2/1 responsive model with one DOM | **Renderer model feasible; form model unresolved** | One active timetable/agenda over one shared fetch is feasible. Separate pane/sheet shells plus composer local state do not prove no remount. See M1. |
| Room pane + booking pane at 1440 and 1024 | **1440 yes, 1024 intentionally no** | 1440 outer widths fit, but booking content density fails. 1024 swaps room for booking pane and must say so explicitly. See M3 and S2. |
| 44px target vs density | **Not feasible as written** | 44px cancel plus required metadata cannot fit a 48px block in a roughly 99-115px day column. See M3. |
| Timetable top/scroll math | **Not testable; mobile impossible as stated** | Measured element and inequality are undefined; mobile vertical regions consume the entire budget before gaps/summary. See M5. |
| Localization impact on tests/API mapping | **Incomplete** | API identifiers are mostly preserved, but mapping omits real codes/field-key localization and test migration detail. See M7 and S4. |
| Table semantics with slot buttons/spanned bookings | **Partially sound** | Native buttons and rowspan are valid; different-zone row headers are unresolved. See M4 and S1. |
| Mobile agenda completeness and auto-scroll | **Incomplete** | No 20-slot partition invariant or fallback when no future/current item exists. See M6. |
| Non-modal pane vs modal sheet focus | **Incomplete** | Open/close is described; resize across inert/non-inert modes is not. See M1. |
| Error-code names match code | **Mostly** | Listed booking/auth names are real; `AUTH_REQUIRED` and `FORBIDDEN_ORIGIN` are omitted, while `INTERNAL_ERROR` is a transport fallback. See M7. |
| Conflict state exact ownership | **Contradictory** | Controller and composer both need to mutate conflict-dependent form state. See M2. |
| Timezone/DST per-day labels | **Behavior recognized, semantics unresolved** | Per-day conversion is retained, but native row headers and user-date crossings are undefined. See M4. |
| Notification presentation | **Incomplete state model** | Ack, unread, retained list, toast timeout and modal suppression are not separated. See M8. |
| Forced colors | **Strong direction, incomplete edge coverage** | System colors and redundant labels are good; add disabled/link/modal/error specifics. See S3. |

## 7. Contradictions and unimplementable details

| Contract A | Contract B | Consequence |
| --- | --- | --- |
| Separate `BookingPane`/`BookingSheet` shells (`02-redesign-spec.md:890-893`) | Composer must not remount and owns draft (`02-redesign-spec.md:902-913`) | No concrete React tree can be derived without an additional state/surface decision. |
| Shared `Час` row header (`02-redesign-spec.md:518-545`) | No shared user-time gutter when zones differ (`02-redesign-spec.md:497-505`) | Table header association is undefined or misleading. |
| 48px block + 44px cancel (`02-redesign-spec.md:600-609`) | Visible title/range/author/ownership (`02-redesign-spec.md:610-629`) | Content does not fit the 7-day desktop column. |
| Mobile first row `top <=240px` as implied by goal (`02-redesign-spec.md:94-100`) | 56px header + heading + 112px date region + filter + timezone/room summary (`02-redesign-spec.md:372-395`) | Target cannot be met with ordinary spacing. |
| Composer owns `endsAt` (`02-redesign-spec.md:890-890`) | Controller refresh must replace invalid end (`02-redesign-spec.md:670-687`) | Conflict transition has no authorized state owner. |
| Toast auto-dismiss (`02-redesign-spec.md:1109-1116`) | Persistent unread badge/list plus immediate server ack (`02-redesign-spec.md:817-845`) | Badge and item lifecycle are indeterminate. |
| "No open assumptions" (`02-redesign-spec.md:1518-1527`) | Multiple unspecified ownership, metric and fallback rules above | Implementer must invent key decisions, contrary to `pasted-text.txt:203-238`. |

## 8. Required must-fix checklist for critic cycle 2

- [ ] Replace pane/sheet no-remount prose with one concrete React ownership and
      focus-transition contract.
- [ ] Define exact create/conflict/cancel events, request owner and stale-response
      rules.
- [ ] Resolve 7-day 30-minute block content vs 44px cancel geometry.
- [ ] Define truthful table headers and user-date labels for differing zones/DST.
- [ ] Define measurable timetable/agenda top and visible-row equations.
- [ ] Define complete 20-slot mobile agenda projection and auto-position fallback.
- [ ] Add exhaustive error/field localization while preserving API codes.
- [ ] Separate notification ack, retained item, badge, toast and dismiss state.
- [ ] Specify default end duration and a bounded keyboard/action-count goal.

## 9. Evidence reviewed

- User brief:
  `D:\AppDataRelocated\King\CodexHome\attachments\a5926699-9145-4240-9af5-668676801425\pasted-text.txt`
  (`:78-145`, `:203-265`, `:314-467`, `:469-558`).
- Original `D:\2026 AI\ua skills\spec-uk.pdf`, pages 1-3, text-extracted and
  visually rendered. Core/bonus mapping is independently recorded at
  `docs/design/01-current-state-audit.md:133-181`.
- Current-state audit:
  `docs/design/01-current-state-audit.md:35-131`,
  `docs/design/01-current-state-audit.md:358-519`,
  `docs/design/01-current-state-audit.md:590-720`.
- Official guidance:
  `docs/design/research/official-guidance.md:33-115`,
  `docs/design/research/official-guidance.md:117-201`,
  `docs/design/research/official-guidance.md:220-278`.
- Relevant implementation/tests cited inline, especially schedule state,
  timezone/DST, error contracts, booking form and notification lifecycle.
