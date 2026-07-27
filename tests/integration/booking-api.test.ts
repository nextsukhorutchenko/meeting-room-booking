import {DateTime} from 'luxon';
import {seedRooms} from '../../prisma/room-seed';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import type {PostHandler} from '../helpers/api-client';
import {postJson, readSessionCookie} from '../helpers/api-client';
import {createBookingFixture, createVerifiedUser} from '../helpers/factories';
import {disconnectTestDatabase, testDb} from '../helpers/database';

const officeTimeZone = 'Europe/Kyiv';
const testPassword = 'booking-api-test-password';
const bookingDaysFromNow = 14;

let bookingPost: PostHandler;
let loginPost: PostHandler;
let roomId: string;
let userId: string;
let cookie: string;
let officeToday: DateTime;

function officeDate(daysFromNow: number, hour: number, minute = 0): DateTime {
  return officeToday
    .plus({days: daysFromNow})
    .set({hour, minute, second: 0, millisecond: 0});
}

function toUtcIso(value: DateTime): string {
  const iso = value.toUTC().toISO();
  if (!iso) {
    throw new Error('Expected a valid ISO date-time');
  }
  return iso;
}

function bookingBody(
  startsAt = officeDate(bookingDaysFromNow, 10),
  endsAt = officeDate(bookingDaysFromNow, 11),
): {
  roomId: string;
  title: string;
  startsAt: string;
  endsAt: string;
} {
  return {
    roomId,
    title: 'Route planning',
    startsAt: toUtcIso(startsAt),
    endsAt: toUtcIso(endsAt),
  };
}

async function loginAsTestUser(email: string): Promise<string> {
  const response = await postJson(loginPost, '/api/auth/login', {
    email,
    password: testPassword,
  });

  expect(response.status).toBe(200);
  return readSessionCookie(response).header;
}

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const [bookingsRoute, loginRoute] = await Promise.all([
    import('../../src/app/api/bookings/route'),
    import('../../src/app/api/auth/login/route'),
  ]);
  bookingPost = bookingsRoute.POST;
  loginPost = loginRoute.POST;
});

beforeEach(async () => {
  officeToday = DateTime.now().setZone(officeTimeZone).startOf('day');
  await seedRooms(testDb);
  const user = await createVerifiedUser({password: testPassword});
  const room = await testDb.room.findUniqueOrThrow({where: {name: 'Yew'}});
  userId = user.id;
  roomId = room.id;
  cookie = await loginAsTestUser(user.email);
});

afterEach(async () => {
  await testDb.booking.deleteMany({where: {userId}});
  await testDb.user.delete({where: {id: userId}});
});

afterAll(async () => {
  await disconnectTestDatabase();
});

describe.sequential('booking API', () => {
  it('requires authentication', async () => {
    const response = await postJson(
      bookingPost,
      '/api/bookings',
      bookingBody(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication is required',
      },
    });
  });

  it.each([
    ['a cross-origin request', 'https://attacker.example'],
    ['a request without an Origin header', null],
  ])('rejects %s before processing its body', async (_name, origin) => {
    const response = await postJson(
      bookingPost,
      '/api/bookings',
      {},
      {cookie, origin, rawBody: '{not-json'},
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'FORBIDDEN_ORIGIN',
        message: 'Request origin is not allowed',
      },
    });
  });

  it('returns a stable error for malformed JSON', async () => {
    const response = await postJson(
      bookingPost,
      '/api/bookings',
      {},
      {cookie, rawBody: '{not-json'},
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request body must be valid JSON',
      },
    });
  });

  it('returns stable field errors for an invalid booking payload', async () => {
    const response = await postJson(bookingPost, '/api/bookings', {
      roomId: ' ',
      title: ' ',
      startsAt: 123,
      endsAt: false,
    }, {cookie});

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Please correct the highlighted fields',
        fields: {
          roomId: 'Room is required',
          title: 'Title must contain 1 to 100 Unicode characters',
          startsAt: 'Enter an ISO date-time with an explicit offset',
          endsAt: 'Enter an ISO date-time with an explicit offset',
        },
      },
    });
  });

  it('rejects an offsetless local timestamp', async () => {
    const localTimestamp = officeDate(bookingDaysFromNow, 10).toFormat(
      "yyyy-LL-dd'T'HH:mm:ss",
    );
    const response = await postJson(
      bookingPost,
      '/api/bookings',
      {...bookingBody(), startsAt: localTimestamp},
      {cookie},
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Please correct the highlighted fields',
        fields: {
          startsAt: 'Enter an ISO date-time with an explicit offset',
        },
      },
    });
  });

  it('rejects a calendar-invalid explicit-offset timestamp', async () => {
    const response = await postJson(
      bookingPost,
      '/api/bookings',
      {...bookingBody(), startsAt: '2026-02-30T10:00:00+02:00'},
      {cookie},
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Please correct the highlighted fields',
        fields: {
          startsAt: 'Enter an ISO date-time with an explicit offset',
        },
      },
    });
  });

  it('rejects a client-supplied owner and unknown field without creating a booking', async () => {
    const attemptedOwner = await createVerifiedUser();
    const bookingsBefore = await testDb.booking.count({where: {roomId}});

    try {
      expect(attemptedOwner.id).not.toBe(userId);
      const response = await postJson(bookingPost, '/api/bookings', {
        ...bookingBody(),
        userId: attemptedOwner.id,
        unknownField: 'not allowed',
      }, {cookie});

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Please correct the highlighted fields',
          fields: {
            body: 'Request body must be an object with valid booking fields',
          },
        },
      });
      await expect(testDb.booking.count({where: {roomId}})).resolves.toBe(
        bookingsBefore,
      );
      await expect(testDb.booking.count({
        where: {userId: attemptedOwner.id},
      })).resolves.toBe(0);
    } finally {
      await testDb.user.delete({where: {id: attemptedOwner.id}});
    }
  });

  it('rejects a booking in the past', async () => {
    const response = await postJson(
      bookingPost,
      '/api/bookings',
      bookingBody(officeDate(-1, 10), officeDate(-1, 11)),
      {cookie},
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'BOOKING_IN_PAST',
        message: 'Booking start must be in the future',
        fields: {startsAt: 'Must be in the future'},
      },
    });
  });

  it('rejects a booking outside office hours', async () => {
    const response = await postJson(
      bookingPost,
      '/api/bookings',
      bookingBody(
        officeDate(bookingDaysFromNow, 8, 30),
        officeDate(bookingDaysFromNow, 9),
      ),
      {cookie},
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'BOOKING_OUTSIDE_OFFICE_HOURS',
        message: 'Booking must be within office hours',
        fields: {startsAt: 'Must be within office hours'},
      },
    });
  });

  it('rejects an invalid booking duration', async () => {
    const response = await postJson(
      bookingPost,
      '/api/bookings',
      bookingBody(
        officeDate(bookingDaysFromNow, 10),
        officeDate(bookingDaysFromNow, 10),
      ),
      {cookie},
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Booking duration must be 30 to 240 minutes',
        fields: {endsAt: 'Duration must be 30 to 240 minutes'},
      },
    });
  });

  it('rejects a booking that is not aligned to 30-minute slots', async () => {
    const response = await postJson(
      bookingPost,
      '/api/bookings',
      bookingBody(
        officeDate(bookingDaysFromNow, 10, 15),
        officeDate(bookingDaysFromNow, 10, 45),
      ),
      {cookie},
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Booking times must align to a 30-minute slot',
        fields: {startsAt: 'Must align to a 30-minute slot'},
      },
    });
  });

  it('returns a stable conflict for an active overlap', async () => {
    await createBookingFixture({
      roomId,
      userId,
      startsAt: officeDate(bookingDaysFromNow, 10).toJSDate(),
      endsAt: officeDate(bookingDaysFromNow, 11).toJSDate(),
    });
    const response = await postJson(
      bookingPost,
      '/api/bookings',
      bookingBody(
        officeDate(bookingDaysFromNow, 10, 30),
        officeDate(bookingDaysFromNow, 11, 30),
      ),
      {cookie},
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'BOOKING_CONFLICT',
        message: 'This time is already booked. Choose another slot.',
      },
    });
  });

  it('allows an adjacent active booking', async () => {
    await createBookingFixture({
      roomId,
      userId,
      startsAt: officeDate(bookingDaysFromNow, 10).toJSDate(),
      endsAt: officeDate(bookingDaysFromNow, 11).toJSDate(),
    });
    const response = await postJson(
      bookingPost,
      '/api/bookings',
      bookingBody(
        officeDate(bookingDaysFromNow, 11),
        officeDate(bookingDaysFromNow, 12),
      ),
      {cookie},
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        roomId,
        title: 'Route planning',
        startsAt: toUtcIso(officeDate(bookingDaysFromNow, 11)),
        endsAt: toUtcIso(officeDate(bookingDaysFromNow, 12)),
      },
    });
  });

  it('normalizes explicit offsets to UTC instants', async () => {
    const startsAt = officeDate(bookingDaysFromNow, 13);
    const endsAt = officeDate(bookingDaysFromNow, 14);
    const startsAtWithOffset = startsAt.toISO({includeOffset: true});
    const endsAtWithOffset = endsAt.toISO({includeOffset: true});
    if (!startsAtWithOffset || !endsAtWithOffset) {
      throw new Error('Expected valid ISO date-times with offsets');
    }

    const response = await postJson(bookingPost, '/api/bookings', {
      roomId,
      title: 'Offset normalization',
      startsAt: startsAtWithOffset,
      endsAt: endsAtWithOffset,
    }, {cookie});

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.startsAt).toBe(toUtcIso(startsAt));
    expect(body.data.endsAt).toBe(toUtcIso(endsAt));

    const persisted = await testDb.booking.findUniqueOrThrow({
      where: {id: body.data.id},
    });
    expect(persisted.startsAt.toISOString()).toBe(toUtcIso(startsAt));
    expect(persisted.endsAt.toISOString()).toBe(toUtcIso(endsAt));
  });

  it('returns only the safe booking projection for the authenticated author', async () => {
    const response = await postJson(
      bookingPost,
      '/api/bookings',
      {...bookingBody(), title: '  Safe response  '},
      {cookie},
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      data: {
        id: expect.any(String),
        roomId,
        title: 'Safe response',
        startsAt: toUtcIso(officeDate(bookingDaysFromNow, 10)),
        endsAt: toUtcIso(officeDate(bookingDaysFromNow, 11)),
        author: {
          id: userId,
          name: expect.any(String),
        },
        isOwn: true,
      },
    });
    expect(Object.keys(body.data).sort()).toEqual([
      'author',
      'endsAt',
      'id',
      'isOwn',
      'roomId',
      'startsAt',
      'title',
    ]);
    expect(JSON.stringify(body)).not.toMatch(/email|password|session|userId/i);
  });
});
