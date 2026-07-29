# Implementation plan pre-flight: final scoped review

## Review scope

- **Reviewed commit:** `44731f73d56dd4224eacedf5aec08ddbcfaf044d`
- **Baseline review:** `docs/design/reviews/implementation-plan-preflight.md`
- **Scope:** only P1-1 through P1-4, P2-1 through P2-4, P3-1 and new
  breakage introduced in their revised plan sections
- **Task count:** 11
- **Verdict:** **REVISE**

The specification and concept decision were not re-reviewed from the
beginning. The changed plan was checked against the exact correction requested
for each prior finding and for internal execution conflicts in the amended
sections.

## Prior finding disposition

### P1-1: Component style import and ownership sequence

**Status: ADDRESSED**

**Current plan refs:** lines 124-183, 275-285, 519-562, 605-756, 762-916,
1095-1250, 1256-1486, 1492-1769, 1775-1973, 1979-2169 and 2175-2313.

The plan now defines `manifest.css` as the sole ordered global entry, imports
legacy CSS first, assigns one selector owner per stylesheet, and requires each
owning task to add its import and remove migrated selectors from `globals.css`
in the same task. The affected tasks include the manifest, owner stylesheet
and legacy file in both Files and staged paths. Task 11 audits rather than
silently absorbing unfinished migrations.

### P1-2: Scoped E2E project/file selection

**Status: ADDRESSED**

**Current plan refs:** lines 1261-1268, 1399-1459, 1474-1486, 1724-1764,
1929-1968, 2129-2164 and 2269-2308.

Task 6 now establishes exact `expanded`, `medium`, `tablet`, `mobile-lg`,
`mobile` and `reflow` projects before Tasks 7-10. The match table includes the
required booking, transition, cancellation, notification and My Bookings files.
Tasks 7, 8, 9 and 10 each run a fail-fast Playwright `--list` assertion for the
claimed desktop/mobile project-file pairs before the real scoped run. The
previous false-green `desktop-kyiv`/`mobile-kyiv` selection is removed.

### P1-3: Final visual evidence viewport/state pairs

**Status: ADDRESSED**

**Current plan refs:** lines 2333-2348, 2645-2648, 2683-2687 and 2709-2713.

Task 11 names twelve primary captures: settled schedule plus default
booking-open state for all six required viewports. It also names four
additional auth, My Bookings, conflict and notification captures and stages
every exact filename.

### P1-4: Mandatory accessibility/manual gates

**Status: ADDRESSED**

**Current plan refs:** lines 2554-2565 and 2640-2681.

The plan now separates actual Chrome 200% at a physical `1440x900` window from
the `320x800` 100% reflow fixture. NVDA + Chrome is mandatory and records
versions, scenarios, spoken-result summaries and pass/fail. Calculated
contrast, forced colors, Windows High Contrast, keyboard-only operation,
reduced motion and optional VoiceOver are explicit, separately reportable
gates.

### P2-1: `REFRESH_OK` event/test contract

**Status: ADDRESSED**

**Current plan refs:** lines 256-260, 1549-1582, 1601-1634 and 1682-1702.

`BookingRefreshOkEvent` now contains only `conflictGeneration` and `options`.
`ScheduleData` remains workspace state. The typed
`applyConflictRefreshSuccess` port commits the refreshed schedule, builds
options from that schedule and then dispatches the reducer event. The RED tests
and implementation example use the same signature and assert
commit-before-dispatch ordering.

### P2-2: Task 8 declared and staged scope

**Status: ADDRESSED**

**Current plan refs:** lines 1781-1800, 1904-1911, 1923-1927 and 1970-1974.

`tests/unit/booking-list.test.tsx` is now explicitly listed as modified,
receives concrete parent-owned cancellation assertions, runs in the focused
suite and appears in the Task 8 staged paths. The previous Files/staging
contradiction is removed.

### P2-3: Required Prisma generation command

**Status: ADDRESSED**

**Current plan refs:** lines 2603-2619 and 2635-2638.

Task 11 runs `npm run db:generate` immediately after `npm ci` and requires both
commands to be recorded as separate evidence rows.

### P2-4: Complete design-token literal enforcement

**Status: NOT ADDRESSED**

**Current plan refs:** lines 156-169, 356-367, 526-547 and 2534-2537.

The revision adds a deterministic token checker and covers colors,
margin/padding/gap/inset/width/height dimensions, radii, shadows and durations.
However, the ownership contract now promises that all type metrics, borders
and dimensions live in `tokens.css` at line 159, while the specified scanner
does not cover common literal-bearing properties such as:

- `grid-template-columns` and `grid-template-rows`;
- `flex-basis`;
- `border` and `border-width`;
- `font-size`, `line-height` and letter spacing;
- length values inside `transform`.

The Task 11 contract test explicitly checks only the five existing categories.
Therefore a hardcoded `248px` grid rail, `1px` border or `13px/18px` type metric
can pass the proposed checker while violating the amended ownership contract.

**Required correction:** either narrow the line-159 contract to the exact
governed categories or, preferably, extend the parser and tests to cover every
literal category claimed there. Add failing fixtures for grid tracks,
`flex-basis`, borders, typography and transform lengths, with a precise
structural/zero/focus allowlist.

### P3-1: Notification breakpoint wording

**Status: ADDRESSED**

**Current plan refs:** lines 2067-2080 and 2106-2113.

The plan and unit matrix now state explicitly that `expanded`, `medium` and
`tablet` use a non-modal popover, while only `mobile` requests the notification
modal owner and renders a sheet.

## New breakage

### New P2-1: Task 1 omits its mandatory manifest build verification

**Plan refs:** global lines 171-179; Task 1 lines 275-280, 553-580 and
596-600; execution protocol lines 2722-2727.

The amended global manifest contract requires every task that creates an
owning stylesheet to run `npm run build` and `git diff --check` after selector
deletion. Task 1 creates the manifest plus three owning stylesheets and performs
the first import/legacy migration, but its GREEN command block omits both
commands and proceeds to commit. This is the first task where Next/PostCSS must
prove that the indirect Tailwind/global import and manifest cascade compile.

Because the execution protocol dispatches a fresh implementer with only the
task text, the omitted Task 1 commands cannot be assumed from the separate
global section. This is one task conflict.

**Required correction:** add `npm run build` and `git diff --check` to Task 1
Step 5 after `npm run check:design-tokens`, and include their expected results
before the Task 1 commit step.

No other new P0-P2 breakage was found in the changed sections.

## Final gate

| Priority | Residual count |
| --- | ---: |
| P0 | 0 |
| P1 | 0 |
| P2 | 2 |
| P3 | 0 |
| Task conflicts | 1 |

The gate requires P0-P2 to equal zero and task conflicts to equal zero.
Therefore the final scoped verdict is **REVISE**.

The plan still contains exactly 11 ordered tasks and no circular task
dependency, but it cannot yet be confirmed executable sequentially under SDD.
After P2-4 and New P2-1 are corrected, a final line-scoped verification of
those two changes is sufficient.
