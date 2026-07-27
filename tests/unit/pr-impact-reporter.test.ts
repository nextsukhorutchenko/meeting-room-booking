import {describe, expect, it} from 'vitest';
import {
  buildPrImpactReport,
  formatPrImpactSummary,
  type PrImpactTestResult,
} from '../../e2e/reporters/pr-impact-reporter';

const unsortedResults: PrImpactTestResult[] = [
  {
    title: 'creates | cancels\nbooking',
    tags: ['@critical', '@booking'],
    project: 'mobile-kyiv',
    durationMs: 1250,
    outcome: 'flaky',
    retries: 1,
  },
  {
    title: 'authenticates demo user',
    tags: [],
    project: 'auth-setup',
    durationMs: 90,
    outcome: 'expected',
    retries: 0,
  },
];

describe('buildPrImpactReport', () => {
  it('sorts tests and tags for stable JSON output', () => {
    expect(buildPrImpactReport('failed', unsortedResults)).toEqual({
      status: 'failed',
      tests: [
        {
          title: 'authenticates demo user',
          tags: [],
          project: 'auth-setup',
          durationMs: 90,
          outcome: 'expected',
          retries: 0,
        },
        {
          title: 'creates | cancels\nbooking',
          tags: ['@booking', '@critical'],
          project: 'mobile-kyiv',
          durationMs: 1250,
          outcome: 'flaky',
          retries: 1,
        },
      ],
    });
  });
});

describe('formatPrImpactSummary', () => {
  it('formats a stable escaped Markdown summary', () => {
    const report = buildPrImpactReport('failed', unsortedResults);

    expect(formatPrImpactSummary(report)).toBe([
      '## Playwright PR impact',
      '',
      'Run status: **failed**',
      '',
      '| Project | Test | Tags | Duration | Outcome | Retries |',
      '| --- | --- | --- | ---: | --- | ---: |',
      '| auth-setup | authenticates demo user | (none) | 90 ms | ' +
        'expected | 0 |',
      '| mobile-kyiv | creates \\| cancels booking | ' +
        '@booking, @critical | 1250 ms | flaky | 1 |',
      '',
    ].join('\n'));
  });

  it('formats an empty run without inventing test rows', () => {
    expect(formatPrImpactSummary({
      status: 'passed',
      tests: [],
    })).toBe([
      '## Playwright PR impact',
      '',
      'Run status: **passed**',
      '',
      'No Playwright tests were executed.',
      '',
    ].join('\n'));
  });
});
