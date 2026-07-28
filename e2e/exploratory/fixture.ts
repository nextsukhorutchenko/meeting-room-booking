import {
  PlaywrightAiFixture,
  type PlayWrightAiFixtureType,
} from '@midscene/web/playwright';
import {test as deterministicTest} from '../fixtures';

export const test = deterministicTest.extend<PlayWrightAiFixtureType>(
  PlaywrightAiFixture({waitForNetworkIdleTimeout: 1_000}),
);
