import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  createPrismaGenerateEnvironment,
  PRISMA_GENERATE_DATABASE_URL,
} from '../../scripts/generate-prisma-client';

const wrapperPath = resolve('scripts/generate-prisma-client.ts');

function environmentWithoutDatabaseUrls(): NodeJS.ProcessEnv {
  const environment = {...process.env};
  delete environment.DATABASE_URL;
  delete environment.TEST_DATABASE_URL;
  return environment;
}

describe('Prisma Client generation environment', () => {
  it('uses a non-runtime database URL only when DATABASE_URL is absent', () => {
    expect(createPrismaGenerateEnvironment({})).toMatchObject({
      DATABASE_URL: PRISMA_GENERATE_DATABASE_URL,
    });
  });

  it('preserves an explicitly supplied DATABASE_URL', () => {
    const databaseUrl =
      'postgresql://localhost:5432/meeting_room_booking?schema=public';

    expect(createPrismaGenerateEnvironment({DATABASE_URL: databaseUrl}))
      .toMatchObject({DATABASE_URL: databaseUrl});
  });

  it('generates through the local Prisma CLI without database environment', () => {
    const parentDatabaseUrl = process.env.DATABASE_URL;
    const parentTestDatabaseUrl = process.env.TEST_DATABASE_URL;
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', wrapperPath],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: environmentWithoutDatabaseUrls(),
        timeout: 30_000,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(process.env.DATABASE_URL).toBe(parentDatabaseUrl);
    expect(process.env.TEST_DATABASE_URL).toBe(parentTestDatabaseUrl);
  }, 35_000);

  it('propagates a Prisma CLI failure', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', wrapperPath, '--invalid-prisma-option'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: environmentWithoutDatabaseUrls(),
        timeout: 30_000,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBeNull();
    expect(result.status).not.toBe(0);
  }, 35_000);
});
