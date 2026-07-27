import {appendFile, mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

export type PrImpactTestResult = {
  title: string;
  tags: string[];
  project: string;
  durationMs: number;
  outcome: ReturnType<TestCase['outcome']>;
  retries: number;
};

export type PrImpactReport = {
  status: FullResult['status'];
  tests: PrImpactTestResult[];
};

type PrImpactReporterOptions = {
  outputFile?: string;
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareTestResults(
  left: PrImpactTestResult,
  right: PrImpactTestResult,
): number {
  return compareText(left.project, right.project) ||
    compareText(left.title, right.title);
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

export function buildPrImpactReport(
  status: FullResult['status'],
  results: PrImpactTestResult[],
): PrImpactReport {
  return {
    status,
    tests: results
      .map((result) => ({
        ...result,
        tags: [...new Set(result.tags)].sort(compareText),
      }))
      .sort(compareTestResults),
  };
}

export function formatPrImpactSummary(report: PrImpactReport): string {
  const lines = [
    '## Playwright PR impact',
    '',
    `Run status: **${report.status}**`,
    '',
  ];
  if (report.tests.length === 0) {
    return [...lines, 'No Playwright tests were executed.', ''].join('\n');
  }

  lines.push(
    '| Project | Test | Tags | Duration | Outcome | Retries |',
    '| --- | --- | --- | ---: | --- | ---: |',
  );
  for (const test of report.tests) {
    lines.push(
      `| ${escapeMarkdownCell(test.project)} | ` +
      `${escapeMarkdownCell(test.title)} | ` +
      `${test.tags.length > 0 ? test.tags.join(', ') : '(none)'} | ` +
      `${test.durationMs} ms | ${test.outcome} | ${test.retries} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

export default class PrImpactReporter implements Reporter {
  private readonly outputFile: string;
  private readonly results = new Map<string, PrImpactTestResult>();

  constructor(options: PrImpactReporterOptions = {}) {
    this.outputFile = resolve(
      options.outputFile ?? 'test-results/pr-impact.json',
    );
  }

  printsToStdio(): boolean {
    return false;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const previous = this.results.get(test.id);
    this.results.set(test.id, {
      title: test.title,
      tags: test.tags,
      project: test.parent.project()?.name ?? 'unknown',
      durationMs: (previous?.durationMs ?? 0) + result.duration,
      outcome: test.outcome(),
      retries: Math.max(previous?.retries ?? 0, result.retry),
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    const report = buildPrImpactReport(result.status, [...this.results.values()]);
    try {
      await mkdir(dirname(this.outputFile), {recursive: true});
      await writeFile(
        this.outputFile,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8',
      );
    } catch (error: unknown) {
      this.logWriteError('JSON artifact', error);
    }

    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      try {
        await appendFile(summaryPath, formatPrImpactSummary(report), 'utf8');
      } catch (error: unknown) {
        this.logWriteError('GitHub step summary', error);
      }
    }
  }

  private logWriteError(target: string, error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[pr-impact-reporter] Could not write ${target}: ${message}`);
  }
}
