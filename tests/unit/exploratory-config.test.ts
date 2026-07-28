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
