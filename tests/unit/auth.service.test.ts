import {describe, expect, it} from 'vitest';
import type {
  AuthUser as SessionUser,
  CreatedSession,
  PreparedSession,
  SessionService,
} from '../../src/modules/auth/auth.types';
import {
  AuthService,
  type AuthAccount,
  type AuthRepository,
  DuplicateEmailRepositoryError,
} from '../../src/modules/auth/auth.service';
import {dummyPasswordHash} from '../../src/modules/auth/password';

class InMemoryAuthRepository implements AuthRepository {
  private sequence = 0;
  private readonly accounts = new Map<string, AuthAccount>();
  failSessionInsert = false;

  async createWithSession(input: {
    name: string;
    email: string;
    normalizedEmail: string;
    passwordHash: string;
  }): Promise<AuthAccount> {
    if (this.failSessionInsert) {
      throw new Error('Session insert failed');
    }
    if (this.accounts.has(input.normalizedEmail)) {
      throw new DuplicateEmailRepositoryError();
    }
    this.sequence += 1;
    const account = {
      id: `user-${this.sequence}`,
      ...input,
      emailVerifiedAt: null,
    };
    this.accounts.set(input.normalizedEmail, account);
    return account;
  }

  async findByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<AuthAccount | null> {
    return this.accounts.get(normalizedEmail) ?? null;
  }
}

class InMemorySessionService implements SessionService {
  readonly usersByToken = new Map<string, SessionUser>();
  readonly revokedTokens: string[] = [];
  private sequence = 0;

  prepare(): PreparedSession {
    this.sequence += 1;
    return {
      token: `session-${this.sequence}`,
      tokenHash: `hashed-session-${this.sequence}`,
      expiresAt: new Date('2026-08-03T06:00:00.000Z'),
    };
  }

  async create(): Promise<CreatedSession> {
    const session = this.prepare();
    return {token: session.token, expiresAt: session.expiresAt};
  }

  async findUserByToken(token: string): Promise<SessionUser | null> {
    return this.usersByToken.get(token) ?? null;
  }

  async revoke(token: string): Promise<void> {
    this.revokedTokens.push(token);
    this.usersByToken.delete(token);
  }
}

function createService(): {
  repository: InMemoryAuthRepository;
  sessions: InMemorySessionService;
  service: AuthService;
} {
  const repository = new InMemoryAuthRepository();
  const sessions = new InMemorySessionService();
  const service = new AuthService({
    repository,
    sessions,
    password: {
      hash: async (password) => `hashed:${password}`,
      verify: async (hash, password) => hash === `hashed:${password}`,
    },
  });

  return {repository, sessions, service};
}

describe('AuthService', () => {
  it('enforces normalized email uniqueness while allowing duplicate names', async () => {
    const {service} = createService();

    const first = await service.register({
      name: '  Ada Lovelace  ',
      email: 'Ada@Example.com',
      password: 'valid password',
    });

    expect(first.user).toEqual({
      id: 'user-1',
      name: 'Ada Lovelace',
      email: 'Ada@Example.com',
      emailVerified: false,
    });
    await expect(service.register({
      name: 'Different person',
      email: ' ada@example.COM ',
      password: 'valid password',
    })).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
      status: 409,
      fields: {email: 'An account with this email already exists'},
    });
    await expect(service.register({
      name: 'Ada Lovelace',
      email: 'another@example.com',
      password: 'valid password',
    })).resolves.toMatchObject({
      user: {
        name: 'Ada Lovelace',
        email: 'another@example.com',
      },
    });
  });

  it('returns stable field errors before hashing invalid registration data', async () => {
    const {service} = createService();

    await expect(service.register({
      name: ' ',
      email: 'not-an-email',
      password: '1234567',
    })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 400,
      fields: {
        name: 'Name is required',
        email: 'Enter a valid email address',
        password: 'Password must contain 8 to 72 Unicode characters',
      },
    });
  });

  it('normalizes login email and uses one error for unknown or wrong credentials', async () => {
    const {service} = createService();
    await service.register({
      name: 'Ada',
      email: 'Ada@Example.com',
      password: 'correct password',
    });

    await expect(service.login({
      email: ' ada@example.COM ',
      password: 'correct password',
    })).resolves.toMatchObject({
      user: {email: 'Ada@Example.com'},
    });

    const unknownEmail = service.login({
      email: 'unknown@example.com',
      password: 'correct password',
    });
    const wrongPassword = service.login({
      email: 'ada@example.com',
      password: 'wrong password',
    });

    await expect(unknownEmail).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401,
    });
    await expect(wrongPassword).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401,
    });
  });

  it('runs the password verifier for unknown and incorrect credentials', async () => {
    const repository = new InMemoryAuthRepository();
    const sessions = new InMemorySessionService();
    const verifierHashes: string[] = [];
    const service = new AuthService({
      repository,
      sessions,
      password: {
        hash: async (password) => `hashed:${password}`,
        verify: async (hash) => {
          verifierHashes.push(hash);
          return false;
        },
      },
    });
    await service.register({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'correct password',
    });

    await expect(service.login({
      email: 'unknown@example.com',
      password: 'wrong password',
    })).rejects.toMatchObject({code: 'INVALID_CREDENTIALS'});
    await expect(service.login({
      email: 'ada@example.com',
      password: 'wrong password',
    })).rejects.toMatchObject({code: 'INVALID_CREDENTIALS'});

    expect(verifierHashes).toEqual([
      dummyPasswordHash,
      'hashed:correct password',
    ]);
  });

  it('does not persist an account when initial session creation fails', async () => {
    const {repository, service} = createService();
    repository.failSessionInsert = true;

    await expect(service.register({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'correct password',
    })).rejects.toThrow('Session insert failed');

    await expect(
      repository.findByNormalizedEmail('ada@example.com'),
    ).resolves.toBeNull();
  });

  it('maps session users to safe fields and revokes only the current token', async () => {
    const {service, sessions} = createService();
    sessions.usersByToken.set('current-token', {
      id: 'user-1',
      name: 'Ada',
      email: 'ada@example.com',
      normalizedEmail: 'ada@example.com',
      emailVerifiedAt: new Date('2026-07-27T06:00:00.000Z'),
    });
    sessions.usersByToken.set('other-token', {
      id: 'user-1',
      name: 'Ada',
      email: 'ada@example.com',
      normalizedEmail: 'ada@example.com',
      emailVerifiedAt: new Date('2026-07-27T06:00:00.000Z'),
    });

    await expect(
      service.getUserBySessionToken('current-token'),
    ).resolves.toEqual({
      id: 'user-1',
      name: 'Ada',
      email: 'ada@example.com',
      emailVerified: true,
    });

    await service.logout('current-token');

    expect(sessions.revokedTokens).toEqual(['current-token']);
    await expect(
      service.getUserBySessionToken('current-token'),
    ).resolves.toBeNull();
    await expect(
      service.getUserBySessionToken('other-token'),
    ).resolves.toMatchObject({id: 'user-1'});
  });
});
