import {describe, expect, it} from 'vitest';
import {
  DefaultNotificationService,
  type DueNotification,
  type HandoffCandidate,
  type NotificationRepository,
  type NotificationTransaction,
} from '../../src/modules/notifications/notification.service';

type BookingFixture = {
  id: string;
  roomId: string;
  roomName: string;
  userId: string;
  authorName: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
};

type StoredNotification = {
  id: string;
  recipientId: string;
  currentBookingId: string;
  nextBookingId: string;
  deliverAt: Date;
  deliveredAt: Date | null;
};

const recipientId = 'current-user';
const now = new Date('2026-07-28T09:55:00.000Z');

function booking(
  id: string,
  overrides: Partial<BookingFixture> = {},
): BookingFixture {
  return {
    id,
    roomId: 'room-a',
    roomName: 'Oak',
    userId: id === 'current' ? recipientId : 'next-user',
    authorName: id === 'current' ? 'Current User' : 'Next User',
    title: id === 'current' ? 'Planning' : 'Review',
    startsAt: id === 'current' ?
      new Date('2026-07-28T09:00:00.000Z') :
      new Date('2026-07-28T10:00:00.000Z'),
    endsAt: id === 'current' ?
      new Date('2026-07-28T10:00:00.000Z') :
      new Date('2026-07-28T10:30:00.000Z'),
    cancelledAt: null,
    ...overrides,
  };
}

class MemoryNotificationTransaction implements NotificationTransaction {
  readonly notifications: StoredNotification[] = [];

  constructor(private readonly bookings: BookingFixture[]) {}

  async findDueHandoffs(input: {
    recipientId: string;
    now: Date;
    windowEndsAt: Date;
  }): Promise<HandoffCandidate[]> {
    return this.bookings.flatMap((current) => {
      if (
        current.userId !== input.recipientId ||
        current.cancelledAt !== null ||
        current.startsAt > input.now ||
        current.endsAt <= input.now ||
        current.endsAt > input.windowEndsAt
      ) {
        return [];
      }
      const next = this.bookings.find((candidate) =>
        candidate.roomId === current.roomId &&
        candidate.startsAt.getTime() === current.endsAt.getTime() &&
        candidate.cancelledAt === null,
      );
      return next ? [{
        currentBookingId: current.id,
        currentEndsAt: current.endsAt,
        nextBookingId: next.id,
      }] : [];
    });
  }

  async upsertHandoff(input: {
    recipientId: string;
    currentBookingId: string;
    nextBookingId: string;
    deliverAt: Date;
  }): Promise<void> {
    const exists = this.notifications.some((notification) =>
      notification.recipientId === input.recipientId &&
      notification.currentBookingId === input.currentBookingId &&
      notification.nextBookingId === input.nextBookingId,
    );
    if (!exists) {
      this.notifications.push({
        id: `notification-${this.notifications.length + 1}`,
        ...input,
        deliveredAt: null,
      });
    }
  }

  async claimActive(input: {
    recipientId: string;
    now: Date;
  }): Promise<DueNotification[]> {
    return this.notifications.flatMap((notification) => {
      const current = this.bookings.find(
        (candidate) => candidate.id === notification.currentBookingId,
      );
      const next = this.bookings.find(
        (candidate) => candidate.id === notification.nextBookingId,
      );
      if (
        notification.recipientId !== input.recipientId ||
        notification.deliveredAt !== null ||
        notification.deliverAt > input.now ||
        !current ||
        !next ||
        current.cancelledAt !== null ||
        next.cancelledAt !== null
      ) {
        return [];
      }
      notification.deliveredAt = input.now;
      return [{
        id: notification.id,
        roomName: current.roomName,
        currentTitle: current.title,
        endsAt: current.endsAt.toISOString(),
        nextAuthorName: next.authorName,
      }];
    });
  }
}

class MemoryNotificationRepository implements NotificationRepository {
  readonly transaction: MemoryNotificationTransaction;

  constructor(bookings: BookingFixture[]) {
    this.transaction = new MemoryNotificationTransaction(bookings);
  }

  async withTransaction<T>(
    operation: (transaction: NotificationTransaction) => Promise<T>,
  ): Promise<T> {
    return operation(this.transaction);
  }
}

function service(bookings: BookingFixture[]): {
  notifications: StoredNotification[];
  service: DefaultNotificationService;
} {
  const repository = new MemoryNotificationRepository(bookings);
  return {
    notifications: repository.transaction.notifications,
    service: new DefaultNotificationService(repository),
  };
}

describe('DefaultNotificationService', () => {
  it('delivers an immediately adjacent active next booking', async () => {
    const subject = service([booking('current'), booking('next')]);

    await expect(subject.service.claimDueNotifications({
      recipientId,
      now,
      leadMinutes: 10,
    })).resolves.toEqual([{
      id: 'notification-1',
      roomName: 'Oak',
      currentTitle: 'Planning',
      endsAt: '2026-07-28T10:00:00.000Z',
      nextAuthorName: 'Next User',
    }]);
  });

  it('does not create a notification when bookings have a gap', async () => {
    const subject = service([
      booking('current'),
      booking('next', {startsAt: new Date('2026-07-28T10:00:01.000Z')}),
    ]);

    await expect(subject.service.claimDueNotifications({
      recipientId,
      now,
      leadMinutes: 10,
    })).resolves.toEqual([]);
    expect(subject.notifications).toEqual([]);
  });

  it.each(['current', 'next'] as const)(
    'does not deliver when the %s booking is cancelled',
    async (cancelledBookingId) => {
      const subject = service([
        booking('current', {
          cancelledAt: cancelledBookingId === 'current' ? now : null,
        }),
        booking('next', {
          cancelledAt: cancelledBookingId === 'next' ? now : null,
        }),
      ]);

      await expect(subject.service.claimDueNotifications({
        recipientId,
        now,
        leadMinutes: 10,
      })).resolves.toEqual([]);
    },
  );

  it('does not create a notification before the lead window', async () => {
    const current = booking('current', {
      endsAt: new Date('2026-07-28T10:06:00.000Z'),
    });
    const subject = service([
      current,
      booking('next', {startsAt: current.endsAt}),
    ]);

    await expect(subject.service.claimDueNotifications({
      recipientId,
      now,
      leadMinutes: 10,
    })).resolves.toEqual([]);
    expect(subject.notifications).toEqual([]);
  });

  it('returns a handoff exactly once across repeated polls', async () => {
    const subject = service([booking('current'), booking('next')]);
    const input = {recipientId, now, leadMinutes: 10};

    const first = await subject.service.claimDueNotifications(input);
    const second = await subject.service.claimDueNotifications(input);

    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
    expect(subject.notifications).toHaveLength(1);
  });

  it('rechecks cancellation when claiming an existing notification', async () => {
    const current = booking('current');
    const next = booking('next');
    const subject = service([current, next]);
    subject.notifications.push({
      id: 'existing',
      recipientId,
      currentBookingId: current.id,
      nextBookingId: next.id,
      deliverAt: new Date('2026-07-28T09:50:00.000Z'),
      deliveredAt: null,
    });
    next.cancelledAt = now;

    await expect(subject.service.claimDueNotifications({
      recipientId,
      now,
      leadMinutes: 10,
    })).resolves.toEqual([]);
    expect(subject.notifications[0].deliveredAt).toBeNull();
  });
});
