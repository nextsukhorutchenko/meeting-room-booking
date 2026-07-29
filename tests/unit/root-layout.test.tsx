import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import RootLayout, {metadata} from '../../src/app/layout';

function readManifestImports(): string[] {
  return [...readFileSync(resolve('src/app/styles/manifest.css'), 'utf8')
    .matchAll(/@import\s+["']([^"']+)["'];/g)]
    .map((match) => match[1]);
}

describe('RootLayout', () => {
  it('renders the Ukrainian document contract', () => {
    const tree = RootLayout({children: <main />});

    expect(tree.props.lang).toBe('uk');
    expect(metadata.title).toBe('Roomwork — Бронювання переговорних');
  });

  it('keeps the style manifest ordered', () => {
    const importOrder = [
      '../globals.css',
      './tokens.css',
      './base.css',
      './ui.css',
      './shell.css',
      './auth.css',
      './schedule-layout.css',
      './timetable.css',
      './agenda.css',
      './booking-surface.css',
      './notifications.css',
      './my-bookings.css',
    ];
    const expectedExistingImports = importOrder.filter((path) =>
      path === '../globals.css' ||
      existsSync(resolve('src/app/styles', path.slice(2))),
    );

    expect(readManifestImports()).toEqual(expectedExistingImports);
  });
});
