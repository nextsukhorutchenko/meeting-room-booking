import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

describe('CI dependency bootstrap contract', () => {
  it('configures safe local verification delivery for CI routes', () => {
    const workflow = readFileSync(
      resolve('.github/workflows/ci.yml'),
      'utf8',
    );

    expect(workflow).toMatch(
      /APP_DEPLOYMENT_MODE: local-development/,
    );
    expect(workflow).toMatch(
      /VERIFICATION_DELIVERY_MODE: console/,
    );
  });

  it('generates Prisma Client after every dependency install', () => {
    const workflow = readFileSync(
      resolve('.github/workflows/ci.yml'),
      'utf8',
    );
    const installOffsets = [...workflow.matchAll(/run: npm ci/g)]
      .map((match) => match.index);

    expect(installOffsets).toHaveLength(2);

    for (const [index, installOffset] of installOffsets.entries()) {
      const nextInstallOffset = installOffsets[index + 1] ?? workflow.length;
      const jobRemainder = workflow.slice(installOffset, nextInstallOffset);

      expect(jobRemainder).toMatch(
        /name: Generate Prisma Client\s+run: npm run db:generate/,
      );
    }
  });

  it('keeps unit commands database-free and preflights database suites', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve('package.json'), 'utf8'),
    ) as {scripts: Record<string, string>};

    expect(packageJson.scripts.test).toBe(
      'vitest run --config vitest.config.ts',
    );
    expect(packageJson.scripts['test:unit']).toBe(
      'vitest run --config vitest.config.ts',
    );
    expect(packageJson.scripts['test:coverage']).toBe(
      'vitest run --coverage --config vitest.config.ts',
    );
    expect(packageJson.scripts.pretest).toBe('npm run db:generate');
    expect(packageJson.scripts['pretest:unit']).toBe('npm run db:generate');
    expect(packageJson.scripts['pretest:coverage']).toBe(
      'npm run db:generate',
    );
    expect(packageJson.scripts['db:generate']).toBe(
      'tsx scripts/generate-prisma-client.ts',
    );
    expect(packageJson.scripts.postinstall).toBeUndefined();
    expect(packageJson.scripts['test:integration']).toMatch(
      /^tsx scripts\/check-test-database-url\.ts integration && /,
    );
    expect(packageJson.scripts['test:e2e']).toMatch(
      /^tsx scripts\/check-test-database-url\.ts e2e && npm run build && /,
    );
  });
});
