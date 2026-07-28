import {expect} from '@playwright/test';
import {
  DEMO_USER,
  loginAsDemoUser,
  officeMonday,
  officeSlot,
  roomByName,
} from '../fixtures';
import {test} from './fixture';

const bookingPrefix = 'task-16-exploratory-';

test.use({timezoneId: 'America/New_York'});

test.afterEach(async ({database}) => {
  await database.booking.deleteMany({
    where: {
      OR: [
        {id: {startsWith: bookingPrefix}},
        {title: {startsWith: bookingPrefix}},
      ],
    },
  });
});

test('weekly schedule remains visually legible', async ({
  agentForPage,
  database,
  page,
}) => {
  const room = await roomByName(database, 'Oak');
  const organizer = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: DEMO_USER.email},
  });
  const guest = await database.user.findUniqueOrThrow({
    where: {normalizedEmail: 'guest@example.test'},
  });
  const weekStart = officeMonday(1);
  const ownStart = officeSlot(weekStart, 1, 10);
  const guestStart = officeSlot(weekStart, 2, 11);
  await database.booking.deleteMany({
    where: {
      OR: [
        {id: {startsWith: bookingPrefix}},
        {title: {startsWith: bookingPrefix}},
      ],
    },
  });
  await database.booking.createMany({
    data: [
      {
        id: `${bookingPrefix}own`,
        endsAt: ownStart.plus({minutes: 30}).toUTC().toJSDate(),
        roomId: room.id,
        startsAt: ownStart.toUTC().toJSDate(),
        title: `${bookingPrefix}planning`,
        userId: organizer.id,
      },
      {
        id: `${bookingPrefix}guest`,
        endsAt: guestStart.plus({minutes: 30}).toUTC().toJSDate(),
        roomId: room.id,
        startsAt: guestStart.toUTC().toJSDate(),
        title: `${bookingPrefix}review`,
        userId: guest.id,
      },
    ],
  });

  await loginAsDemoUser(page);
  await page.goto(`/schedule?roomId=${room.id}&weekStart=${weekStart}`);
  await expect(page.getByRole('grid', {name: 'Weekly room schedule'}))
    .toBeVisible();
  const agent = await agentForPage(page);

  await agent.aiAssert(
    'The weekly calendar is easy to scan. Booking titles and author names ' +
    'do not overlap. The organizer\'s own booking is clearly distinguishable ' +
    'from the guest booking. The user timezone information is visible and ' +
    'legible.',
  );
});
