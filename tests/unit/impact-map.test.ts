import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {describe, expect, it} from 'vitest';
import {
  selectImpactedTests,
  type ImpactDecision,
  type TestTag,
} from '../../e2e/impact-map';

const mappingCases: Array<{
  expectedReason: string;
  expectedTags: TestTag[];
  paths: string[];
}> = [
  {
    paths: ['src/modules/auth/auth.service.ts'],
    expectedTags: ['@auth', '@critical'],
    expectedReason:
      'authentication paths affect authentication and critical access flows',
  },
  {
    paths: ['src/components/schedule/week-grid.tsx'],
    expectedTags: ['@schedule', '@booking'],
    expectedReason:
      'schedule and room paths affect schedule and booking flows',
  },
  {
    paths: ['src/lib/time/office-time.ts'],
    expectedTags: ['@timezone', '@booking', '@critical'],
    expectedReason:
      'src/lib/time/** affects timezone-sensitive booking flows',
  },
  {
    paths: ['src/app/globals.css'],
    expectedTags: ['@schedule', '@mobile'],
    expectedReason:
      'src/app/globals.css affects schedule and mobile layout',
  },
];

describe('selectImpactedTests', () => {
  it.each(mappingCases)(
    'maps $paths to $expectedTags',
    ({expectedReason, expectedTags, paths}) => {
      expect(selectImpactedTests(paths)).toEqual({
        mode: 'selected',
        tags: expectedTags,
        reasons: [expectedReason],
      });
    },
  );

  it('normalizes Windows separators and name-status additions', () => {
    expect(selectImpactedTests([
      'A\tsrc\\modules\\auth\\verification.service.ts',
    ])).toEqual({
      mode: 'selected',
      tags: ['@auth', '@critical'],
      reasons: [
        'authentication paths affect authentication and critical access flows',
      ],
    });
  });

  it('accepts only unscored A and M records for mapped paths', () => {
    expect(selectImpactedTests([
      'M\tsrc/modules/auth/auth.service.ts',
      'A\tsrc\\modules\\auth\\verification.service.ts',
    ])).toEqual({
      mode: 'selected',
      tags: ['@auth', '@critical'],
      reasons: [
        'authentication paths affect authentication and critical access flows',
      ],
    });
  });

  it('deduplicates and deterministically orders tags and reasons', () => {
    expect(selectImpactedTests([
      './src/lib/time/office-time.ts',
      'src\\components\\schedule\\week-grid.tsx',
      'src/lib/time/browser-zone.ts',
    ])).toEqual({
      mode: 'selected',
      tags: ['@schedule', '@timezone', '@booking', '@critical'],
      reasons: [
        'schedule and room paths affect schedule and booking flows',
        'src/lib/time/** affects timezone-sensitive booking flows',
      ],
    });
  });

  it('falls back to the full suite for an empty diff', () => {
    expect(selectImpactedTests([])).toEqual({
      mode: 'full',
      reasons: ['No changed paths were provided'],
    });
  });

  it('falls back to the full suite for an unknown production path', () => {
    expect(selectImpactedTests(['src/new-area/unknown.ts'])).toEqual({
      mode: 'full',
      reasons: ['Unknown production path: src/new-area/unknown.ts'],
    });
  });

  it.each([
    'playwright.config.ts',
    'next.config.ts',
    'tsconfig.json',
    'package.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    '.github/workflows/ci.yml',
    '.codex/agents/playwright_test_healer.toml',
    'prisma/schema.prisma',
    'prisma/migrations/migration_lock.toml',
    'e2e/fixtures.ts',
    'tests/unit/impact-map.test.ts',
    'scripts/select-impacted-tests.ts',
  ])('falls back for cross-cutting path %s', (path) => {
    expect(selectImpactedTests([path])).toEqual({
      mode: 'full',
      reasons: [`Cross-cutting change requires full E2E: ${path}`],
    });
  });

  it('falls back when any path is unknown even if another path is mapped', () => {
    expect(selectImpactedTests([
      'src/modules/auth/auth.service.ts',
      'src/new-area/unknown.ts',
    ])).toEqual({
      mode: 'full',
      reasons: ['Unknown production path: src/new-area/unknown.ts'],
    });
  });

  it('sorts every reason when multiple changes require the full suite', () => {
    expect(selectImpactedTests([
      'src/new-area/unknown.ts',
      'package-lock.json',
    ])).toEqual({
      mode: 'full',
      reasons: [
        'Cross-cutting change requires full E2E: package-lock.json',
        'Unknown production path: src/new-area/unknown.ts',
      ],
    });
  });

  it('falls back for deleted files reported by git name-status', () => {
    expect(selectImpactedTests([
      'D\tsrc/modules/auth/auth.service.ts',
    ])).toEqual({
      mode: 'full',
      reasons: [
        'Deleted path requires full E2E: src/modules/auth/auth.service.ts',
      ],
    });
  });

  it('falls back for renamed files reported by git name-status', () => {
    expect(selectImpactedTests([
      'R100\tsrc/modules/auth/auth.service.ts\t' +
        'src/modules/auth/login.service.ts',
    ])).toEqual({
      mode: 'full',
      reasons: [
        'Renamed path requires full E2E: ' +
          'src/modules/auth/auth.service.ts -> ' +
          'src/modules/auth/login.service.ts',
      ],
    });
  });

  it('falls back for copied files with a valid similarity score', () => {
    expect(selectImpactedTests([
      'C075\tsrc/modules/auth/auth.service.ts\t' +
        'src/modules/auth/auth-copy.service.ts',
    ])).toEqual({
      mode: 'full',
      reasons: [
        'Copied path requires full E2E: ' +
          'src/modules/auth/auth.service.ts -> ' +
          'src/modules/auth/auth-copy.service.ts',
      ],
    });
  });

  it.each([
    ['M100\tsrc/modules/auth/auth.service.ts', 'M100'],
    ['A50\tsrc/modules/auth/auth.service.ts', 'A50'],
    ['M', 'M'],
    ['A\tsrc/modules/auth/auth.service.ts\textra.ts', 'A'],
    ['D100\tsrc/modules/auth/auth.service.ts', 'D100'],
    ['D\tsrc/one.ts\tsrc/two.ts', 'D'],
    ['R\tsrc/one.ts\tsrc/two.ts', 'R'],
    ['R101\tsrc/one.ts\tsrc/two.ts', 'R101'],
    ['R-1\tsrc/one.ts\tsrc/two.ts', 'R-1'],
    ['R100\tsrc/one.ts', 'R100'],
    ['R100\tsrc/one.ts\tsrc/two.ts\tsrc/three.ts', 'R100'],
    ['C\tsrc/one.ts\tsrc/two.ts', 'C'],
    ['C101\tsrc/one.ts\tsrc/two.ts', 'C101'],
    ['C100\tsrc/one.ts', 'C100'],
    ['T\tsrc/modules/auth/auth.service.ts', 'T'],
    ['X100\tsrc/modules/auth/auth.service.ts', 'X100'],
  ])('fails closed for malformed name-status %s', (input, status) => {
    expect(selectImpactedTests([input])).toEqual({
      mode: 'full',
      reasons: expect.arrayContaining([
        expect.stringContaining(`Git status ${status} requires full E2E`),
      ]),
    });
  });
});

function runSelector(
  args: string[],
  input?: string,
): {decision: ImpactDecision; stderr: string; status: number | null} {
  const result = spawnSync(
    process.execPath,
    [
      resolve('node_modules/tsx/dist/cli.mjs'),
      resolve('scripts/select-impacted-tests.ts'),
      ...args,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      input,
    },
  );

  return {
    decision: result.stdout ?
      JSON.parse(result.stdout) as ImpactDecision :
      {mode: 'full', reasons: []},
    stderr: result.stderr,
    status: result.status,
  };
}

describe('select-impacted-tests CLI', () => {
  it('accepts command-line paths and emits stable grep JSON', () => {
    const result = runSelector(['src/modules/auth/auth.service.ts']);

    expect(result).toEqual({
      status: 0,
      stderr: '',
      decision: {
        mode: 'selected',
        tags: ['@auth', '@critical'],
        grep: '@auth|@critical',
        reasons: [
          'authentication paths affect authentication and critical access flows',
        ],
      },
    });
  });

  it('accepts newline-delimited name-status input', () => {
    const result = runSelector([], 'M\tsrc\\app\\globals.css\n');

    expect(result).toEqual({
      status: 0,
      stderr: '',
      decision: {
        mode: 'selected',
        tags: ['@schedule', '@mobile'],
        grep: '@schedule|@mobile',
        reasons: [
          'src/app/globals.css affects schedule and mobile layout',
        ],
      },
    });
  });

  it.each([
    'M100\tsrc\\modules\\auth\\auth.service.ts\n',
    'A50\tsrc/modules/auth/auth.service.ts\n',
    'R101\tsrc/one.ts\tsrc/two.ts\n',
    'C100\tsrc/one.ts\n',
  ])('emits full JSON for malformed stdin %j', (input) => {
    const result = runSelector([], input);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.decision).toMatchObject({mode: 'full'});
    expect(result.decision).not.toHaveProperty('grep');
  });

  it('emits a full decision without grep for a schema change', () => {
    const result = runSelector(['prisma/schema.prisma']);

    expect(result).toEqual({
      status: 0,
      stderr: '',
      decision: {
        mode: 'full',
        reasons: [
          'Cross-cutting change requires full E2E: prisma/schema.prisma',
        ],
      },
    });
  });
});
