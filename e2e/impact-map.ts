export type TestTag =
  | '@auth'
  | '@schedule'
  | '@booking'
  | '@timezone'
  | '@mobile'
  | '@critical';

export type ImpactDecision =
  | {mode: 'selected'; tags: TestTag[]; reasons: string[]}
  | {mode: 'full'; reasons: string[]};

type ImpactRule = {
  prefixes?: string[];
  paths?: string[];
  reason: string;
  tags: TestTag[];
};

type ParsedChange =
  | {kind: 'path'; path: string}
  | {kind: 'deleted'; path: string}
  | {kind: 'renamed'; from: string; to: string}
  | {kind: 'copied'; from: string; to: string}
  | {kind: 'unsafe-status'; status: string; paths: string[]};

const TAG_ORDER: TestTag[] = [
  '@auth',
  '@schedule',
  '@timezone',
  '@mobile',
  '@booking',
  '@critical',
];

const IMPACT_RULES: ImpactRule[] = [
  {
    paths: ['src/app/globals.css'],
    tags: ['@schedule', '@mobile'],
    reason: 'src/app/globals.css affects schedule and mobile layout',
  },
  {
    prefixes: [
      'src/modules/auth/',
      'src/components/auth/',
      'src/app/api/auth/',
      'src/app/login/',
      'src/app/register/',
      'src/app/verify/',
    ],
    tags: ['@auth', '@critical'],
    reason:
      'authentication paths affect authentication and critical access flows',
  },
  {
    prefixes: [
      'src/components/schedule/',
      'src/app/schedule/',
      'src/modules/rooms/',
      'src/app/api/rooms/',
    ],
    tags: ['@schedule', '@booking'],
    reason:
      'schedule and room paths affect schedule and booking flows',
  },
  {
    prefixes: ['src/lib/time/'],
    tags: ['@timezone', '@booking', '@critical'],
    reason: 'src/lib/time/** affects timezone-sensitive booking flows',
  },
  {
    prefixes: [
      'src/modules/bookings/',
      'src/components/bookings/',
      'src/app/api/bookings/',
      'src/app/api/me/bookings/',
      'src/app/my-bookings/',
    ],
    tags: ['@booking', '@critical'],
    reason: 'booking paths affect booking and critical flows',
  },
];

const CROSS_CUTTING_PREFIXES = [
  '.codex/',
  '.github/',
  'e2e/',
  'prisma/',
  'scripts/',
  'specs/',
  'tests/',
];

const CROSS_CUTTING_PATHS = new Set([
  '.env.example',
  '.gitignore',
  '.nvmrc',
  'docker-compose.yml',
  'eslint.config.mjs',
  'next.config.ts',
  'package.json',
  'package-lock.json',
  'playwright.config.ts',
  'pnpm-lock.yaml',
  'postcss.config.mjs',
  'prisma.config.ts',
  'tsconfig.json',
  'vitest.config.ts',
  'vitest.integration.config.ts',
  'yarn.lock',
]);

function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+/g, '/');
}

function parseChange(rawChange: string): ParsedChange {
  const fields = rawChange.split('\t');
  const status = fields[0];
  if (fields.length === 1 && !/^[A-Z](?:\d+)?$/.test(status)) {
    return {kind: 'path', path: normalizePath(rawChange)};
  }

  const paths = fields.slice(1).map(normalizePath).filter(Boolean);
  if (
    (status === 'A' || status === 'M') &&
    fields.length === 2 &&
    paths.length === 1
  ) {
    return {kind: 'path', path: paths[0]};
  }
  if (status === 'D' && fields.length === 2 && paths.length === 1) {
    return {kind: 'deleted', path: paths[0]};
  }
  const similarityStatus = /^([RC])(\d{1,3})$/.exec(status);
  const similarityScore = similarityStatus ?
    Number(similarityStatus[2]) :
    Number.NaN;
  if (
    similarityStatus &&
    similarityScore <= 100 &&
    fields.length === 3 &&
    paths.length === 2
  ) {
    return similarityStatus[1] === 'R' ?
      {kind: 'renamed', from: paths[0], to: paths[1]} :
      {kind: 'copied', from: paths[0], to: paths[1]};
  }
  return {kind: 'unsafe-status', status, paths};
}

function isCrossCutting(path: string): boolean {
  return CROSS_CUTTING_PATHS.has(path) ||
    CROSS_CUTTING_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function findImpactRule(path: string): ImpactRule | undefined {
  return IMPACT_RULES.find((rule) =>
    rule.paths?.includes(path) ||
    rule.prefixes?.some((prefix) => path.startsWith(prefix)),
  );
}

function sortTags(tags: Set<TestTag>): TestTag[] {
  return TAG_ORDER.filter((tag) => tags.has(tag));
}

export function selectImpactedTests(
  changedPaths: string[],
): ImpactDecision {
  const nonEmptyChanges = changedPaths.filter((path) => path.trim().length > 0);
  if (nonEmptyChanges.length === 0) {
    return {mode: 'full', reasons: ['No changed paths were provided']};
  }

  const tags = new Set<TestTag>();
  const reasons = new Set<string>();
  const fullReasons = new Set<string>();

  for (const rawChange of nonEmptyChanges) {
    const change = parseChange(rawChange);
    if (change.kind === 'deleted') {
      fullReasons.add(`Deleted path requires full E2E: ${change.path}`);
      continue;
    }
    if (change.kind === 'renamed') {
      fullReasons.add(
        `Renamed path requires full E2E: ${change.from} -> ${change.to}`,
      );
      continue;
    }
    if (change.kind === 'copied') {
      fullReasons.add(
        `Copied path requires full E2E: ${change.from} -> ${change.to}`,
      );
      continue;
    }
    if (change.kind === 'unsafe-status') {
      const listedPaths = change.paths.length > 0 ?
        `: ${change.paths.join(' -> ')}` :
        '';
      fullReasons.add(
        `Git status ${change.status} requires full E2E${listedPaths}`,
      );
      continue;
    }

    if (isCrossCutting(change.path)) {
      fullReasons.add(
        `Cross-cutting change requires full E2E: ${change.path}`,
      );
      continue;
    }

    const rule = findImpactRule(change.path);
    if (!rule) {
      fullReasons.add(`Unknown production path: ${change.path}`);
      continue;
    }

    rule.tags.forEach((tag) => tags.add(tag));
    reasons.add(rule.reason);
  }

  if (fullReasons.size > 0) {
    return {mode: 'full', reasons: [...fullReasons].sort()};
  }

  return {
    mode: 'selected',
    tags: sortTags(tags),
    reasons: [...reasons].sort(),
  };
}
