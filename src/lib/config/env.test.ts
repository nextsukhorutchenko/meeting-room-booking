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
});
