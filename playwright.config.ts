import {defineConfig, devices} from '@playwright/test';
import {config as loadEnvironment} from 'dotenv';

loadEnvironment({path: '.env', quiet: true});

const baseUrl = 'http://127.0.0.1:3105';
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL must be set for Playwright tests');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/exploratory/**',
  use: {
    baseURL: baseUrl,
  },
  webServer: {
    command: 'npm run dev -- --port 3105',
    url: baseUrl,
    env: {
      APP_URL: baseUrl,
      DATABASE_URL: testDatabaseUrl,
    },
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: {width: 390, height: 844},
      },
    },
  ],
});
