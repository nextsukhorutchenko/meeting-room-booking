import {describe, expect, it} from 'vitest';
import {
  requireTestDatabaseUrl,
  type DatabaseBackedTestCommand,
} from '../../test-config/test-database';

const commands: DatabaseBackedTestCommand[] = ['integration', 'e2e'];

describe('database-backed test preflight', () => {
  it.each(commands)('requires TEST_DATABASE_URL for %s', (command) => {
    expect(() => requireTestDatabaseUrl({
      DATABASE_URL: 'postgresql://localhost/meeting_room_booking',
    }, command)).toThrow(
      `TEST_DATABASE_URL must be set for npm run test:${command}`,
    );
  });

  it('rejects a normal database', () => {
    expect(() => requireTestDatabaseUrl({
      TEST_DATABASE_URL: 'postgresql://localhost/meeting_room_booking',
    }, 'integration')).toThrow(
      'Refusing to use non-test database for npm run test:integration: ' +
      'meeting_room_booking',
    );
  });

  it('rejects a malformed test database URL', () => {
    expect(() => requireTestDatabaseUrl({
      TEST_DATABASE_URL: 'not-a-url',
    }, 'e2e')).toThrow(
      'TEST_DATABASE_URL must be a valid URL for npm run test:e2e',
    );
  });

  it('returns an explicit test URL without consulting DATABASE_URL', () => {
    const testDatabaseUrl =
      'postgresql://localhost/meeting_room_booking_test?schema=public';

    expect(requireTestDatabaseUrl({
      DATABASE_URL: 'postgresql://localhost/meeting_room_booking',
      TEST_DATABASE_URL: testDatabaseUrl,
    }, 'e2e')).toBe(testDatabaseUrl);
  });
});
