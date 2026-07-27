import type {NextRequest} from 'next/server';
import {readAppEnv} from '../../../lib/config/env';
import {apiError, apiSuccess} from '../../../lib/http/api-response';
import {assertSameOrigin} from '../../../lib/http/same-origin';
import type {Clock} from '../../../lib/time/office-time';
import {requireUser} from '../../../modules/auth/auth.service';
import {
  claimDueNotifications,
  type DueNotification,
} from '../../../modules/notifications/notification.service';

type NotificationRouteDependencies = {
  authenticate(request: Request): Promise<{id: string}>;
  claim(input: {
    recipientId: string;
    now: Date;
    leadMinutes: number;
  }): Promise<DueNotification[]>;
  clock: Clock;
  leadMinutes(): number;
};

const systemClock: Clock = {
  now: () => new Date(),
};

const defaultDependencies: NotificationRouteDependencies = {
  authenticate: requireUser,
  claim: claimDueNotifications,
  clock: systemClock,
  leadMinutes: () => readAppEnv().notifyBeforeMinutes,
};

export function createNotificationsPost(
  overrides: Partial<NotificationRouteDependencies> = {},
): (request: NextRequest) => Promise<Response> {
  const dependencies = {...defaultDependencies, ...overrides};
  return async (request: NextRequest): Promise<Response> => {
    try {
      assertSameOrigin(request);
      const user = await dependencies.authenticate(request);
      return apiSuccess(await dependencies.claim({
        recipientId: user.id,
        now: dependencies.clock.now(),
        leadMinutes: dependencies.leadMinutes(),
      }));
    } catch (error) {
      return apiError(error);
    }
  };
}

export const POST = createNotificationsPost();
