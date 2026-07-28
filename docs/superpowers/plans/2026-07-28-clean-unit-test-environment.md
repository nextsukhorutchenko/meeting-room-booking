# Clean Unit Test Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make unit and coverage commands pass without database environment while database-backed commands require `TEST_DATABASE_URL` before doing expensive work.

**Architecture:** Move deterministic and exploratory Playwright config construction into pure factories that accept environment-dependent inputs explicitly. Keep root Playwright files as environment-bound entrypoints, and add one pure test-database validator plus a thin CLI preflight that integration and E2E npm scripts run before Vitest or build.

**Tech Stack:** TypeScript 5, Vitest 4, Playwright 1.62, Node.js 22, npm scripts, dotenv

## Global Constraints

- `npm test`, `npm run test:unit`, and `npm run test:coverage` must not require PostgreSQL or `TEST_DATABASE_URL`.
- `npm run test:integration` and `npm run test:e2e` must require an explicit `TEST_DATABASE_URL`.
- Never fall back from `TEST_DATABASE_URL` to `DATABASE_URL`.
- The test database name must end with `_test`.
- Config factories receive environment-dependent values explicitly and never read `process.env`, load dotenv, connect to PostgreSQL, or terminate the process.
- The E2E server receives `DATABASE_URL` only from validated `TEST_DATABASE_URL` inside the spawned test server environment.
- Keep existing runtime, reset, integration, and E2E safety checks as defense in depth.
- Use TypeScript only and keep application behavior unchanged.

---

## File Structure

### Create

- `test-config/playwright-configs.ts`
  - Pure deterministic and Midscene Playwright config factories.
- `test-config/test-database.ts`
  - Pure `TEST_DATABASE_URL` validation with no process access or fallback.
- `scripts/check-test-database-url.ts`
  - Thin dotenv-aware CLI used only by database-backed npm commands.
- `tests/unit/test-database-preflight.test.ts`
  - Unit tests for missing, unsafe, malformed, and valid test database values.

### Modify

- `playwright.config.ts`
  - Keep deterministic runtime env guard and delegate config construction.
- `playwright.midscene.config.ts`
  - Read runtime env and delegate config construction.
- `tests/unit/exploratory-config.test.ts`
  - Import pure factories rather than runtime entrypoints.
- `package.json`
  - Run preflight before integration Vitest and before E2E build.
- `tests/unit/playwright-agent-contract.test.ts`
  - Lock the new E2E command ordering.
- `tests/unit/ci-workflow-contract.test.ts`
  - Lock unit-only commands and both database preflight contracts.

### Preserve

- `scripts/run-e2e.ts`
  - Retain its existing `TEST_DATABASE_URL` guard and child-only
    `DATABASE_URL` assignment.
- `tests/integration/global-setup.ts`
  - Retain database reset as a second integration safety boundary.
- `scripts/reset-test-db.ts`
  - Retain `_test` database protection.

---

### Task 1: Pure Playwright Config Factories

**Files:**
- Create: `test-config/playwright-configs.ts`
- Modify: `playwright.config.ts`
- Modify: `playwright.midscene.config.ts`
- Test: `tests/unit/exploratory-config.test.ts`

**Interfaces:**
- Produces:
  - `createDeterministicPlaywrightConfig(): PlaywrightTestConfig`
  - `createExploratoryPlaywrightConfig(options: ExploratoryConfigOptions): PlaywrightTestConfig`
  - `ExploratoryConfigOptions` with `baseUrl: string` and
    `testDatabaseUrl: string`
- Consumes: no application modules and no process-global state.

- [ ] **Step 1: Replace the env-bound unit imports with the desired factory API**

Update `tests/unit/exploratory-config.test.ts` so the complete test reads:

```ts
import {describe, expect, it} from 'vitest';
import {
  createDeterministicPlaywrightConfig,
  createExploratoryPlaywrightConfig,
} from '../../test-config/playwright-configs';

describe('Playwright exploratory test boundary', () => {
  it('constructs deterministic and exploratory configs without process env', () => {
    const standardConfig = createDeterministicPlaywrightConfig();
    const exploratoryConfig = createExploratoryPlaywrightConfig({
      baseUrl: 'http://127.0.0.1:3106',
      testDatabaseUrl:
        'postgresql://localhost/meeting_room_booking_test?schema=public',
    });

    expect(standardConfig.testMatch).toBe('**/*.spec.ts');
    expect(standardConfig.testIgnore).toContain('**/exploratory/**');
    const desktopKyiv = standardConfig.projects?.find(
      (project) => project.name === 'desktop-kyiv',
    );
    expect(desktopKyiv?.testIgnore).toContain('**/exploratory/**');
    expect(exploratoryConfig.testDir).toBe('./e2e/exploratory');
    expect(exploratoryConfig.timeout).toBe(90_000);
    expect(exploratoryConfig.retries).toBe(0);
    expect(exploratoryConfig.projects).toHaveLength(1);
    expect(exploratoryConfig.projects?.[0]?.name).toBe('chromium');
    expect(exploratoryConfig.reporter).toContainEqual([
      '@midscene/web/playwright-reporter',
      {type: 'merged'},
    ]);
  });
});
```

- [ ] **Step 2: Run the focused unit test and verify RED**

Run with both database variables removed:

```powershell
Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npx vitest run tests/unit/exploratory-config.test.ts --config vitest.config.ts
```

Expected: FAIL because `../../test-config/playwright-configs` does not exist.
The failure must not be a PostgreSQL connection attempt.

- [ ] **Step 3: Add the pure factory module**

Create `test-config/playwright-configs.ts` with this public shape:

```ts
import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from '@playwright/test';

const deterministicBaseUrl = 'http://127.0.0.1:3105';
const authStatePath = 'test-results/.auth/demo-user.json';

export interface ExploratoryConfigOptions {
  baseUrl: string;
  testDatabaseUrl: string;
}

function parseLocalExploratoryUrl(baseUrl: string): URL {
  const parsedBaseUrl = new URL(baseUrl);
  if (
    parsedBaseUrl.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(parsedBaseUrl.hostname) ||
    !parsedBaseUrl.port ||
    parsedBaseUrl.pathname !== '/'
  ) {
    throw new Error(
      'APP_URL for Midscene exploratory tests must be a local HTTP origin ' +
      'with an explicit port',
    );
  }
  return parsedBaseUrl;
}

function assertExploratoryTestDatabase(testDatabaseUrl: string): void {
  const databaseName = new URL(testDatabaseUrl).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing to use non-test database: ${databaseName}`);
  }
}

export function createDeterministicPlaywrightConfig(
): PlaywrightTestConfig {
  return defineConfig({
    fullyParallel: false,
    retries: 0,
    workers: 1,
    testDir: './e2e',
    testMatch: '**/*.spec.ts',
    testIgnore: '**/exploratory/**',
    reporter: [
      ['list'],
      ['html', {open: 'never', outputFolder: 'playwright-report'}],
      [
        './e2e/reporters/pr-impact-reporter.ts',
        {outputFile: 'test-results/pr-impact.json'},
      ],
    ],
    use: {
      baseURL: deterministicBaseUrl,
      trace: 'on-first-retry',
    },
    projects: [
      {
        name: 'seed',
        testMatch: '**/seed.spec.ts',
      },
      {
        name: 'auth-setup',
        dependencies: ['seed'],
        testMatch: '**/auth.setup.ts',
      },
      {
        name: 'desktop-kyiv',
        dependencies: ['auth-setup'],
        testIgnore: [
          '**/exploratory/**',
          '**/locale.spec.ts',
          '**/mobile.spec.ts',
          '**/seed.spec.ts',
          '**/smoke.spec.ts',
          '**/transition.spec.ts',
        ],
        use: {
          ...devices['Desktop Chrome'],
          storageState: authStatePath,
          timezoneId: 'Europe/Kyiv',
          viewport: {width: 1440, height: 900},
        },
      },
      {
        name: 'desktop-new-york',
        dependencies: ['auth-setup'],
        testMatch: [
          '**/timezone.spec.ts',
          '**/transition.spec.ts',
        ],
        use: {
          ...devices['Desktop Chrome'],
          storageState: authStatePath,
          timezoneId: 'America/New_York',
          viewport: {width: 1440, height: 900},
        },
      },
      {
        name: 'desktop-new-york-fr',
        dependencies: ['auth-setup'],
        testMatch: '**/locale.spec.ts',
        use: {
          ...devices['Desktop Chrome'],
          locale: 'fr-FR',
          storageState: authStatePath,
          timezoneId: 'America/New_York',
          viewport: {width: 1440, height: 900},
        },
      },
      {
        name: 'mobile-kyiv',
        dependencies: ['auth-setup'],
        testMatch: [
          '**/mobile.spec.ts',
          '**/notifications.spec.ts',
        ],
        use: {
          ...devices['Pixel 7'],
          storageState: authStatePath,
          timezoneId: 'Europe/Kyiv',
          viewport: {width: 390, height: 844},
        },
      },
      {
        name: 'desktop-auth-smoke',
        dependencies: ['seed'],
        testMatch: '**/smoke.spec.ts',
        use: {
          ...devices['Desktop Chrome'],
          viewport: {width: 1440, height: 900},
        },
      },
      {
        name: 'mobile-auth-smoke',
        dependencies: ['seed'],
        testMatch: '**/smoke.spec.ts',
        use: {
          ...devices['Desktop Chrome'],
          viewport: {width: 390, height: 844},
        },
      },
    ],
  });
}

export function createExploratoryPlaywrightConfig(
  options: ExploratoryConfigOptions,
): PlaywrightTestConfig {
  const parsedBaseUrl = parseLocalExploratoryUrl(options.baseUrl);
  assertExploratoryTestDatabase(options.testDatabaseUrl);

  return defineConfig({
    fullyParallel: false,
    projects: [
      {
        name: 'chromium',
        use: {...devices['Desktop Chrome']},
      },
    ],
    reporter: [
      ['list'],
      ['@midscene/web/playwright-reporter', {type: 'merged'}],
    ],
    retries: 0,
    testDir: './e2e/exploratory',
    timeout: 90_000,
    use: {
      baseURL: options.baseUrl,
      trace: 'retain-on-failure',
    },
    webServer: {
      command:
        'node node_modules/next/dist/bin/next dev --port ' +
        parsedBaseUrl.port,
      env: {
        APP_URL: options.baseUrl,
        DATABASE_URL: options.testDatabaseUrl,
      },
      reuseExistingServer: false,
      url: options.baseUrl,
    },
    workers: 1,
  });
}
```

- [ ] **Step 4: Convert the root files into thin entrypoints**

Replace `playwright.config.ts` with:

```ts
import {config as loadEnvironment} from 'dotenv';
import {createDeterministicPlaywrightConfig} from './test-config/playwright-configs';

loadEnvironment({path: '.env', quiet: true});

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must be set for Playwright tests');
}

export default createDeterministicPlaywrightConfig();
```

Replace `playwright.midscene.config.ts` with:

```ts
import {config as loadEnvironment} from 'dotenv';
import {createExploratoryPlaywrightConfig} from './test-config/playwright-configs';

loadEnvironment({path: '.env', quiet: true});

const baseUrl = process.env.APP_URL ?? 'http://127.0.0.1:3106';
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL must be set for Midscene exploratory tests',
  );
}

export default createExploratoryPlaywrightConfig({
  baseUrl,
  testDatabaseUrl,
});
```

- [ ] **Step 5: Run focused tests and static checks to verify GREEN**

Run:

```powershell
Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npx vitest run tests/unit/exploratory-config.test.ts --config vitest.config.ts
npm run typecheck
npm run lint
```

Expected:

- focused test PASS;
- typecheck exits `0`;
- lint exits `0`;
- no database process or connection is required.

- [ ] **Step 6: Prove the runtime Playwright guard remains**

Run:

```powershell
Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run test:e2e:list
```

Expected: exit `1` with
`TEST_DATABASE_URL must be set for Playwright tests`.

- [ ] **Step 7: Review and commit Task 1**

Review:

```powershell
git diff --check
git diff -- test-config/playwright-configs.ts playwright.config.ts playwright.midscene.config.ts tests/unit/exploratory-config.test.ts
```

Commit:

```powershell
git add -- test-config/playwright-configs.ts playwright.config.ts playwright.midscene.config.ts tests/unit/exploratory-config.test.ts
git commit -m "test: isolate Playwright config factories"
```

---

### Task 2: Shared Database Preflight and npm Command Contracts

**Files:**
- Create: `test-config/test-database.ts`
- Create: `scripts/check-test-database-url.ts`
- Create: `tests/unit/test-database-preflight.test.ts`
- Modify: `package.json`
- Modify: `tests/unit/playwright-agent-contract.test.ts`
- Modify: `tests/unit/ci-workflow-contract.test.ts`

**Interfaces:**
- Produces:
  - `type DatabaseBackedTestCommand = 'integration' | 'e2e'`
  - `requireTestDatabaseUrl(source, command): string`
- Consumes:
  - `source: Readonly<Record<string, string | undefined>>`
- The CLI accepts exactly one argument: `integration` or `e2e`.

- [ ] **Step 1: Write failing validator and command-contract tests**

Create `tests/unit/test-database-preflight.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {
  requireTestDatabaseUrl,
  type DatabaseBackedTestCommand,
} from '../../test-config/test-database';

const commands: DatabaseBackedTestCommand[] = ['integration', 'e2e'];

describe('database-backed test preflight', () => {
  it.each(commands)('requires TEST_DATABASE_URL for %s', (command) => {
    expect(() => requireTestDatabaseUrl({
      DATABASE_URL: 'postgresql://localhost/meeting_room_booking',
    }, command)).toThrow(
      `TEST_DATABASE_URL must be set for npm run test:${command}`,
    );
  });

  it('rejects a normal database', () => {
    expect(() => requireTestDatabaseUrl({
      TEST_DATABASE_URL: 'postgresql://localhost/meeting_room_booking',
    }, 'integration')).toThrow(
      'Refusing to use non-test database for npm run test:integration: ' +
      'meeting_room_booking',
    );
  });

  it('rejects a malformed test database URL', () => {
    expect(() => requireTestDatabaseUrl({
      TEST_DATABASE_URL: 'not-a-url',
    }, 'e2e')).toThrow(
      'TEST_DATABASE_URL must be a valid URL for npm run test:e2e',
    );
  });

  it('returns an explicit test URL without consulting DATABASE_URL', () => {
    const testDatabaseUrl =
      'postgresql://localhost/meeting_room_booking_test?schema=public';

    expect(requireTestDatabaseUrl({
      DATABASE_URL: 'postgresql://localhost/meeting_room_booking',
      TEST_DATABASE_URL: testDatabaseUrl,
    }, 'e2e')).toBe(testDatabaseUrl);
  });
});
```

Extend `tests/unit/ci-workflow-contract.test.ts` with:

```ts
it('keeps unit commands database-free and preflights database suites', () => {
  const packageJson = JSON.parse(
    readFileSync(resolve('package.json'), 'utf8'),
  ) as {scripts: Record<string, string>};

  expect(packageJson.scripts.test).toBe(
    'vitest run --config vitest.config.ts',
  );
  expect(packageJson.scripts['test:unit']).toBe(
    'vitest run --config vitest.config.ts',
  );
  expect(packageJson.scripts['test:coverage']).toBe(
    'vitest run --coverage --config vitest.config.ts',
  );
  expect(packageJson.scripts['test:integration']).toMatch(
    /^tsx scripts\/check-test-database-url\.ts integration && /,
  );
  expect(packageJson.scripts['test:e2e']).toMatch(
    /^tsx scripts\/check-test-database-url\.ts e2e && npm run build && /,
  );
});
```

Update the canonical runner expectation in
`tests/unit/playwright-agent-contract.test.ts` to:

```ts
expect(packageJson.scripts['test:e2e']).toBe(
  'tsx scripts/check-test-database-url.ts e2e && ' +
  'npm run build && tsx scripts/run-e2e.ts',
);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npx vitest run tests/unit/test-database-preflight.test.ts tests/unit/ci-workflow-contract.test.ts tests/unit/playwright-agent-contract.test.ts --config vitest.config.ts
```

Expected failures:

- missing `test-config/test-database.ts`;
- package scripts do not start with the preflight.

- [ ] **Step 3: Implement the pure validator**

Create `test-config/test-database.ts`:

```ts
export type DatabaseBackedTestCommand = 'integration' | 'e2e';

type EnvironmentSource =
  Readonly<Record<string, string | undefined>>;

function commandLabel(command: DatabaseBackedTestCommand): string {
  return `npm run test:${command}`;
}

export function requireTestDatabaseUrl(
  source: EnvironmentSource,
  command: DatabaseBackedTestCommand,
): string {
  const databaseUrl = source.TEST_DATABASE_URL?.trim();
  const label = commandLabel(command);
  if (!databaseUrl) {
    throw new Error(`TEST_DATABASE_URL must be set for ${label}`);
  }

  let databaseName: string;
  try {
    databaseName = new URL(databaseUrl).pathname.slice(1);
  } catch {
    throw new Error(`TEST_DATABASE_URL must be a valid URL for ${label}`);
  }

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to use non-test database for ${label}: ${databaseName}`,
    );
  }

  return databaseUrl;
}
```

This function must not reference `process.env` or `DATABASE_URL`.

- [ ] **Step 4: Add the thin CLI preflight**

Create `scripts/check-test-database-url.ts`:

```ts
import 'dotenv/config';
import {
  requireTestDatabaseUrl,
  type DatabaseBackedTestCommand,
} from '../test-config/test-database';

function readCommand(value: string | undefined):
    DatabaseBackedTestCommand {
  if (value === 'integration' || value === 'e2e') {
    return value;
  }
  throw new Error(
    'Database test preflight expects "integration" or "e2e"',
  );
}

try {
  requireTestDatabaseUrl(process.env, readCommand(process.argv[2]));
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : 'Preflight failed');
  process.exitCode = 1;
}
```

The CLI owns process access and exit status. The pure validator does not.

- [ ] **Step 5: Put preflight before database-backed work**

Change only these scripts in `package.json`:

```json
{
  "test:integration": "tsx scripts/check-test-database-url.ts integration && vitest run --config vitest.integration.config.ts --no-file-parallelism",
  "test:e2e": "tsx scripts/check-test-database-url.ts e2e && npm run build && tsx scripts/run-e2e.ts"
}
```

Do not change `test`, `test:unit`, or `test:coverage`.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
npx vitest run tests/unit/test-database-preflight.test.ts tests/unit/ci-workflow-contract.test.ts tests/unit/playwright-agent-contract.test.ts --config vitest.config.ts
npm run typecheck
npm run lint
```

Expected: all focused tests pass; typecheck and lint exit `0`.

- [ ] **Step 7: Verify both missing-env commands fail before expensive work**

Run each command in a clean child process:

```powershell
Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run test:integration
```

Expected:

- exit `1`;
- output contains
  `TEST_DATABASE_URL must be set for npm run test:integration`;
- output does not contain the Vitest `RUN` banner.

Then run:

```powershell
Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run test:e2e
```

Expected:

- exit `1`;
- output contains
  `TEST_DATABASE_URL must be set for npm run test:e2e`;
- output does not contain `next build` or
  `Creating an optimized production build`.

- [ ] **Step 8: Review and commit Task 2**

Review:

```powershell
git diff --check
git diff -- test-config/test-database.ts scripts/check-test-database-url.ts tests/unit/test-database-preflight.test.ts package.json tests/unit/playwright-agent-contract.test.ts tests/unit/ci-workflow-contract.test.ts
```

Commit:

```powershell
git add -- test-config/test-database.ts scripts/check-test-database-url.ts tests/unit/test-database-preflight.test.ts package.json tests/unit/playwright-agent-contract.test.ts tests/unit/ci-workflow-contract.test.ts
git commit -m "test: preflight database-backed commands"
```

---

### Task 3: Clean-Environment and Database-Backed Verification

**Files:**
- Verify only; no source changes expected.

**Interfaces:**
- Consumes the completed Task 1 and Task 2 command contracts.
- Produces verification evidence for local review and CI.

- [ ] **Step 1: Run all fast commands without database env**

Use a fresh PowerShell process for each command so no previous test mutates the
environment:

```powershell
pwsh -NoProfile -Command "Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; npm test"
pwsh -NoProfile -Command "Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; npm run test:unit"
pwsh -NoProfile -Command "Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; npm run test:coverage"
```

Expected: all three commands exit `0` and make no PostgreSQL connection.

- [ ] **Step 2: Re-run static project checks**

Run:

```powershell
npm run lint
npm run typecheck
npm run check:source
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 3: Run integration tests against an isolated database**

Set the isolated environment:

```powershell
$env:DATABASE_URL='postgresql://postgres@127.0.0.1:55435/meeting_room_booking_test?schema=public'
$env:TEST_DATABASE_URL=$env:DATABASE_URL
$env:APP_URL='http://127.0.0.1:3105'
$env:APP_DEPLOYMENT_MODE='local-development'
$env:VERIFICATION_DELIVERY_MODE='console'
$env:PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='Підтверджую reset тимчасової meeting_room_booking_test на порту 55435'
npm run test:integration
```

Expected: all integration tests pass.

- [ ] **Step 4: Run deterministic E2E against the isolated database**

With the same environment, run:

```powershell
npm run test:e2e
```

Expected:

- preflight passes;
- production build passes;
- all deterministic Playwright tests pass;
- the standalone child server receives `DATABASE_URL` from
  `TEST_DATABASE_URL`.

- [ ] **Step 5: Run production dependency audit**

Run:

```powershell
npm audit --omit=dev --audit-level=high
```

Expected: zero production vulnerabilities at the configured threshold.

- [ ] **Step 6: Perform final scoped review**

Review the complete range:

```powershell
git log --oneline fa6b1e7..HEAD
git diff --stat fa6b1e7..HEAD
git diff fa6b1e7..HEAD
git status --short --branch
```

Confirm:

- no application runtime behavior changed;
- no unit command reads database env;
- no fallback to `DATABASE_URL` exists;
- E2E preflight precedes build;
- runtime safety checks remain;
- working tree is clean.

Do not create a verification-only commit.

---

## Final Publication Gate

After the scoped review is clean:

1. Push `main`.
2. Wait for all GitHub CI jobs for the exact HEAD SHA.
3. Move `event2-submission-ready` only after CI succeeds.
4. Verify remote `main` and the tag point to the same exact SHA.
