export type DatabaseBackedTestCommand = 'integration' | 'e2e';

type EnvironmentSource =
  Readonly<Record<string, string | undefined>>;

function commandLabel(command: DatabaseBackedTestCommand): string {
  return `npm run test:${command}`;
}

export function requireTestDatabaseUrl(
  source: EnvironmentSource,
  command: DatabaseBackedTestCommand,
): string {
  const databaseUrl = source.TEST_DATABASE_URL?.trim();
  const label = commandLabel(command);
  if (!databaseUrl) {
    throw new Error(`TEST_DATABASE_URL must be set for ${label}`);
  }

  let databaseName: string;
  try {
    databaseName = new URL(databaseUrl).pathname.slice(1);
  } catch {
    throw new Error(`TEST_DATABASE_URL must be a valid URL for ${label}`);
  }

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to use non-test database for ${label}: ${databaseName}`,
    );
  }

  return databaseUrl;
}
