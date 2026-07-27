import {createHash, randomBytes} from 'node:crypto';
import {Prisma, type PrismaClient} from '@prisma/client';
import {readAppEnv} from '../../lib/config/env';
import {DomainError} from '../../lib/http/domain-error';
import type {Clock} from '../../lib/time/office-time';

const verificationLifetimeMilliseconds = 24 * 60 * 60 * 1_000;
const rawTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export type VerificationLinkWriter = {
  write(url: string): void;
};

export type PreparedVerification = {
  tokenHash: string;
  url: string;
  expiresAt: Date;
};

export interface VerificationService {
  prepare(): PreparedVerification;
  writeLink(url: string): void;
  verify(rawToken: string): Promise<void>;
}

export interface VerificationRepository {
  consumeAndVerify(input: {
    tokenHash: string;
    consumedAt: Date;
  }): Promise<boolean>;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function invalidOrExpiredError(): DomainError {
  return new DomainError({
    code: 'VERIFICATION_INVALID_OR_EXPIRED',
    message: 'Verification link is invalid or expired',
    status: 410,
  });
}

function serviceUnavailableError(): DomainError {
  return new DomainError({
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service unavailable',
    status: 503,
  });
}

export class DefaultVerificationService implements VerificationService {
  constructor(
    private readonly dependencies: {
      repository: VerificationRepository;
      clock: Clock;
      appUrl: string;
      writer: VerificationLinkWriter;
    },
  ) {}

  prepare(): PreparedVerification {
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      this.dependencies.clock.now().getTime() +
      verificationLifetimeMilliseconds,
    );
    const verificationUrl = new URL('/verify', this.dependencies.appUrl);
    verificationUrl.searchParams.set('token', rawToken);
    return {
      tokenHash: hashToken(rawToken),
      url: verificationUrl.toString(),
      expiresAt,
    };
  }

  writeLink(url: string): void {
    try {
      this.dependencies.writer.write(url);
    } catch {
      throw serviceUnavailableError();
    }
  }

  async verify(rawToken: string): Promise<void> {
    if (!rawTokenPattern.test(rawToken)) {
      throw invalidOrExpiredError();
    }

    let verified: boolean;
    try {
      verified = await this.dependencies.repository.consumeAndVerify({
        tokenHash: hashToken(rawToken),
        consumedAt: this.dependencies.clock.now(),
      });
    } catch {
      throw serviceUnavailableError();
    }
    if (!verified) {
      throw invalidOrExpiredError();
    }
  }
}

type VerificationPrismaClient = Pick<PrismaClient, '$transaction'>;

export class PrismaVerificationRepository implements VerificationRepository {
  constructor(private readonly database: VerificationPrismaClient) {}

  async consumeAndVerify(input: {
    tokenHash: string;
    consumedAt: Date;
  }): Promise<boolean> {
    return this.database.$transaction(async (transaction) => {
      const verifiedUsers = await transaction.$queryRaw<Array<{id: string}>>(
        Prisma.sql`
          WITH "consumed" AS (
            UPDATE "VerificationToken"
            SET "consumedAt" = ${input.consumedAt}
            WHERE "tokenHash" = ${input.tokenHash}
              AND "consumedAt" IS NULL
              AND "expiresAt" > ${input.consumedAt}
            RETURNING "userId"
          )
          UPDATE "User" AS "user"
          SET
            "emailVerifiedAt" = COALESCE(
              "user"."emailVerifiedAt",
              ${input.consumedAt}
            ),
            "updatedAt" = ${input.consumedAt}
          FROM "consumed"
          WHERE "user"."id" = "consumed"."userId"
          RETURNING "user"."id"
        `,
      );
      return verifiedUsers.length === 1;
    });
  }
}

const systemClock: Clock = {
  now: () => new Date(),
};

export const developmentVerificationLinkWriter: VerificationLinkWriter = {
  write: (url) => console.info(url),
};

let defaultService: Promise<VerificationService> | undefined;

async function getDefaultService(): Promise<VerificationService> {
  if (!defaultService) {
    defaultService = import('../../lib/db/prisma').then(({prisma}) => {
      const env = readAppEnv();
      return new DefaultVerificationService({
        repository: new PrismaVerificationRepository(prisma),
        clock: systemClock,
        appUrl: env.appUrl,
        writer: developmentVerificationLinkWriter,
      });
    });
  }
  return defaultService;
}

export async function verifyEmailToken(rawToken: string): Promise<void> {
  await (await getDefaultService()).verify(rawToken);
}
