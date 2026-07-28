# Clean Unit Test Environment Design

**Date:** 2026-07-28
**Status:** Approved

## Goal

Make the fast local test commands run in a clean process without PostgreSQL
configuration:

- `npm test`
- `npm run test:unit`
- `npm run test:coverage`

Keep database-backed test commands explicit and fail-fast:

- `npm run test:integration`
- `npm run test:e2e`

## Current Problem

`tests/unit/exploratory-config.test.ts` statically imports the deterministic and
Midscene Playwright entrypoint files. Those entrypoints read
`TEST_DATABASE_URL` during module evaluation and throw when it is absent.

As a result, the unit suite fails before collecting tests even though no unit
test needs a database connection.

The E2E command has a second boundary problem. Its current script runs the
production build before `scripts/run-e2e.ts` checks `TEST_DATABASE_URL`, so a
missing variable does not fail immediately.

## Required Command Boundaries

| Command | Requires PostgreSQL | Requires `TEST_DATABASE_URL` |
| --- | --- | --- |
| `npm test` | No | No |
| `npm run test:unit` | No | No |
| `npm run test:coverage` | No | No |
| `npm run test:integration` | Yes | Yes |
| `npm run test:e2e` | Yes | Yes |

There must be no automatic fallback from `TEST_DATABASE_URL` to
`DATABASE_URL`.

## Architecture

### Pure Playwright Config Factories

Move Playwright configuration construction into a test-configuration module
that exports two pure factories:

- a deterministic Playwright config factory;
- a Midscene exploratory config factory.

The factories receive all environment-dependent values as explicit
parameters. They do not:

- read `process.env`;
- load `.env`;
- connect to PostgreSQL;
- mutate process state;
- call `process.exit` or assign `process.exitCode`.

Factories may reject invalid explicit arguments, such as a non-local Midscene
URL or a database name without the `_test` suffix. Argument validation remains
deterministic and side-effect free.

The root `playwright.config.ts` and `playwright.midscene.config.ts` files remain
thin runtime entrypoints. They load environment values, validate required
inputs, and pass the values required by each factory. The deterministic
entrypoint still enforces `TEST_DATABASE_URL` as an execution guard even though
the deterministic factory does not use a database URL to construct its config.

Unit tests import only the factories. They never import an environment-bound
Playwright entrypoint.

### Shared Test Database Preflight

Add a shared test-database validator with a pure function that accepts:

- an environment-like record;
- a human-readable command context.

The function returns `TEST_DATABASE_URL` only when:

1. the variable exists and is non-empty;
2. the parsed database name ends with `_test`.

It never reads or falls back to `DATABASE_URL`.

A thin CLI preflight loads the existing local environment convention, calls
the validator with `process.env`, prints one clear error on failure, and exits
with a non-zero status.

Both database-backed npm scripts run this preflight first:

- integration preflight before Vitest;
- E2E preflight before the production build.

Existing checks in integration setup, Playwright entrypoints, database reset,
and the E2E runner remain as defense in depth.

### E2E Database Propagation

After preflight succeeds, `scripts/run-e2e.ts` reads the verified
`TEST_DATABASE_URL`. It supplies that value as `DATABASE_URL` only to the
spawned standalone E2E server.

The parent environment and application defaults are not changed. Production
code never receives an automatic database fallback.

## Error Behavior

When `TEST_DATABASE_URL` is absent:

- `npm run test:integration` exits before Vitest initializes;
- `npm run test:e2e` exits before `npm run build`;
- both commands return a non-zero status;
- the error names `TEST_DATABASE_URL` and the affected test command.

When the URL targets a database whose name does not end in `_test`, the
preflight refuses to continue with a clear safety error.

Unit and coverage commands do not execute the preflight.

## Testing

### Unit

- deterministic config factory exposes the existing deterministic projects and
  excludes exploratory tests;
- Midscene config factory exposes only the exploratory directory and receives
  explicit local URL and test database inputs;
- config factories work when `TEST_DATABASE_URL` is absent from
  `process.env`;
- shared preflight rejects a missing `TEST_DATABASE_URL`;
- shared preflight rejects a non-test database;
- shared preflight returns an explicit valid test database URL and ignores any
  ordinary `DATABASE_URL`.

### Script Contracts

- `test` and `test:unit` remain unit-only;
- `test:coverage` remains unit-only;
- `test:integration` runs preflight before Vitest;
- `test:e2e` runs preflight before build and the E2E runner;
- the canonical E2E runner still rebuilds current source and waits for health.

### Acceptance Verification

Run without either variable supplied by the process or local dotenv files:

1. `npm test` succeeds.
2. `npm run test:unit` succeeds.
3. `npm run test:coverage` succeeds.
4. `npm run test:integration` fails immediately with the expected message.
5. `npm run test:e2e` fails before build with the expected message.

Then run integration and E2E with an isolated `_test` database and confirm the
full suites still pass.

## Out of Scope

- provisioning PostgreSQL automatically;
- adding a default database URL;
- changing application runtime environment rules;
- changing Midscene model credential requirements;
- changing test selection, coverage thresholds, or CI job topology.

## Acceptance Criteria

1. Fast unit and coverage commands need no database environment.
2. Unit tests do not import environment-bound Playwright entrypoints.
3. Database-backed commands require an explicit `TEST_DATABASE_URL`.
4. No command falls back to `DATABASE_URL`.
5. E2E validates its database input before building.
6. The E2E server receives `DATABASE_URL` only from validated
   `TEST_DATABASE_URL`.
7. Existing deterministic, exploratory, integration, and E2E safety behavior
   remains covered by tests.
