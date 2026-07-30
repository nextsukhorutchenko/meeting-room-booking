# Roomwork Implementation Evidence

Date: 2026-07-30

Status: `DONE_WITH_CONCERNS`. Non-database static, unit, Chromium-unit,
configuration, token, contrast, type, lint, and build gates are automated.
Database-backed Playwright/integration execution and the manual visual,
assistive-technology, actual zoom, physical keyboard, and Windows High Contrast
gates are unavailable and are not reported as passed.

## Automated Evidence

| Gate | Status | Assertion source |
| --- | --- | --- |
| Focused fix suites | PASS | Vitest localization, focus containment, 96.85px Chromium geometry, contrast-manifest, source-ownership, and responsive-project tests |
| Source hygiene | PASS | `npm run check:source`; invisible controls, stale source, and stylesheet ownership |
| Design tokens | PASS | `npm run check:design-tokens -- --include-legacy`; governed CSS literals |
| Contrast | PASS | `npm run check:contrast`; authoritative ordered 36-pair manifest |
| Type and lint | PASS | `npm run typecheck`; `npm run lint` |
| Unit suite | PASS | `npm test`; non-database unit and browser-backed Chromium-unit tests |
| Configured build | PASS with warning | `npm run build` with `.env.example` runtime values; existing multiple-lockfile root warning |
| Playwright discovery/config | PASS; execution Deferred | `npm run test:e2e:list` with a syntactically valid non-connected `_test` URL |
| Integration/E2E execution | DEFERRED | Explicit isolated `TEST_DATABASE_URL` and mutation/reset permission were not available |

`--color-surface-subtle` is a meaningful text background. The manifest measures
its actual `--color-text` pairing; mixed My Bookings row text uses the measured
canvas pairings instead. Only `--color-border-subtle` is a decorative-only
exclusion. Disabled boundaries remain exempt; disabled text on
`--color-disabled-bg` is measured.

## Acceptance Ledger

| AC | Status | Assertion / evidence source |
| --- | --- | --- |
| AC-001 | PASS (automated) | `ui-errors.test.ts`, visible-copy source scan, schedule/history rendered error tests |
| AC-002 | PASS (automated) | root-layout, formatter, locale and office-time unit tests |
| AC-003 | PASS (automated) | metadata, auth, verify and shell unit/source contracts |
| AC-004 | PASS (static/unit) | No API route, payload, Prisma, migration, or domain-service change; existing API/service unit tests |
| AC-005 | DEFERRED (browser) | Expanded 7-day/pane assertions exist in `geometry.spec.ts`; DB-backed execution and screenshot unavailable |
| AC-006 | DEFERRED (browser) | Medium 3-day/non-modal allocation exists in `geometry.spec.ts`; execution unavailable |
| AC-007 | DEFERRED (browser) | Tablet 2-day table assertion exists in `geometry.spec.ts`; execution unavailable |
| AC-008 | DEFERRED (browser) | Compact agenda/filter project allocation exists; DB-backed viewport execution unavailable |
| AC-009 | DEFERRED (browser) | Twelve actual half-hour row bounds are asserted in `geometry.spec.ts`; execution unavailable |
| AC-010 | DEFERRED (browser) | Internal scroll and document-overflow assertions exist in `geometry.spec.ts`; execution unavailable |
| AC-011 | PASS (automated) | timetable/day-agenda unit DOM and CSS contracts for visible free-slot actions |
| AC-012 | PASS (automated) | timetable semantic tests and real Chromium 96.85px title/range/status bounds |
| AC-013 | PARTIAL | text/icon/shape unit and forced-color emulation assertions exist; physical High Contrast inspection Deferred |
| AC-014 | PASS (automated) | timetable/agenda/projection tests prove native table/list, rowSpan, full-week validation, and no grid role |
| AC-015 | PASS (automated) | booking-controller, composer, selection and end-option unit tests |
| AC-016 | PASS (automated) | end-time option boundary unit tests |
| AC-017 | PASS (automated) | create/cancel pending and duplicate-request unit tests |
| AC-018 | PASS (automated) | conflict refresh/retry/start-unavailable reducer and schedule-client tests |
| AC-019 | PASS (automated) | preserved schedule/draft conflict-error unit tests; route-controlled browser case is listed but Deferred |
| AC-020 | PARTIAL | success announcement/focus coordinator unit tests pass; browser focus observation Deferred |
| AC-021 | PASS (automated) | cancellation ownership, confirmation, localization and focus-restoration unit tests |
| AC-022 | PASS (automated) | booking grouping and nearest-row dedupe unit tests |
| AC-023 | PASS (automated) | independent history loading/error/empty/pagination/retry unit tests |
| AC-024 | PASS (automated) | booking deep-link construction and sibling Cancel tab-order unit tests |
| AC-025 | PASS (automated) | auth validation, autocomplete and localized-error unit contracts |
| AC-026 | PASS (automated) | verification pending/success/error state tests |
| AC-027 | PASS (automated) | notification polling/dedupe/ack/visibility reducer and payload tests |
| AC-028 | PARTIAL | notification focus/state unit tests and browser geometry spec exist; DB-backed overlap execution Deferred |
| AC-029 | PARTIAL | 44px CSS/unit contracts and keyboard-only Playwright assertions exist; browser execution Deferred |
| AC-030 | BLOCKED (manual) | 320px/reduced-motion/forced-color automation exists; actual Chrome 200% and Windows High Contrast unavailable |
| AC-031 | PARTIAL | complete compact focus loop and coordinator restoration unit tests pass; browser walkthrough Deferred |
| AC-032 | PASS (automated) | ordered 36-pair contrast manifest and zero governed-literal token gate |
| AC-033 | PASS (automated) | 100-character title unit and real Chromium containment checks |
| AC-034 | DEFERRED (browser) | all-project horizontal-overflow assertions exist; DB-backed execution unavailable |
| AC-035 | PARTIAL | complete non-database unit suite passes; DB-backed integration/E2E suites Deferred |
| AC-036 | PASS (automated contract) | jump-control option/label tests plus actual keyboard order in `accessibility.spec.ts`; browser execution Deferred |
| AC-037 | PASS (automated) | whole-block trigger, no nested Cancel, details/agenda sibling tests |
| AC-038 | PASS (automated) | default +30 minute and product-action controller tests |
| AC-039 | PASS (automated) | typed reducer/request-generation and presentational-form source/unit contracts |
| AC-040 | PASS (automated) | notification lifecycle and single modal-owner coordinator tests |
| AC-041 | PASS (automated) | adaptive-surface DOM identity, controlled draft, resize and SSR-mode tests |
| AC-042 | PASS (automated) | agenda exact 0..19 partition, atomic error and one-position-per-epoch tests |
| AC-043 | PASS (automated) | exhaustive code/field localization, unknown fallback and safe-return tests |
| AC-044 | PARTIAL | timezone/DST/date-crossing unit tests pass; DB-backed locale/timezone browser execution Deferred |
| AC-045 | PASS (automated) | projection tests prove hidden-day filtering and atomic malformed/overlap failure; browser case listed |
| AC-046 | PASS (automated) | coordinator tests prove one owner and deterministic modal-to-modal restoration |
| AC-047 | DEFERRED (browser/manual) | 320x800 long-room/IANA/reachable-sheet assertions exist; execution and actual zoom unavailable |
| AC-048 | PASS (automated) | notification-center-open duplicate/seen/queue/ack reducer tests |
| AC-049 | PASS (automated) | real Chromium fixture measures 100-character title, status icon/text and range at 96.85px |

## Screenshot Inventory

No file below exists. No placeholder image was created.

| Filename | Status | Viewport | Zoom | Timezone | Seed | State | Baseline | Assertion source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `schedule-settled-expanded-1440x900.png` | Deferred | 1440x900 | Chrome 100% | Europe/Kyiv | Isolated Task 11 seed unavailable | settled schedule | approved redesign spec | manual screenshot inspection unavailable |
| `booking-open-expanded-1440x900.png` | Deferred | 1440x900 | Chrome 100% | Europe/Kyiv | Isolated Task 11 seed unavailable | default booking open | approved redesign spec | manual screenshot inspection unavailable |
| `schedule-settled-medium-1024x768.png` | Deferred | 1024x768 | Chrome 100% | Europe/Kyiv | Isolated Task 11 seed unavailable | settled schedule | approved redesign spec | manual screenshot inspection unavailable |
| `booking-open-medium-1024x768.png` | Deferred | 1024x768 | Chrome 100% | Europe/Kyiv | Isolated Task 11 seed unavailable | default booking open | approved redesign spec | manual screenshot inspection unavailable |
| `schedule-settled-tablet-768x1024.png` | Deferred | 768x1024 | Chrome 100% | Europe/Kyiv | Isolated Task 11 seed unavailable | settled schedule | approved redesign spec | manual screenshot inspection unavailable |
| `booking-open-tablet-768x1024.png` | Deferred | 768x1024 | Chrome 100% | Europe/Kyiv | Isolated Task 11 seed unavailable | default booking open | approved redesign spec | manual screenshot inspection unavailable |
| `schedule-settled-mobile-lg-390x844.png` | Deferred | 390x844 | Chrome 100% | Europe/Kyiv | Isolated Task 11 seed unavailable | settled agenda | approved redesign spec | manual screenshot inspection unavailable |
| `booking-open-mobile-lg-390x844.png` | Deferred | 390x844 | Chrome 100% | Europe/Kyiv | Isolated Task 11 seed unavailable | booking sheet open | approved redesign spec | manual screenshot inspection unavailable |
| `schedule-settled-mobile-360x800.png` | Deferred | 360x800 | Chrome 100% | Europe/Kyiv | Isolated Task 11 seed unavailable | settled agenda | approved redesign spec | manual screenshot inspection unavailable |
| `booking-open-mobile-360x800.png` | Deferred | 360x800 | Chrome 100% | Europe/Kyiv | Isolated Task 11 seed unavailable | booking sheet open | approved redesign spec | manual screenshot inspection unavailable |
| `schedule-settled-reflow-320x800.png` | Deferred | 320x800 | Chrome 100% | America/Argentina/Buenos_Aires | Long-room isolated seed unavailable | settled long-room agenda | approved redesign spec | manual screenshot inspection unavailable |
| `booking-open-reflow-320x800.png` | Deferred | 320x800 | Chrome 100% | America/Argentina/Buenos_Aires | Long-room isolated seed unavailable | full-screen booking sheet | approved redesign spec | manual screenshot inspection unavailable |
| `auth-login-expanded-1440x900.png` | Deferred | 1440x900 | Chrome 100% | Europe/Kyiv | N/A | login | approved redesign spec | manual screenshot inspection unavailable |
| `my-bookings-mobile-lg-390x844.png` | Deferred | 390x844 | Chrome 100% | Europe/Kyiv | Isolated Task 11 seed unavailable | future/past history | approved redesign spec | manual screenshot inspection unavailable |
| `state-conflict-expanded-1440x900.png` | Deferred | 1440x900 | Chrome 100% | Europe/Kyiv | Conflict seed unavailable | conflict/retry | approved redesign spec | manual screenshot inspection unavailable |
| `state-notifications-mobile-lg-390x844.png` | Deferred | 390x844 | Chrome 100% | Europe/Kyiv | Notification seed unavailable | notification center | approved redesign spec | manual screenshot inspection unavailable |

## Manual Gate Inventory

| Filename | Status | Viewport | Zoom | Timezone | Seed | State | Baseline | Assertion source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N/A - actual zoom record | Blocked | physical 1440x900 window | actual Chrome 200% | Europe/Kyiv | Isolated seed unavailable | auth/schedule/booking/cancel/history | spec section 27 | Chrome UI zoom indicator and observation unavailable |
| N/A - NVDA record | Blocked | physical 1440x900 and compact | Chrome 100% | Europe/Kyiv | Isolated seed unavailable | table/agenda/slots/dialog/live regions | spec section 27 | NVDA + Chrome versions/spoken results unavailable |
| N/A - Windows High Contrast record | Blocked | all six categories | Chrome 100% | Europe/Kyiv | Isolated seed unavailable | boundaries/focus/state/modal | token system and spec section 24 | physical Windows High Contrast inspection unavailable |
| N/A - keyboard walkthrough | Deferred | expanded and compact | Chrome 100% | Europe/Kyiv | Isolated seed unavailable | auth/filter/jump/booking/cancel/notifications/history | spec section 27 | physical keyboard observation unavailable |
| N/A - responsive visual review | Deferred | 1440x900, 1024x768, 768x1024, 390x844, 360x800, 320x800 | Chrome 100% | specified per screenshot | Isolated seed unavailable | settled and booking-open | approved concept/spec | screenshot set unavailable |
| N/A - forced-color visual review | Deferred | all six categories | Chrome 100% | Europe/Kyiv | Isolated seed unavailable | own/other/current/selected/conflict/invalid | token system and spec section 24 | Playwright emulation is supplemental; physical review unavailable |
| N/A - reduced-motion visual review | Deferred | expanded and compact | Chrome 100% | Europe/Kyiv | Isolated seed unavailable | navigation/loading/modal | spec section 24 | computed automation exists; manual observation unavailable |
| N/A - VoiceOver spot check | Deferred (availability-dependent) | compact | Safari 100% | Europe/Kyiv | Isolated seed unavailable | agenda/dialog/live regions | spec section 27 | Apple environment unavailable |

The automated `320x800` project is Chrome 100% reflow only, never evidence of
actual browser zoom. Playwright forced-colors emulation is supplemental and is
not evidence of Windows High Contrast.
