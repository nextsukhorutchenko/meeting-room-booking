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
    baseURL: baseUrl,
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
