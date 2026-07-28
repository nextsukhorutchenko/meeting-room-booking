import {describe, expect, it, vi} from 'vitest';
import {
  approveCleanStartTargets,
  CLEAN_START_MUTATION_CONSENT,
  CLEAN_START_TARGET_ERROR,
  runCleanStartVerification,
  type CleanStartDependencies,
  type CleanStartEnvironment,
} from '../../scripts/verify-clean-start';

const baseEnvironment = {
  APP_URL: 'http://localhost:3000',
  DATABASE_URL:
    'postgresql://meeting_room_booking:password@localhost:5432/' +
    'meeting_room_booking?schema=public',
  NOTIFY_BEFORE_MINUTES: '10',
  OFFICE_CLOSE_HOUR: '19',
  OFFICE_OPEN_HOUR: '9',
  OFFICE_TIMEZONE: 'Europe/Kyiv',
  SESSION_DAYS: '7',
  [CLEAN_START_MUTATION_CONSENT]:
    'database=postgresql://localhost:5432/meeting_room_booking;' +
    'app=http://localhost:3000',
} satisfies CleanStartEnvironment;

function hazardousDependencies(): {
  dependencies: CleanStartDependencies;
  createDatabase: ReturnType<typeof vi.fn>;
  fetch: ReturnType<typeof vi.fn>;
  runNodeScript: ReturnType<typeof vi.fn>;
} {
  const createDatabase = vi.fn(() => {
    throw new Error('database client must not be created');
  });
  const fetch = vi.fn(async () => new Response());
  const runNodeScript = vi.fn(async () => {});
  return {
    dependencies: {
      createDatabase,
      fetch,
      runNodeScript,
    },
    createDatabase,
    fetch,
    runNodeScript,
  };
}

describe('clean-start target approval', () => {
  it('canonically binds the exact local database and app targets', () => {
    expect(approveCleanStartTargets({
      ...baseEnvironment,
      APP_URL: 'http://[::1]:3100',
      DATABASE_URL:
        'postgres://user:password@127.0.0.1:55432/' +
        'meeting_room_booking_test?schema=public',
      [CLEAN_START_MUTATION_CONSENT]:
        'database=postgresql://127.0.0.1:55432/' +
        'meeting_room_booking_test;app=http://[::1]:3100',
    })).toMatchObject({
      appOrigin: 'http://[::1]:3100',
      databaseTarget:
        'postgresql://127.0.0.1:55432/meeting_room_booking_test',
    });
  });

  it.each([
    {
      name: 'non-local database',
      environment: {DATABASE_URL:
        'postgresql://user:password@db.example.com/meeting_room_booking'},
    },
    {
      name: 'unapproved database name',
      environment: {DATABASE_URL:
        'postgresql://user:password@localhost/postgres'},
    },
    {
      name: 'malformed database URL',
      environment: {DATABASE_URL: 'not a database URL'},
    },
    {
      name: 'database query target override',
      environment: {DATABASE_URL:
        'postgresql://user:password@localhost/meeting_room_booking' +
        '?schema=public&host=db.example.com'},
    },
    {
      name: 'non-local app',
      environment: {APP_URL: 'http://app.example.com:3000'},
    },
    {
      name: 'HTTPS app',
      environment: {APP_URL: 'https://localhost:3000'},
    },
    {
      name: 'app URL with a path',
      environment: {APP_URL: 'http://localhost:3000/admin'},
    },
    {
      name: 'missing consent',
      environment: {[CLEAN_START_MUTATION_CONSENT]: undefined},
    },
    {
      name: 'boolean consent',
      environment: {[CLEAN_START_MUTATION_CONSENT]: 'true'},
    },
    {
      name: 'wildcard consent',
      environment: {[CLEAN_START_MUTATION_CONSENT]: '*'},
    },
    {
      name: 'mismatched consent',
      environment: {[CLEAN_START_MUTATION_CONSENT]:
        'database=postgresql://localhost:5433/meeting_room_booking;' +
        'app=http://localhost:3000'},
    },
  ])('rejects $name before hazardous operations', async ({environment}) => {
    const {
      dependencies,
      createDatabase,
      fetch,
      runNodeScript,
    } = hazardousDependencies();

    await expect(runCleanStartVerification({
      dependencies,
      environment: {...baseEnvironment, ...environment},
    })).rejects.toMatchObject({message: CLEAN_START_TARGET_ERROR});

    expect(createDatabase).not.toHaveBeenCalled();
    expect(runNodeScript).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
