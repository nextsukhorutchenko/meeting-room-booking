import {beforeEach} from 'vitest';
import {testDb} from '../helpers/database';

beforeEach(async () => {
  await testDb.authRateLimitBucket.deleteMany();
});
