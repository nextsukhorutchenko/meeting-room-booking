import 'dotenv/config';
import {spawn, type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

const baseUrl = 'http://127.0.0.1:3105';
const serverPath = resolve('.next/standalone/server.js');
const playwrightCli = resolve('node_modules/@playwright/test/cli.js');

function waitForServerReady(server: ChildProcess): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Standalone E2E server did not become ready'));
      }
    }, 30_000);

    const settle = (operation: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      operation();
    };

    server.stdout?.on('data', (chunk: Buffer) => {
      process.stdout.write(chunk);
      if (chunk.toString().includes('Ready')) {
        settle(resolvePromise);
      }
    });
    server.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
    });
    server.once('exit', (code, signal) => {
      settle(() => reject(new Error(
        `Standalone E2E server exited before ready: ${code ?? signal}`,
      )));
    });
    server.once('error', (error) => {
      settle(() => reject(error));
    });
  });
}

async function terminate(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) {
    return;
  }
  const exited = once(server, 'exit');
  server.kill();
  await exited;
}

async function main(): Promise<void> {
  if (!existsSync(serverPath)) {
    throw new Error('E2E requires a fresh `npm run build` first');
  }
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL must be set for Playwright tests');
  }

  const server = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      APP_URL: baseUrl,
      DATABASE_URL: testDatabaseUrl,
      HOSTNAME: '127.0.0.1',
      PORT: '3105',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServerReady(server);
    const runner = spawn(
      process.execPath,
      [
        playwrightCli,
        'test',
        '--config',
        'playwright.config.ts',
        ...process.argv.slice(2),
      ],
      {env: process.env, stdio: 'inherit'},
    );
    const [code, signal] = await once(runner, 'exit') as [
      number | null,
      NodeJS.Signals | null,
    ];
    if (code !== 0) {
      throw new Error(`Playwright failed: ${code ?? signal}`);
    }
  } finally {
    await terminate(server);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'E2E run failed');
  process.exitCode = 1;
});
