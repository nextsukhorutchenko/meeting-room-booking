import {describe, expect, it} from 'vitest';
import {readAppEnv} from './env';

describe('readAppEnv', () => {
  it('uses the documented office defaults', () => {
    const env = readAppEnv({
      DATABASE_URL: 'postgresql://example',
      APP_URL: 'http://localhost:3000',
    });

    expect(env.officeTimeZone).toBe('Europe/Kyiv');
    expect(env.officeOpenHour).toBe(9);
    expect(env.officeCloseHour).toBe(19);
    expect(env.notifyBeforeMinutes).toBe(10);
  });

  it('rejects a closing hour that is not later than opening hour', () => {
    expect(() =>
      readAppEnv({
        DATABASE_URL: 'postgresql://example',
        APP_URL: 'http://localhost:3000',
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
        OFFICE_TIMEZONE: 'Not/A_Timezone',
      }),
    ).toThrow('OFFICE_TIMEZONE must be a valid IANA timezone');
  });

  it('rejects a zero notification lead with a stable error', () => {
    expect(() =>
      readAppEnv({
        DATABASE_URL: 'postgresql://example',
        APP_URL: 'http://localhost:3000',
        NOTIFY_BEFORE_MINUTES: '0',
      }),
    ).toThrow('NOTIFY_BEFORE_MINUTES must be greater than 0');
  });
});
