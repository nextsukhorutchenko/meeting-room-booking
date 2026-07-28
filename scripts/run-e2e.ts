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
    let pollTimer: NodeJS.Timeout | undefined;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        if (pollTimer) {
          clearTimeout(pollTimer);
        }
        reject(new Error('Standalone E2E server did not become ready'));
      }
    }, 30_000);

    const settle = (operation: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
      operation();
    };

    const pollHealth = async (): Promise<void> => {
      if (settled) {
        return;
      }
      try {
        const response = await fetch(`${baseUrl}/api/health`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(1_000),
        });
        if (response.ok) {
          settle(resolvePromise);
          return;
        }
      } catch {
        // The bounded retry below handles startup connection failures.
      }
      if (!settled) {
        pollTimer = setTimeout(() => void pollHealth(), 200);
      }
    };

    server.once('exit', (code, signal) => {
      settle(() => reject(new Error(
        `Standalone E2E server exited before ready: ${code ?? signal}`,
      )));
    });
    server.once('error', (error) => {
      settle(() => reject(error));
    });
    void pollHealth();
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
      APP_DEPLOYMENT_MODE: 'local-development',
      DATABASE_URL: testDatabaseUrl,
      HOSTNAME: '127.0.0.1',
      PORT: '3105',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (chunk: Buffer) => process.stdout.write(chunk));
  server.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));

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
    const outcome = await Promise.race([
      once(runner, 'exit').then(([code, signal]) => ({
        code: code as number | null,
        signal: signal as NodeJS.Signals | null,
        source: 'playwright' as const,
      })),
      once(server, 'exit').then(([code, signal]) => ({
        code: code as number | null,
        signal: signal as NodeJS.Signals | null,
        source: 'server' as const,
      })),
    ]);
    if (outcome.source === 'server') {
      await terminate(runner);
      throw new Error(
        `Standalone E2E server exited during Playwright: ` +
        `${outcome.code ?? outcome.signal}`,
      );
    }
    if (outcome.code !== 0) {
      throw new Error(
        `Playwright failed: ${outcome.code ?? outcome.signal}`,
      );
    }
  } finally {
    await terminate(server);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'E2E run failed');
  process.exitCode = 1;
});
