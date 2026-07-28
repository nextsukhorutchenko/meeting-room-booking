import {createHash} from 'node:crypto';
import {type PrismaClient} from '@prisma/client';
import {DomainError} from '../../lib/http/domain-error';

export type AuthRateLimitAction = 'login' | 'register';

export type AuthRateLimitPolicy = {
  identityLimit: number;
  ipLimit: number;
  windowSeconds: number;
};

export type RateLimitBucketInput = {
  key: string;
  limit: number;
  now: Date;
  windowSeconds: number;
};

export interface AuthRateLimitRepository {
  consume(input: RateLimitBucketInput): Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
  }>;
}

function bucketKey(
  action: AuthRateLimitAction,
  dimension: 'identity' | 'ip',
  value: string,
): string {
  return createHash('sha256')
    .update(`${action}:${dimension}:${value}`)
    .digest('hex');
}

function rateLimitedError(retryAfterSeconds: number): DomainError {
  return new DomainError({
    code: 'RATE_LIMITED',
    message: 'Too many attempts. Try again later.',
    retryAfterSeconds,
    status: 429,
  });
}

export class DefaultAuthRateLimitService {
  constructor(private readonly repository: AuthRateLimitRepository) {}

  async enforce(input: {
    action: AuthRateLimitAction;
    clientIp: string;
    identity?: string;
    now: Date;
    policy: AuthRateLimitPolicy;
  }): Promise<void> {
    const buckets: Array<{
      dimension: 'identity' | 'ip';
      limit: number;
      value: string;
    }> = [{
      dimension: 'ip' as const,
      limit: input.policy.ipLimit,
      value: input.clientIp,
    }];
    if (input.identity) {
      buckets.push({
        dimension: 'identity',
        limit: input.policy.identityLimit,
        value: input.identity,
      });
    }
    for (const bucket of buckets) {
      const result = await this.repository.consume({
        key: bucketKey(input.action, bucket.dimension, bucket.value),
        limit: bucket.limit,
        now: input.now,
        windowSeconds: input.policy.windowSeconds,
      });
      if (!result.allowed) {
        throw rateLimitedError(result.retryAfterSeconds);
      }
    }
  }
}

type AuthRateLimitPrismaClient = Pick<PrismaClient, '$queryRaw'>;

type RateLimitRow = {
  attempts: number;
  expiresAt: Date;
};

export class PrismaAuthRateLimitRepository
  implements AuthRateLimitRepository {
  constructor(private readonly database: AuthRateLimitPrismaClient) {}

  async consume(input: RateLimitBucketInput): Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
  }> {
    const expiresAt = new Date(
      input.now.getTime() + input.windowSeconds * 1_000,
    );
    const [bucket] = await this.database.$queryRaw<RateLimitRow[]>`
      INSERT INTO "AuthRateLimitBucket" (
        "key",
        "attempts",
        "windowStartedAt",
        "expiresAt"
      )
      VALUES (${input.key}, 1, ${input.now}, ${expiresAt})
      ON CONFLICT ("key") DO UPDATE
      SET
        "attempts" = CASE
          WHEN "AuthRateLimitBucket"."expiresAt" <= ${input.now} THEN 1
          ELSE "AuthRateLimitBucket"."attempts" + 1
        END,
        "windowStartedAt" = CASE
          WHEN "AuthRateLimitBucket"."expiresAt" <= ${input.now}
            THEN ${input.now}
          ELSE "AuthRateLimitBucket"."windowStartedAt"
        END,
        "expiresAt" = CASE
          WHEN "AuthRateLimitBucket"."expiresAt" <= ${input.now}
            THEN ${expiresAt}
          ELSE "AuthRateLimitBucket"."expiresAt"
        END
      RETURNING "attempts", "expiresAt"
    `;
    if (!bucket) {
      throw new Error('Rate-limit bucket was not returned');
    }
    return {
      allowed: bucket.attempts <= input.limit,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(
          (bucket.expiresAt.getTime() - input.now.getTime()) / 1_000,
        ),
      ),
    };
  }
}

let defaultService: Promise<DefaultAuthRateLimitService> | undefined;

async function getDefaultService(): Promise<DefaultAuthRateLimitService> {
  if (!defaultService) {
    defaultService = import('../../lib/db/prisma').then(({prisma}) =>
      new DefaultAuthRateLimitService(
        new PrismaAuthRateLimitRepository(prisma),
      ),
    );
  }
  return defaultService;
}

export async function enforceAuthRateLimit(input: {
  action: AuthRateLimitAction;
  clientIp: string;
  identity?: string;
  now: Date;
  policy: AuthRateLimitPolicy;
}): Promise<void> {
  await (await getDefaultService()).enforce(input);
}

export function readClientIp(request: Request, headerName: string): string {
  const value = request.headers.get(headerName)?.split(',', 1)[0].trim();
  return value || 'unknown';
}

export function readRateLimitIdentity(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || !('email' in body)) {
    return undefined;
  }
  const email = (body as {email: unknown}).email;
  if (typeof email !== 'string') {
    return undefined;
  }
  const normalized = email.trim().toLowerCase().slice(0, 320);
  return normalized || undefined;
}
