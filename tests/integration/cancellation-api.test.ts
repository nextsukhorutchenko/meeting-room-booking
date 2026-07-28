import {DateTime} from 'luxon';
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

type DeleteHandler = (
  request: NextRequest,
  context: {params: Promise<{bookingId: string}>},
) => Promise<Response>;

const taskPrefix = 'task-10-cancellation-api-';
const ownerEmail = `${taskPrefix}owner@example.test`;
const otherEmail = `${taskPrefix}other@example.test`;
const password = 'task-10-cancellation-password';

let bookingDelete: DeleteHandler;
let bookingPost: PostHandler;
let loginPost: PostHandler;
let ownerCookie: string;
let otherCookie: string;
let ownerId: string;
let otherId: string;
let roomId: string;
let officeToday: DateTime;

function bookingInstant(hour: number): DateTime {
  return officeToday.plus({days: 14}).set({
    hour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
}

function iso(value: DateTime): string {
  const result = value.toUTC().toISO();
  if (!result) {
    throw new Error('Expected a valid booking instant');
  }
  return result;
}

async function removeTaskFixtures(): Promise<void> {
  await testDb.booking.deleteMany({
    where: {
      OR: [
        {title: {startsWith: taskPrefix}},
        {user: {normalizedEmail: {in: [ownerEmail, otherEmail]}}},
      ],
    },
  });
  await testDb.user.deleteMany({
    where: {normalizedEmail: {in: [ownerEmail, otherEmail]}},
  });
}

async function login(email: string): Promise<string> {
  const response = await postJson(loginPost, '/api/auth/login', {
    email,
    password,
  });
  expect(response.status).toBe(200);
  return readSessionCookie(response).header;
}

function deleteRequest(
  bookingId: string,
  options: {cookie?: string; origin?: string | null} = {},
): Promise<Response> {
  const appUrl = new URL(process.env.APP_URL ?? 'http://127.0.0.1:3000');
  const headers = new Headers();
  if (options.origin !== null) {
    headers.set('origin', options.origin ?? appUrl.origin);
  }
  if (options.cookie) {
    headers.set('cookie', options.cookie);
  }
  return bookingDelete(
    new NextRequest(
      new URL(`/api/bookings/${encodeURIComponent(bookingId)}`, appUrl),
      {method: 'DELETE', headers},
    ),
    {params: Promise.resolve({bookingId})},
  );
}

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const [cancellationRoute, bookingsRoute, loginRoute] = await Promise.all([
    import('../../src/app/api/bookings/[bookingId]/route'),
    import('../../src/app/api/bookings/route'),
    import('../../src/app/api/auth/login/route'),
  ]);
  bookingDelete = cancellationRoute.DELETE;
  bookingPost = bookingsRoute.POST;
  loginPost = loginRoute.POST;
});

beforeEach(async () => {
  await removeTaskFixtures();
  officeToday = DateTime.now().setZone('Europe/Kyiv').startOf('day');
  const owner = await createVerifiedUser({
    email: ownerEmail,
    password,
  });
  const other = await createVerifiedUser({
    email: otherEmail,
    password,
  });
  await seedRooms(testDb);
  const room = await testDb.room.findUniqueOrThrow({where: {name: 'Yew'}});
  ownerId = owner.id;
  otherId = other.id;
  roomId = room.id;
  ownerCookie = await login(owner.email);
  otherCookie = await login(other.email);
});

afterEach(removeTaskFixtures);

afterAll(async () => {
  await removeTaskFixtures();
  await disconnectTestDatabase();
});

describe.sequential('cancellation API', () => {
  it.each([
    ['a cross-origin request', 'https://attacker.example'],
    ['a request without an Origin header', null],
  ])('rejects %s before authentication', async (_name, origin) => {
    const response = await deleteRequest(`${taskPrefix}missing`, {origin});

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'FORBIDDEN_ORIGIN',
        message: 'Request origin is not allowed',
      },
    });
  });

  it('requires authentication', async () => {
    const response = await deleteRequest(`${taskPrefix}missing`);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication is required',
      },
    });
  });

  it('returns a truly empty 204 for the owner and preserves the row', async () => {
    const booking = await createBookingFixture({
      roomId,
      userId: ownerId,
      title: `${taskPrefix}owner-success`,
      startsAt: bookingInstant(10).toUTC().toJSDate(),
      endsAt: bookingInstant(11).toUTC().toJSDate(),
    });

    const response = await deleteRequest(booking.id, {cookie: ownerCookie});

    expect(response.status).toBe(204);
    expect(response.headers.get('content-type')).toBeNull();
    await expect(response.text()).resolves.toBe('');
    await expect(testDb.booking.findUnique({where: {id: booking.id}}))
      .resolves.toMatchObject({
        id: booking.id,
        userId: ownerId,
        cancelledAt: expect.any(Date),
      });
  });

  it('returns stable forbidden details for another user', async () => {
    const booking = await createBookingFixture({
      roomId,
      userId: ownerId,
      title: `${taskPrefix}forbidden`,
    });

    const response = await deleteRequest(booking.id, {cookie: otherCookie});

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'BOOKING_FORBIDDEN',
        message: 'You can only cancel your own bookings.',
      },
    });
    await expect(testDb.booking.findUniqueOrThrow({where: {id: booking.id}}))
      .resolves.toMatchObject({cancelledAt: null});
  });

  it.each([
    `${taskPrefix}missing`,
    'not-a-cuid',
    '',
  ])('returns the same not-found contract for opaque id %j', async (bookingId) => {
    const response = await deleteRequest(bookingId, {cookie: ownerCookie});

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found.',
      },
    });
  });

  it('treats repeated owner cancellation as idempotent 204', async () => {
    const booking = await createBookingFixture({
      roomId,
      userId: ownerId,
      title: `${taskPrefix}idempotent`,
    });

    const first = await deleteRequest(booking.id, {cookie: ownerCookie});
    const firstCancellation = await testDb.booking.findUniqueOrThrow({
      where: {id: booking.id},
    });
    const second = await deleteRequest(booking.id, {cookie: ownerCookie});
    const secondCancellation = await testDb.booking.findUniqueOrThrow({
      where: {id: booking.id},
    });

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(firstCancellation.cancelledAt).toBeInstanceOf(Date);
    expect(secondCancellation.cancelledAt).toEqual(
      firstCancellation.cancelledAt,
    );
  });

  it('makes simultaneous owner cancellation requests idempotent', async () => {
    const booking = await createBookingFixture({
      roomId,
      userId: ownerId,
      title: `${taskPrefix}concurrent-owner`,
    });

    const responses = await Promise.all([
      deleteRequest(booking.id, {cookie: ownerCookie}),
      deleteRequest(booking.id, {cookie: ownerCookie}),
    ]);

    expect(responses.map(({status}) => status)).toEqual([204, 204]);
    await expect(testDb.booking.findUniqueOrThrow({where: {id: booking.id}}))
      .resolves.toMatchObject({cancelledAt: expect.any(Date)});
  });

  it('still forbids another user after the owner already cancelled', async () => {
    const booking = await createBookingFixture({
      roomId,
      userId: ownerId,
      title: `${taskPrefix}cancelled-other-owner`,
      cancelledAt: new Date(),
    });

    const response = await deleteRequest(booking.id, {cookie: otherCookie});

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'BOOKING_FORBIDDEN',
        message: 'You can only cancel your own bookings.',
      },
    });
  });

  it('makes the cancelled interval bookable through the existing API', async () => {
    const startsAt = bookingInstant(13);
    const endsAt = bookingInstant(14);
    const booking = await createBookingFixture({
      roomId,
      userId: ownerId,
      title: `${taskPrefix}release-slot`,
      startsAt: startsAt.toUTC().toJSDate(),
      endsAt: endsAt.toUTC().toJSDate(),
    });

    const cancellation = await deleteRequest(booking.id, {
      cookie: ownerCookie,
    });
    const creation = await postJson(bookingPost, '/api/bookings', {
      roomId,
      title: `${taskPrefix}replacement`,
      startsAt: iso(startsAt),
      endsAt: iso(endsAt),
    }, {cookie: otherCookie});

    expect(cancellation.status).toBe(204);
    expect(creation.status).toBe(201);
    await expect(creation.json()).resolves.toMatchObject({
      data: {
        roomId,
        title: `${taskPrefix}replacement`,
        author: {id: otherId},
      },
    });
    await expect(testDb.booking.count({
      where: {
        roomId,
        startsAt: startsAt.toUTC().toJSDate(),
        endsAt: endsAt.toUTC().toJSDate(),
      },
    })).resolves.toBe(2);
  });
});
