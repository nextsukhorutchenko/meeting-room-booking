import {cpSync, existsSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const runtimeRequire = createRequire(resolve('package.json'));
const proxyRuntimePath = resolve('.next/server/middleware.js');
const source = resolve('.next/static');
const destination = resolve('.next/standalone/.next/static');

type ProxyHandler = (
  request: Request,
  context: {
    requestMeta: Record<string, never>;
    waitUntil(promise: Promise<unknown>): void;
  },
) => Promise<Response>;

async function verifyProxyRuntime(): Promise<void> {
  if (!existsSync(proxyRuntimePath)) {
    throw new Error(
      'Next build did not emit .next/server/middleware.js for src/proxy.ts',
    );
  }
  const runtime = runtimeRequire(proxyRuntimePath) as {handler?: ProxyHandler};
  if (typeof runtime.handler !== 'function') {
    throw new Error('Emitted proxy runtime does not export a request handler');
  }

  const destinations = [
    '/schedule?roomId=oak&query=quiet%26sunny',
    '/my-bookings?scope=future&label=100%25',
  ];
  for (const destination of destinations) {
    const response = await runtime.handler(
      new Request(`http://localhost:3000${destination}`),
      {
        requestMeta: {},
        waitUntil: () => undefined,
      },
    );
    const forwarded = response.headers.get(
      'x-middleware-request-x-roomwork-return-to',
    );
    if (forwarded !== destination) {
      throw new Error(
        `Emitted proxy runtime did not preserve ${destination}`,
      );
    }
  }
}

async function main(): Promise<void> {
  await verifyProxyRuntime();
  if (!existsSync(source)) {
    throw new Error('Next static assets are missing; run next build first');
  }

  mkdirSync(destination, {recursive: true});
  cpSync(source, destination, {recursive: true});
}

void main();
