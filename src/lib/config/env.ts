import {z} from 'zod';

export type VerificationDeliveryConfig =
  | {mode: 'console'}
  | {
    mode: 'webhook';
    url: string;
    bearerToken: string;
  };

export type AppEnv = {
  databaseUrl: string;
  appUrl: string;
  officeTimeZone: string;
  officeOpenHour: number;
  officeCloseHour: number;
  sessionDays: number;
  notifyBeforeMinutes: number;
  notificationLeaseSeconds: number;
  authRequestBodyMaxBytes: number;
  authClientIpHeader: string;
  authRateLimitWindowSeconds: number;
  authLoginIpLimit: number;
  authLoginIdentityLimit: number;
  authRegisterIpLimit: number;
  authRegisterIdentityLimit: number;
  verificationDelivery: VerificationDeliveryConfig;
};

function isLoopbackUrl(value: string): boolean {
  const hostname = new URL(value).hostname;
  return hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]';
}

const appEnvSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    APP_URL: z.string().url(),
    OFFICE_TIMEZONE: z.string()
      .min(1)
      .refine((timeZone) => {
        try {
          new Intl.DateTimeFormat('en-US', {timeZone});
          return true;
        } catch {
          return false;
        }
      }, 'OFFICE_TIMEZONE must be a valid IANA timezone')
      .default('Europe/Kyiv'),
    OFFICE_OPEN_HOUR: z.coerce.number().int().min(0).max(23).default(9),
    OFFICE_CLOSE_HOUR: z.coerce.number().int().min(1).max(24).default(19),
    SESSION_DAYS: z.coerce.number().int().positive().default(7),
    NOTIFY_BEFORE_MINUTES: z.coerce
      .number()
      .int()
      .positive('NOTIFY_BEFORE_MINUTES must be greater than 0')
      .default(10),
    NOTIFICATION_LEASE_SECONDS: z.coerce
      .number()
      .int()
      .min(5)
      .max(300)
      .default(30),
    AUTH_REQUEST_BODY_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(65_536)
      .default(8_192),
    AUTH_CLIENT_IP_HEADER: z.string()
      .regex(/^[a-z0-9-]+$/i)
      .default('x-forwarded-for'),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .max(3_600)
      .default(60),
    AUTH_LOGIN_IP_LIMIT: z.coerce.number().int().positive().default(30),
    AUTH_LOGIN_IDENTITY_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    AUTH_REGISTER_IP_LIMIT: z.coerce.number().int().positive().default(10),
    AUTH_REGISTER_IDENTITY_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .default(5),
    APP_DEPLOYMENT_MODE: z.enum(['local-development', 'production']),
    VERIFICATION_DELIVERY_MODE: z.enum(['console', 'webhook']),
    VERIFICATION_WEBHOOK_URL: z.preprocess(
      (value) => value === '' ? undefined : value,
      z.string().url().optional(),
    ),
    VERIFICATION_WEBHOOK_BEARER_TOKEN: z.preprocess(
      (value) => value === '' ? undefined : value,
      z.string().min(1).optional(),
    ),
  })
  .superRefine((value, context) => {
    if (value.OFFICE_CLOSE_HOUR <= value.OFFICE_OPEN_HOUR) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OFFICE_CLOSE_HOUR must be later than OFFICE_OPEN_HOUR',
        path: ['OFFICE_CLOSE_HOUR'],
      });
    }
    if (
      value.VERIFICATION_DELIVERY_MODE === 'console' &&
      (
        value.APP_DEPLOYMENT_MODE !== 'local-development' ||
        !isLoopbackUrl(value.APP_URL)
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Console verification delivery is restricted to local development',
        path: ['VERIFICATION_DELIVERY_MODE'],
      });
    }
    if (value.VERIFICATION_DELIVERY_MODE === 'webhook') {
      if (!value.VERIFICATION_WEBHOOK_URL) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'VERIFICATION_WEBHOOK_URL is required for webhook delivery',
          path: ['VERIFICATION_WEBHOOK_URL'],
        });
      } else if (new URL(value.VERIFICATION_WEBHOOK_URL).protocol !== 'https:') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'VERIFICATION_WEBHOOK_URL must use HTTPS',
          path: ['VERIFICATION_WEBHOOK_URL'],
        });
      }
      if (!value.VERIFICATION_WEBHOOK_BEARER_TOKEN) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'VERIFICATION_WEBHOOK_BEARER_TOKEN is required for webhook delivery',
          path: ['VERIFICATION_WEBHOOK_BEARER_TOKEN'],
        });
      }
    }
  });

export function readAppEnv(source?: NodeJS.ProcessEnv): AppEnv;
export function readAppEnv(
  source?: Record<string, string | undefined>,
): AppEnv;
export function readAppEnv(
  source: Record<string, string | undefined> = process.env,
): AppEnv {
  const env = appEnvSchema.parse(source);
  const verificationDelivery: VerificationDeliveryConfig =
    env.VERIFICATION_DELIVERY_MODE === 'console' ?
      {mode: 'console'} :
      {
        mode: 'webhook',
        url: env.VERIFICATION_WEBHOOK_URL as string,
        bearerToken: env.VERIFICATION_WEBHOOK_BEARER_TOKEN as string,
      };

  return {
    databaseUrl: env.DATABASE_URL,
    appUrl: env.APP_URL,
    officeTimeZone: env.OFFICE_TIMEZONE,
    officeOpenHour: env.OFFICE_OPEN_HOUR,
    officeCloseHour: env.OFFICE_CLOSE_HOUR,
    sessionDays: env.SESSION_DAYS,
    notifyBeforeMinutes: env.NOTIFY_BEFORE_MINUTES,
    notificationLeaseSeconds: env.NOTIFICATION_LEASE_SECONDS,
    authRequestBodyMaxBytes: env.AUTH_REQUEST_BODY_MAX_BYTES,
    authClientIpHeader: env.AUTH_CLIENT_IP_HEADER,
    authRateLimitWindowSeconds: env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    authLoginIpLimit: env.AUTH_LOGIN_IP_LIMIT,
    authLoginIdentityLimit: env.AUTH_LOGIN_IDENTITY_LIMIT,
    authRegisterIpLimit: env.AUTH_REGISTER_IP_LIMIT,
    authRegisterIdentityLimit: env.AUTH_REGISTER_IDENTITY_LIMIT,
    verificationDelivery,
  };
}
