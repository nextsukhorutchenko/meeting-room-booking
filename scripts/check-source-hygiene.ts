import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {extname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export type ForbiddenControl = {
  path: string;
  index: number;
  codePoint: string;
};

export type UnsupportedTextEncoding = {
  path: string;
  error: 'UNSUPPORTED_TEXT_ENCODING';
};

export type SourceHygieneFinding =
  | ForbiddenControl
  | UnsupportedTextEncoding;

// Text permits horizontal tab, line feed, and carriage return from C0 only.
const forbiddenControlPattern =
  /[\p{Cf}\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu;
const excludedPaths = new Set(['package-lock.json']);
const excludedPrefixes = [
  'coverage/',
  'midscene_run/',
  'node_modules/',
  'playwright-report/',
  'src/generated/prisma/',
  'test-results/',
];
const binaryExtensions = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.webp',
  '.woff',
  '.woff2',
]);

type GitRunner = (
  file: string,
  arguments_: string[],
  options: {
    encoding: 'utf8';
    maxBuffer: number;
  },
) => string;

type SourceInventory = {
  readFile(path: string): Buffer;
  trackedPaths(): string[];
};

export function findForbiddenControls(
  path: string,
  content: string,
): ForbiddenControl[] {
  return [...content.matchAll(forbiddenControlPattern)].map((match) => {
    const codePoint = match[0].codePointAt(0);
    if (codePoint === undefined || match.index === undefined) {
      throw new Error('Unable to identify a forbidden source control');
    }
    return {
      path,
      index: match.index,
      codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
    };
  });
}

export function isExcludedTrackedPath(path: string): boolean {
  return excludedPaths.has(path) ||
    excludedPrefixes.some((prefix) => path.startsWith(prefix));
}

export function listTrackedPaths(
  run: GitRunner = execFileSync as GitRunner,
): string[] {
  const output = run('git', ['ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return output.split('\0').filter(Boolean);
}

function isKnownBinary(path: string): boolean {
  return binaryExtensions.has(extname(path).toLowerCase());
}

function readTrackedText(content: Buffer): string {
  if (content.includes(0)) {
    throw new Error('NUL byte in tracked text');
  }
  return new TextDecoder('utf-8', {fatal: true}).decode(content);
}

export function scanTrackedTextFiles(
  overrides: Partial<SourceInventory> = {},
): SourceHygieneFinding[] {
  const inventory: SourceInventory = {
    readFile: readFileSync,
    trackedPaths: listTrackedPaths,
    ...overrides,
  };
  const findings: SourceHygieneFinding[] = [];
  for (const path of inventory.trackedPaths()) {
    if (isExcludedTrackedPath(path) || isKnownBinary(path)) {
      continue;
    }
    try {
      const content = readTrackedText(inventory.readFile(path));
      findings.push(...findForbiddenControls(path, content));
    } catch {
      findings.push({path, error: 'UNSUPPORTED_TEXT_ENCODING'});
    }
  }
  return findings;
}

function main(): void {
  const findings = scanTrackedTextFiles();
  if (findings.length === 0) {
    process.stdout.write('Source hygiene check passed.\n');
    return;
  }

  for (const finding of findings) {
    if ('error' in finding) {
      process.stderr.write(
        `${finding.path}: unsupported text encoding; expected UTF-8\n`,
      );
    } else {
      process.stderr.write(
        `${finding.path}:${finding.index}: forbidden ${finding.codePoint}\n`,
      );
    }
  }
  process.exitCode = 1;
}

const entryPoint = process.argv[1];
if (
  entryPoint &&
  import.meta.url === pathToFileURL(resolve(entryPoint)).href
) {
  main();
}
