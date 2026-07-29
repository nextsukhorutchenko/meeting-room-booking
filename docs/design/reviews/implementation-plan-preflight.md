# Implementation plan pre-flight review

## Review result

- **Reviewer role:** independent implementation-plan reviewer
- **Plan:** `docs/superpowers/plans/2026-07-29-roomwork-product-redesign.md`
- **Normative sources:** approved `docs/design/02-redesign-spec.md` and
  `docs/design/05-concept-decision.md`
- **Task count:** 11
- **Verdict:** **REVISE**

The task graph is sequential and has no circular dependency. It covers every
approved product area and does not instruct an implementer to change an API,
backend service, Prisma schema, migration or business rule. However, four P1
and four P2 findings make the current plan unsafe to execute under the stated
Subagent-Driven Development gate.

| Priority | Count |
| --- | ---: |
| P0 | 0 |
| P1 | 4 |
| P2 | 4 |
| P3 | 1 |

## Findings

### P1-1: Component styles have no executable import and ownership sequence

**Plan refs:** lines 398-400, 442-463, 578-594, 888-897, 1025-1036,
1178-1193, 1530-1539, 1677-1684, 1811-1821 and 2052-2054.

Task 1 imports only `tokens.css`, `base.css` and `ui.css`, followed by the
existing `globals.css`. Tasks 2-10 then create `shell.css`, `auth.css`,
`schedule-layout.css`, `timetable.css`, `agenda.css`, `booking-surface.css`,
`notifications.css` and `my-bookings.css`, but none of those tasks includes an
import owner or a root style manifest in its file/staging scope. The current
application imports only `src/app/globals.css` from the root layout.

The plan also says to retain legacy rules until replacement coverage exists,
while the self-review defers legacy removal to Task 11. That leaves two unsafe
outcomes: new files can be dead/unloaded, or new and legacy selectors can
compete for Tasks 2-10. DOM-focused tests can pass while Concept A styling is
absent or overridden.

**Required revision:** define one deterministic global style manifest and
explicit import order. Every task that creates an owning stylesheet must add it
to that manifest and, after replacement tests pass, remove the migrated legacy
selectors from `globals.css` in the same task. Add the manifest and
`globals.css` to each affected task's Files and staged paths. Do not postpone
all selector transfer to Task 11.

### P1-2: Scoped E2E commands do not run the promised mobile/transition cases

**Plan refs:** lines 1344-1353, 1504-1513 and 1759-1768.

The commands select `desktop-kyiv` and `mobile-kyiv`, but the current
`test-config/playwright-configs.ts` limits `mobile-kyiv` to
`mobile.spec.ts`/`notifications.spec.ts` and makes `desktop-kyiv` ignore
`transition.spec.ts`. A Playwright `--list` rehearsal produced:

- Task 7 selection: desktop booking tests only; no mobile and no transition
  tests.
- Task 8 selection: desktop cancellation tests only; no mobile and no
  transition tests.
- Task 10 selection: desktop My Bookings/cancellation tests only; no mobile
  tests.

The commands exit successfully, so this is false-green task coverage rather
than a harmless naming issue.

**Required revision:** move the necessary deterministic project/testMatch
changes into the first task that needs each scenario, include
`test-config/playwright-configs.ts` in that task's scope, and add a
`--list` assertion or explicit expected per-project test count before the real
run. Each task must prove the desktop and mobile behavior it claims before its
scoped review.

### P1-3: Final visual evidence omits required viewport/state pairs

**Plan refs:** lines 1791-1798 and 1989-1992.

The approved spec requires a settled schedule and default booking-open capture
for all six deterministic viewports. Task 11 names only eight images: five
schedule widths, one mobile booking sheet, one mobile My Bookings page and one
desktop auth page. It omits the `360x800` settled schedule and default
booking-open evidence for expanded, medium, tablet, `360x800` and `320x800`.

**Required revision:** enumerate at least twelve primary responsive captures,
one settled schedule and one default booking-open state for each of
`1440x900`, `1024x768`, `768x1024`, `390x844`, `360x800` and `320x800`.
Keep auth, My Bookings and canonical state captures as additional evidence.
Add every named file to Task 11's Files and staged paths.

### P1-4: The final accessibility gate omits mandatory manual checks

**Plan refs:** lines 1910-1926 and 1982-1987.

Task 11 mentions keyboard navigation, actual 200% zoom, reduced motion and
Windows High Contrast, but it does not require the approved mandatory
NVDA + Chrome walkthrough or token-pair contrast calculations. It also says to
repeat the `reflow` fixture at actual 200% zoom, while the approved test plan
separates actual Chrome 200% at `1440x900` from the `320px` CSS reflow fixture.

**Required revision:** make all three gates explicit and reportable:

1. Actual Chrome 200% at `1440x900`, plus separate `320x800` reflow at 100%.
2. Mandatory NVDA + Chrome checks for table headers, slot names, dialogs and
   live regions; record VoiceOver as an availability-dependent spot check.
3. Calculated WCAG contrast results for every semantic text/background and
   non-text token pair, followed by visual forced-colors/High Contrast checks.

### P2-1: The Task 7 RED example does not satisfy its own event contract

**Plan refs:** lines 1240-1242 and 1269-1274.

`REFRESH_OK` requires `conflictGeneration`, `options` and `schedule`, but the
normative RED test dispatches only `conflictGeneration` and `options`. The
sample cannot typecheck against the preceding interface.

**Required revision:** include a `ScheduleData` fixture in the test and state
how `ScheduleWorkspace` commits it before reducer-derived option retention, or
remove `schedule` from the reducer event and define a separate typed controller
effect. Use one exact contract in the Interface Ledger, task text and tests.

### P2-2: Task 8's staged scope contradicts its declared Files list

**Plan refs:** global line 31, Task 8 lines 1370-1385 and line 1518.

The plan requires every task to stage only listed paths. Task 8's commit command
stages `tests/unit/booking-list.test.tsx`, but that file is not in Task 8's
Files list, even though the GREEN command also executes it.

**Required revision:** add the test to Task 8's Modify list and describe its
parent-owned cancellation assertions, or remove it from the staged command if
it must remain unchanged.

### P2-3: The final required command suite omits Prisma generation

**Plan refs:** lines 1957-1977.

The approved spec's exact required commands include `npm run db:generate`.
Task 11 runs `npm ci`, source checks, tests, build, Docker config, integration
and E2E, but never runs the explicit Prisma generation command.

**Required revision:** add `npm run db:generate` immediately after `npm ci` and
record its exit status in the implementation evidence report.

### P2-4: The CSS contract test enforces only a subset of the token policy

**Plan refs:** global line 23 and lines 1892-1898.

The plan requires hardcoded color, spacing, radius, shadow and duration values
to live only in token definitions. The proposed contract test rejects only hex
and `rgb()` colors in component CSS. It does not detect hardcoded spacing,
radii, shadows or transition/animation durations, so the final test can pass
while the declared design-token contract is violated.

**Required revision:** extend the deterministic contract test or add a
documented parser/lint check for all governed literal categories. Allow only
explicit structural exceptions such as percentages, grid counts and
accessibility-mandated `2px` focus geometry.

### P3-1: Notification breakpoint wording is ambiguous

**Plan refs:** lines 1633-1639.

The text says "Desktop renders a non-modal popover; mobile requests owner
`notifications`." The approved spec assigns the popover to expanded, medium
and tablet, with only mobile using a modal sheet.

**Suggested revision:** replace "Desktop" with
"`expanded`, `medium` and `tablet`" so a Task 9 implementer cannot reasonably
make the `768px` tablet center modal.

## Coverage matrix

| Approved spec area | Acceptance criteria | Owning task(s) | Pre-flight coverage |
| --- | --- | --- | --- |
| Locale, brand, formatters, typed API errors and unchanged public contracts | AC-001-004, AC-043 | 1, 2, 11 | Covered; backend/API scope is frozen. |
| Persistent shell, routes, auth and verification | AC-003, AC-025-026 | 2, 11 | Covered; route-group migration preserves URLs. |
| Responsive mode, SSR, room/filter ownership, URL and request races | AC-005-010, AC-041 | 3, 8, 11 | Behavior covered; CSS loading is blocked by P1-1. |
| Full-week validation, timezone/DST and atomic projection errors | AC-014, AC-042, AC-044-045 | 4, 5, 6, 11 | Covered with pure validation before visible filtering. |
| Concept A native 7/3/2-day timetable and compact booking fit | AC-005-007, AC-011-014, AC-037, AC-049 | 5, 11 | Covered semantically; style ownership is blocked by P1-1. |
| Mobile one-day agenda, deterministic positioning and jump controls | AC-008-009, AC-036, AC-042, AC-047 | 6, 11 | Covered; final evidence is incomplete under P1-3. |
| Booking selection, 30-240 minute end options, create/conflict/stale lifecycle and stable surface | AC-015-020, AC-038-039, AC-041 | 7, 11 | Covered in scope; event mismatch and false-green E2E remain. |
| Cancellation, modal serialization, inertness and focus restoration | AC-021, AC-037, AC-039, AC-046 | 8, 11 | Covered in scope; mobile/transition command and staged scope need revision. |
| Notification retained/seen/ack/toast/dismiss lifecycle | AC-027-028, AC-040, AC-048 | 8, 9, 11 | Covered; clarify tablet presentation per P3-1. |
| My Bookings priority, grouping, pagination, deep link and sibling Cancel | AC-022-024 | 8, 10, 11 | Covered; Task 10 mobile E2E is false-green under P1-2. |
| WCAG, target size, contrast, reflow, reduced motion, forced colors, long content and evidence | AC-029-035, AC-046-049 | 1, 5-11 | Broadly assigned, but final release gates/evidence are incomplete under P1-3, P1-4 and P2-4. |

## Pre-flight checklist

| Check | Result |
| --- | --- |
| Eleven tasks present and ordered sequentially | Pass |
| Circular dependencies or backend/business drift | Pass |
| Fresh implementer can execute each task independently | Revise: P1-1 and P1-2 |
| RED/GREEN commands use repository-supported tools | Pass, except claimed E2E coverage under P1-2 |
| Interface signatures are consistent | Revise: P2-1 |
| CSS migration has deterministic load/removal ownership | Revise: P1-1 and P2-4 |
| Existing behavioral tests are migrated rather than discarded | Pass in assignment; scoped mobile execution needs revision |
| Final commands and evidence exactly match approved gates | Revise: P1-3, P1-4 and P2-3 |
| Placeholder/TODO or prototype route promoted to production | Pass: none found |
| Task-scoped staging is internally consistent | Revise: P2-2 |

## Gate decision

The approval rule requires zero P0-P2 findings and no task conflict. Current
counts are P0: 0, P1: 4, P2: 4 and P3: 1, so the implementation plan is
**REVISE**. After the eight blocking findings are corrected in the plan, a
scoped pre-flight re-review is sufficient; the product specification and
Concept A decision do not need another design cycle.
