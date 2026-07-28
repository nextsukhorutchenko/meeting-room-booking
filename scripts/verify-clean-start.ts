import 'dotenv/config';
import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {DateTime} from 'luxon';
import {readAppEnv, type AppEnv} from '../src/lib/config/env';

export type CleanStartCheck = {
  name: string;
  run(): Promise<void>;
};

export type CleanStartEnvironment = Record<string, string | undefined>;

export type CleanStartDependencies = {
  createDatabase(connectionString: string): PrismaClient;
  fetch: typeof fetch;
  runNodeScript(
    args: string[],
    environment: CleanStartEnvironment,
  ): Promise<void>;
};

export type ApprovedCleanStartTargets = {
  appEnv: AppEnv;
  appOrigin: string;
  databaseTarget: string;
};

type VerificationState = {
  appEnv: AppEnv;
  bookingId?: string;
  cookie?: string;
  database?: PrismaClient;
  email: string;
  password: string;
  userId?: string;
};

type ApiBody = {
  data?: unknown;
  error?: unknown;
};

type RunCleanStartOptions = {
  dependencies?: CleanStartDependencies;
  environment?: CleanStartEnvironment;
};

export const CLEAN_START_MUTATION_CONSENT =
  'CLEAN_START_MUTATION_CONSENT';
export const CLEAN_START_TARGET_ERROR =
  'Clean-start targets or mutation consent are not approved';

const approvedDatabaseNames = new Set([
  'meeting_room_booking',
  'meeting_room_booking_test',
]);
const execFileAsync = promisify(execFile);

function canonicalLoopbackHost(hostname: string): string {
  switch (hostname.toLowerCase()) {
    case 'localhost':
      return 'localhost';
    case '127.0.0.1':
      return '127.0.0.1';
    case '::1':
    case '[::1]':
      return '[::1]';
    default:
      throw new Error(CLEAN_START_TARGET_ERROR);
  }
}

function canonicalDatabaseTarget(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(CLEAN_START_TARGET_ERROR);
  }
  const host = canonicalLoopbackHost(parsed.hostname);
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  const query = [...parsed.searchParams.entries()];
  const approvedQuery = query.length === 0 || (
    query.length === 1 &&
    query[0][0] === 'schema' &&
    query[0][1] === 'public'
  );
  if (
    !databaseName ||
    databaseName.includes('/') ||
    !approvedDatabaseNames.has(databaseName) ||
    !approvedQuery ||
    parsed.hash
  ) {
    throw new Error(CLEAN_START_TARGET_ERROR);
  }
  return `postgresql://${host}:${parsed.port || '5432'}/${databaseName}`;
}

function canonicalAppOrigin(appUrl: string): string {
  const parsed = new URL(appUrl);
  if (
    parsed.protocol !== 'http:' ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(CLEAN_START_TARGET_ERROR);
  }
  canonicalLoopbackHost(parsed.hostname);
  return parsed.origin;
}

export function approveCleanStartTargets(
  environment: CleanStartEnvironment,
): ApprovedCleanStartTargets {
  try {
    const appEnv = readAppEnv(environment);
    const databaseTarget = canonicalDatabaseTarget(appEnv.databaseUrl);
    const appOrigin = canonicalAppOrigin(appEnv.appUrl);
    const expectedConsent =
      `database=${databaseTarget};app=${appOrigin}`;
    if (environment[CLEAN_START_MUTATION_CONSENT] !== expectedConsent) {
      throw new Error(CLEAN_START_TARGET_ERROR);
    }
    return {appEnv, appOrigin, databaseTarget};
  } catch {
    throw new Error(CLEAN_START_TARGET_ERROR);
  }
}

const defaultDependencies: CleanStartDependencies = {
  createDatabase: (connectionString) => new PrismaClient({
    adapter: new PrismaPg({connectionString}),
  }),
  fetch: (input, init) => fetch(input, init),
  runNodeScript: async (args, environment) => {
    await execFileAsync(process.execPath, args, {
      env: environment as NodeJS.ProcessEnv,
      maxBuffer: 10 * 1024 * 1024,
    });
  },
};

function childEnvironment(
  environment: CleanStartEnvironment,
  appEnv: AppEnv,
): CleanStartEnvironment {
  const child: CleanStartEnvironment = {
    ...environment,
    DATABASE_URL: appEnv.databaseUrl,
  };
  delete child[CLEAN_START_MUTATION_CONSENT];
  return child;
}

async function expectResponse(
  response: Response,
  status: number,
  operation: string,
): Promise<ApiBody> {
  const text = await response.text();
  const body = text ? JSON.parse(text) as ApiBody : {};
  if (response.status !== status) {
    throw new Error(
      `${operation} returned ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  const cookie = setCookie?.split(';', 1)[0];
  if (!cookie) {
    throw new Error('Authentication response did not set a session cookie');
  }
  return cookie;
}

function nextBookableStart(appEnv: AppEnv): DateTime {
  let candidate = DateTime.now()
    .setZone(appEnv.officeTimeZone)
    .plus({days: 1})
    .startOf('day');
  while (candidate.weekday > 5) {
    candidate = candidate.plus({days: 1});
  }
  return candidate.set({
    hour: appEnv.officeOpenHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
}

function createChecks(
  state: VerificationState,
  dependencies: CleanStartDependencies,
  environment: CleanStartEnvironment,
): CleanStartCheck[] {
  const database = (): PrismaClient => {
    if (!state.database) {
      throw new Error('Database readiness check has not completed');
    }
    return state.database;
  };
  const postJson = (path: string, body: unknown): Promise<Response> =>
    dependencies.fetch(new URL(path, state.appEnv.appUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: new URL(state.appEnv.appUrl).origin,
        ...(state.cookie ? {cookie: state.cookie} : {}),
      },
      body: JSON.stringify(body),
    });
  const cleanup = async (): Promise<void> => {
    if (!state.database) {
      return;
    }
    if (state.bookingId) {
      await state.database.notification.deleteMany({
        where: {
          OR: [
            {currentBookingId: state.bookingId},
            {nextBookingId: state.bookingId},
          ],
        },
      });
    }
    await state.database.booking.deleteMany({
      where: {user: {normalizedEmail: state.email}},
    });
    await state.database.user.deleteMany({
      where: {normalizedEmail: state.email},
    });
  };

  return [
    {
      name: 'environment and target approval',
      run: async () => {},
    },
    {
      name: 'database readiness',
      run: async () => {
        state.database = dependencies.createDatabase(state.appEnv.databaseUrl);
        await state.database.$queryRaw`SELECT 1`;
      },
    },
    {
      name: 'migrations',
      run: async () => {
        await dependencies.runNodeScript([
          resolve('node_modules/prisma/build/index.js'),
          'migrate',
          'deploy',
        ], childEnvironment(environment, state.appEnv));
      },
    },
    {
      name: 'idempotent seed',
      run: async () => {
        const seedCommand = [
          resolve('node_modules/tsx/dist/cli.mjs'),
          resolve('prisma/seed.ts'),
        ];
        const childEnv = childEnvironment(environment, state.appEnv);
        await dependencies.runNodeScript(seedCommand, childEnv);
        await dependencies.runNodeScript(seedCommand, childEnv);
        const [roomCount, demoUserCount, demoBookingCount] = await Promise.all([
          database().room.count(),
          database().user.count({
            where: {
              normalizedEmail: {
                in: ['organizer@example.test', 'guest@example.test'],
              },
            },
          }),
          database().booking.count({
            where: {id: {startsWith: 'demo-'}},
          }),
        ]);
        if (roomCount !== 6 || demoUserCount !== 2 || demoBookingCount !== 3) {
          throw new Error(
            'Seed did not produce six rooms, two demo users, and three bookings',
          );
        }
      },
    },
    {
      name: 'health endpoint',
      run: async () => {
        const response = await dependencies.fetch(
          new URL('/api/health', state.appEnv.appUrl),
        );
        const body = await expectResponse(response, 200, 'Health endpoint');
        if (JSON.stringify(body) !== JSON.stringify({data: {status: 'ok'}})) {
          throw new Error(
            `Unexpected health response: ${JSON.stringify(body)}`,
          );
        }
      },
    },
    {
      name: 'registration and login',
      run: async () => {
        const registration = await postJson('/api/auth/register', {
          name: 'Clean Start Verifier',
          email: state.email,
          password: state.password,
        });
        const registrationBody = await expectResponse(
          registration,
          201,
          'Registration',
        );
        const user = (registrationBody.data as {
          user?: {id?: unknown};
        } | undefined)?.user;
        if (typeof user?.id !== 'string') {
          throw new Error('Registration response did not include a user id');
        }
        state.userId = user.id;
        await database().user.update({
          where: {id: state.userId},
          data: {emailVerifiedAt: new Date()},
        });

        const login = await postJson('/api/auth/login', {
          email: state.email,
          password: state.password,
        });
        await expectResponse(login, 200, 'Login');
        state.cookie = cookieFrom(login);
      },
    },
    {
      name: 'booking and cancellation',
      run: async () => {
        const roomsResponse = await dependencies.fetch(
          new URL('/api/rooms', state.appEnv.appUrl),
          {headers: {cookie: state.cookie ?? ''}},
        );
        const roomsBody = await expectResponse(
          roomsResponse,
          200,
          'Room list',
        );
        const rooms = (roomsBody.data ?? []) as Array<{
          id?: unknown;
          name?: unknown;
        }>;
        const room = rooms.find(({name}) => name === 'Yew');
        if (typeof room?.id !== 'string') {
          throw new Error('Seeded room Yew was not returned by the API');
        }

        const startsAt = nextBookableStart(state.appEnv);
        const creation = await postJson('/api/bookings', {
          roomId: room.id,
          title: `Clean start ${state.email}`,
          startsAt: startsAt.toISO(),
          endsAt: startsAt.plus({minutes: 30}).toISO(),
        });
        const creationBody = await expectResponse(
          creation,
          201,
          'Booking creation',
        );
        const bookingId =
          (creationBody.data as {id?: unknown} | undefined)?.id;
        if (typeof bookingId !== 'string') {
          throw new Error('Booking response did not include an id');
        }
        state.bookingId = bookingId;

        const cancellation = await dependencies.fetch(
          new URL(`/api/bookings/${bookingId}`, state.appEnv.appUrl),
          {
            method: 'DELETE',
            headers: {
              cookie: state.cookie ?? '',
              origin: new URL(state.appEnv.appUrl).origin,
            },
          },
        );
        await expectResponse(cancellation, 204, 'Booking cancellation');
        const persisted = await database().booking.findUnique({
          where: {id: bookingId},
          select: {cancelledAt: true},
        });
        if (!persisted?.cancelledAt) {
          throw new Error('Cancelled booking was not persisted');
        }
      },
    },
    {
      name: 'teardown',
      run: cleanup,
    },
  ];
}

export async function runCleanStartVerification(
  options: RunCleanStartOptions = {},
): Promise<void> {
  const environment = options.environment ?? process.env;
  const approved = approveCleanStartTargets(environment);
  const dependencies = options.dependencies ?? defaultDependencies;
  const runId = randomUUID();
  const state: VerificationState = {
    appEnv: approved.appEnv,
    email: `clean-start-${runId}@example.test`,
    password: `clean-start-${runId}`,
  };
  const checks = createChecks(state, dependencies, environment);
  let teardownCompleted = false;
  try {
    for (const check of checks) {
      const startedAt = Date.now();
      await check.run();
      teardownCompleted ||= check.name === 'teardown';
      process.stdout.write(
        `PASS ${check.name} (${Date.now() - startedAt} ms)\n`,
      );
    }
  } finally {
    if (!teardownCompleted) {
      const teardown = checks.find(({name}) => name === 'teardown');
      await teardown?.run();
    }
    await state.database?.$disconnect();
  }
}

function main(): void {
  void runCleanStartVerification().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Clean start failed');
    process.exitCode = 1;
  });
}

const entryPoint = process.argv[1];
if (
  entryPoint &&
  import.meta.url === pathToFileURL(resolve(entryPoint)).href
) {
  main();
}
