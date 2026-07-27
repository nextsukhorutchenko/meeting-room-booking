import {NextRequest} from 'next/server';
import {seedRooms} from '../../prisma/room-seed';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import type {PostHandler} from '../helpers/api-client';
import {postJson, readSessionCookie} from '../helpers/api-client';
import {
  createBookingFixture,
  createVerifiedUser,
} from '../helpers/factories';
import {disconnectTestDatabase, testDb} from '../helpers/database';

type PollHandler = (request: NextRequest) => Promise<Response>;

const taskPrefix = 'task-14-notification-api-';
const password = 'task-14-notification-password';
let pollNotifications: PollHandler;
let loginPost: PostHandler;
let cookie: string;
let currentUserId: string;
let nextUserId: string;
let roomId: string;
let sequence = 0;

function poll(
  sessionCookie?: string,
  query = '',
  origin: string | null = process.env.APP_URL ??
    'http://127.0.0.1:3000',
): Promise<Response> {
  const headers = new Headers();
  if (sessionCookie) {
    headers.set('cookie', sessionCookie);
  }
  if (origin) {
    headers.set('origin', origin);
  }
  return pollNotifications(new NextRequest(new URL(
    `/api/notifications${query}`,
    process.env.APP_URL ?? 'http://127.0.0.1:3000',
  ), {
    method: 'POST',
    headers,
  }));
}

async function removeTaskFixtures(): Promise<void> {
  await testDb.notification.deleteMany({
    where: {recipient: {normalizedEmail: {startsWith: taskPrefix}}},
  });
  await testDb.booking.deleteMany({
    where: {
      OR: [
        {title: {startsWith: taskPrefix}},
        {user: {normalizedEmail: {startsWith: taskPrefix}}},
      ],
    },
  });
  await testDb.user.deleteMany({
    where: {normalizedEmail: {startsWith: taskPrefix}},
  });
}

async function createHandoff(options: {
  gapMilliseconds?: number;
  currentCancelled?: boolean;
  nextCancelled?: boolean;
  minutesUntilEnd?: number;
} = {}): Promise<{currentId: string; nextId: string}> {
  const requestTime = new Date();
  requestTime.setMilliseconds(0);
  const currentEndsAt = new Date(
    requestTime.getTime() +
    (options.minutesUntilEnd ?? 5) * 60_000,
  );
  const current = await createBookingFixture({
    roomId,
    userId: currentUserId,
    title: `${taskPrefix}current-${sequence}`,
    startsAt: new Date(requestTime.getTime() - 30 * 60_000),
    endsAt: currentEndsAt,
    cancelledAt: options.currentCancelled ? requestTime : null,
  });
  const next = await createBookingFixture({
    roomId,
    userId: nextUserId,
    title: `${taskPrefix}next-${sequence}`,
    startsAt: new Date(
      currentEndsAt.getTime() + (options.gapMilliseconds ?? 0),
    ),
    endsAt: new Date(currentEndsAt.getTime() + 30 * 60_000),
    cancelledAt: options.nextCancelled ? requestTime : null,
  });
  return {currentId: current.id, nextId: next.id};
}

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.NOTIFY_BEFORE_MINUTES = '10';
  const [notificationRoute, loginRoute] = await Promise.all([
    import('../../src/app/api/notifications/route'),
    import('../../src/app/api/auth/login/route'),
  ]);
  pollNotifications = notificationRoute.POST;
  loginPost = loginRoute.POST;
});

beforeEach(async () => {
  await removeTaskFixtures();
  sequence += 1;
  const current = await createVerifiedUser({
    name: 'Current User',
    email: `${taskPrefix}current-${process.pid}-${sequence}@example.test`,
    password,
  });
  const next = await createVerifiedUser({
    name: 'Next User',
    email: `${taskPrefix}next-${process.pid}-${sequence}@example.test`,
    password,
  });
  await seedRooms(testDb);
  const room = await testDb.room.findUniqueOrThrow({where: {name: 'Yew'}});
  currentUserId = current.id;
  nextUserId = next.id;
  roomId = room.id;
  const login = await postJson(loginPost, '/api/auth/login', {
    email: current.email,
    password,
  });
  cookie = readSessionCookie(login).header;
});

afterEach(removeTaskFixtures);

afterAll(async () => {
  await removeTaskFixtures();
  await disconnectTestDatabase();
});

describe.sequential('notification API', () => {
  it('requires authentication and ignores client-selected recipients', async () => {
    const unauthorized = await poll(undefined, `?recipientId=${nextUserId}`);
    expect(unauthorized.status).toBe(401);

    await createHandoff();
    const authenticated = await poll(cookie, `?recipientId=${nextUserId}`);
    expect(authenticated.status).toBe(200);
    const body = await authenticated.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      roomName: 'Yew',
      currentTitle: `${taskPrefix}current-${sequence}`,
      nextAuthorName: 'Next User',
    });
    expect(JSON.stringify(body)).not.toMatch(/recipientId|userId|email/i);
  });

  it.each([
    ['a cross-origin request', 'https://attacker.example'],
    ['a request without an Origin header', null],
  ])('rejects %s before authentication', async (_name, origin) => {
    const response = await poll(undefined, '', origin);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'FORBIDDEN_ORIGIN',
        message: 'Request origin is not allowed',
      },
    });
  });

  it('returns no notification when adjacent bookings have a gap', async () => {
    await createHandoff({gapMilliseconds: 1});

    const response = await poll(cookie);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({data: []});
    await expect(testDb.notification.count()).resolves.toBe(0);
  });

  it.each([
    ['current', {currentCancelled: true}],
    ['next', {nextCancelled: true}],
  ] as const)('returns none when the %s booking is cancelled', async (
    _name,
    options,
  ) => {
    await createHandoff(options);

    const response = await poll(cookie);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({data: []});
    await expect(testDb.notification.count()).resolves.toBe(0);
  });

  it('does not create the handoff before the notification window', async () => {
    await createHandoff({minutesUntilEnd: 11});

    const response = await poll(cookie);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({data: []});
    await expect(testDb.notification.count()).resolves.toBe(0);
  });

  it('delivers an adjacent handoff exactly once across repeated polls', async () => {
    await createHandoff();

    const first = await poll(cookie);
    const second = await poll(cookie);

    expect(first.status).toBe(200);
    expect((await first.json()).data).toHaveLength(1);
    await expect(second.json()).resolves.toEqual({data: []});
    await expect(testDb.notification.count({
      where: {
        recipientId: currentUserId,
        deliveredAt: {not: null},
      },
    })).resolves.toBe(1);
  });

  it('rechecks cancellation before claiming an existing row', async () => {
    const ids = await createHandoff();
    await testDb.notification.create({
      data: {
        type: 'BOOKING_END_HANDOFF',
        recipientId: currentUserId,
        currentBookingId: ids.currentId,
        nextBookingId: ids.nextId,
        deliverAt: new Date(Date.now() - 60_000),
      },
    });
    await testDb.booking.update({
      where: {id: ids.nextId},
      data: {cancelledAt: new Date()},
    });

    const response = await poll(cookie);

    await expect(response.json()).resolves.toEqual({data: []});
    await expect(testDb.notification.findFirstOrThrow({
      where: {recipientId: currentUserId},
      select: {deliveredAt: true},
    })).resolves.toEqual({deliveredAt: null});
  });

  it('delivers once across two simultaneous real PostgreSQL polls', async () => {
    await createHandoff();

    const [first, second] = await Promise.all([
      poll(cookie),
      poll(cookie),
    ]);
    const payloads = await Promise.all([first.json(), second.json()]);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(
      payloads.reduce(
        (count, payload) => count + payload.data.length,
        0,
      ),
    ).toBe(1);
    await expect(testDb.notification.count({
      where: {
        recipientId: currentUserId,
        deliveredAt: {not: null},
      },
    })).resolves.toBe(1);
  });
});
