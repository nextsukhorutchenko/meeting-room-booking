import {assertTestDatabaseUrl} from '../scripts/reset-test-db';

export function readTestSeedDatabaseUrl(
  source: Record<string, string | undefined> = process.env,
): string {
  const databaseUrl = source.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL must be set to seed the test database');
  }
  assertTestDatabaseUrl(databaseUrl);
  return databaseUrl;
}
