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
  leaseExpiresAt: Date | null;
  acknowledgedAt: Date | null;
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
        leaseExpiresAt: null,
        acknowledgedAt: null,
      });
    }
  }

  async claimActive(input: {
    recipientId: string;
    now: Date;
    leaseExpiresAt: Date;
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
        notification.acknowledgedAt !== null ||
        (
          notification.leaseExpiresAt !== null &&
          notification.leaseExpiresAt > input.now
        ) ||
        notification.deliverAt > input.now ||
        !current ||
        !next ||
        current.cancelledAt !== null ||
        next.cancelledAt !== null
      ) {
        return [];
      }
      notification.leaseExpiresAt = input.leaseExpiresAt;
      return [{
        id: notification.id,
        roomName: current.roomName,
        currentTitle: current.title,
        endsAt: current.endsAt.toISOString(),
        nextAuthorName: next.authorName,
      }];
    });
  }

  async acknowledge(input: {
    recipientId: string;
    notificationId: string;
    acknowledgedAt: Date;
  }): Promise<void> {
    const notification = this.notifications.find((candidate) =>
      candidate.id === input.notificationId &&
      candidate.recipientId === input.recipientId,
    );
    if (notification) {
      notification.acknowledgedAt ??= input.acknowledgedAt;
      notification.leaseExpiresAt = null;
    }
  }
}

class MemoryNotificationRepository implements NotificationRepository {
  readonly transaction: MemoryNotificationTransaction;
  transactionCalls = 0;

  constructor(bookings: BookingFixture[]) {
    this.transaction = new MemoryNotificationTransaction(bookings);
  }

  async withTransaction<T>(
    operation: (transaction: NotificationTransaction) => Promise<T>,
  ): Promise<T> {
    this.transactionCalls += 1;
    return operation(this.transaction);
  }
}

function service(bookings: BookingFixture[]): {
  notifications: StoredNotification[];
  repository: MemoryNotificationRepository;
  service: DefaultNotificationService;
} {
  const repository = new MemoryNotificationRepository(bookings);
  return {
    notifications: repository.transaction.notifications,
    repository,
    service: new DefaultNotificationService(repository),
  };
}

describe('DefaultNotificationService', () => {
  it('rejects a zero lead before opening a database transaction', async () => {
    const subject = service([]);

    await expect(subject.service.claimDueNotifications({
      recipientId,
      now,
      leadMinutes: 0,
      leaseSeconds: 30,
    })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Invalid notification claim input.',
      status: 400,
    });
    expect(subject.repository.transactionCalls).toBe(0);
  });

  it('delivers an immediately adjacent active next booking', async () => {
    const subject = service([booking('current'), booking('next')]);

    await expect(subject.service.claimDueNotifications({
      recipientId,
      now,
      leadMinutes: 10,
      leaseSeconds: 30,
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
      leaseSeconds: 30,
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
        leaseSeconds: 30,
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
      leaseSeconds: 30,
    })).resolves.toEqual([]);
    expect(subject.notifications).toEqual([]);
  });

  it('returns a handoff exactly once across repeated polls', async () => {
    const subject = service([booking('current'), booking('next')]);
    const input = {recipientId, now, leadMinutes: 10, leaseSeconds: 30};

    const first = await subject.service.claimDueNotifications(input);
    const second = await subject.service.claimDueNotifications(input);

    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
    expect(subject.notifications).toHaveLength(1);
  });

  it('redelivers the same ID after lease expiry until acknowledged', async () => {
    const subject = service([booking('current'), booking('next')]);
    const first = await subject.service.claimDueNotifications({
      recipientId,
      now,
      leadMinutes: 10,
      leaseSeconds: 30,
    });

    const afterExpiry = new Date(now.getTime() + 30_000);
    const redelivered = await subject.service.claimDueNotifications({
      recipientId,
      now: afterExpiry,
      leadMinutes: 10,
      leaseSeconds: 30,
    });
    await subject.service.acknowledge({
      recipientId,
      notificationId: first[0].id,
      now: afterExpiry,
    });
    await subject.service.acknowledge({
      recipientId,
      notificationId: first[0].id,
      now: afterExpiry,
    });
    const afterAck = await subject.service.claimDueNotifications({
      recipientId,
      now: new Date(afterExpiry.getTime() + 30_000),
      leadMinutes: 10,
      leaseSeconds: 30,
    });

    expect(redelivered).toEqual(first);
    expect(afterAck).toEqual([]);
    expect(subject.notifications[0]).toMatchObject({
      acknowledgedAt: afterExpiry,
      leaseExpiresAt: null,
    });
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
      leaseExpiresAt: null,
      acknowledgedAt: null,
    });
    next.cancelledAt = now;

    await expect(subject.service.claimDueNotifications({
      recipientId,
      now,
      leadMinutes: 10,
      leaseSeconds: 30,
    })).resolves.toEqual([]);
    expect(subject.notifications[0].leaseExpiresAt).toBeNull();
  });
});
