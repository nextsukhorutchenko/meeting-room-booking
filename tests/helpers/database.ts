import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {
  assertTestDatabaseUrl,
  resetTestDatabase as resetDatabase,
} from '../../scripts/reset-test-db';

function getTestDatabaseUrl(): string {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL must be set for integration tests');
  }
  assertTestDatabaseUrl(databaseUrl);
  return databaseUrl;
}

const testDatabaseUrl = getTestDatabaseUrl();

export const testDb = new PrismaClient({
  adapter: new PrismaPg({connectionString: testDatabaseUrl}),
});

export async function resetTestDatabase(): Promise<void> {
  await resetDatabase();
}

export async function disconnectTestDatabase(): Promise<void> {
  await testDb.$disconnect();
}
