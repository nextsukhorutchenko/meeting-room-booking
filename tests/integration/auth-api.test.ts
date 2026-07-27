import {createHash, randomBytes} from 'node:crypto';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {SessionService} from '../../src/modules/auth/auth.types';
import type {AuthUser} from '../../src/modules/auth/auth.schemas';
import {
  AuthService,
  PrismaAuthRepository,
} from '../../src/modules/auth/auth.service';
import {
  DefaultVerificationService,
  PrismaVerificationRepository,
  type VerificationService,
} from '../../src/modules/auth/verification.service';
import {createVerifiedUser} from '../helpers/factories';
import {
  type PostHandler,
  postJson,
  readSessionCookie,
  requestWithCookie,
} from '../helpers/api-client';
import {disconnectTestDatabase, testDb} from '../helpers/database';

const testEmailPrefix = 'task-5-auth-';

let registerPost: PostHandler;
let loginPost: PostHandler;
let logoutPost: PostHandler;
let verifyPost: PostHandler;
let getOptionalUser: (request?: Request) => Promise<AuthUser | null>;
let verificationUrls: string[] = [];

function createRegistrationSessionService(): SessionService {
  const token = randomBytes(32).toString('base64url');
  return {
    prepare: () => ({
      token,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
    }),
    create: async () => {
      throw new Error('Unexpected session creation');
    },
    findUserByToken: async () => null,
    revoke: async () => {},
  };
}

function createPreparedVerificationService(input: {
  tokenHash?: string;
  writeLink?: (url: string) => void;
} = {}): VerificationService {
  const rawToken = randomBytes(32).toString('base64url');
  const url = new URL('/verify', 'http://localhost:3000');
  url.searchParams.set('token', rawToken);
  return {
    prepare: () => ({
      tokenHash: input.tokenHash ??
        createHash('sha256').update(rawToken).digest('hex'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      url: url.toString(),
    }),
    writeLink: input.writeLink ?? (() => {}),
    verify: async () => {},
  };
}

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const [registerRoute, loginRoute, logoutRoute, verifyRoute, authModule] =
    await Promise.all([
      import('../../src/app/api/auth/register/route'),
      import('../../src/app/api/auth/login/route'),
      import('../../src/app/api/auth/logout/route'),
      import('../../src/app/api/auth/verify/route'),
      import('../../src/modules/auth/auth.service'),
    ]);
  registerPost = registerRoute.POST;
  loginPost = loginRoute.POST;
  logoutPost = logoutRoute.POST;
  verifyPost = verifyRoute.POST;
  getOptionalUser = authModule.getOptionalUser;
});

beforeEach(async () => {
  verificationUrls = [];
  vi.spyOn(console, 'info').mockImplementation((value?: unknown) => {
    if (typeof value === 'string') {
      verificationUrls.push(value);
    }
  });
  await testDb.user.deleteMany({
    where: {normalizedEmail: {startsWith: testEmailPrefix}},
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await testDb.user.deleteMany({
    where: {normalizedEmail: {startsWith: testEmailPrefix}},
  });
  await disconnectTestDatabase();
});

describe.sequential('auth API', () => {
  it('rejects every cross-origin POST before processing its body', async () => {
    const routes = [
      ['/api/auth/register', registerPost],
      ['/api/auth/login', loginPost],
      ['/api/auth/logout', logoutPost],
      ['/api/auth/verify', verifyPost],
    ] as const;

    for (const [path, handler] of routes) {
      const response = await postJson(handler, path, {}, {
        origin: 'https://attacker.example',
        rawBody: '{not-json',
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: 'FORBIDDEN_ORIGIN',
          message: 'Request origin is not allowed',
        },
      });
    }
  });

  it('returns stable registration field errors', async () => {
    const response = await postJson(registerPost, '/api/auth/register', {
      name: ' ',
      email: 'not-an-email',
      password: '1234567',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Please correct the highlighted fields',
        fields: {
          name: 'Name is required',
          email: 'Enter a valid email address',
          password: 'Password must contain 8 to 72 Unicode characters',
        },
      },
    });
  });

  it('registers a safe user and persists only a hashed session token', async () => {
    const password = 'correct password';
    const response = await postJson(registerPost, '/api/auth/register', {
      name: '  Route Ada  ',
      email: `${testEmailPrefix}register@Example.com`,
      password,
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      data: {
        user: {
          name: 'Route Ada',
          email: `${testEmailPrefix}register@Example.com`,
          emailVerified: false,
        },
      },
    });
    expect(Object.keys(body.data.user).sort()).toEqual([
      'email',
      'emailVerified',
      'id',
      'name',
    ]);
    expect(JSON.stringify(body)).not.toContain(password);
    expect(verificationUrls).toHaveLength(1);
    const verificationUrl = new URL(verificationUrls[0]);
    expect(verificationUrl.origin).toBe('http://localhost:3000');
    expect(verificationUrl.pathname).toBe('/verify');
    const rawVerificationToken =
      verificationUrl.searchParams.get('token') ?? '';
    expect(Buffer.from(rawVerificationToken, 'base64url')).toHaveLength(32);

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('mrb_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toContain('Path=/');
    expect(setCookie).not.toContain('Secure');
    expect(setCookie).not.toContain(password);

    const cookie = readSessionCookie(response);
    const persisted = await testDb.session.findUniqueOrThrow({
      where: {
        tokenHash: createHash('sha256').update(cookie.token).digest('hex'),
      },
    });
    expect(persisted.tokenHash).not.toBe(cookie.token);
    expect(JSON.stringify(persisted)).not.toContain(cookie.token);
    const expiresInDays =
      (persisted.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1_000);
    expect(expiresInDays).toBeGreaterThan(6.99);
    expect(expiresInDays).toBeLessThanOrEqual(7);

    const verificationToken = await testDb.verificationToken.findUniqueOrThrow({
      where: {
        tokenHash: createHash('sha256')
          .update(rawVerificationToken)
          .digest('hex'),
      },
    });
    expect(verificationToken.tokenHash).not.toBe(rawVerificationToken);
    expect(JSON.stringify(verificationToken)).not.toContain(
      rawVerificationToken,
    );
    const verificationExpiresInHours =
      (verificationToken.expiresAt.getTime() - Date.now()) /
      (60 * 60 * 1_000);
    expect(verificationExpiresInHours).toBeGreaterThan(23.99);
    expect(verificationExpiresInHours).toBeLessThanOrEqual(24);

    await expect(
      getOptionalUser(requestWithCookie(cookie.header)),
    ).resolves.toEqual(body.data.user);
  });

  it('verifies an issued token once and rejects its reuse', async () => {
    const email = `${testEmailPrefix}verify-once@example.com`;
    const registration = await postJson(registerPost, '/api/auth/register', {
      name: 'Verify Once',
      email,
      password: 'correct password',
    });
    expect(registration.status).toBe(201);
    const rawToken = new URL(verificationUrls[0])
      .searchParams.get('token') ?? '';

    const verified = await postJson(verifyPost, '/api/auth/verify', {token: rawToken});

    expect(verified.status).toBe(200);
    await expect(verified.json()).resolves.toEqual({
      data: {verified: true},
    });
    await expect(testDb.user.findUniqueOrThrow({
      where: {normalizedEmail: email},
      select: {emailVerifiedAt: true},
    })).resolves.toEqual({emailVerifiedAt: expect.any(Date)});
    await expect(postJson(
      verifyPost,
      '/api/auth/verify',
      {token: rawToken},
    ).then(async (response) => ({
      status: response.status,
      body: await response.json(),
    }))).resolves.toEqual({
      status: 410,
      body: {
        error: {
          code: 'VERIFICATION_INVALID_OR_EXPIRED',
          message: 'Verification link is invalid or expired',
        },
      },
    });
  });

  it('rejects an expired token without verifying its user', async () => {
    const email = `${testEmailPrefix}expired@example.com`;
    const registration = await postJson(registerPost, '/api/auth/register', {
      name: 'Expired Link',
      email,
      password: 'correct password',
    });
    expect(registration.status).toBe(201);
    const rawToken = new URL(verificationUrls[0])
      .searchParams.get('token') ?? '';
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await testDb.verificationToken.update({
      where: {tokenHash},
      data: {expiresAt: new Date('2000-01-01T00:00:00.000Z')},
    });

    const response = await postJson(
      verifyPost,
      '/api/auth/verify',
      {token: rawToken},
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VERIFICATION_INVALID_OR_EXPIRED',
        message: 'Verification link is invalid or expired',
      },
    });
    await expect(testDb.user.findUniqueOrThrow({
      where: {normalizedEmail: email},
      select: {emailVerifiedAt: true},
    })).resolves.toEqual({emailVerifiedAt: null});
    await expect(testDb.verificationToken.findUniqueOrThrow({
      where: {tokenHash},
      select: {consumedAt: true},
    })).resolves.toEqual({consumedAt: null});
  });

  it('treats the exact PostgreSQL expiry boundary as expired', async () => {
    const email = `${testEmailPrefix}expiry-boundary@example.com`;
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date('2030-01-02T03:04:05.000Z');
    const user = await testDb.user.create({
      data: {
        name: 'Expiry Boundary',
        email,
        normalizedEmail: email,
        passwordHash: 'test-only-password-hash',
      },
    });
    await testDb.verificationToken.create({
      data: {tokenHash, userId: user.id, expiresAt},
    });
    const service = new DefaultVerificationService({
      repository: new PrismaVerificationRepository(testDb),
      clock: {now: () => new Date(expiresAt)},
      appUrl: 'http://localhost:3000',
      writer: {write: () => {}},
    });

    await expect(service.verify(rawToken)).rejects.toMatchObject({
      code: 'VERIFICATION_INVALID_OR_EXPIRED',
      status: 410,
    });
    await expect(testDb.user.findUniqueOrThrow({
      where: {id: user.id},
      select: {emailVerifiedAt: true},
    })).resolves.toEqual({emailVerifiedAt: null});
    await expect(testDb.verificationToken.findUniqueOrThrow({
      where: {tokenHash},
      select: {consumedAt: true},
    })).resolves.toEqual({consumedAt: null});
  });

  it('allows exactly one concurrent verification attempt', async () => {
    const email = `${testEmailPrefix}verify-race@example.com`;
    const registration = await postJson(registerPost, '/api/auth/register', {
      name: 'Verification Race',
      email,
      password: 'correct password',
    });
    expect(registration.status).toBe(201);
    const rawToken = new URL(verificationUrls[0])
      .searchParams.get('token') ?? '';

    const attempts = await Promise.all([
      postJson(verifyPost, '/api/auth/verify', {token: rawToken}),
      postJson(verifyPost, '/api/auth/verify', {token: rawToken}),
    ]);

    expect(attempts.map((response) => response.status).sort()).toEqual([
      200,
      410,
    ]);
    await expect(testDb.user.findUniqueOrThrow({
      where: {normalizedEmail: email},
      select: {emailVerifiedAt: true},
    })).resolves.toEqual({emailVerifiedAt: expect.any(Date)});
    await expect(testDb.verificationToken.count({
      where: {
        user: {normalizedEmail: email},
        consumedAt: {not: null},
      },
    })).resolves.toBe(1);
  });

  it('strictly validates verification input without exposing internals', async () => {
    const response = await postJson(verifyPost, '/api/auth/verify', {
      token: 'not-a-token',
      extra: 'not allowed',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid verification request',
      },
    });
  });

  it('rolls back the user when the initial session insert fails', async () => {
    const email = `${testEmailPrefix}session-failure@example.com`;
    const failingSessionService: SessionService = {
      prepare: () => ({
        token: 'not-persisted',
        tokenHash: 'not-persisted-hash',
        expiresAt: null as unknown as Date,
      }),
      create: async () => {
        throw new Error('Unexpected session creation');
      },
      findUserByToken: async () => null,
      revoke: async () => {},
    };
    const service = new AuthService({
      repository: new PrismaAuthRepository(testDb),
      sessions: failingSessionService,
      verification: {
        prepare: () => {
          throw new Error('Unexpected verification preparation');
        },
        writeLink: () => {
          throw new Error('Unexpected verification link write');
        },
        verify: async () => {},
      },
      password: {
        hash: async () => 'hashed:correct password',
        verify: async () => false,
      },
    });

    await expect(service.register({
      name: 'Session Failure',
      email,
      password: 'correct password',
    })).rejects.toThrow();
    await expect(testDb.user.findUnique({
      where: {normalizedEmail: email},
    })).resolves.toBeNull();
  });

  it('rolls back registration when the verification-token insert fails', async () => {
    const email = `${testEmailPrefix}token-failure@example.com`;
    const holder = await testDb.user.create({
      data: {
        name: 'Token Holder',
        email: `${testEmailPrefix}token-holder@example.com`,
        normalizedEmail: `${testEmailPrefix}token-holder@example.com`,
        passwordHash: 'test-only-password-hash',
      },
    });
    const collidingTokenHash = createHash('sha256')
      .update(randomBytes(32))
      .digest('hex');
    await testDb.verificationToken.create({
      data: {
        tokenHash: collidingTokenHash,
        userId: holder.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      },
    });
    const writeLink = vi.fn();
    const service = new AuthService({
      repository: new PrismaAuthRepository(testDb),
      sessions: createRegistrationSessionService(),
      verification: createPreparedVerificationService({
        tokenHash: collidingTokenHash,
        writeLink,
      }),
      password: {
        hash: async () => 'hashed:correct password',
        verify: async () => false,
      },
    });

    await expect(service.register({
      name: 'Token Failure',
      email,
      password: 'correct password',
    })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 503,
    });
    expect(writeLink).not.toHaveBeenCalled();
    await expect(testDb.user.findUnique({
      where: {normalizedEmail: email},
    })).resolves.toBeNull();
    await expect(testDb.session.count({
      where: {user: {normalizedEmail: email}},
    })).resolves.toBe(0);
    await expect(testDb.verificationToken.count({
      where: {user: {normalizedEmail: email}},
    })).resolves.toBe(0);

    const retry = new AuthService({
      repository: new PrismaAuthRepository(testDb),
      sessions: createRegistrationSessionService(),
      verification: createPreparedVerificationService(),
      password: {
        hash: async () => 'hashed:correct password',
        verify: async () => false,
      },
    });
    await expect(retry.register({
      name: 'Token Failure',
      email,
      password: 'correct password',
    })).resolves.toMatchObject({
      user: {email, emailVerified: false},
    });
    await expect(testDb.user.findUnique({
      where: {normalizedEmail: email},
    })).resolves.not.toBeNull();
    await expect(testDb.session.count({
      where: {user: {normalizedEmail: email}},
    })).resolves.toBe(1);
    await expect(testDb.verificationToken.count({
      where: {user: {normalizedEmail: email}},
    })).resolves.toBe(1);
  });

  it('rolls back registration when the development link writer fails', async () => {
    const email = `${testEmailPrefix}writer-failure@example.com`;
    const privateDetail = 'private writer failure detail';
    const service = new AuthService({
      repository: new PrismaAuthRepository(testDb),
      sessions: createRegistrationSessionService(),
      verification: createPreparedVerificationService({
        writeLink: () => {
          throw new Error(privateDetail);
        },
      }),
      password: {
        hash: async () => 'hashed:correct password',
        verify: async () => false,
      },
    });

    const failure = await service.register({
      name: 'Writer Failure',
      email,
      password: 'correct password',
    }).catch((error: unknown) => error);
    expect(failure).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service unavailable',
      status: 503,
    });
    expect(JSON.stringify(failure)).not.toContain(privateDetail);
    await expect(testDb.user.findUnique({
      where: {normalizedEmail: email},
    })).resolves.toBeNull();
    await expect(testDb.session.count({
      where: {user: {normalizedEmail: email}},
    })).resolves.toBe(0);
    await expect(testDb.verificationToken.count({
      where: {user: {normalizedEmail: email}},
    })).resolves.toBe(0);

    const retry = new AuthService({
      repository: new PrismaAuthRepository(testDb),
      sessions: createRegistrationSessionService(),
      verification: createPreparedVerificationService(),
      password: {
        hash: async () => 'hashed:correct password',
        verify: async () => false,
      },
    });
    await expect(retry.register({
      name: 'Writer Failure',
      email,
      password: 'correct password',
    })).resolves.toMatchObject({
      user: {email, emailVerified: false},
    });
    await expect(testDb.user.findUnique({
      where: {normalizedEmail: email},
    })).resolves.not.toBeNull();
    await expect(testDb.session.count({
      where: {user: {normalizedEmail: email}},
    })).resolves.toBe(1);
    await expect(testDb.verificationToken.count({
      where: {user: {normalizedEmail: email}},
    })).resolves.toBe(1);
  });

  it('maps a real normalized-email conflict without rejecting duplicate names', async () => {
    const first = await postJson(registerPost, '/api/auth/register', {
      name: 'Same Name',
      email: `${testEmailPrefix}collision@Example.com`,
      password: 'correct password',
    });
    expect(first.status).toBe(201);

    const collision = await postJson(registerPost, '/api/auth/register', {
      name: 'Another Name',
      email: ` ${testEmailPrefix}COLLISION@example.COM `,
      password: 'correct password',
    });
    expect(collision.status).toBe(409);
    await expect(collision.json()).resolves.toMatchObject({
      error: {
        code: 'EMAIL_TAKEN',
        fields: {
          email: 'An account with this email already exists',
        },
      },
    });

    const duplicateName = await postJson(registerPost, '/api/auth/register', {
      name: 'Same Name',
      email: `${testEmailPrefix}different@example.com`,
      password: 'correct password',
    });
    expect(duplicateName.status).toBe(201);
  });

  it('uses the same invalid-credentials response for wrong email and password', async () => {
    await createVerifiedUser({
      name: 'Login User',
      email: `${testEmailPrefix}login@example.com`,
      password: 'correct password',
    });

    const login = await postJson(loginPost, '/api/auth/login', {
      email: ` ${testEmailPrefix}LOGIN@EXAMPLE.COM `,
      password: 'correct password',
    });
    expect(login.status).toBe(200);
    await expect(login.json()).resolves.toMatchObject({
      data: {
        user: {
          name: 'Login User',
          emailVerified: true,
        },
      },
    });
    expect(login.headers.get('set-cookie')).toContain('mrb_session=');

    const unknownEmail = await postJson(loginPost, '/api/auth/login', {
      email: `${testEmailPrefix}unknown@example.com`,
      password: 'correct password',
    });
    const wrongPassword = await postJson(loginPost, '/api/auth/login', {
      email: `${testEmailPrefix}login@example.com`,
      password: 'wrong password',
    });

    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    const unknownEmailBody = await unknownEmail.json();
    const wrongPasswordBody = await wrongPassword.json();
    expect(unknownEmailBody).toEqual(wrongPasswordBody);

    const malformedCredentials = await postJson(
      loginPost,
      '/api/auth/login',
      {email: 'not-an-email', password: 'short'},
    );
    expect(malformedCredentials.status).toBe(401);
    expect(await malformedCredentials.json()).toEqual(wrongPasswordBody);
  });

  it('logs out only the current session and expires its cookie', async () => {
    await createVerifiedUser({
      name: 'Two Sessions',
      email: `${testEmailPrefix}sessions@example.com`,
      password: 'correct password',
    });
    const credentials = {
      email: `${testEmailPrefix}sessions@example.com`,
      password: 'correct password',
    };
    const firstLogin = await postJson(
      loginPost,
      '/api/auth/login',
      credentials,
    );
    const secondLogin = await postJson(
      loginPost,
      '/api/auth/login',
      credentials,
    );
    const firstCookie = readSessionCookie(firstLogin);
    const secondCookie = readSessionCookie(secondLogin);

    const logout = await postJson(logoutPost, '/api/auth/logout', {}, {
      cookie: firstCookie.header,
    });

    expect(logout.status).toBe(200);
    expect(await logout.json()).toEqual({data: {loggedOut: true}});
    const clearedCookie = logout.headers.get('set-cookie') ?? '';
    expect(clearedCookie).toContain('mrb_session=');
    expect(clearedCookie).toContain('HttpOnly');
    expect(clearedCookie).toMatch(/SameSite=Lax/i);
    expect(clearedCookie).toContain('Path=/');
    expect(clearedCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
    await expect(
      getOptionalUser(requestWithCookie(firstCookie.header)),
    ).resolves.toBeNull();
    await expect(
      getOptionalUser(requestWithCookie(secondCookie.header)),
    ).resolves.toMatchObject({name: 'Two Sessions'});
  });

  it('adds Secure to the session cookie only in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    Reflect.set(process.env, 'NODE_ENV', 'production');
    try {
      const response = await postJson(registerPost, '/api/auth/register', {
        name: 'Secure Cookie',
        email: `${testEmailPrefix}secure@example.com`,
        password: 'correct password',
      });

      expect(response.status).toBe(201);
      expect(response.headers.get('set-cookie')).toContain('Secure');
    } finally {
      if (originalNodeEnv === undefined) {
        Reflect.deleteProperty(process.env, 'NODE_ENV');
      } else {
        Reflect.set(process.env, 'NODE_ENV', originalNodeEnv);
      }
    }
  });
});
