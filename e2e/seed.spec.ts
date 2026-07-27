import {execFile} from 'node:child_process';
import {resolve} from 'node:path';
import {promisify} from 'node:util';
import {test} from '@playwright/test';

test('resets and seeds the isolated browser test database', async () => {
  const execFileAsync = promisify(execFile);
  const tsxCli = resolve('node_modules/tsx/dist/cli.mjs');
  await execFileAsync(
    process.execPath,
    [tsxCli, resolve('scripts/reset-test-db.ts')],
    {env: process.env},
  );
  await execFileAsync(
    process.execPath,
    [tsxCli, resolve('prisma/seed-test.ts')],
    {env: process.env},
  );
});
