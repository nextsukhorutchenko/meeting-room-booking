import {createHash, randomBytes} from 'node:crypto';
import {Prisma, type PrismaClient} from '@prisma/client';
import {
  readAppEnv,
  type VerificationDeliveryConfig,
} from '../../lib/config/env';
import {DomainError} from '../../lib/http/domain-error';
import type {Clock} from '../../lib/time/office-time';

const verificationLifetimeMilliseconds = 24 * 60 * 60 * 1_000;
const rawTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export type VerificationLinkWriter = {
  write(delivery: VerificationDelivery): Promise<void> | void;
};

export type VerificationRecipient = {
  email: string;
  name: string;
};

export type VerificationDelivery = {
  expiresAt: Date;
  recipient: VerificationRecipient;
  url: string;
};

export type PreparedVerification = {
  tokenHash: string;
  url: string;
  expiresAt: Date;
};

export interface VerificationService {
  issue(
    userId: string,
    recipient: VerificationRecipient,
  ): Promise<{url: string; expiresAt: Date}>;
  verify(rawToken: string): Promise<void>;
}

export interface RegistrationVerificationService extends VerificationService {
  prepare(): PreparedVerification;
  deliver(
    prepared: Pick<PreparedVerification, 'expiresAt' | 'url'>,
    recipient: VerificationRecipient,
  ): Promise<void>;
}

export interface VerificationRepository {
  create(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void>;
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

export class DefaultVerificationService
  implements RegistrationVerificationService {
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

  async deliver(
    prepared: Pick<PreparedVerification, 'expiresAt' | 'url'>,
    recipient: VerificationRecipient,
  ): Promise<void> {
    try {
      await this.dependencies.writer.write({
        expiresAt: prepared.expiresAt,
        recipient,
        url: prepared.url,
      });
    } catch {
      throw serviceUnavailableError();
    }
  }

  async issue(
    userId: string,
    recipient: VerificationRecipient,
  ): Promise<{url: string; expiresAt: Date}> {
    const prepared = this.prepare();
    try {
      await this.dependencies.repository.create({
        tokenHash: prepared.tokenHash,
        userId,
        expiresAt: prepared.expiresAt,
      });
    } catch {
      throw serviceUnavailableError();
    }
    await this.deliver(prepared, recipient);
    return {url: prepared.url, expiresAt: prepared.expiresAt};
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

  async create(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.$transaction((transaction) =>
      transaction.verificationToken.create({data: input}).then(() => undefined),
    );
  }

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

type VerificationFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export function createVerificationLinkWriter(
  config: VerificationDeliveryConfig,
  fetcher: VerificationFetch = fetch,
): VerificationLinkWriter {
  if (config.mode === 'console') {
    return {
      write: ({url}) => console.info(url),
    };
  }
  return {
    write: async (delivery) => {
      const response = await fetcher(config.url, {
        body: JSON.stringify({
          expiresAt: delivery.expiresAt.toISOString(),
          recipientEmail: delivery.recipient.email,
          recipientName: delivery.recipient.name,
          verificationUrl: delivery.url,
        }),
        headers: {
          authorization: `Bearer ${config.bearerToken}`,
          'content-type': 'application/json',
        },
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error('Verification delivery webhook rejected the request');
      }
    },
  };
}

let defaultService: Promise<VerificationService> | undefined;

async function getDefaultService(): Promise<VerificationService> {
  if (!defaultService) {
    defaultService = import('../../lib/db/prisma').then(({prisma}) => {
      const env = readAppEnv();
      return new DefaultVerificationService({
        repository: new PrismaVerificationRepository(prisma),
        clock: systemClock,
        appUrl: env.appUrl,
        writer: createVerificationLinkWriter(env.verificationDelivery),
      });
    });
  }
  return defaultService;
}

export async function verifyEmailToken(rawToken: string): Promise<void> {
  await (await getDefaultService()).verify(rawToken);
}
