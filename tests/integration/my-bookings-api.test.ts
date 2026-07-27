import {NextRequest} from 'next/server';
import {DateTime} from 'luxon';
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
import {createVerifiedUser} from '../helpers/factories';
import {disconnectTestDatabase, testDb} from '../helpers/database';

type GetHandler = (request: NextRequest) => Promise<Response>;

const password = 'history-api-test-password';
let getBookings: GetHandler;
let loginPost: PostHandler;
let cookie: string;
let userId: string;
let roomId: string;
let userSequence = 0;

function get(path: string, sessionCookie?: string): Promise<Response> {
  const headers = sessionCookie ? {cookie: sessionCookie} : undefined;
  return getBookings(new NextRequest(
    new URL(path, process.env.APP_URL ?? 'http://127.0.0.1:3000'),
    {headers},
  ));
}

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const [route, loginRoute] = await Promise.all([
    import('../../src/app/api/me/bookings/route'),
    import('../../src/app/api/auth/login/route'),
  ]);
  getBookings = route.GET;
  loginPost = loginRoute.POST;
});

beforeEach(async () => {
  userSequence += 1;
  userId = '';
  await seedRooms(testDb);
  const user = await createVerifiedUser({
    email:
      `my-bookings-user-${process.pid}-${userSequence}@example.test`,
    password,
  });
  const room = await testDb.room.findUniqueOrThrow({where: {name: 'Yew'}});
  const login = await postJson(loginPost, '/api/auth/login', {
    email: user.email,
    password,
  });
  cookie = readSessionCookie(login).header;
  userId = user.id;
  roomId = room.id;
});

afterEach(async () => {
  if (!userId) {
    return;
  }
  await testDb.booking.deleteMany({where: {userId}});
  await testDb.user.delete({where: {id: userId}});
});

afterAll(async () => {
  await disconnectTestDatabase();
});

describe.sequential('my bookings API', () => {
  it('requires authentication and never accepts a client owner id', async () => {
    const response = await get(
      `/api/me/bookings?scope=future&userId=${userId}`,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication is required',
      },
    });

    const authenticated = await get(
      `/api/me/bookings?scope=future&userId=${userId}`,
      cookie,
    );
    expect(authenticated.status).toBe(400);
  });

  it.each([
    ['/api/me/bookings', 'missing scope'],
    ['/api/me/bookings?scope=all', 'unknown scope'],
    ['/api/me/bookings?scope=future&limit=0', 'zero limit'],
    ['/api/me/bookings?scope=future&limit=1.5', 'fractional limit'],
    ['/api/me/bookings?scope=future&limit=abc', 'non-numeric limit'],
    ['/api/me/bookings?scope=future&cursor=not+a+cursor', 'invalid cursor'],
    ['/api/me/bookings?scope=future&extra=private', 'unknown query'],
  ])('returns one sanitized validation contract for %s (%s)', async (path) => {
    const response = await get(path, cookie);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid booking history query.',
      },
    });
  });

  it('uses only the session user and caps pages at 50', async () => {
    const other = await createVerifiedUser({
      email:
        `my-bookings-other-${process.pid}-${userSequence}@example.test`,
      password,
    });
    const now = DateTime.now().toUTC();
    await testDb.booking.createMany({
      data: [
        ...Array.from({length: 52}, (_, index) => ({
          id: `history-api-own-${index.toString().padStart(2, '0')}`,
          roomId,
          userId,
          title: `Own ${index}`,
          startsAt: now.plus({days: 2, minutes: index}).toJSDate(),
          endsAt: now.plus({days: 2, minutes: index + 30}).toJSDate(),
        })),
        {
          id: 'history-api-other',
          roomId,
          userId: other.id,
          title: 'Private other booking',
          startsAt: now.plus({days: 2}).toJSDate(),
          endsAt: now.plus({days: 2, minutes: 30}).toJSDate(),
        },
      ],
    });

    try {
      const response = await get(
        '/api/me/bookings?scope=future&limit=500',
        cookie,
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.items).toHaveLength(50);
      expect(body.data.nextCursor).toEqual(expect.any(String));
      expect(JSON.stringify(body)).not.toContain('Private other booking');
      expect(JSON.stringify(body)).not.toMatch(/userId|email|password/i);
    } finally {
      await testDb.booking.deleteMany({where: {userId: other.id}});
      await testDb.user.delete({where: {id: other.id}});
    }
  });

  it('paginates equal past starts with no duplicates or skipped records', async () => {
    const startsAt = DateTime.now().minus({days: 2}).startOf('hour');
    await testDb.booking.createMany({
      data: ['a', 'b', 'c', 'd'].map((suffix) => ({
        id: `history-api-equal-${suffix}`,
        roomId,
        userId,
        title: `Equal ${suffix}`,
        startsAt: startsAt.toJSDate(),
        endsAt: startsAt.plus({minutes: 30}).toJSDate(),
      })),
    });

    const firstResponse = await get(
      '/api/me/bookings?scope=past&limit=2',
      cookie,
    );
    expect(firstResponse.status).toBe(200);
    const first = (await firstResponse.json()).data;
    expect(first.items.map((item: {id: string}) => item.id)).toEqual([
      'history-api-equal-d',
      'history-api-equal-c',
    ]);
    expect(first.nextCursor).toEqual(expect.any(String));

    const secondResponse = await get(
      `/api/me/bookings?scope=past&limit=2&cursor=${first.nextCursor}`,
      cookie,
    );
    expect(secondResponse.status).toBe(200);
    const second = (await secondResponse.json()).data;
    expect(second.items.map((item: {id: string}) => item.id)).toEqual([
      'history-api-equal-b',
      'history-api-equal-a',
    ]);
    expect(second.nextCursor).toBeNull();
    const combinedIds = [
      ...first.items.map((item: {id: string}) => item.id),
      ...second.items.map((item: {id: string}) => item.id),
    ];
    expect(new Set(combinedIds).size).toBe(4);
  });
});
