import {describe, expect, it} from 'vitest';
import {
  DefaultAuthRateLimitService,
  type AuthRateLimitRepository,
  type RateLimitBucketInput,
} from '../../src/modules/auth/auth-rate-limit.service';

type StoredBucket = {
  attempts: number;
  expiresAt: Date;
};

class MemoryRateLimitRepository implements AuthRateLimitRepository {
  readonly buckets = new Map<string, StoredBucket>();

  async consume(input: RateLimitBucketInput): Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
  }> {
    const existing = this.buckets.get(input.key);
    const expired = !existing || existing.expiresAt <= input.now;
    const bucket = expired ? {
      attempts: 1,
      expiresAt: new Date(
        input.now.getTime() + input.windowSeconds * 1_000,
      ),
    } : {
      attempts: existing.attempts + 1,
      expiresAt: existing.expiresAt,
    };
    this.buckets.set(input.key, bucket);
    return {
      allowed: bucket.attempts <= input.limit,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.expiresAt.getTime() - input.now.getTime()) / 1_000),
      ),
    };
  }
}

const policy = {
  identityLimit: 2,
  ipLimit: 3,
  windowSeconds: 60,
};

describe('DefaultAuthRateLimitService', () => {
  it('shares exhaustion across service instances and recovers after expiry', async () => {
    const repository = new MemoryRateLimitRepository();
    const firstProcess = new DefaultAuthRateLimitService(repository);
    const secondProcess = new DefaultAuthRateLimitService(repository);
    const now = new Date('2026-07-28T10:00:00.000Z');
    const input = {
      action: 'login' as const,
      clientIp: '203.0.113.8',
      identity: 'person@example.com',
      now,
      policy,
    };

    await firstProcess.enforce(input);
    await secondProcess.enforce(input);
    await expect(firstProcess.enforce(input)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 60,
      status: 429,
    });
    await expect(secondProcess.enforce({
      ...input,
      now: new Date('2026-07-28T10:01:00.000Z'),
    })).resolves.toBeUndefined();
  });

  it('stores hashed bucket keys instead of IPs or normalized identities', async () => {
    const repository = new MemoryRateLimitRepository();
    const service = new DefaultAuthRateLimitService(repository);

    await service.enforce({
      action: 'register',
      clientIp: '203.0.113.8',
      identity: 'person@example.com',
      now: new Date('2026-07-28T10:00:00.000Z'),
      policy,
    });

    const keys = [...repository.buckets.keys()];
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => /^[a-f0-9]{64}$/.test(key))).toBe(true);
    expect(keys.join()).not.toContain('203.0.113.8');
    expect(keys.join()).not.toContain('person@example.com');
  });
});
