import {createHash, randomBytes} from 'node:crypto';
import type {PrismaClient} from '@prisma/client';
import type {Clock} from '../../lib/time/office-time';
import type {
  AuthUser,
  CreatedSession,
  SessionRecord,
  SessionRepository,
  SessionService,
} from './auth.types';

const millisecondsPerDay = 24 * 60 * 60 * 1_000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toAuthUser(user: AuthUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    normalizedEmail: user.normalizedEmail,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

export class OpaqueSessionService implements SessionService {
  constructor(
    private readonly dependencies: {
      repository: SessionRepository;
      clock: Clock;
      sessionDays: number;
    },
  ) {}

  async create(userId: string): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      this.dependencies.clock.now().getTime() +
      this.dependencies.sessionDays * millisecondsPerDay,
    );

    await this.dependencies.repository.create({
      tokenHash: hashToken(token),
      userId,
      expiresAt,
    });

    return {token, expiresAt};
  }

  async findUserByToken(token: string): Promise<AuthUser | null> {
    const tokenHash = hashToken(token);
    const session = await this.dependencies.repository.findByTokenHash(tokenHash);
    if (!session) {
      return null;
    }

    if (session.expiresAt <= this.dependencies.clock.now()) {
      await this.dependencies.repository.deleteByTokenHash(tokenHash);
      return null;
    }

    return toAuthUser(session.user);
  }

  async revoke(token: string): Promise<void> {
    await this.dependencies.repository.deleteByTokenHash(hashToken(token));
  }
}

type SessionPrismaClient = Pick<PrismaClient, 'session'>;

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: SessionPrismaClient) {}

  async create(session: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.session.create({data: session});
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const session = await this.prisma.session.findUnique({
      where: {tokenHash},
      include: {user: true},
    });
    if (!session) {
      return null;
    }

    return {
      tokenHash: session.tokenHash,
      userId: session.userId,
      expiresAt: session.expiresAt,
      user: toAuthUser(session.user),
    };
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.session.deleteMany({where: {tokenHash}});
  }
}
