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

function encodeOpaqueCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function encodeOversizedValidCursor(): string {
  return Buffer.from(`${' '.repeat(400)}${JSON.stringify({
    startsAt: '2026-07-28T06:00:00.000Z',
    id: 'booking-a',
  })}`, 'utf8').toString('base64url');
}

function task11BookingId(suffix: string): string {
  return `task-11-history-${process.pid}-${userSequence}-${suffix}`;
}

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
    [
      '/api/me/bookings?scope=future&scope=past',
      'duplicate scope',
    ],
    ['/api/me/bookings?scope=future&limit=0', 'zero limit'],
    ['/api/me/bookings?scope=future&limit=1.5', 'fractional limit'],
    ['/api/me/bookings?scope=future&limit=abc', 'non-numeric limit'],
    [
      '/api/me/bookings?scope=future&limit=2&limit=3',
      'duplicate limit',
    ],
    ['/api/me/bookings?scope=future&cursor=not+a+cursor', 'invalid cursor'],
    [
      `/api/me/bookings?scope=future&cursor=${encodeOpaqueCursor({
        startsAt: '2026-07-28T06:00:00.000Z',
        id: 'booking-a',
      })}=`,
      'otherwise valid cursor with invalid alphabet padding',
    ],
    [
      `/api/me/bookings?scope=future&cursor=${
        encodeOpaqueCursor({
          startsAt: '2026-07-28T06:00:00.000Z',
          id: 'booking-a',
        })
      }&cursor=${
        encodeOpaqueCursor({
          startsAt: '2026-07-28T06:00:00.000Z',
          id: 'booking-b',
        })
      }`,
      'duplicate cursor',
    ],
    [
      `/api/me/bookings?scope=future&cursor=${encodeOpaqueCursor({
        startsAt: '2026-07-28T06:00:00.000Z',
        id: 'booking-a',
        private: 'value',
      })}`,
      'cursor with an extra key',
    ],
    [
      `/api/me/bookings?scope=future&cursor=${encodeOpaqueCursor({
        startsAt: 'not-a-timestamp',
        id: 'booking-a',
      })}`,
      'cursor with an invalid timestamp',
    ],
    [
      `/api/me/bookings?scope=future&cursor=${encodeOpaqueCursor({
        startsAt: '2026-07-28T06:00:00.000Z',
        id: '',
      })}`,
      'cursor with an empty id',
    ],
    [
      `/api/me/bookings?scope=future&cursor=${encodeOpaqueCursor({
        startsAt: '2026-07-28T06:00:00.000Z',
        id: 'x'.repeat(256),
      })}`,
      'cursor with an oversized id',
    ],
    [
      `/api/me/bookings?scope=future&cursor=${encodeOversizedValidCursor()}`,
      'oversized otherwise valid cursor text',
    ],
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

  it('paginates equal future starts and applies cancellation by scope', async () => {
    const now = DateTime.now().toUTC();
    const futureStartsAt = now.plus({days: 3}).startOf('hour');
    const pastStartsAt = now.minus({days: 3}).startOf('hour');
    const activeFutureIds = ['10-a', '20-b', '30-c', '40-d'].map(
      task11BookingId,
    );
    const cancelledFutureId = task11BookingId('05-cancelled-future');
    const cancelledPastId = task11BookingId('cancelled-past');
    await testDb.booking.createMany({
      data: [
        ...activeFutureIds.map((id) => ({
          id,
          roomId,
          userId,
          title: id,
          startsAt: futureStartsAt.toJSDate(),
          endsAt: futureStartsAt.plus({minutes: 30}).toJSDate(),
        })),
        {
          id: cancelledFutureId,
          roomId,
          userId,
          title: cancelledFutureId,
          startsAt: futureStartsAt.toJSDate(),
          endsAt: futureStartsAt.plus({minutes: 30}).toJSDate(),
          cancelledAt: now.toJSDate(),
        },
        {
          id: cancelledPastId,
          roomId,
          userId,
          title: cancelledPastId,
          startsAt: pastStartsAt.toJSDate(),
          endsAt: pastStartsAt.plus({minutes: 30}).toJSDate(),
          cancelledAt: pastStartsAt.plus({hours: 1}).toJSDate(),
        },
      ],
    });

    const firstResponse = await get(
      '/api/me/bookings?scope=future&limit=2',
      cookie,
    );
    expect(firstResponse.status).toBe(200);
    const first = (await firstResponse.json()).data;
    expect(first.items.map((item: {id: string}) => item.id)).toEqual(
      activeFutureIds.slice(0, 2),
    );
    expect(first.nextCursor).toEqual(expect.any(String));

    const secondResponse = await get(
      `/api/me/bookings?scope=future&limit=2&cursor=${
        encodeURIComponent(first.nextCursor)
      }`,
      cookie,
    );
    expect(secondResponse.status).toBe(200);
    const second = (await secondResponse.json()).data;
    expect(second.items.map((item: {id: string}) => item.id)).toEqual(
      activeFutureIds.slice(2),
    );
    expect(second.nextCursor).toBeNull();

    const combinedIds = [
      ...first.items.map((item: {id: string}) => item.id),
      ...second.items.map((item: {id: string}) => item.id),
    ];
    expect(combinedIds).toEqual(activeFutureIds);
    expect(new Set(combinedIds).size).toBe(activeFutureIds.length);
    expect(combinedIds).not.toContain(cancelledFutureId);

    const pastResponse = await get(
      '/api/me/bookings?scope=past&limit=20',
      cookie,
    );
    expect(pastResponse.status).toBe(200);
    const past = (await pastResponse.json()).data;
    expect(past.items).toEqual([
      expect.objectContaining({
        id: cancelledPastId,
        status: 'cancelled',
      }),
    ]);
  });
});
