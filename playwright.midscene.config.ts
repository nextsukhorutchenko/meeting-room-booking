import {config as loadEnvironment} from 'dotenv';
import {createExploratoryPlaywrightConfig} from './test-config/playwright-configs';

loadEnvironment({path: '.env', quiet: true});

const baseUrl = process.env.APP_URL ?? 'http://127.0.0.1:3106';
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL must be set for Midscene exploratory tests',
  );
}
export default createExploratoryPlaywrightConfig({
  baseUrl,
  testDatabaseUrl,
});
