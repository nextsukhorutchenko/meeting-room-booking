import {describe, expect, it} from 'vitest';
import standardConfig from '../../playwright.config';
import exploratoryConfig from '../../playwright.midscene.config';

describe('Playwright exploratory test boundary', () => {
  it('keeps exploratory tests outside the deterministic suite', () => {
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
