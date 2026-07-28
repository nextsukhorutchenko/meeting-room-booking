import {cpSync, existsSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

const source = resolve('.next/static');
const destination = resolve('.next/standalone/.next/static');

if (!existsSync(source)) {
  throw new Error('Next static assets are missing; run next build first');
}

mkdirSync(destination, {recursive: true});
cpSync(source, destination, {recursive: true});
