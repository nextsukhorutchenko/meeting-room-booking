import 'dotenv/config';
import {
  requireTestDatabaseUrl,
  type DatabaseBackedTestCommand,
} from '../test-config/test-database';

function readCommand(value: string | undefined):
    DatabaseBackedTestCommand {
  if (value === 'integration' || value === 'e2e') {
    return value;
  }
  throw new Error(
    'Database test preflight expects "integration" or "e2e"',
  );
}

try {
  if (process.argv.length !== 3) {
    throw new Error(
      'Database test preflight expects "integration" or "e2e"',
    );
  }
  requireTestDatabaseUrl(process.env, readCommand(process.argv[2]));
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : 'Preflight failed');
  process.exitCode = 1;
}
