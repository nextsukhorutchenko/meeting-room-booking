import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export type ForbiddenControl = {
  path: string;
  index: number;
  codePoint: string;
};

const forbiddenControlPattern =
  /[\u061C\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu;
const excludedPaths = new Set(['package-lock.json']);
const excludedPrefixes = [
  'coverage/',
  'midscene_run/',
  'node_modules/',
  'playwright-report/',
  'src/generated/prisma/',
  'test-results/',
];

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

function isExcluded(path: string): boolean {
  return excludedPaths.has(path) ||
    excludedPrefixes.some((prefix) => path.startsWith(prefix));
}

function trackedPaths(): string[] {
  const output = execFileSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return output.split('\0').filter(Boolean);
}

function readTrackedText(path: string): string | null {
  const content = readFileSync(path);
  if (content.includes(0)) {
    return null;
  }
  try {
    return new TextDecoder('utf-8', {fatal: true}).decode(content);
  } catch {
    return null;
  }
}

export function scanTrackedTextFiles(): ForbiddenControl[] {
  const findings: ForbiddenControl[] = [];
  for (const path of trackedPaths()) {
    if (isExcluded(path)) {
      continue;
    }
    const content = readTrackedText(path);
    if (content !== null) {
      findings.push(...findForbiddenControls(path, content));
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
    process.stderr.write(
      `${finding.path}:${finding.index}: forbidden ${finding.codePoint}\n`,
    );
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
