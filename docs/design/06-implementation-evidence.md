# Roomwork Implementation Evidence

Date: 2026-07-30

Status: `DONE_WITH_CONCERNS`. The local non-database gates pass. Database-backed
browser/integration execution, screenshots, actual Chrome 200% zoom, NVDA,
Windows High Contrast, and physical keyboard walkthroughs were not performed
because no isolated test database or required manual environment was available.
Those gates are deferred, not passed.

## Automated Evidence

| Gate | Result | Duration / details |
| --- | --- | --- |
| Required token/contrast RED | Expected failure | 15.69s; 34 tests: 32 passed, 2 failed, contrast suite missing. Missing contrast script, 22 governed CSS literal violations, and two missing forced-color focus declarations. |
| Focused token/contrast GREEN | PASS | 2 files, 39 tests; 12.79s |
| Final focused contract suite | PASS | 6 files, 105 tests; final rerun 18.85s |
| `npm ci` | PASS with warnings | 117.278s; 860 packages installed, 861 audited; deprecated `whatwg-encoding`, one Windows cleanup `EPERM`, and npm audit reported 1 moderate and 15 high vulnerabilities. |
| `npm run db:generate` | PASS after environment correction | Initial 37.745s attempt stopped before generation because `DATABASE_URL` was absent. Rerun with the `.env.example` URL passed in 6.764s; Prisma Client 7.9.1 generated in 485ms. No database connection was made. |
| `npm run check:source` | PASS | 1.528s |
| `npm run check:design-tokens -- --include-legacy` | PASS | 7.134s; zero governed literals |
| `npm run check:contrast` | PASS | 1.646s; 34/34 pairs |
| `npm run lint` | PASS | 83.093s |
| `npm run typecheck` | PASS | 32.978s |
| `npm test` | PASS | 51 files, 450 tests; Vitest 507.89s, command 513.162s |
| `npm run test:coverage` | PASS | 51 files, 450 tests; Vitest 563.45s, command 570.897s; statements 78.94%, branches 75.88%, functions 74.33%, lines 79.73% |
| `npm run build` | PASS after environment correction | Initial 38.667s attempt compiled and type-checked, then stopped because required runtime variables were absent. Rerun with exact `.env.example` runtime values passed in 24.401s. Warning: Next.js inferred the parent workspace root because two lockfiles are present. |
| Docker Compose config | PASS | 0.427s |
| Contrast Markdown generation | PASS | 1.560s; `test-results/token-contrast.md`, 34/34 pairs |
| Playwright list/configuration | PASS, execution deferred | 3.749s; 131 tests in 14 files across the exact six responsive projects and auxiliary projects |

The lowest measured normal-text ratio is 4.62:1 for
`--color-text-subtle` on `--color-canvas`. The lowest measured meaningful
non-text ratio is 4.75:1 for `--color-other-border` on `--color-info-soft`.
`--color-surface-subtle` and `--color-border-subtle` are decorative-only
exclusions. Disabled boundaries are exempt, while disabled text is measured at
5.10:1.

## Acceptance Mapping

| Acceptance criteria | Evidence |
| --- | --- |
| AC-001, AC-002, AC-003 | Ukrainian copy unit tests, root-layout tests, locale browser specification, and stale-copy scan |
| AC-004, AC-035 | Existing service/controller/API suites in the 450-test unit run; no backend, Prisma, migration, route, or domain-service edits |
| AC-005, AC-006, AC-007, AC-008 | Exact responsive project unit contract and `geometry.spec.ts` 7/3/2/1-day assertions |
| AC-009, AC-010, AC-034, AC-047 | Geometry browser specification for six-hour visibility, internal scroll, overflow, safe-area clearance, 320px long room, full IANA labels, and `top <=296px` |
| AC-011, AC-012, AC-013, AC-014, AC-037, AC-042, AC-045, AC-049 | Timetable, agenda, booking-block, projection, and native semantics unit suites; long-title browser-backed unit geometry |
| AC-015, AC-016, AC-017, AC-018, AC-019, AC-020, AC-038, AC-039, AC-041 | Booking controller, end-time, adaptive surface, schedule request-state, and browser specifications |
| AC-021, AC-046 | Cancellation dialog/coordinator unit suites and modal ownership/focus browser assertions |
| AC-022, AC-023, AC-024 | Booking grouping/list pagination, independent state/retry, and deep-link unit suites |
| AC-025, AC-026, AC-043 | Auth surface, verify page, and exhaustive UI-error unit suites |
| AC-027, AC-028, AC-040, AC-048 | Notification service/controller/bell unit suites and notification browser suite allocation |
| AC-029, AC-031 | Accessibility browser specification for 44px targets, keyboard order, visible focus, inertness, containment, and restoration |
| AC-030 | Automated 320x800, reduced-motion, and Playwright forced-colors assertions exist. Actual Chrome 200%, NVDA, and Windows High Contrast remain manual and deferred. |
| AC-032 | Calculated 34-pair contrast manifest and zero-literal token contract |
| AC-033 | 100-character title unit/browser geometry and cancellation containment specifications |
| AC-036 | Schedule jump controls and keyboard-order tests |
| AC-044 | Timezone label, timetable, locale, and office-time unit/browser specifications |

## Style Ownership

`src/app/styles/manifest.css` remains the sole application style entry and has
exactly 12 imports in the approved order. `globals.css` retains Tailwind because
shared layout, alert, button, field, and icon components still use utilities.
Its only selectors are `.toast` and `.toast svg`; no selector is duplicated in
an owner stylesheet. Manifest-owned and legacy styles contain zero governed
literal violations.

## Browser And Database Limitations

`npm run test:integration` and `npm run test:e2e` were not run. Both require an
explicit isolated `TEST_DATABASE_URL` and can reset or mutate it; no permission
or isolated database was provided. Playwright was run only in list mode with a
syntactically valid non-connected test URL.

No responsive screenshot or state screenshot was captured, and no placeholder
PNG was created. The following required evidence files remain unavailable:

- `schedule-settled-expanded-1440x900.png`
- `booking-open-expanded-1440x900.png`
- `schedule-settled-medium-1024x768.png`
- `booking-open-medium-1024x768.png`
- `schedule-settled-tablet-768x1024.png`
- `booking-open-tablet-768x1024.png`
- `schedule-settled-mobile-lg-390x844.png`
- `booking-open-mobile-lg-390x844.png`
- `schedule-settled-mobile-360x800.png`
- `booking-open-mobile-360x800.png`
- `schedule-settled-reflow-320x800.png`
- `booking-open-reflow-320x800.png`
- `auth-login-expanded-1440x900.png`
- `my-bookings-mobile-lg-390x844.png`
- `state-conflict-expanded-1440x900.png`
- `state-notifications-mobile-lg-390x844.png`

Actual Chrome 200% from a physical 1440x900 window, NVDA with Chrome, Windows
High Contrast, physical keyboard walkthroughs, and optional VoiceOver were not
performed. Playwright's 320x800 normal-zoom project is reflow evidence only and
is not presented as browser-zoom evidence. Playwright forced-colors emulation
is supplemental and is not presented as Windows High Contrast evidence.
