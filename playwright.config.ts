import {config as loadEnvironment} from 'dotenv';
import {createDeterministicPlaywrightConfig} from './test-config/playwright-configs';

loadEnvironment({path: '.env', quiet: true});

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must be set for Playwright tests');
}

export default createDeterministicPlaywrightConfig();
