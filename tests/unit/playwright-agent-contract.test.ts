import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

function readHealerInstructions(): string {
  return readFileSync(
    resolve('.codex/agents/playwright_test_healer.toml'),
    'utf8',
  );
}

function readRemediationSection(instructions: string): string {
  const section = /5\. \*\*Code Remediation\*\*([\s\S]*?)6\. \*\*Verification\*\*/
    .exec(instructions)?.[1];
  if (!section) {
    throw new Error('Healer Code Remediation section is missing');
  }
  return section;
}

describe('Playwright healer contract', () => {
  it('permits locator-only proposals without behavior edits', () => {
    const instructions = readHealerInstructions();
    const remediation = readRemediationSection(instructions);

    expect(instructions).toContain(
      'You may propose locator changes only when application behavior',
    );
    expect(remediation).toContain('Updating locators only');
    expect(remediation).not.toMatch(
      /assertions?|expected values?|skip|fixme|wait|application behavior/i,
    );
  });
});

describe('canonical E2E runner contract', () => {
  it('rebuilds current source and waits for health with child-exit handling', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve('package.json'), 'utf8'),
    ) as {scripts: Record<string, string>};
    const runner = readFileSync(resolve('scripts/run-e2e.ts'), 'utf8');

    expect(packageJson.scripts['test:e2e']).toBe(
      'tsx scripts/check-test-database-url.ts e2e && ' +
      'npm run build && tsx scripts/run-e2e.ts',
    );
    expect(runner).toContain('/api/health');
    expect(runner).toContain("server.once('exit'");
    expect(runner).not.toContain("includes('Ready')");
  });
});
