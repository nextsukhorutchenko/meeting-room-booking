import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  calculateContrastTable,
  contrastPairs,
  type ContrastPair,
} from '../../scripts/check-design-contrast';

const requiredPairs = [
  ['--color-text', '--color-surface', 'normal-text', 4.5],
  ['--color-text', '--color-surface-subtle', 'normal-text', 4.5],
  ['--color-text', '--color-canvas', 'normal-text', 4.5],
  ['--color-text-muted', '--color-surface', 'normal-text', 4.5],
  ['--color-text-muted', '--color-canvas', 'normal-text', 4.5],
  ['--color-text-subtle', '--color-surface', 'normal-text', 4.5],
  ['--color-text-subtle', '--color-canvas', 'normal-text', 4.5],
  ['--color-brand', '--color-surface', 'normal-text', 4.5],
  ['--color-brand', '--color-canvas', 'normal-text', 4.5],
  ['--color-surface', '--color-brand', 'normal-text', 4.5],
  ['--color-surface', '--color-brand-hover', 'normal-text', 4.5],
  ['--color-surface', '--color-brand-pressed', 'normal-text', 4.5],
  ['--color-selected-text', '--color-brand-soft', 'normal-text', 4.5],
  ['--color-info', '--color-info-soft', 'normal-text', 4.5],
  ['--color-success', '--color-success-soft', 'normal-text', 4.5],
  ['--color-warning', '--color-warning-soft', 'normal-text', 4.5],
  ['--color-danger', '--color-danger-soft', 'normal-text', 4.5],
  ['--color-surface', '--color-danger', 'normal-text', 4.5],
  ['--color-conflict-text', '--color-danger-soft', 'normal-text', 4.5],
  ['--color-own-text', '--color-own-surface', 'normal-text', 4.5],
  ['--color-other-text', '--color-info-soft', 'normal-text', 4.5],
  ['--color-current', '--color-current-soft', 'normal-text', 4.5],
  ['--color-disabled-text', '--color-disabled-bg', 'normal-text', 4.5],
  ['--color-border-control', '--color-surface', 'non-text', 3],
  ['--color-border-strong', '--color-surface', 'non-text', 3],
  ['--color-brand', '--color-brand-soft', 'non-text', 3],
  ['--color-info', '--color-info-soft', 'non-text', 3],
  ['--color-success', '--color-success-soft', 'non-text', 3],
  ['--color-warning', '--color-warning-soft', 'non-text', 3],
  ['--color-danger', '--color-danger-soft', 'non-text', 3],
  ['--color-conflict-text', '--color-danger-soft', 'non-text', 3],
  ['--color-own-border', '--color-own-surface', 'non-text', 3],
  ['--color-other-border', '--color-info-soft', 'non-text', 3],
  ['--color-current', '--color-current-soft', 'non-text', 3],
  ['--color-focus', '--color-surface', 'non-text', 3],
  ['--color-focus-outer', '--color-focus', 'non-text', 3],
] as const satisfies readonly (
  readonly [
    ContrastPair['foreground'],
    ContrastPair['background'],
    ContrastPair['kind'],
    ContrastPair['minimum'],
  ]
)[];

function tokenMap(): Map<string, string> {
  return new Map([
    ['--black', '#000000'],
    ['--white', '#FFFFFF'],
    ['--low-contrast', '#777777'],
  ]);
}

describe('calculateContrastTable', () => {
  it('calculates WCAG sRGB contrast ratios without rounding pass decisions', () => {
    expect(calculateContrastTable(tokenMap(), [{
      background: '--white',
      foreground: '--black',
      kind: 'normal-text',
      minimum: 4.5,
    }])).toEqual([{
      background: '--white',
      backgroundValue: '#FFFFFF',
      foreground: '--black',
      foregroundValue: '#000000',
      kind: 'normal-text',
      minimum: 4.5,
      pass: true,
      ratio: 21,
    }]);
  });

  it('rejects missing and non-hex token values', () => {
    expect(() => calculateContrastTable(tokenMap(), [{
      background: '--missing',
      foreground: '--black',
      kind: 'non-text',
      minimum: 3,
    }])).toThrow('Missing contrast token: --missing');

    const tokens = tokenMap();
    tokens.set('--invalid', 'var(--black)');
    expect(() => calculateContrastTable(tokens, [{
      background: '--white',
      foreground: '--invalid',
      kind: 'non-text',
      minimum: 3,
    }])).toThrow('Contrast token --invalid must be a six-digit hex color');
  });

  it('reports a below-threshold pair as failed', () => {
    expect(calculateContrastTable(tokenMap(), [{
      background: '--white',
      foreground: '--low-contrast',
      kind: 'normal-text',
      minimum: 4.5,
    }])[0]).toMatchObject({
      pass: false,
      ratio: expect.closeTo(4.478, 3),
    });
  });
});

describe('Roomwork contrast manifest and command', () => {
  it('contains every approved semantic foreground/background pair once', () => {
    expect(contrastPairs.map((pair) => [
      pair.foreground,
      pair.background,
      pair.kind,
      pair.minimum,
    ])).toEqual(requiredPairs);
  });

  it('prints an auditable markdown table and truthful decorative exclusions', () => {
    const result = spawnSync(
      process.execPath,
      [
        resolve('node_modules/tsx/dist/cli.mjs'),
        resolve('scripts/check-design-contrast.ts'),
        '--format',
        'markdown',
      ],
      {encoding: 'utf8'},
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('| Foreground | Background | Kind |');
    expect(result.stdout).toContain('--color-text');
    expect(result.stdout).toContain('--color-surface-subtle');
    expect(result.stdout).toContain(
      'decorative-only exclusion: `--color-border-subtle`',
    );
    expect(result.stdout).not.toContain(
      'decorative-only exclusions: `--color-surface-subtle`',
    );
    expect(result.stdout).toContain('--color-border-subtle');
    expect(result.stdout).toContain('36/36 pairs pass');
  });
});
