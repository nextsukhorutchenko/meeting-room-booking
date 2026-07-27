import {Prisma, type PrismaClient} from '@prisma/client';
import {cookies} from 'next/headers';
import {NextRequest} from 'next/server';
import type {ZodError} from 'zod';
import {readAppEnv} from '../../lib/config/env';
import {sessionCookieName} from '../../lib/http/api-response';
import {
  DomainError,
  type DomainErrorFields,
} from '../../lib/http/domain-error';
import type {Clock} from '../../lib/time/office-time';
import {
  OpaqueSessionService,
  PrismaSessionRepository,
} from './session.service';
import type {PreparedSession, SessionService} from './auth.types';
import {
  type AuthUser,
  loginSchema,
  type LoginInput,
  registerSchema,
  type RegisterInput,
} from './auth.schemas';
import {normalizeEmail} from './email';
import {
  dummyPasswordHash,
  hashPassword,
  verifyPassword,
} from './password';
import {
  developmentVerificationLinkWriter,
  DefaultVerificationService,
  type PreparedVerification,
  PrismaVerificationRepository,
  type VerificationService,
} from './verification.service';

export type AuthAccount = {
  id: string;
  name: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
};

export interface AuthRepository {
  createRegistration(input: {
    name: string;
    email: string;
    normalizedEmail: string;
    passwordHash: string;
  }, session: Pick<PreparedSession, 'tokenHash' | 'expiresAt'>,
  verification: Pick<PreparedVerification, 'tokenHash' | 'expiresAt'>,
  beforeCommit: () => void):
    Promise<AuthAccount>;
  findByNormalizedEmail(normalizedEmail: string): Promise<AuthAccount | null>;
}

type AuthenticatedSession = {
  user: AuthUser;
  token: string;
  expiresAt: Date;
};

type PasswordOperations = {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
};

export class DuplicateEmailRepositoryError extends Error {
  constructor() {
    super('Normalized email already exists');
    this.name = 'DuplicateEmailRepositoryError';
  }
}

function validationError(fields: DomainErrorFields): DomainError {
  return new DomainError({
    code: 'VALIDATION_FAILED',
    message: 'Please correct the highlighted fields',
    status: 400,
    fields,
  });
}

function invalidCredentialsError(): DomainError {
  return new DomainError({
    code: 'INVALID_CREDENTIALS',
    message: 'Email or password is incorrect',
    status: 401,
  });
}

function serviceUnavailableError(): DomainError {
  return new DomainError({
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service unavailable',
    status: 503,
  });
}

function toFieldErrors(error: ZodError): DomainErrorFields {
  const fields: DomainErrorFields = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !fields[field]) {
      fields[field] = issue.message;
    }
  }
  return fields;
}

function toAuthUser(account: AuthAccount): AuthUser {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    emailVerified: account.emailVerifiedAt !== null,
  };
}

function toSessionAuthUser(user: Awaited<
  ReturnType<SessionService['findUserByToken']>
>): AuthUser | null {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
  };
}

export class AuthService {
  constructor(
    private readonly dependencies: {
      repository: AuthRepository;
      sessions: SessionService;
      verification: VerificationService;
      password: PasswordOperations;
    },
  ) {}

  async register(input: unknown): Promise<AuthenticatedSession> {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      throw validationError(toFieldErrors(parsed.error));
    }

    const normalizedEmail = normalizeEmail(parsed.data.email);
    const passwordHash = await this.dependencies.password.hash(
      parsed.data.password,
    );
    const session = this.dependencies.sessions.prepare();
    const verification = this.dependencies.verification.prepare();
    let account: AuthAccount;
    try {
      account = await this.dependencies.repository.createRegistration({
        name: parsed.data.name,
        email: parsed.data.email,
        normalizedEmail,
        passwordHash,
      }, session, verification, () => {
        this.dependencies.verification.writeLink(verification.url);
      });
    } catch (error) {
      if (error instanceof DuplicateEmailRepositoryError) {
        throw new DomainError({
          code: 'EMAIL_TAKEN',
          message: 'An account with this email already exists',
          status: 409,
          fields: {email: 'An account with this email already exists'},
        });
      }
      throw serviceUnavailableError();
    }

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: toAuthUser(account),
    };
  }

  async login(input: unknown): Promise<AuthenticatedSession> {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      throw invalidCredentialsError();
    }

    let normalizedEmail: string;
    try {
      normalizedEmail = normalizeEmail(parsed.data.email);
    } catch {
      throw invalidCredentialsError();
    }

    const account = await this.dependencies.repository.findByNormalizedEmail(
      normalizedEmail,
    );
    const passwordMatches = await this.dependencies.password.verify(
      account?.passwordHash ?? dummyPasswordHash,
      parsed.data.password,
    );
    if (!account || !passwordMatches) {
      throw invalidCredentialsError();
    }

    const session = await this.dependencies.sessions.create(account.id);
    return {...session, user: toAuthUser(account)};
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) {
      await this.dependencies.sessions.revoke(token);
    }
  }

  async getUserBySessionToken(token: string): Promise<AuthUser | null> {
    return toSessionAuthUser(
      await this.dependencies.sessions.findUserByToken(token),
    );
  }
}

type AuthPrismaClient = Pick<PrismaClient, '$transaction' | 'user'>;

function isNormalizedEmailUniqueConstraintError(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  const target = error.meta?.target;
  const isUserConstraint = error.meta?.modelName === 'User';
  if (Array.isArray(target)) {
    return isUserConstraint && target.includes('normalizedEmail');
  }
  if (typeof target === 'string') {
    return isUserConstraint && target.includes('normalizedEmail');
  }
  return isUserConstraint;
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly database: AuthPrismaClient) {}

  async createRegistration(input: {
    name: string;
    email: string;
    normalizedEmail: string;
    passwordHash: string;
  }, session: Pick<PreparedSession, 'tokenHash' | 'expiresAt'>,
  verification: Pick<PreparedVerification, 'tokenHash' | 'expiresAt'>,
  beforeCommit: () => void):
    Promise<AuthAccount> {
    try {
      return await this.database.$transaction(async (transaction) => {
        const account = await transaction.user.create({data: input});
        await transaction.session.create({
          data: {
            tokenHash: session.tokenHash,
            userId: account.id,
            expiresAt: session.expiresAt,
          },
        });
        await transaction.verificationToken.create({
          data: {
            tokenHash: verification.tokenHash,
            userId: account.id,
            expiresAt: verification.expiresAt,
          },
        });
        beforeCommit();
        return account;
      });
    } catch (error) {
      if (isNormalizedEmailUniqueConstraintError(error)) {
        throw new DuplicateEmailRepositoryError();
      }
      throw error;
    }
  }

  async findByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<AuthAccount | null> {
    return this.database.user.findUnique({where: {normalizedEmail}});
  }
}

const systemClock: Clock = {
  now: () => new Date(),
};

let defaultService: Promise<AuthService> | undefined;

async function getDefaultService(): Promise<AuthService> {
  if (!defaultService) {
    defaultService = import('../../lib/db/prisma').then(({prisma}) => {
      const env = readAppEnv();
      return new AuthService({
        repository: new PrismaAuthRepository(prisma),
        sessions: new OpaqueSessionService({
          repository: new PrismaSessionRepository(prisma),
          clock: systemClock,
          sessionDays: env.sessionDays,
        }),
        verification: new DefaultVerificationService({
          repository: new PrismaVerificationRepository(prisma),
          clock: systemClock,
          appUrl: env.appUrl,
          writer: developmentVerificationLinkWriter,
        }),
        password: {
          hash: hashPassword,
          verify: verifyPassword,
        },
      });
    });
  }
  return defaultService;
}

async function readSessionToken(request?: Request): Promise<string | undefined> {
  if (request) {
    return new NextRequest(request).cookies.get(sessionCookieName)?.value;
  }
  return (await cookies()).get(sessionCookieName)?.value;
}

export async function register(
  input: RegisterInput | unknown,
): Promise<AuthenticatedSession> {
  return (await getDefaultService()).register(input);
}

export async function login(
  input: LoginInput | unknown,
): Promise<AuthenticatedSession> {
  return (await getDefaultService()).login(input);
}

export async function logout(token: string | undefined): Promise<void> {
  await (await getDefaultService()).logout(token);
}

export async function getUserBySessionToken(
  token: string,
): Promise<AuthUser | null> {
  return (await getDefaultService()).getUserBySessionToken(token);
}

export async function getOptionalUser(
  request?: Request,
): Promise<AuthUser | null> {
  const token = await readSessionToken(request);
  return token ? getUserBySessionToken(token) : null;
}

export async function requireUser(request?: Request): Promise<AuthUser> {
  const user = await getOptionalUser(request);
  if (!user) {
    throw new DomainError({
      code: 'AUTH_REQUIRED',
      message: 'Authentication is required',
      status: 401,
    });
  }
  return user;
}
