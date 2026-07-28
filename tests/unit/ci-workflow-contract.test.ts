import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

describe('CI dependency bootstrap contract', () => {
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
});
