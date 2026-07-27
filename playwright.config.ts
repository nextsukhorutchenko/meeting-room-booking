import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/exploratory/**',
  use: {
    baseURL: 'http://127.0.0.1:3105',
  },
  webServer: {
    command: 'npm run dev -- --port 3105',
    url: 'http://127.0.0.1:3105',
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
