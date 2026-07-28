import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['tests/integration/global-setup.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    include: [
      'src/**/*.integration.test.ts',
      'src/**/*.integration.test.tsx',
      'tests/integration/**/*.test.ts',
    ],
  },
});
