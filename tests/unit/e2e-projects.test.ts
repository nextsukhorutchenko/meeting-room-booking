import {describe, expect, it} from 'vitest';
import {createDeterministicPlaywrightConfig} from '../../test-config/playwright-configs';

describe('deterministic Playwright responsive projects', () => {
  it('routes responsive suites through the exact authenticated projects', () => {
    const config = createDeterministicPlaywrightConfig();
    const projects = new Map((config.projects ?? []).map((project) => [
      project.name,
      project,
    ]));
    const expected = {
      expanded: {
        testMatch: [
          '**/booking.spec.ts', '**/cancellation.spec.ts',
          '**/my-bookings.spec.ts', '**/notifications.spec.ts',
          '**/schedule.spec.ts', '**/transition.spec.ts',
        ],
        viewport: {width: 1440, height: 900},
      },
      medium: {
        testMatch: ['**/booking.spec.ts', '**/schedule.spec.ts'],
        viewport: {width: 1024, height: 768},
      },
      tablet: {
        testMatch: [
          '**/booking.spec.ts', '**/cancellation.spec.ts',
          '**/schedule.spec.ts', '**/transition.spec.ts',
        ],
        viewport: {width: 768, height: 1024},
      },
      'mobile-lg': {
        testMatch: [
          '**/booking.spec.ts', '**/cancellation.spec.ts',
          '**/mobile.spec.ts', '**/my-bookings.spec.ts',
          '**/notifications.spec.ts', '**/transition.spec.ts',
        ],
        viewport: {width: 390, height: 844},
      },
      mobile: {
        testMatch: [
          '**/booking.spec.ts', '**/cancellation.spec.ts',
          '**/mobile.spec.ts', '**/my-bookings.spec.ts',
        ],
        viewport: {width: 360, height: 800},
      },
      reflow: {
        testMatch: ['**/booking.spec.ts', '**/mobile.spec.ts'],
        viewport: {width: 320, height: 800},
      },
    } as const;

    for (const [name, expectedProject] of Object.entries(expected)) {
      const project = projects.get(name);
      expect(project?.dependencies).toEqual(['auth-setup']);
      expect(project?.testMatch).toEqual(expectedProject.testMatch);
      expect(project?.use).toMatchObject({
        storageState: 'test-results/.auth/demo-user.json',
        timezoneId: 'Europe/Kyiv',
        viewport: expectedProject.viewport,
      });
    }
    expect(projects.get('mobile-lg')?.use).toMatchObject({isMobile: true});
    expect(projects.has('desktop-kyiv')).toBe(false);
    expect(projects.has('mobile-kyiv')).toBe(false);
  });
});
