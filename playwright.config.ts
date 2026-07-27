import {defineConfig, devices} from '@playwright/test';
import {config as loadEnvironment} from 'dotenv';

loadEnvironment({path: '.env', quiet: true});

const baseUrl = 'http://127.0.0.1:3105';
const authStatePath = 'test-results/.auth/demo-user.json';
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL must be set for Playwright tests');
}

export default defineConfig({
  fullyParallel: false,
  retries: 1,
  workers: 1,
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/exploratory/**',
  use: {
    baseURL: baseUrl,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --port 3105',
    url: baseUrl,
    env: {
      APP_URL: baseUrl,
      DATABASE_URL: testDatabaseUrl,
    },
    reuseExistingServer: false,
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
      name: 'desktop',
      dependencies: ['auth-setup'],
      testIgnore: ['**/seed.spec.ts', '**/smoke.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: authStatePath,
        viewport: {width: 1440, height: 900},
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
