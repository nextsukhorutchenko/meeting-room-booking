export type DomainErrorCode =
  | 'AUTH_REQUIRED'
  | 'EMAIL_TAKEN'
  | 'EMAIL_NOT_VERIFIED'
  | 'FORBIDDEN_ORIGIN'
  | 'INVALID_CREDENTIALS'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'VALIDATION_FAILED'
  | 'ROOM_NOT_FOUND'
  | 'BOOKING_IN_PAST'
  | 'BOOKING_OUTSIDE_OFFICE_HOURS'
  | 'BOOKING_CONFLICT'
  | 'BOOKING_FORBIDDEN'
  | 'BOOKING_NOT_FOUND'
  | 'SERVICE_UNAVAILABLE'
  | 'VERIFICATION_INVALID_OR_EXPIRED';

export type DomainErrorFields = Record<string, string>;

export type DomainErrorOptions = {
  code: DomainErrorCode;
  message: string;
  status: number;
  fields?: DomainErrorFields;
  retryAfterSeconds?: number;
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly status: number;
  readonly fields?: DomainErrorFields;
  readonly retryAfterSeconds?: number;

  constructor({
    code,
    message,
    status,
    fields,
    retryAfterSeconds,
  }: DomainErrorOptions) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
