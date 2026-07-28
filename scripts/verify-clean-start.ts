import 'dotenv/config';
import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {promisify} from 'node:util';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {DateTime} from 'luxon';
import {readAppEnv, type AppEnv} from '../src/lib/config/env';

export type CleanStartCheck = {
  name: string;
  run(): Promise<void>;
};

type VerificationState = {
  appEnv?: AppEnv;
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

const execFileAsync = promisify(execFile);
const runId = randomUUID();
const state: VerificationState = {
  email: `clean-start-${runId}@example.test`,
  password: `clean-start-${runId}`,
};

function requireAppEnv(): AppEnv {
  if (!state.appEnv) {
    throw new Error('Environment check has not completed');
  }
  return state.appEnv;
}

function requireDatabase(): PrismaClient {
  if (!state.database) {
    throw new Error('Database readiness check has not completed');
  }
  return state.database;
}

async function runNodeScript(args: string[]): Promise<void> {
  await execFileAsync(process.execPath, args, {
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
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

async function postJson(path: string, body: unknown): Promise<Response> {
  const appEnv = requireAppEnv();
  return fetch(new URL(path, appEnv.appUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: new URL(appEnv.appUrl).origin,
      ...(state.cookie ? {cookie: state.cookie} : {}),
    },
    body: JSON.stringify(body),
  });
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

async function cleanup(): Promise<void> {
  const database = state.database;
  if (!database) {
    return;
  }
  if (state.bookingId) {
    await database.notification.deleteMany({
      where: {
        OR: [
          {currentBookingId: state.bookingId},
          {nextBookingId: state.bookingId},
        ],
      },
    });
  }
  await database.booking.deleteMany({
    where: {user: {normalizedEmail: state.email}},
  });
  await database.user.deleteMany({
    where: {normalizedEmail: state.email},
  });
}

const checks: CleanStartCheck[] = [
  {
    name: 'environment shape',
    run: async () => {
      state.appEnv = readAppEnv();
    },
  },
  {
    name: 'database readiness',
    run: async () => {
      const appEnv = requireAppEnv();
      state.database = new PrismaClient({
        adapter: new PrismaPg({connectionString: appEnv.databaseUrl}),
      });
      await state.database.$queryRaw`SELECT 1`;
    },
  },
  {
    name: 'migrations',
    run: async () => {
      await runNodeScript([
        resolve('node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
      ]);
    },
  },
  {
    name: 'idempotent seed',
    run: async () => {
      const seedCommand = [
        resolve('node_modules/tsx/dist/cli.mjs'),
        resolve('prisma/seed.ts'),
      ];
      await runNodeScript(seedCommand);
      await runNodeScript(seedCommand);
      const database = requireDatabase();
      const [roomCount, demoUserCount, demoBookingCount] = await Promise.all([
        database.room.count(),
        database.user.count({
          where: {
            normalizedEmail: {
              in: ['organizer@example.test', 'guest@example.test'],
            },
          },
        }),
        database.booking.count({
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
      const response = await fetch(new URL('/api/health', requireAppEnv().appUrl));
      const body = await expectResponse(response, 200, 'Health endpoint');
      if (JSON.stringify(body) !== JSON.stringify({data: {status: 'ok'}})) {
        throw new Error(`Unexpected health response: ${JSON.stringify(body)}`);
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
      await requireDatabase().user.update({
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
      const appEnv = requireAppEnv();
      const roomsResponse = await fetch(new URL('/api/rooms', appEnv.appUrl), {
        headers: {cookie: state.cookie ?? ''},
      });
      const roomsBody = await expectResponse(roomsResponse, 200, 'Room list');
      const rooms = (roomsBody.data ?? []) as Array<{
        id?: unknown;
        name?: unknown;
      }>;
      const room = rooms.find(({name}) => name === 'Yew');
      if (typeof room?.id !== 'string') {
        throw new Error('Seeded room Yew was not returned by the API');
      }

      const startsAt = nextBookableStart(appEnv);
      const creation = await postJson('/api/bookings', {
        roomId: room.id,
        title: `Clean start ${runId}`,
        startsAt: startsAt.toISO(),
        endsAt: startsAt.plus({minutes: 30}).toISO(),
      });
      const creationBody = await expectResponse(
        creation,
        201,
        'Booking creation',
      );
      const bookingId = (creationBody.data as {id?: unknown} | undefined)?.id;
      if (typeof bookingId !== 'string') {
        throw new Error('Booking response did not include an id');
      }
      state.bookingId = bookingId;

      const cancellation = await fetch(
        new URL(`/api/bookings/${bookingId}`, appEnv.appUrl),
        {
          method: 'DELETE',
          headers: {
            cookie: state.cookie ?? '',
            origin: new URL(appEnv.appUrl).origin,
          },
        },
      );
      await expectResponse(cancellation, 204, 'Booking cancellation');
      const persisted = await requireDatabase().booking.findUnique({
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

async function main(): Promise<void> {
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
      await cleanup();
    }
    await state.database?.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Clean start failed');
  process.exitCode = 1;
});
