import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const runtimeRequire = createRequire(resolve('package.json'));

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

// This URL is only passed to the Prisma generate child process when needed.
export const PRISMA_GENERATE_DATABASE_URL =
  'postgresql://prisma-generate-only:prisma-generate-only@127.0.0.1:1/' +
  'prisma_generate_only';

export function createPrismaGenerateEnvironment(
  environment: EnvironmentSource,
): EnvironmentSource {
  if (environment.DATABASE_URL !== undefined) {
    return {...environment};
  }
  return {
    ...environment,
    DATABASE_URL: PRISMA_GENERATE_DATABASE_URL,
  };
}

function resolvePrismaCli(): string {
  return runtimeRequire.resolve('prisma/build/index.js');
}

function runPrismaGenerate(): Promise<number> {
  return new Promise((resolveExitCode, reject) => {
    const child = spawn(
      process.execPath,
      [resolvePrismaCli(), 'generate', ...process.argv.slice(2)],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...createPrismaGenerateEnvironment(process.env),
        },
        stdio: 'inherit',
      },
    );

    child.once('error', reject);
    child.once('exit', (exitCode, signal) => {
      if (exitCode !== null) {
        resolveExitCode(exitCode);
        return;
      }
      reject(new Error(`Prisma generate stopped by signal ${signal}`));
    });
  });
}

async function main(): Promise<void> {
  try {
    process.exitCode = await runPrismaGenerate();
  } catch (error: unknown) {
    console.error(
      error instanceof Error ? error.message : 'Prisma generate failed',
    );
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (
  entryPoint &&
  import.meta.url === pathToFileURL(resolve(entryPoint)).href
) {
  void main();
}
