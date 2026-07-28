import {resetTestDatabase} from '../../scripts/reset-test-db';

export async function setup(): Promise<void> {
  await resetTestDatabase();
}
