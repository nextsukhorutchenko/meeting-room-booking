import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {NextRequest} from 'next/server';
import {seedDemoData} from '../../prisma/demo-seed';
import {assertTestDatabaseUrl} from '../../scripts/reset-test-db';
import {readAppEnv} from '../../src/lib/config/env';
import {postJson, readSessionCookie} from '../helpers/api-client';
import {disconnectTestDatabase, testDb} from '../helpers/database';

type GetHandler = (request: NextRequest) => Promise<Response>;
type ScheduleGetHandler = (
  request: NextRequest,
  context: {params: Promise<{roomId: string}>},
) => Promise<Response>;
type PostHandler = (request: NextRequest) => Promise<Response>;
type HealthResponse = (database: {queryRaw(): Promise<unknown>}) => Promise<Response>;

let getRooms: GetHandler;
let getSchedule: ScheduleGetHandler;
let loginPost: PostHandler;
let getHealthResponse: HealthResponse;

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(new URL(path, process.env.APP_URL), {
    headers: cookie ? {cookie} : undefined,
  });
}

async function loginAsDemoOrganizer(): Promise<string> {
  const response = await postJson(loginPost, '/api/auth/login', {
    email: 'organizer@example.test',
    password: 'demo-booking-password',
  });

  expect(response.status).toBe(200);
  return readSessionCookie(response).header;
}

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const [roomsRoute, scheduleRoute, loginRoute, healthRoute] =
    await Promise.all([
      import('../../src/app/api/rooms/route'),
      import('../../src/app/api/rooms/[roomId]/schedule/route'),
      import('../../src/app/api/auth/login/route'),
      import('../../src/app/api/health/route'),
    ]);
  getRooms = roomsRoute.GET;
  getSchedule = scheduleRoute.GET;
  loginPost = loginRoute.POST;
  getHealthResponse = healthRoute.getHealthResponse;
});

beforeEach(async () => {
  await testDb.booking.deleteMany({
    where: {id: 'cancelled-weekly-booking'},
  });

  const appEnv = readAppEnv();
  await seedDemoData(testDb, {
    now: new Date('2026-07-27T06:00:00.000Z'),
    officeTimeZone: appEnv.officeTimeZone,
    officeOpenHour: appEnv.officeOpenHour,
  });
});

afterAll(async () => {
  await disconnectTestDatabase();
});

describe('test database guard', () => {
  it('rejects a database that is not suffixed with _test', () => {
    expect(() =>
      assertTestDatabaseUrl('postgresql://localhost/meeting_room_booking'),
    ).toThrow('Refusing to reset non-test database: meeting_room_booking');
  });
});

describe('room seed', () => {
  it('creates six usable rooms in display order', async () => {
    const rooms = await testDb.room.findMany({
      orderBy: {sortOrder: 'asc'},
    });

    expect(rooms).toHaveLength(6);
    expect(rooms.map((room) => room.capacity)).toEqual([4, 6, 8, 10, 12, 16]);
    expect(new Set(rooms.map((room) => room.name)).size).toBe(6);
  });

  it('creates idempotent verified users and useful demo bookings', async () => {
    const now = new Date('2026-07-27T06:00:00.000Z');
    const appEnv = readAppEnv();

    await seedDemoData(testDb, {
      now,
      officeTimeZone: appEnv.officeTimeZone,
      officeOpenHour: appEnv.officeOpenHour,
    });
    await seedDemoData(testDb, {
      now,
      officeTimeZone: appEnv.officeTimeZone,
      officeOpenHour: appEnv.officeOpenHour,
    });

    const users = await testDb.user.findMany({
      where: {
        normalizedEmail: {
          in: ['guest@example.test', 'organizer@example.test'],
        },
      },
      orderBy: {normalizedEmail: 'asc'},
    });
    const bookings = await testDb.booking.findMany({
      where: {
        id: {
          in: [
            'demo-past-retrospective',
            'demo-future-planning',
            'demo-future-review',
          ],
        },
      },
      orderBy: {startsAt: 'asc'},
    });

    expect(users).toHaveLength(2);
    expect(users.every((user) => user.emailVerifiedAt)).toBe(true);
    expect(bookings).toHaveLength(3);
    expect(bookings.some((booking) => booking.endsAt < now)).toBe(true);
    expect(bookings.some((booking) => booking.startsAt > now)).toBe(true);
  });
});

describe.sequential('room API', () => {
  it('requires authentication and returns rooms in display order', async () => {
    const unauthenticated = await getRooms(request('/api/rooms'));
    expect(unauthenticated.status).toBe(401);
    await expect(unauthenticated.json()).resolves.toEqual({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication is required',
      },
    });

    const response = await getRooms(
      request('/api/rooms', await loginAsDemoOrganizer()),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      data: [
        {id: expect.any(String), name: 'Maple', floor: 1, capacity: 4},
        {id: expect.any(String), name: 'Oak', floor: 1, capacity: 6},
        {id: expect.any(String), name: 'Pine', floor: 2, capacity: 8},
        {id: expect.any(String), name: 'Spruce', floor: 2, capacity: 10},
        {id: expect.any(String), name: 'Willow', floor: 3, capacity: 12},
        {id: expect.any(String), name: 'Yew', floor: 3, capacity: 16},
      ],
    });
    expect(JSON.stringify(body)).not.toContain('sortOrder');
  });

  it('filters rooms by a valid minimum capacity', async () => {
    const response = await getRooms(
      request('/api/rooms?minCapacity=8', await loginAsDemoOrganizer()),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        {id: expect.any(String), name: 'Pine', floor: 2, capacity: 8},
        {id: expect.any(String), name: 'Spruce', floor: 2, capacity: 10},
        {id: expect.any(String), name: 'Willow', floor: 3, capacity: 12},
        {id: expect.any(String), name: 'Yew', floor: 3, capacity: 16},
      ],
    });
  });

  it.each(['-1', '2.5', 'Infinity', ''])(
    'rejects an invalid minimum capacity: %s',
    async (minCapacity) => {
      const response = await getRooms(request(
        `/api/rooms?minCapacity=${encodeURIComponent(minCapacity)}`,
        await loginAsDemoOrganizer(),
      ));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'minCapacity must be a finite non-negative integer',
          fields: {minCapacity: 'Must be a finite non-negative integer'},
        },
      });
    },
  );

  it('requires authentication before returning schedule data', async () => {
    const room = await testDb.room.findUniqueOrThrow({where: {name: 'Oak'}});
    const response = await getSchedule(
      request(`/api/rooms/${room.id}/schedule?weekStart=2026-07-27`),
      {params: Promise.resolve({roomId: room.id})},
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication is required',
      },
    });
  });

  it('returns active weekly bookings with ownership and office UTC bounds', async () => {
    const organizer = await testDb.user.findUniqueOrThrow({
      where: {normalizedEmail: 'organizer@example.test'},
    });
    const oak = await testDb.room.findUniqueOrThrow({where: {name: 'Oak'}});
    const pine = await testDb.room.findUniqueOrThrow({where: {name: 'Pine'}});
    await testDb.booking.create({
      data: {
        id: 'cancelled-weekly-booking',
        roomId: oak.id,
        userId: organizer.id,
        title: 'Cancelled booking',
        startsAt: new Date('2026-07-28T08:00:00.000Z'),
        endsAt: new Date('2026-07-28T09:00:00.000Z'),
        cancelledAt: new Date('2026-07-27T06:00:00.000Z'),
      },
    });
    const cookie = await loginAsDemoOrganizer();

    const ownResponse = await getSchedule(
      request(`/api/rooms/${oak.id}/schedule?weekStart=2026-07-27`, cookie),
      {params: Promise.resolve({roomId: oak.id})},
    );
    const otherResponse = await getSchedule(
      request(`/api/rooms/${pine.id}/schedule?weekStart=2026-07-27`, cookie),
      {params: Promise.resolve({roomId: pine.id})},
    );

    expect(ownResponse.status).toBe(200);
    expect(ownResponse.headers.get('cache-control')).toBe('private, no-store');
    await expect(ownResponse.json()).resolves.toEqual({
      data: {
        room: {id: oak.id, name: 'Oak', floor: 1, capacity: 6},
        officeTimeZone: 'Europe/Kyiv',
        officeWeekStart: '2026-07-27',
        range: {
          startsAt: '2026-07-26T21:00:00.000Z',
          endsAt: '2026-08-02T21:00:00.000Z',
        },
        bookings: [
          {
            id: 'demo-future-planning',
            title: 'Demo planning',
            startsAt: '2026-07-28T06:00:00.000Z',
            endsAt: '2026-07-28T07:00:00.000Z',
            author: {id: organizer.id, name: 'Demo Organizer'},
            isOwn: true,
          },
        ],
      },
    });

    expect(otherResponse.status).toBe(200);
    const otherBody = await otherResponse.json();
    expect(otherBody.data.bookings).toEqual([
      {
        id: 'demo-future-review',
        title: 'Demo review',
        startsAt: '2026-07-29T06:00:00.000Z',
        endsAt: '2026-07-29T07:00:00.000Z',
        author: {id: expect.any(String), name: 'Demo Guest'},
        isOwn: false,
      },
    ]);
    expect(JSON.stringify(otherBody)).not.toMatch(/email|password|session/i);
  });

  it('returns a stable error for an unknown room', async () => {
    const response = await getSchedule(
      request(
        '/api/rooms/missing-room/schedule?weekStart=2026-07-27',
        await loginAsDemoOrganizer(),
      ),
      {params: Promise.resolve({roomId: 'missing-room'})},
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'ROOM_NOT_FOUND',
        message: 'Room was not found',
      },
    });
  });

  it('rejects a week start that is not an office-local Monday', async () => {
    const room = await testDb.room.findUniqueOrThrow({where: {name: 'Oak'}});
    const response = await getSchedule(
      request(
        `/api/rooms/${room.id}/schedule?weekStart=2026-07-28`,
        await loginAsDemoOrganizer(),
      ),
      {params: Promise.resolve({roomId: room.id})},
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'weekStart must be an ISO Monday date',
        fields: {weekStart: 'Must be an ISO Monday date'},
      },
    });
  });
});

describe('health API', () => {
  it('returns a sanitized 503 when the database readiness query fails', async () => {
    const response = await getHealthResponse({
      queryRaw: async () => {
        throw new Error('connection refused: postgres.internal');
      },
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service unavailable',
      },
    });
  });
});
