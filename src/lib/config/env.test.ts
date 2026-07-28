import {describe, expect, it} from 'vitest';
import {readAppEnv} from './env';

describe('readAppEnv', () => {
  it('uses the documented office defaults', () => {
    const env = readAppEnv({
      DATABASE_URL: 'postgresql://example',
      APP_URL: 'http://localhost:3000',
      APP_DEPLOYMENT_MODE: 'local-development',
      VERIFICATION_DELIVERY_MODE: 'console',
    });

    expect(env.officeTimeZone).toBe('Europe/Kyiv');
    expect(env.officeOpenHour).toBe(9);
    expect(env.officeCloseHour).toBe(19);
    expect(env.notifyBeforeMinutes).toBe(10);
    expect(env.verificationDelivery).toEqual({mode: 'console'});
  });

  it('requires an explicit verification delivery mode', () => {
    expect(() =>
      readAppEnv({
        DATABASE_URL: 'postgresql://example',
        APP_URL: 'http://localhost:3000',
        APP_DEPLOYMENT_MODE: 'local-development',
      }),
    ).toThrow('VERIFICATION_DELIVERY_MODE');
  });

  it('rejects console verification delivery for non-local production', () => {
    expect(() =>
      readAppEnv({
        DATABASE_URL: 'postgresql://example',
        APP_URL: 'https://booking.example.com',
        APP_DEPLOYMENT_MODE: 'production',
        VERIFICATION_DELIVERY_MODE: 'console',
      }),
    ).toThrow(
      'Console verification delivery is restricted to local development',
    );
  });

  it('rejects console verification delivery in production on loopback', () => {
    expect(() =>
      readAppEnv({
        DATABASE_URL: 'postgresql://example',
        APP_URL: 'http://localhost:3000',
        APP_DEPLOYMENT_MODE: 'production',
        VERIFICATION_DELIVERY_MODE: 'console',
      }),
    ).toThrow(
      'Console verification delivery is restricted to local development',
    );
  });

  it('requires complete webhook verification delivery configuration', () => {
    expect(() =>
      readAppEnv({
        DATABASE_URL: 'postgresql://example',
        APP_URL: 'https://booking.example.com',
        APP_DEPLOYMENT_MODE: 'production',
        VERIFICATION_DELIVERY_MODE: 'webhook',
        VERIFICATION_WEBHOOK_URL: 'https://mail.example.com/verification',
      }),
    ).toThrow('VERIFICATION_WEBHOOK_BEARER_TOKEN');
  });

  it('rejects a closing hour that is not later than opening hour', () => {
    expect(() =>
      readAppEnv({
        DATABASE_URL: 'postgresql://example',
        APP_URL: 'http://localhost:3000',
        APP_DEPLOYMENT_MODE: 'local-development',
        VERIFICATION_DELIVERY_MODE: 'console',
        OFFICE_OPEN_HOUR: '19',
        OFFICE_CLOSE_HOUR: '9',
      }),
    ).toThrow('OFFICE_CLOSE_HOUR must be later than OFFICE_OPEN_HOUR');
  });

  it('rejects an invalid office IANA timezone with a stable error', () => {
    expect(() =>
      readAppEnv({
        DATABASE_URL: 'postgresql://example',
        APP_URL: 'http://localhost:3000',
        APP_DEPLOYMENT_MODE: 'local-development',
        VERIFICATION_DELIVERY_MODE: 'console',
        OFFICE_TIMEZONE: 'Not/A_Timezone',
      }),
    ).toThrow('OFFICE_TIMEZONE must be a valid IANA timezone');
  });

  it('rejects a zero notification lead with a stable error', () => {
    expect(() =>
      readAppEnv({
        DATABASE_URL: 'postgresql://example',
        APP_URL: 'http://localhost:3000',
        APP_DEPLOYMENT_MODE: 'local-development',
        VERIFICATION_DELIVERY_MODE: 'console',
        NOTIFY_BEFORE_MINUTES: '0',
      }),
    ).toThrow('NOTIFY_BEFORE_MINUTES must be greater than 0');
  });
});
