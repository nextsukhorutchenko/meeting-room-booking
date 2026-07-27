import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {afterAll, afterEach, beforeEach, expect, it} from 'vitest';
import {readAppEnv} from '../../src/lib/config/env';
import {DomainError} from '../../src/lib/http/domain-error';
import {
  DefaultBookingService,
  PrismaBookingRepository,
} from '../../src/modules/bookings/booking.service';
import {
  createRoomFixture,
  createVerifiedUser,
} from '../helpers/factories';
import {disconnectTestDatabase, testDb} from '../helpers/database';
import {TestClock} from '../helpers/test-clock';

const raceRoomName = 'Atomic booking race room';
const raceUserEmail = 'atomic-booking-race@example.test';
const lockWaitTimeoutMilliseconds = 5_000;
const requestCompletionTimeoutMilliseconds = 10_000;
let raceSequence = 0;

type Deferred<T> = {
  promise: Promise<T>;
  reject(reason?: unknown): void;
  resolve(value: T): void;
};

type LockActivity = {
  pid: number;
  applicationName: string;
  waitEventType: string | null;
  blockingPids: number[];
};

function createDeferred<T>(): Deferred<T> {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });
  return {promise, reject, resolve};
}

function createRaceDatabase(
  applicationName: string,
  maxConnections: number,
): PrismaClient {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL must be set for integration tests');
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      application_name: applicationName,
      connectionString,
      max: maxConnections,
    }),
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), milliseconds);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function blockingChainReaches(
  pid: number,
  targetPid: number,
  activitiesByPid: Map<number, LockActivity>,
  visited = new Set<number>(),
): boolean {
  if (pid === targetPid) {
    return true;
  }
  if (visited.has(pid)) {
    return false;
  }
  visited.add(pid);

  const activity = activitiesByPid.get(pid);
  return activity?.blockingPids.some((blockingPid) =>
    blockingChainReaches(
      blockingPid,
      targetPid,
      activitiesByPid,
      visited,
    ),
  ) ?? false;
}

async function waitForControlledLockWaiters(
  monitorDatabase: PrismaClient,
  serviceApplicationName: string,
  controlPid: number,
): Promise<number[]> {
  const deadline = Date.now() + lockWaitTimeoutMilliseconds;
  let lastActivities: LockActivity[] = [];

  while (Date.now() < deadline) {
    lastActivities = await monitorDatabase.$queryRaw<LockActivity[]>`
      SELECT
        "pid",
        "application_name" AS "applicationName",
        "wait_event_type" AS "waitEventType",
        pg_blocking_pids("pid") AS "blockingPids"
      FROM pg_stat_activity
      WHERE "datname" = current_database()
        AND (
          "application_name" = ${serviceApplicationName}
          OR "pid" = ${controlPid}
        )
    `;
    const activitiesByPid = new Map(
      lastActivities.map((activity) => [activity.pid, activity]),
    );
    const waitingPids = lastActivities
      .filter((activity) =>
        activity.applicationName === serviceApplicationName &&
        activity.waitEventType === 'Lock' &&
        blockingChainReaches(
          activity.pid,
          controlPid,
          activitiesByPid,
        ),
      )
      .map((activity) => activity.pid);

    if (new Set(waitingPids).size === 2) {
      return waitingPids;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(
    'Timed out waiting for two booking requests to block on the controlled ' +
    `room lock. Last activity: ${JSON.stringify(lastActivities)}`,
  );
}

async function removeRaceFixtures(): Promise<void> {
  await testDb.booking.deleteMany({
    where: {
      OR: [
        {room: {name: raceRoomName}},
        {user: {normalizedEmail: raceUserEmail}},
      ],
    },
  });
  await testDb.room.deleteMany({where: {name: raceRoomName}});
  await testDb.user.deleteMany({
    where: {normalizedEmail: raceUserEmail},
  });
}

beforeEach(removeRaceFixtures);
afterEach(removeRaceFixtures);

afterAll(async () => {
  await disconnectTestDatabase();
});

it('allows exactly one of two concurrent identical reservations', async () => {
  raceSequence += 1;
  const suffix = `${process.pid}-${raceSequence}`;
  const serviceApplicationName = `task7-race-service-${suffix}`;
  const controlApplicationName = `task7-race-control-${suffix}`;
  const monitorApplicationName = `task7-race-monitor-${suffix}`;
  const serviceDatabase = createRaceDatabase(serviceApplicationName, 2);
  const controlDatabase = createRaceDatabase(controlApplicationName, 1);
  const monitorDatabase = createRaceDatabase(monitorApplicationName, 1);
  const room = await createRoomFixture({name: raceRoomName});
  const user = await createVerifiedUser({email: raceUserEmail});
  const bookingService = new DefaultBookingService({
    repository: new PrismaBookingRepository(serviceDatabase),
    clock: new TestClock(new Date('2026-07-27T06:00:00.000Z')),
    env: readAppEnv(),
  });
  const input = {
    userId: user.id,
    roomId: room.id,
    title: 'Race reservation',
    startsAt: new Date('2026-07-28T10:00:00.000Z'),
    endsAt: new Date('2026-07-28T11:00:00.000Z'),
  };
  const controlLocked = createDeferred<number>();
  const releaseControl = createDeferred<void>();
  const controlTransaction = controlDatabase.$transaction(
    async (transaction) => {
      const [backend] = await transaction.$queryRaw<Array<{pid: number}>>`
        SELECT pg_backend_pid() AS "pid"
      `;
      if (!backend) {
        throw new Error('Control transaction did not return a backend PID');
      }
      await transaction.$queryRaw`
        SELECT "id"
        FROM "Room"
        WHERE "id" = ${room.id}
        FOR UPDATE
      `;
      controlLocked.resolve(backend.pid);
      await releaseControl.promise;
    },
  );
  void controlTransaction.catch((error) => controlLocked.reject(error));
  let attemptsPromise:
    Promise<PromiseSettledResult<Awaited<
      ReturnType<typeof bookingService.create>
    >>[]> | undefined;

  try {
    const controlPid = await withTimeout(
      controlLocked.promise,
      lockWaitTimeoutMilliseconds,
      'Timed out acquiring the controlled room lock',
    );
    attemptsPromise = Promise.allSettled([
      bookingService.create(input),
      bookingService.create(input),
    ]);

    const waitingPids = await waitForControlledLockWaiters(
      monitorDatabase,
      serviceApplicationName,
      controlPid,
    );
    expect(new Set(waitingPids).size).toBe(2);

    releaseControl.resolve(undefined);
    const attempts = await withTimeout(
      attemptsPromise,
      requestCompletionTimeoutMilliseconds,
      'Timed out waiting for booking requests after releasing the room lock',
    );
    await controlTransaction;

    const fulfilled = attempts.filter(
      (result) => result.status === 'fulfilled',
    );
    const rejected = attempts.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: expect.objectContaining({
        code: 'BOOKING_CONFLICT',
        status: 409,
      }),
    });
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      DomainError,
    );
    expect(
      await testDb.booking.count({
        where: {roomId: input.roomId, cancelledAt: null},
      }),
    ).toBe(1);
  } finally {
    releaseControl.resolve(undefined);
    try {
      if (attemptsPromise) {
        await withTimeout(
          attemptsPromise,
          requestCompletionTimeoutMilliseconds,
          'Timed out draining booking requests during teardown',
        );
      }
      await controlTransaction;
    } finally {
      await Promise.all([
        serviceDatabase.$disconnect(),
        controlDatabase.$disconnect(),
        monitorDatabase.$disconnect(),
      ]);
    }
    const [remainingConnections] = await testDb.$queryRaw<Array<{count: number}>>`
      SELECT COUNT(*)::integer AS "count"
      FROM pg_stat_activity
      WHERE "datname" = current_database()
        AND "application_name" IN (
          ${serviceApplicationName},
          ${controlApplicationName},
          ${monitorApplicationName}
        )
    `;
    expect(remainingConnections?.count).toBe(0);
  }
});
