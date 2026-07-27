import type {PrismaClient} from '@prisma/client';
import {DateTime} from 'luxon';
import {normalizeEmail} from '../src/modules/auth/email';
import {hashPassword} from '../src/modules/auth/password';
import {seedRooms} from './room-seed';

type DemoSeedDatabase = Pick<PrismaClient, 'booking' | 'room' | 'user'>;

type DemoSeedOptions = {
  now: Date;
  officeTimeZone: string;
  officeOpenHour: number;
};

const demoPassword = 'demo-booking-password';

const demoUsers = [
  {name: 'Demo Organizer', email: 'organizer@example.test'},
  {name: 'Demo Guest', email: 'guest@example.test'},
];

function nearestWeekday(
  now: DateTime,
  direction: -1 | 1,
): DateTime {
  let candidate = now.startOf('day').plus({days: direction});
  while (candidate.weekday > 5) {
    candidate = candidate.plus({days: direction});
  }
  return candidate;
}

function seedBookingDates(options: DemoSeedOptions): {
  past: {startsAt: Date; endsAt: Date};
  firstFuture: {startsAt: Date; endsAt: Date};
  secondFuture: {startsAt: Date; endsAt: Date};
} {
  const officeNow = DateTime.fromJSDate(options.now, {
    zone: options.officeTimeZone,
  });
  const past = nearestWeekday(officeNow, -1).set({
    hour: options.officeOpenHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const firstFuture = nearestWeekday(officeNow, 1).set({
    hour: options.officeOpenHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const secondFuture = nearestWeekday(firstFuture, 1).set({
    hour: options.officeOpenHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  return {
    past: {
      startsAt: past.toUTC().toJSDate(),
      endsAt: past.plus({hours: 1}).toUTC().toJSDate(),
    },
    firstFuture: {
      startsAt: firstFuture.toUTC().toJSDate(),
      endsAt: firstFuture.plus({hours: 1}).toUTC().toJSDate(),
    },
    secondFuture: {
      startsAt: secondFuture.toUTC().toJSDate(),
      endsAt: secondFuture.plus({hours: 1}).toUTC().toJSDate(),
    },
  };
}

export async function seedDemoData(
  database: DemoSeedDatabase,
  options: DemoSeedOptions,
): Promise<void> {
  await seedRooms(database);
  const passwordHash = await hashPassword(demoPassword);
  const verifiedAt = new Date(options.now);

  const users = await Promise.all(
    demoUsers.map((user) =>
      database.user.upsert({
        where: {normalizedEmail: normalizeEmail(user.email)},
        update: {
          name: user.name,
          email: user.email,
          passwordHash,
          emailVerifiedAt: verifiedAt,
        },
        create: {
          name: user.name,
          email: user.email,
          normalizedEmail: normalizeEmail(user.email),
          passwordHash,
          emailVerifiedAt: verifiedAt,
        },
      }),
    ),
  );
  const userIdsByEmail = new Map(
    users.map((user) => [user.normalizedEmail, user.id]),
  );

  const dates = seedBookingDates(options);
  const bookings = [
    {
      id: 'demo-past-retrospective',
      roomName: 'Maple',
      userEmail: 'organizer@example.test',
      title: 'Demo retrospective',
      ...dates.past,
    },
    {
      id: 'demo-future-planning',
      roomName: 'Oak',
      userEmail: 'organizer@example.test',
      title: 'Demo planning',
      ...dates.firstFuture,
    },
    {
      id: 'demo-future-review',
      roomName: 'Pine',
      userEmail: 'guest@example.test',
      title: 'Demo review',
      ...dates.secondFuture,
    },
  ];

  await Promise.all(
    bookings.map(async ({roomName, userEmail, ...booking}) => {
      const room = await database.room.findUniqueOrThrow({
        where: {name: roomName},
      });
      const userId = userIdsByEmail.get(normalizeEmail(userEmail));
      if (!userId) {
        throw new Error(`Missing demo user for ${userEmail}`);
      }
      const bookingData = {...booking, roomId: room.id, userId};
      await database.booking.upsert({
        where: {id: booking.id},
        update: bookingData,
        create: bookingData,
      });
    }),
  );
}
