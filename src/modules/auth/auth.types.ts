export type AuthUser = {
  id: string;
  name: string;
  email: string;
  normalizedEmail: string;
  emailVerifiedAt: Date | null;
};

export type CreatedSession = {
  token: string;
  expiresAt: Date;
};

export type PreparedSession = CreatedSession & {
  tokenHash: string;
};

export type SessionRecord = {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  user: AuthUser;
};

export interface SessionRepository {
  create(session: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
}

export interface SessionService {
  prepare(): PreparedSession;
  create(userId: string): Promise<CreatedSession>;
  findUserByToken(token: string): Promise<AuthUser | null>;
  revoke(token: string): Promise<void>;
}
