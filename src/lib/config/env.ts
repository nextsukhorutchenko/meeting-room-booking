import {z} from 'zod';

export type AppEnv = {
  databaseUrl: string;
  appUrl: string;
  officeTimeZone: string;
  officeOpenHour: number;
  officeCloseHour: number;
  sessionDays: number;
  notifyBeforeMinutes: number;
};

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
    NOTIFY_BEFORE_MINUTES: z.coerce.number().int().nonnegative().default(10),
  })
  .superRefine((value, context) => {
    if (value.OFFICE_CLOSE_HOUR <= value.OFFICE_OPEN_HOUR) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OFFICE_CLOSE_HOUR must be later than OFFICE_OPEN_HOUR',
        path: ['OFFICE_CLOSE_HOUR'],
      });
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

  return {
    databaseUrl: env.DATABASE_URL,
    appUrl: env.APP_URL,
    officeTimeZone: env.OFFICE_TIMEZONE,
    officeOpenHour: env.OFFICE_OPEN_HOUR,
    officeCloseHour: env.OFFICE_CLOSE_HOUR,
    sessionDays: env.SESSION_DAYS,
    notifyBeforeMinutes: env.NOTIFY_BEFORE_MINUTES,
  };
}
