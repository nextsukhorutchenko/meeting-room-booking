import {createHash} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import type {
  AuthUser,
  SessionRecord,
  SessionRepository,
} from '../../src/modules/auth/auth.types';
import {OpaqueSessionService} from '../../src/modules/auth/session.service';
import {TestClock} from '../helpers/test-clock';

const user: AuthUser = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'Ada.Lovelace@example.com',
  normalizedEmail: 'ada.lovelace@example.com',
  emailVerifiedAt: new Date('2026-07-20T06:00:00.000Z'),
};

class InMemorySessionRepository implements SessionRepository {
  readonly sessions = new Map<string, SessionRecord>();

  async create(session: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    this.sessions.set(session.tokenHash, {
      ...session,
      user,
    });
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('OpaqueSessionService', () => {
  it('stores a hash instead of the generated raw token', async () => {
    const repository = new InMemorySessionRepository();
    const service = new OpaqueSessionService({
      repository,
      clock: new TestClock(new Date('2026-07-27T06:00:00.000Z')),
      sessionDays: 7,
    });

    const session = await service.create(user.id);
    const [storedHash] = repository.sessions.keys();

    expect(Buffer.from(session.token, 'base64url')).toHaveLength(32);
    expect(storedHash).toBe(hashToken(session.token));
    expect(storedHash).not.toBe(session.token);
    expect(session.expiresAt).toEqual(new Date('2026-08-03T06:00:00.000Z'));
  });

  it('removes an expired session during lookup', async () => {
    const repository = new InMemorySessionRepository();
    const token = 'expired-session-token';
    const tokenHash = hashToken(token);
    repository.sessions.set(tokenHash, {
      tokenHash,
      userId: user.id,
      user,
      expiresAt: new Date('2026-07-27T05:59:59.999Z'),
    });
    const service = new OpaqueSessionService({
      repository,
      clock: new TestClock(new Date('2026-07-27T06:00:00.000Z')),
      sessionDays: 7,
    });

    await expect(service.findUserByToken(token)).resolves.toBeNull();
    expect(repository.sessions.has(tokenHash)).toBe(false);
  });

  it('revokes only the supplied session token', async () => {
    const repository = new InMemorySessionRepository();
    const service = new OpaqueSessionService({
      repository,
      clock: new TestClock(new Date('2026-07-27T06:00:00.000Z')),
      sessionDays: 7,
    });

    const first = await service.create(user.id);
    const second = await service.create(user.id);

    await service.revoke(first.token);

    await expect(service.findUserByToken(first.token)).resolves.toBeNull();
    await expect(service.findUserByToken(second.token)).resolves.toEqual(user);
  });
});
