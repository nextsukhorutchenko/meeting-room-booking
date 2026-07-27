import type {PrismaClient} from '@prisma/client';
import {readAppEnv} from '../../lib/config/env';
import {DomainError} from '../../lib/http/domain-error';
import {officeWeekBounds} from '../../lib/time/office-time';

type RoomDatabase = Pick<PrismaClient, 'room'>;

export type RoomSummary = {
  id: string;
  name: string;
  floor: number;
  capacity: number;
};

export type ScheduleResponse = {
  room: RoomSummary;
  officeTimeZone: string;
  officeWeekStart: string;
  range: {startsAt: string; endsAt: string};
  bookings: Array<{
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    author: {id: string; name: string};
    isOwn: boolean;
  }>;
};

export type WeeklyScheduleInput = {
  roomId: string;
  userId: string;
  weekStart: string;
  officeTimeZone: string;
};

function invalidMinimumCapacity(): DomainError {
  return new DomainError({
    code: 'VALIDATION_FAILED',
    message: 'minCapacity must be a finite non-negative integer',
    status: 400,
    fields: {minCapacity: 'Must be a finite non-negative integer'},
  });
}

function parseMinimumCapacity(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw invalidMinimumCapacity();
  }

  const capacity = Number(value);
  if (!Number.isFinite(capacity) || !Number.isInteger(capacity) || capacity < 0) {
    throw invalidMinimumCapacity();
  }
  return capacity;
}

function roomNotFound(): DomainError {
  return new DomainError({
    code: 'ROOM_NOT_FOUND',
    message: 'Room was not found',
    status: 404,
  });
}

export class RoomService {
  constructor(private readonly database: RoomDatabase) {}

  async listRooms(input: {minCapacity?: unknown}): Promise<RoomSummary[]> {
    const minCapacity = parseMinimumCapacity(input.minCapacity);
    return this.database.room.findMany({
      where: minCapacity === undefined ? undefined : {
        capacity: {gte: minCapacity},
      },
      orderBy: {sortOrder: 'asc'},
      select: {id: true, name: true, floor: true, capacity: true},
    });
  }

  async getWeeklySchedule(input: WeeklyScheduleInput): Promise<ScheduleResponse> {
    const bounds = officeWeekBounds(input.weekStart, input.officeTimeZone);
    const room = await this.database.room.findUnique({
      where: {id: input.roomId},
      select: {
        id: true,
        name: true,
        floor: true,
        capacity: true,
        bookings: {
          where: {
            cancelledAt: null,
            startsAt: {lt: bounds.endsAt},
            endsAt: {gt: bounds.startsAt},
          },
          orderBy: [{startsAt: 'asc'}, {id: 'asc'}],
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            userId: true,
            user: {select: {id: true, name: true}},
          },
        },
      },
    });
    if (!room) {
      throw roomNotFound();
    }

    return {
      room: {
        id: room.id,
        name: room.name,
        floor: room.floor,
        capacity: room.capacity,
      },
      officeTimeZone: input.officeTimeZone,
      officeWeekStart: input.weekStart,
      range: {
        startsAt: bounds.startsAt.toISOString(),
        endsAt: bounds.endsAt.toISOString(),
      },
      bookings: room.bookings.map((booking) => ({
        id: booking.id,
        title: booking.title,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        author: {id: booking.user.id, name: booking.user.name},
        isOwn: booking.userId === input.userId,
      })),
    };
  }
}

let defaultService: Promise<RoomService> | undefined;

async function getDefaultService(): Promise<RoomService> {
  if (!defaultService) {
    defaultService = import('../../lib/db/prisma').then(
      ({prisma}) => new RoomService(prisma),
    );
  }
  return defaultService;
}

export async function listRooms(
  input: {minCapacity?: unknown},
): Promise<RoomSummary[]> {
  return (await getDefaultService()).listRooms(input);
}

export async function getWeeklySchedule(
  input: Omit<WeeklyScheduleInput, 'officeTimeZone'>,
): Promise<ScheduleResponse> {
  const {officeTimeZone} = readAppEnv();
  return (await getDefaultService()).getWeeklySchedule({
    ...input,
    officeTimeZone,
  });
}
