import type {NextRequest} from 'next/server';
import {readAppEnv} from '../../../lib/config/env';
import {
  apiError,
  apiSuccess,
  readJsonBody,
} from '../../../lib/http/api-response';
import {assertSameOrigin} from '../../../lib/http/same-origin';
import type {Clock} from '../../../lib/time/office-time';
import {requireUser} from '../../../modules/auth/auth.service';
import {
  acknowledgeNotification,
  claimDueNotifications,
  type DueNotification,
} from '../../../modules/notifications/notification.service';

type NotificationRouteDependencies = {
  authenticate(request: Request): Promise<{id: string}>;
  claim(input: {
    recipientId: string;
    now: Date;
    leadMinutes: number;
    leaseSeconds: number;
  }): Promise<DueNotification[]>;
  acknowledge(input: {
    recipientId: string;
    notificationId: string;
    now: Date;
  }): Promise<void>;
  clock: Clock;
  leadMinutes(): number;
  leaseSeconds(): number;
};

const systemClock: Clock = {
  now: () => new Date(),
};

const defaultDependencies: NotificationRouteDependencies = {
  authenticate: requireUser,
  acknowledge: acknowledgeNotification,
  claim: claimDueNotifications,
  clock: systemClock,
  leadMinutes: () => readAppEnv().notifyBeforeMinutes,
  leaseSeconds: () => readAppEnv().notificationLeaseSeconds,
};

export function createNotificationsGet(
  overrides: Partial<NotificationRouteDependencies> = {},
): (request: NextRequest) => Promise<Response> {
  const dependencies = {...defaultDependencies, ...overrides};
  return async (request: NextRequest): Promise<Response> => {
    try {
      const user = await dependencies.authenticate(request);
      return apiSuccess(await dependencies.claim({
        recipientId: user.id,
        now: dependencies.clock.now(),
        leadMinutes: dependencies.leadMinutes(),
        leaseSeconds: dependencies.leaseSeconds(),
      }));
    } catch (error) {
      return apiError(error);
    }
  };
}

export function createNotificationsPost(
  overrides: Partial<NotificationRouteDependencies> = {},
): (request: NextRequest) => Promise<Response> {
  const dependencies = {...defaultDependencies, ...overrides};
  return async (request: NextRequest): Promise<Response> => {
    try {
      assertSameOrigin(request);
      const user = await dependencies.authenticate(request);
      const body = await readJsonBody(request);
      const notificationId =
        body && typeof body === 'object' && 'notificationId' in body ?
          (body as {notificationId: unknown}).notificationId :
          undefined;
      await dependencies.acknowledge({
        recipientId: user.id,
        notificationId: typeof notificationId === 'string' ?
          notificationId :
          '',
        now: dependencies.clock.now(),
      });
      return new Response(null, {status: 204});
    } catch (error) {
      return apiError(error);
    }
  };
}

export const GET = createNotificationsGet();
export const POST = createNotificationsPost();
