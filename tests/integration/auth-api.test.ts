import {createHash} from 'node:crypto';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import type {AuthUser} from '../../src/modules/auth/auth.schemas';
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
let getOptionalUser: (request?: Request) => Promise<AuthUser | null>;

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const [registerRoute, loginRoute, logoutRoute, authModule] =
    await Promise.all([
      import('../../src/app/api/auth/register/route'),
      import('../../src/app/api/auth/login/route'),
      import('../../src/app/api/auth/logout/route'),
      import('../../src/modules/auth/auth.service'),
    ]);
  registerPost = registerRoute.POST;
  loginPost = loginRoute.POST;
  logoutPost = logoutRoute.POST;
  getOptionalUser = authModule.getOptionalUser;
});

beforeEach(async () => {
  await testDb.user.deleteMany({
    where: {normalizedEmail: {startsWith: testEmailPrefix}},
  });
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

    await expect(
      getOptionalUser(requestWithCookie(cookie.header)),
    ).resolves.toEqual(body.data.user);
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
