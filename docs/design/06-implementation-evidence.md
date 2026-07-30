# Roomwork Implementation Evidence

Date: 2026-07-30

Status: `READY_FOR_SUBMISSION`. Implementation, task reviews, broad review,
clean-machine Docker Compose rehearsal, database-backed verification, and
responsive visual walkthrough are complete with no open P0-P2 findings.
Physical NVDA, VoiceOver, actual Chrome 200% zoom, and physical Windows High
Contrast remain environment-limited manual checks and are not reported as
passed.

## Automated Evidence

| Gate | Status | Assertion source |
| --- | --- | --- |
| Focused fix suites | PASS | Vitest localization, focus containment, 96.85px Chromium geometry, contrast-manifest, source-ownership, and responsive-project tests |
| Source hygiene | PASS | `npm run check:source`; invisible controls, stale source, and stylesheet ownership |
| Design tokens | PASS | `npm run check:design-tokens -- --include-legacy`; governed CSS literals |
| Contrast | PASS | `npm run check:contrast`; 58/58 rendered stylesheet pairs audited and measured |
| Type and lint | PASS | `npm run typecheck`; `npm run lint` |
| Unit suite | PASS | `npm test`; 53 files and 558/558 non-database unit and browser-backed Chromium-unit tests |
| Coverage | PASS | `npm run test:coverage`; 81.51% statements, 78.97% branches, 78.16% functions, 82.40% lines |
| Configured build | PASS | `npm run build`; local standalone output created in the worktree with an explicit Turbopack root |
| Docker Compose config | PASS | `docker compose --env-file .env.example config --quiet` |
| Clean Compose rehearsal | PASS | Empty Docker engine build, five migrations, seed, healthy PostgreSQL and application; final source rebuild also healthy at `http://localhost:3310/api/health` |
| Playwright discovery/config | PASS | 146 tests in 15 files across responsive, authentication, locale, and timezone projects |
| Integration execution | PASS | `npm run test:integration`; 8 files and 106/106 against authorized isolated `meeting_room_booking_test` on port 55435 |
| E2E execution | PASS | Full deterministic run: 141 passed, 5 intentional project-scope skips, 0 failed |
| Responsive visual walkthrough | PASS | 16 committed screenshots; 1440, 1024, 768, 390, 360, and 320 px inspected for overlap, clipping, modal ownership, and horizontal overflow |

The contrast command derives every semantic text/background and meaningful
boundary/background combination from the stylesheets imported by
`manifest.css`. It fails for either an unmeasured rendered combination or a
manifest row without rendered usage. All 58 derived rows pass their unchanged
WCAG thresholds, including info and danger text on surface, brand-hover on
brand-soft, explicit inherited current-day states, validated composited
backdrops, semantic currentColor boundaries, focus on canvas, and toast/status
boundaries. Only `--color-border-subtle` is a decorative boundary exclusion.
Disabled boundaries remain exempt; disabled text on both its disabled and
surface backgrounds is measured.

## Environment Rehearsal

Docker Desktop was reinstalled with its data store on `D:`. The rehearsal began
with zero containers and images, built the Node 22 application and setup images,
started PostgreSQL 16, applied all five migrations, seeded the demo data, and
reached healthy status. The final uncommitted source state was rebuilt once more
before screenshot capture. The application health endpoint returned
`{"data":{"status":"ok"}}`.

`npm test`, `npm run test:unit`, and `npm run test:coverage` remain
database-free. Their lifecycle hooks generate Prisma Client with a
non-connecting placeholder URL scoped only to the generator child process.
Integration and E2E retain the shared fail-fast preflight, require an explicit
`_test` `TEST_DATABASE_URL`, and do not fall back to `DATABASE_URL`.

## Dependency Audit

`npm audit --omit=dev --json` reports zero production vulnerabilities. The full
audit reports 16 development-only advisories: 15 high and 1 moderate, through
the ESLint/eslint-config-next and Midscene toolchains. `npm audit fix --force`
was not used because the proposed remediations include breaking or unsuitable
toolchain changes.

## Acceptance Ledger

| AC | Status | Assertion / evidence source |
| --- | --- | --- |
| AC-001 | PASS (automated) | `ui-errors.test.ts`, visible-copy source scan, schedule/history rendered error tests |
| AC-002 | PASS (automated) | root-layout, formatter, locale and office-time unit tests |
| AC-003 | PASS (automated) | metadata, auth, verify and shell unit/source contracts |
| AC-004 | PASS (static/unit) | No API route, payload, Prisma, migration, or domain-service change; existing API/service unit tests |
| AC-005 | PASS (browser) | Expanded 7-day timetable, room rail, booking pane, and committed screenshot |
| AC-006 | PASS (browser) | Medium 3-day timetable and exact room-to-booking pane swap at 1024 and 900 px |
| AC-007 | PASS (browser) | Tablet 2-day table plus compact modal booking surface |
| AC-008 | PASS (browser) | Compact agenda/filter allocation across 390, 360, and 320 px projects |
| AC-009 | PASS (browser) | Twelve real half-hour rows measured and made reachable inside the schedule scrollport |
| AC-010 | PASS (browser) | Internal scrolling, reachable lower rows, and zero document-level horizontal overflow |
| AC-011 | PASS (automated) | timetable/day-agenda unit DOM and CSS contracts for visible free-slot actions |
| AC-012 | PASS (automated) | timetable semantic tests and real Chromium 96.85px title/range/status bounds |
| AC-013 | PARTIAL | text/icon/shape unit and forced-color emulation assertions exist; physical High Contrast inspection Deferred |
| AC-014 | PASS (automated) | timetable/agenda/projection tests prove native table/list, rowSpan, full-week validation, and no grid role |
| AC-015 | PASS (automated) | booking-controller, composer, selection and end-option unit tests |
| AC-016 | PASS (automated) | end-time option boundary unit tests |
| AC-017 | PASS (automated) | create/cancel pending and duplicate-request unit tests |
| AC-018 | PASS (automated) | conflict refresh/retry/start-unavailable reducer and schedule-client tests |
| AC-019 | PASS (browser/unit) | Preserved schedule/draft conflict-error unit tests and route-controlled E2E progress/retry case |
| AC-020 | PASS (browser/unit) | Success announcement, compact ownership release, and exact focus restoration in unit and Playwright flows |
| AC-021 | PASS (automated) | cancellation ownership, confirmation, localization and focus-restoration unit tests |
| AC-022 | PASS (automated) | booking grouping and nearest-row dedupe unit tests |
| AC-023 | PASS (automated) | independent history loading/error/empty/pagination/retry unit tests |
| AC-024 | PASS (automated) | booking deep-link construction and sibling Cancel tab-order unit tests |
| AC-025 | PASS (automated) | auth validation, autocomplete and localized-error unit contracts |
| AC-026 | PASS (automated) | verification pending/success/error state tests |
| AC-027 | PASS (automated) | notification polling/dedupe/ack/visibility reducer and payload tests |
| AC-028 | PASS (browser/unit) | Notification focus/state units plus desktop/mobile handoff geometry and modal-owner E2E |
| AC-029 | PASS (browser/unit) | 44px contracts and keyboard-only traversal/focus-loop Playwright assertions |
| AC-030 | PARTIAL (manual) | 320px reflow, reduced-motion, and forced-color automation pass; actual Chrome 200% and physical Windows High Contrast remain unavailable |
| AC-031 | PASS (browser/unit) | Complete compact focus loop, Escape, and coordinator restoration verified in browser and unit tests |
| AC-032 | PASS (automated) | exact ordered 58-pair rendered contrast inventory, validated inherited/composited/currentColor contexts, bidirectional stylesheet audit, and zero governed-literal token gate |
| AC-033 | PASS (automated) | 100-character title unit and real Chromium containment checks |
| AC-034 | PASS (browser) | All required projects assert zero page-level horizontal overflow |
| AC-035 | PASS | Unit 558/558, integration 106/106, E2E 141 passed with 5 intentional project-scope skips |
| AC-036 | PASS (browser/unit) | Jump-control labels/options and actual keyboard order in `accessibility.spec.ts` |
| AC-037 | PASS (automated) | whole-block trigger, no nested Cancel, details/agenda sibling tests |
| AC-038 | PASS (automated) | default +30 minute and product-action controller tests |
| AC-039 | PASS (automated) | typed reducer/request-generation and presentational-form source/unit contracts |
| AC-040 | PASS (automated) | notification lifecycle and single modal-owner coordinator tests |
| AC-041 | PASS (automated) | adaptive-surface DOM identity, controlled draft, resize and SSR-mode tests |
| AC-042 | PASS (automated) | agenda exact 0..19 partition, atomic error and one-position-per-epoch tests |
| AC-043 | PASS (automated) | exhaustive code/field localization, unknown fallback and safe-return tests |
| AC-044 | PASS (browser/unit) | Timezone/DST/date-crossing units plus New York and French-locale browser projects |
| AC-045 | PASS (automated) | projection tests prove hidden-day filtering and atomic malformed/overlap failure; browser case listed |
| AC-046 | PASS (automated) | coordinator tests prove one owner and deterministic modal-to-modal restoration |
| AC-047 | PARTIAL (manual) | 320x800 IANA/reachable-sheet browser assertions and screenshot pass; actual 200% browser zoom remains unavailable |
| AC-048 | PASS (automated) | notification-center-open duplicate/seen/queue/ack reducer tests |
| AC-049 | PASS (automated) | real Chromium fixture measures 100-character title, status icon/text and range at 96.85px |

## Screenshot Inventory

All files below exist under `docs/design/evidence/final/` and were captured
from the final rebuilt Compose image. Screenshots support, but do not replace,
the DOM, state, accessibility, and geometry assertions.

| Filename | Status | Viewport | Timezone | State | Assertion source |
| --- | --- | --- | --- | --- | --- |
| `schedule-settled-expanded-1440x900.png` | PASS | 1440x900 | Europe/Kyiv | settled 7-day schedule | Playwright geometry + manual review |
| `booking-open-expanded-1440x900.png` | PASS | 1440x900 | Europe/Kyiv | non-modal booking pane | Playwright geometry + manual review |
| `schedule-settled-medium-1024x768.png` | PASS | 1024x768 | Europe/Kyiv | settled 3-day schedule | exact pane-swap E2E + manual review |
| `booking-open-medium-1024x768.png` | PASS | 1024x768 | Europe/Kyiv | non-modal booking pane | exact pane-swap E2E + manual review |
| `schedule-settled-tablet-768x1024.png` | PASS | 768x1024 | Europe/Kyiv | settled 2-day schedule | responsive E2E + manual review |
| `booking-open-tablet-768x1024.png` | PASS | 768x1024 | Europe/Kyiv | modal booking sheet | modal-owner E2E + manual review |
| `schedule-settled-mobile-lg-390x844.png` | PASS | 390x844 | Europe/Kyiv | settled agenda | mobile E2E + manual review |
| `booking-open-mobile-lg-390x844.png` | PASS | 390x844 | Europe/Kyiv | full-screen booking sheet | mobile E2E + manual review |
| `schedule-settled-mobile-360x800.png` | PASS | 360x800 | Europe/Kyiv | settled agenda | mobile E2E + manual review |
| `booking-open-mobile-360x800.png` | PASS | 360x800 | Europe/Kyiv | full-screen booking sheet | mobile E2E + manual review |
| `schedule-settled-reflow-320x800.png` | PASS | 320x800 | Europe/Kyiv | 320px reflow agenda | reflow E2E + manual review |
| `booking-open-reflow-320x800.png` | PASS | 320x800 | Europe/Kyiv | 320px full-screen sheet | reflow E2E + manual review |
| `auth-login-expanded-1440x900.png` | PASS | 1440x900 | Europe/Kyiv | login | auth E2E + manual review |
| `my-bookings-mobile-lg-390x844.png` | PASS | 390x844 | Europe/Kyiv | future/past history | history E2E + manual review |
| `state-conflict-expanded-1440x900.png` | PASS | 1440x900 | Europe/Kyiv | conflict refresh failure/retry | route-controlled E2E + manual review |
| `state-notifications-mobile-lg-390x844.png` | PASS | 390x844 | Europe/Kyiv | modal notification center | notification E2E + manual review |

## Manual Gate Inventory

| Filename | Status | Viewport | Zoom | Timezone | Seed | State | Baseline | Assertion source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N/A - actual zoom record | Deferred | physical 1440x900 window | actual Chrome 200% | Europe/Kyiv | Demo seed | auth/schedule/booking/cancel/history | spec section 27 | Browser UI zoom indicator not captured; automated 320px reflow is separate evidence |
| N/A - NVDA record | Deferred | physical 1440x900 and compact | Chrome 100% | Europe/Kyiv | Demo seed | table/agenda/slots/dialog/live regions | spec section 27 | NVDA is not installed in this environment |
| N/A - Windows High Contrast record | Deferred | all six categories | Chrome 100% | Europe/Kyiv | Demo seed | boundaries/focus/state/modal | token system and spec section 24 | Strict Playwright forced-colors checks pass; physical mode was unavailable |
| N/A - keyboard walkthrough | PASS (automated) | expanded and compact | Chrome 100% | Europe/Kyiv | Isolated test seed | auth/filter/jump/booking/cancel/notifications/history | spec section 27 | Playwright traverses controls, focus loops, Escape, and exact restoration |
| `docs/design/evidence/final/*.png` | PASS | all six required viewports | Chrome 100% | Europe/Kyiv | Demo Compose seed | settled, booking, history, conflict, notifications | approved concept/spec | Manual screenshot review found no overlap, clipping, or horizontal overflow |
| N/A - forced-color visual review | PASS (emulated) | all six categories | Chrome 100% | Europe/Kyiv | Isolated test seed | own/other/current/selected/conflict/invalid | token system and spec section 24 | Exact Canvas, CanvasText, ButtonText, and Highlight assertions pass |
| N/A - reduced-motion visual review | PASS (emulated) | expanded and compact | Chrome 100% | Europe/Kyiv | Isolated test seed | navigation/loading/modal | spec section 24 | Computed animation and transition durations are zero |
| N/A - VoiceOver spot check | Deferred (environment unavailable) | compact | Safari 100% | Europe/Kyiv | N/A | agenda/dialog/live regions | spec section 27 | Apple environment unavailable |

The automated `320x800` project is Chrome 100% reflow only, never evidence of
actual browser zoom. Playwright forced-colors emulation is supplemental and is
not evidence of Windows High Contrast.
