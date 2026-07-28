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
