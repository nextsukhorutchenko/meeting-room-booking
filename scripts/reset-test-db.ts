import 'dotenv/config';
import {execFile} from 'node:child_process';
import {resolve} from 'node:path';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';

const execFileAsync = promisify(execFile);

export function assertTestDatabaseUrl(databaseUrl: string): void {
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing to reset non-test database: ${databaseName}`);
  }
}

function getTestDatabaseUrl(): string {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL must be set to reset the test database');
  }
  assertTestDatabaseUrl(databaseUrl);
  return databaseUrl;
}

export async function resetTestDatabase(): Promise<void> {
  const databaseUrl = getTestDatabaseUrl();
  const prismaCli = resolve('node_modules/prisma/build/index.js');

  await execFileAsync(
    process.execPath,
    [prismaCli, 'migrate', 'reset', '--force'],
    {env: {...process.env, DATABASE_URL: databaseUrl}},
  );
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  resetTestDatabase().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
