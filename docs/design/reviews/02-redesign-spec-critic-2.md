# Adversarial review: 02-redesign-spec, critic 2

- **Дата review:** 2026-07-29
- **Reviewer role:** незалежний агент-критик; reviewer не писав і не редагував
  `docs/design/02-redesign-spec.md`
- **Reviewed spec:** `docs/design/02-redesign-spec.md` at
  `510de50d84d72c94814e992d13dc08e371bf78c5`
- **Application baseline:** production code and tests at the same commit
- **Previous review:** `docs/design/reviews/02-redesign-spec-critic-1.md` at
  `2c076fd`
- **Verdict:** **FAIL - потрібне рішення координатора після другого циклу**
- **Weighted total:** **83.73/100**
- **Critical findings:** 0
- **Must-fix findings:** 4
- **Should-fix findings:** 4

## 1. Gate verdict

| Gate | Result | Evidence |
| --- | --- | --- |
| No critical findings | PASS | Critical findings відсутні. |
| No must-fix findings | FAIL | Відкриті C2-M1-C2-M4. |
| Weighted total `>=85` | FAIL | `83.73/100`. |
| Every category `>=70` | PASS | Найнижча категорія - mobile UX, `72/100`. |
| Implementable and testable without key invention | FAIL | Visible-window projection, modal arbitration, mobile timezone geometry and poll-while-open notification state потребують рішення, якого spec не дає. |

**Gate result: FAIL.** Це другий дозволений цикл критики
(`pasted-text.txt:240-265`), тому spec не отримує статус Approved автоматично.
Координатор має або виправити чотири blockers перед implementation, або
документувати свідомий компроміс і його tests.

## 2. Weighted score

Weights are unchanged from critic cycle 1.

| Category | Weight | Score | Weighted contribution | Rationale |
| --- | ---: | ---: | ---: | --- |
| Відповідність PDF | 10 | 96 | 9.60 | Auth, weekly schedule, user-zone display, booking rules, owner-only cancellation, history and implemented bonuses are retained (`02-redesign-spec.md:123-147`, `02-redesign-spec.md:1909-2007`). Office clocks are now explicitly secondary context while actionable labels remain user-local (`02-redesign-spec.md:660-674`, `02-redesign-spec.md:701-730`). |
| Збереження реалізованої поведінки | 15 | 88 | 13.20 | Typed create/conflict/cancel ownership and API-code preservation are strong (`02-redesign-spec.md:1001-1077`, `02-redesign-spec.md:1166-1214`), but valid weekly bookings can become a false data error in 3/2-day modes and notification state remains ambiguous in one reachable transition. |
| Швидкість бронювання | 10 | 92 | 9.20 | Default `+30 хв`, prefilled context and the three-action pointer/touch path are explicit (`02-redesign-spec.md:1079-1102`). Jump controls bound keyboard traversal, with a residual timezone-label ambiguity. |
| Читабельність календаря | 10 | 87 | 8.70 | Native table semantics, truthful zone labels, exact agenda partition and removal of inline Cancel materially improve readability (`02-redesign-spec.md:676-848`, `02-redesign-spec.md:870-916`). The narrowest compact status still lacks a complete fit assertion. |
| Desktop UX | 8 | 90 | 7.20 | The full 1440 equation, internal scroll and 12 visible body rows are implementable (`02-redesign-spec.md:426-464`). Closed-pane content contradicts `hidden`, but does not invalidate the open booking flow. |
| Tablet UX | 8 | 78 | 6.24 | The 2-day model and geometry are concrete (`02-redesign-spec.md:499-517`), but weekly API data conflicts with visible-window validation and filter/booking/cancellation modal ownership is incomplete. |
| Mobile UX | 10 | 72 | 7.20 | Agenda completeness and auto-position are now strong (`02-redesign-spec.md:788-848`). The fixed 48px room/timezone row has contradictory one-line/two-line contracts and cannot guarantee full IANA labels at 320px. |
| WCAG 2.2 AA | 12 | 79 | 9.48 | Native semantics, target policy, resize focus, forced colors and browser gates are detailed (`02-redesign-spec.md:1703-1838`). Nested booking-to-cancellation modal behavior and room-filter ownership can still produce invalid inert/focus state. |
| Технічна реалістичність | 7 | 73 | 5.11 | Stable surface/reducer architecture is feasible, but the normative projector rejects ordinary API data and the modal coordinator omits modal surfaces that the same spec requires. |
| Обсяг/ризик змін | 5 | 77 | 3.85 | Phase gates, rollback points, test migration and canonical E2E ownership improve control (`02-redesign-spec.md:1840-1907`, `02-redesign-spec.md:2128-2208`). AppShell persistence, global modal arbitration and calendar replacement remain a large coordinated refactor. |
| Тестованість | 5 | 79 | 3.95 | The test matrix is unusually concrete, but it omits valid hidden-day bookings, poll while center is open and modal-to-modal restoration; the contradictory mobile row cannot have one expected geometry. |
| **Total** | **100** |  | **83.73** |  |

## 3. Cycle-1 finding verification

Writer mapping was not treated as evidence. Each item below was checked against
the full revised spec and the current API/component/test contracts.

| ID | Cycle-2 result | Independent verification |
| --- | --- | --- |
| M1 responsive composer architecture | **Resolved for resize/state preservation** | One stable subtree, controlled reducer state, unresolved SSR snapshot, no interactive wrong mode and inside/outside focus transitions are normative (`02-redesign-spec.md:920-999`, `02-redesign-spec.md:1001-1077`). Closed expanded-pane copy still contradicts `hidden`; see C2-S1. Modal-to-modal behavior is a separate unresolved system issue; see C2-M2. |
| M2 conflict/cancellation ownership | **Resolved** | `ScheduleWorkspace` exclusively owns booking effects and stale generations; `BookingComposer` is presentational (`02-redesign-spec.md:1001-1077`). Cancellation request/state is parent-owned with matching/stale transitions (`02-redesign-spec.md:1166-1214`). This is stricter than current local ownership in `src/components/schedule/booking-dialog.tsx:46-60`, `src/components/schedule/booking-dialog.tsx:75-134` and `src/components/bookings/cancel-booking-dialog.tsx:27-70`. |
| M3 7-day density vs 44px Cancel | **Resolved, one nonblocking fit gap** | Inline Cancel was removed from the 7-day block; the whole 48px block is one details trigger and Cancel moved to details (`02-redesign-spec.md:870-916`). The 1360/1440 arithmetic is complete (`02-redesign-spec.md:448-464`). C2-S2 asks the final gate to include status, not only title/range. |
| M4 differing-zone table semantics | **Resolved** | Office row headers, user-local cell clocks/dates, explicit `headers`, full accessible names and immutable DST/date-cross fixtures are defined (`02-redesign-spec.md:676-743`). This preserves the per-day behavior covered by `tests/unit/week-grid.test.tsx:131-183`. |
| M5 top/scroll math | **Partially resolved** | Expanded/medium/tablet now name scrollport/body coordinates and exclude the sticky header from 12 visible body rows (`02-redesign-spec.md:426-517`). Mobile has an exact sum, but its 48px timezone content has contradictory line count; see C2-M3. |
| M6 mobile agenda completeness | **Resolved** | The pure projection covers atomic indices `0..19` exactly, merges spans once, fails malformed data atomically and defines all positioning fallbacks/epochs (`02-redesign-spec.md:788-848`). Unit coverage includes 20/1/0 free starts, all-past, fully booked and refresh behavior (`02-redesign-spec.md:2029-2036`). |
| M7 localization/error mapping | **Resolved** | Every current `DomainErrorCode` from `src/lib/http/domain-error.ts:1-17`, plus `INTERNAL_ERROR` from `src/lib/http/api-response.ts:72-92`, has a typed UI descriptor (`02-redesign-spec.md:247-305`). Stable field-key fallback, Ukrainian formatters and a test migration manifest are present (`02-redesign-spec.md:307-358`, `02-redesign-spec.md:2128-2156`). |
| M8 notification lifecycle | **Partially resolved** | Ack, retained item, seen badge, toast and dismiss are separated and persistence is explicit (`02-redesign-spec.md:1305-1365`). The global coordinator and poll-while-open transition are incomplete; see C2-M2 and C2-M4. |
| M9 speed/keyboard proof | **Resolved, one nonblocking label gap** | Default `+30 хв`, product-action accounting and native jump controls are explicit (`02-redesign-spec.md:1079-1102`, `02-redesign-spec.md:1711-1748`). Different-zone labels in the jump `Час` select remain ambiguous; see C2-S3. |
| S1 normative `rowSpan` | **Not resolved for 3/2-day input** | The matrix algorithm is normative (`02-redesign-spec.md:745-786`), but it treats a valid booking outside the visible subset as invalid despite the unchanged weekly API. See C2-M1. |
| S2 full pane geometry | **Resolved** | Padding, gaps, borders, tracks and minimum central widths are specified at 1440/1200/1024/900; medium explicitly swaps room and booking panes (`02-redesign-spec.md:448-497`). |
| S3 forced-colors edges | **Resolved** | Disabled, links, selected/today, own/other, conflict, invalid, modal, toast, focus and current-time treatments plus automated/manual gates are normative (`02-redesign-spec.md:1810-1838`). |
| S4 locale migration manifest | **Resolved** | Every affected current unit/E2E file has an assigned replacement responsibility; API English machine payload assertions remain unchanged (`02-redesign-spec.md:2128-2156`). All named current files exist. |
| S5 E2E duplication/fixtures | **Resolved** | Six projects share only the critical path; stateful scenarios have canonical projects, unique data ownership, one clock, a race barrier and cleanup rules (`02-redesign-spec.md:2158-2208`). Current config already uses one worker and one seed/auth dependency (`test-config/playwright-configs.ts:38-145`). |
| S6 no open assumptions | **Not resolved as a claim** | A real decision log now exists (`02-redesign-spec.md:2296-2332`), but “Відкритих product assumptions немає” at `02-redesign-spec.md:2317` is false while C2-M1-C2-M4 remain. |

## 4. Critical findings

None. The revision does not intentionally remove a PDF business rule, weaken
server overlap/concurrency/ownership protection or rename an API identifier.

## 5. Must-fix findings

### C2-M1. The normative projector rejects valid hidden-day bookings returned by the weekly API

**Categories:** preservation, tablet, technical feasibility, testability
**Severity:** must-fix

The 3-day and 2-day modes render only a subset of an office week
(`docs/design/02-redesign-spec.md:414-424`). The projector nevertheless requires
every booking day to be in `visible range`; any out-of-bounds booking moves the
whole timetable to `schedule-data-error`
(`docs/design/02-redesign-spec.md:745-760`).

The unchanged route calls `getWeeklySchedule` once for `weekStart`
(`src/app/api/rooms/[roomId]/schedule/route.ts:8-19`). The service queries and
returns every active booking intersecting the full week
(`src/modules/rooms/room.service.ts:83-107`,
`src/modules/rooms/room.service.ts:114-135`). Therefore a valid Friday booking
can break a Monday-Wednesday medium window, and a valid Wednesday booking can
break a Monday-Tuesday tablet window.

This is not merely an omitted test: following the normative algorithm produces
the wrong UI for ordinary valid data.

**Required correction:**

1. Validate all weekly bookings against the office-week/business invariants.
2. After validation, project only bookings whose office day is in the visible
   day set; an otherwise valid hidden-day booking must be ignored by this
   renderer, not treated as malformed.
3. Keep overlap validation week-wide or explain how hidden/visible boundary
   validation remains truthful.
4. Add unit fixtures with valid bookings before/after a 3-day and 2-day window,
   plus a malformed visible booking that still fails the whole surface.

### C2-M2. `PresentationCoordinator` cannot serialize every modal required by the spec

**Categories:** tablet, mobile, WCAG, technical feasibility
**Severity:** must-fix

The spec requires filter sheets on tablet/mobile
(`docs/design/02-redesign-spec.md:414-419`,
`docs/design/02-redesign-spec.md:499-517`) but `ModalOwner` contains only
`booking`, `cancellation` and `notifications`
(`docs/design/02-redesign-spec.md:1367-1387`). `RoomFilterSurface` owns its own
sheet-open state and is not assigned to the coordinator
(`docs/design/02-redesign-spec.md:1457-1463`). As written, the filter modal
cannot participate in the one-modal invariant or notification-toast
suppression.

There is also a direct nested-modal path. Own booking details include
`Скасувати бронювання` (`docs/design/02-redesign-spec.md:888-894`); on
tablet/mobile that details surface is already `role="dialog"` and owns inert
background (`docs/design/02-redesign-spec.md:951-955`). `OPEN_CANCEL` then opens
another modal (`docs/design/02-redesign-spec.md:1185-1193`), but no transition
suspends/hides the booking dialog, transfers owner, or restores the booking
dialog and focus after cancellation closes. A singular owner must either reject
the Cancel action or leave two modal surfaces active.

The generic focus contract only covers opening/closing one modal
(`docs/design/02-redesign-spec.md:1764-1772`); the test plan says “one modal
owner” but does not name these transitions
(`docs/design/02-redesign-spec.md:2087-2094`).

**Required correction:**

1. Include `room-filter` in modal ownership and toast suppression.
2. Define coordinator request/deny/close transitions for every modal surface.
3. Define booking-details -> cancellation -> booking-details restoration on
   tablet/mobile, including role/aria/inert order and exact focus targets for
   Cancel, Keep, successful cancellation and error close.
4. Add tests proving exactly one active `aria-modal`, no focus in inert content
   and correct toast behavior for filter and nested cancellation paths.

### C2-M3. The 48px mobile room/timezone row has contradictory content and cannot guarantee reflow

**Categories:** mobile, WCAG, testability
**Severity:** must-fix

The mobile budget allocates exactly `48px` to a row that already contains room
name, capacity and a `44px` filter control. It then says differing zones use a
single second compact line inside those same 48px
(`docs/design/02-redesign-spec.md:519-550`). The timezone contract separately
requires two compact mobile lines, one for the full user IANA zone and one for
office hours plus the full office IANA zone, with no disclosure
(`docs/design/02-redesign-spec.md:651-658`).

Thus the same region has both a one-extra-line and two-extra-line contract.
At 320px, a value such as `America/Argentina/Buenos_Aires` cannot be assumed to
fit beside the 44px control without wrapping, clipping, truncation or very small
text. The exact `agenda-first-body-item.top=264px` budget forbids spending the
24px reserve on another row (`docs/design/02-redesign-spec.md:534-550`), while
the release gate forbids clipping/loss at 320px and 200% zoom
(`docs/design/02-redesign-spec.md:1789-1796`).

**Required correction:**

- Choose one exact mobile content hierarchy and line count.
- Define wrapping/truncation rules for long room names and full IANA zones. Full
  timezone meaning must remain available without a tooltip-only disclosure.
- Recalculate the first-item top if the row is allowed to grow.
- Add 320px/200%-equivalent geometry tests with a long room name and a long,
  differing user zone.

### C2-M4. A notification delivered while the center is open has contradictory seen/toast behavior

**Categories:** preservation, WCAG, testability
**Severity:** must-fix

`POLL_VALID` always creates a new retained item with `seen=false` and enqueues
it (`docs/design/02-redesign-spec.md:1344-1351`). `CENTER_OPEN` marks only the
currently retained set as seen and clears the current queue
(`docs/design/02-redesign-spec.md:1352-1356`). Polling continues every 60
seconds while the document is visible (`docs/design/02-redesign-spec.md:1362-1365`).

Consequently, a new item received while the center remains open is immediately
visible in the list but increments the “unseen” badge and remains queued. After
center close it can produce a toast for content the user already saw. This
contradicts the stated meaning of `seen` and leaves two plausible
implementations. The test plan does not include poll-while-open
(`docs/design/02-redesign-spec.md:2087-2094`).

**Required correction:** define `POLL_VALID` conditional on `centerOpen`.
Specify `seen`, badge and queue outcomes for first delivery and duplicate
redelivery while the popover/sheet is open, then test close and route-navigation
behavior.

## 6. Should-fix findings

### C2-S1. Expanded empty-pane content contradicts the surface `hidden` state

Expanded always reserves a 320px contextual pane and requires an empty-state
heading, room summary and instruction (`docs/design/02-redesign-spec.md:426-446`).
The one stable surface is then `hidden` whenever controller state is closed
(`docs/design/02-redesign-spec.md:940-942`). A hidden subtree cannot render that
required empty state. Define whether the stable panel remains visible with a
closed-state presentation or whether a separate noninteractive placeholder
occupies the track.

### C2-S2. The narrow booking fit gate omits required visible status

At `<128px`, title, range and compact `Ваше|Зайнято` are all required
(`docs/design/02-redesign-spec.md:876-886`), but the 96.85px bounding gate
asserts only title/range non-overlap and absence of inline Cancel
(`docs/design/02-redesign-spec.md:914-916`). Add status/icon bounds and a
100-character title fixture to the same gate; AC-012 requires the status to
remain visible (`docs/design/02-redesign-spec.md:1935-1937`).

### C2-S3. Jump-control time labels are undefined when per-day clocks differ

The `Час` select is described only as “20 office slots”
(`docs/design/02-redesign-spec.md:1724-1735`), while all actionable labels must
be user-local and DST conversion differs by selected day
(`docs/design/02-redesign-spec.md:660-674`). Specify option value and visible/
accessible label, including user date crossing and office context, and
recompute labels after `День` changes. Add a different-zone DST fixture to the
jump-control tests (`docs/design/02-redesign-spec.md:2108-2111`).

### C2-S4. The implementation plan must update the decision log after blockers are resolved

The decision log is useful, but `Відкритих product assumptions немає`
(`docs/design/02-redesign-spec.md:2315-2330`) is currently false. C2-M1-C2-M4
are not implementation latitude. The coordinator's post-cycle-2 decision must
replace that assertion with the chosen rules and corresponding acceptance
boundaries.

## 7. Requested feasibility checks

| Requested check | Cycle-2 result | Review |
| --- | --- | --- |
| Native table + `rowSpan` for overlapping multi-slot spans | **Algorithm sound for one visible set; current input contract fails** | Same-room overlapping data correctly fails atomically and spans in different columns are feasible. Valid weekly bookings outside 3/2 visible days must be filtered, not rejected. See C2-M1. |
| 7/3/2/1 responsive model with one DOM | **Feasible with the stated single renderer/stable booking subtree** | SSR and resize identity are concrete. Closed-pane content and full modal arbitration need correction. See C2-S1 and C2-M2. |
| Supporting room pane + booking pane within 1440 and 1024 | **1440 yes; 1024 intentionally swaps** | 1440 fits all three panes. At 1024 the room pane is replaced by a 320px booking pane and the timetable remains 663px; this is explicit (`02-redesign-spec.md:466-497`). |
| Target 44px vs density | **Core conflict resolved** | Inline 44px Cancel is gone from the 7-day cell; whole block is the target. Add status to the narrow fit gate. See C2-S2. |
| Timetable top/scroll math | **Desktop/tablet resolved; mobile not final** | Scrollport/body elements and 12 complete rows are exact. Mobile sum depends on contradictory timezone line count. See C2-M3. |
| Localization impact on tests and API mapping | **Substantially resolved** | All actual codes match `src/lib/http/domain-error.ts:1-17`; `INTERNAL_ERROR` is treated as transport fallback. UI maps by code/key and the manifest preserves API assertions. |
| Table semantics with slot buttons and spanned bookings | **Semantically sound after C2-M1 input fix** | Native `table/th/td/headers/rowSpan`, whole buttons and explicit accessible names are implementable; no partial grid behavior remains. |
| Mobile agenda completeness and auto-scroll | **Resolved** | Exact 20-slot partition, malformed-data failure, all load states and one-shot ordered fallbacks are normative (`02-redesign-spec.md:788-848`). |
| Focus behavior non-modal pane vs modal sheet | **Resize resolved; modal-to-modal unresolved** | Same-node resize transitions are testable. Booking-details to cancellation and room-filter ownership are missing. See C2-M2. |
| Error-code names correspond to actual code | **Yes** | The 16-member domain union and separate `INTERNAL_ERROR` fallback are represented exactly (`02-redesign-spec.md:247-305`; `src/lib/http/domain-error.ts:1-17`; `src/lib/http/api-response.ts:72-92`). |
| Conflict state exact ownership | **Resolved** | One reducer owns draft/request/generations and the controller alone performs effects (`02-redesign-spec.md:1001-1077`). |
| Timezone/DST per-day labels | **Resolved for timetable/agenda; jump labels need definition** | Exact US-only, Kyiv-only and date-cross fixtures are correct (`02-redesign-spec.md:732-743`). See C2-S3 for the keyboard select. |
| Notification presentation | **Still incomplete** | Lifecycle concepts are separated, but modal owner coverage and poll while center is open are undefined. See C2-M2 and C2-M4. |
| Forced colors | **Resolved** | System colors, redundant text/shapes, focus and manual/automated gates cover the previously missing states (`02-redesign-spec.md:1810-1838`). |

## 8. Contradictions, ambiguities and unimplementable details

| Contract A | Contract B | Consequence |
| --- | --- | --- |
| Every booking must be within `visible range` or timetable errors (`02-redesign-spec.md:749-760`) | Existing API returns all bookings intersecting the office week (`src/modules/rooms/room.service.ts:83-107`) | Ordinary hidden-day data breaks 3/2-day modes. |
| One modal owner is `booking|cancellation|notifications` (`02-redesign-spec.md:1367-1387`) | Room filter is modal, and cancellation can open from an already-modal booking details surface (`02-redesign-spec.md:509-516`, `02-redesign-spec.md:888-894`) | One-modal/inert/focus contract cannot be implemented without new transitions. |
| Mobile combined row has one second timezone line inside 48px (`02-redesign-spec.md:530-532`) | Mobile timezone notice has two full compact lines (`02-redesign-spec.md:651-658`) | Exact top budget and 320px reflow have no single valid expected layout. |
| `POLL_VALID` always creates unseen queued items (`02-redesign-spec.md:1348`) | Open center means visible items are seen and queue is cleared (`02-redesign-spec.md:1354`, `02-redesign-spec.md:1419-1421`) | Poll while open can show a badge and later toast for an already visible item. |
| Expanded closed pane displays details guidance (`02-redesign-spec.md:445-446`) | Closed stable surface is `hidden` (`02-redesign-spec.md:940-942`) | Empty third pane presentation is undefined. |

## 9. Residual must-fix checklist

- [ ] Filter valid weekly bookings to the visible day subset after week-wide
      validation; test hidden-day data in 3/2-day modes.
- [ ] Put room filter and booking-to-cancellation transitions under one complete
      modal owner/focus/inert protocol.
- [ ] Resolve the 48px mobile room/timezone line-count and long-IANA reflow
      contract.
- [ ] Define notification delivery while the center is already open.

## 10. Evidence reviewed

- Full revised `docs/design/02-redesign-spec.md` at `510de50`, all 2332 lines.
- Full `docs/design/reviews/02-redesign-spec-critic-1.md`.
- User brief
  `D:\AppDataRelocated\King\CodexHome\attachments\a5926699-9145-4240-9af5-668676801425\pasted-text.txt`,
  especially `:78-145`, `:203-265`, `:314-467`, `:469-558`.
- `D:\2026 AI\ua skills\spec-uk.pdf`, pages 1-3, text extracted again for this
  cycle; core and bonus behavior checked independently.
- Current-state audit `docs/design/01-current-state-audit.md:35-181`,
  `docs/design/01-current-state-audit.md:358-519` and
  `docs/design/01-current-state-audit.md:590-739`.
- Official guidance synthesis
  `docs/design/research/official-guidance.md:33-115`,
  `docs/design/research/official-guidance.md:117-201` and
  `docs/design/research/official-guidance.md:220-278`.
- Current schedule API/service, booking/conflict/cancellation components,
  notification client, timezone utilities, Playwright config and the test files
  named by the migration manifest.
