import {describe, expect, it} from 'vitest';
import {
  createDeterministicPlaywrightConfig,
  createExploratoryPlaywrightConfig,
} from '../../test-config/playwright-configs';

const databaseEnvironmentVariables = ['TEST_DATABASE_URL', 'DATABASE_URL'] as const;

function withoutDatabaseEnvironment(callback: () => void): void {
  const previousValues = new Map(
    databaseEnvironmentVariables.map((name) => [name, process.env[name]]),
  );

  try {
    for (const name of databaseEnvironmentVariables) {
      delete process.env[name];
    }
    callback();
  } finally {
    for (const [name, value] of previousValues) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

describe('Playwright exploratory test boundary', () => {
  it('constructs deterministic and exploratory configs without process env', () => {
    withoutDatabaseEnvironment(() => {
      const standardConfig = createDeterministicPlaywrightConfig();
      const exploratoryConfig = createExploratoryPlaywrightConfig({
        baseUrl: 'http://127.0.0.1:3106',
        testDatabaseUrl:
          'postgresql://localhost/meeting_room_booking_test?schema=public',
      });

      expect(standardConfig.testMatch).toBe('**/*.spec.ts');
      expect(standardConfig.testIgnore).toContain('**/exploratory/**');
      const expanded = standardConfig.projects?.find(
        (project) => project.name === 'expanded',
      );
      expect(expanded?.testMatch).toContain('**/schedule.spec.ts');
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
});
