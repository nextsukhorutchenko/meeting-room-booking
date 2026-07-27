import {mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {test as setup} from '@playwright/test';
import {loginAsDemoUser} from './fixtures';

const authStatePath = 'test-results/.auth/demo-user.json';

setup('authenticates the reusable demo browser state', async ({page}) => {
  await loginAsDemoUser(page);
  await mkdir(dirname(authStatePath), {recursive: true});
  await page.context().storageState({path: authStatePath});
});
