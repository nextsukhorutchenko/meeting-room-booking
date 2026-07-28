import {defineConfig, devices} from '@playwright/test';
import {config as loadEnvironment} from 'dotenv';

loadEnvironment({path: '.env', quiet: true});

const baseUrl = process.env.APP_URL ?? 'http://127.0.0.1:3106';
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

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL must be set for Midscene exploratory tests',
  );
}
const testDatabaseName = new URL(testDatabaseUrl).pathname.slice(1);
if (!testDatabaseName.endsWith('_test')) {
  throw new Error(
    `Refusing to use non-test database: ${testDatabaseName}`,
  );
}

export default defineConfig({
  fullyParallel: false,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
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
    baseURL: baseUrl,
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'node node_modules/next/dist/bin/next dev --port ' +
      parsedBaseUrl.port,
    env: {
      APP_URL: baseUrl,
      DATABASE_URL: testDatabaseUrl,
    },
    reuseExistingServer: false,
    url: baseUrl,
  },
  workers: 1,
});
