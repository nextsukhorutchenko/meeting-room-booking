import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  auditStylesheetContrastUsage,
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
  ['--color-brand-hover', '--color-brand-soft', 'normal-text', 4.5],
  ['--color-brand-hover', '--color-surface', 'normal-text', 4.5],
  ['--color-text-muted', '--color-brand-soft', 'normal-text', 4.5],
  ['--color-text-muted', '--color-current-soft', 'normal-text', 4.5],
  ['--color-text', '--color-brand-soft', 'normal-text', 4.5],
  ['--color-surface', '--color-brand', 'normal-text', 4.5],
  ['--color-surface', '--color-brand-hover', 'normal-text', 4.5],
  ['--color-surface', '--color-conflict-text', 'normal-text', 4.5],
  ['--color-info', '--color-surface', 'normal-text', 4.5],
  ['--color-success', '--color-success-soft', 'normal-text', 4.5],
  ['--color-success', '--color-surface', 'normal-text', 4.5],
  ['--color-warning', '--color-surface', 'normal-text', 4.5],
  ['--color-danger', '--color-danger-soft', 'normal-text', 4.5],
  ['--color-danger', '--color-surface', 'normal-text', 4.5],
  ['--color-surface', '--color-danger', 'normal-text', 4.5],
  ['--color-own-text', '--color-own-surface', 'normal-text', 4.5],
  ['--color-other-text', '--color-info-soft', 'normal-text', 4.5],
  ['--color-disabled-text', '--color-disabled-bg', 'normal-text', 4.5],
  ['--color-disabled-text', '--color-surface', 'normal-text', 4.5],
  ['--color-disabled-text', '--color-current-soft', 'normal-text', 4.5],
  ['--color-text-muted', '--color-disabled-bg', 'normal-text', 4.5],
  ['--color-text-muted', '--color-info-soft', 'normal-text', 4.5],
  ['--color-text', '--color-info-soft', 'normal-text', 4.5],
  ['--color-danger', '--color-info-soft', 'normal-text', 4.5],
  ['--color-text-muted', '--color-own-surface', 'normal-text', 4.5],
  ['--color-text', '--color-own-surface', 'normal-text', 4.5],
  ['--color-danger', '--color-own-surface', 'normal-text', 4.5],
  ['--color-danger', '--color-brand-soft', 'normal-text', 4.5],
  ['--color-border-control', '--color-surface', 'non-text', 3],
  ['--color-brand', '--color-brand-soft', 'non-text', 3],
  ['--color-brand', '--color-current-soft', 'non-text', 3],
  ['--color-brand', '--color-surface', 'non-text', 3],
  ['--color-brand-hover', '--color-surface', 'non-text', 3],
  ['--color-info', '--color-info-soft', 'non-text', 3],
  ['--color-danger', '--color-danger-soft', 'non-text', 3],
  ['--color-danger', '--color-surface', 'non-text', 3],
  ['--color-surface', '--color-danger', 'non-text', 3],
  ['--color-conflict-text', '--color-surface', 'non-text', 3],
  ['--color-own-border', '--color-own-surface', 'non-text', 3],
  ['--color-own-border', '--color-success-soft', 'non-text', 3],
  ['--color-other-border', '--color-info-soft', 'non-text', 3],
  ['--color-current', '--color-info-soft', 'non-text', 3],
  ['--color-current', '--color-own-surface', 'non-text', 3],
  ['--color-info', '--color-own-surface', 'non-text', 3],
  ['--color-focus', '--color-surface', 'non-text', 3],
  ['--color-focus', '--color-canvas', 'non-text', 3],
  ['--color-text', '--color-surface', 'non-text', 3],
  ['--color-backdrop-surface', '--color-surface', 'non-text', 3],
  ['--color-backdrop-canvas', '--color-canvas', 'non-text', 3],
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

function semanticAuditTokens(): Map<string, string> {
  return new Map([
    ['--color-text', '#17202A'],
    ['--color-text-muted', '#475569'],
    ['--color-brand', '#0F766E'],
    ['--color-danger', '#B42318'],
    ['--color-surface', '#FFFFFF'],
    ['--color-current-soft', '#FFF7ED'],
    ['--color-canvas', '#F7F8FA'],
    ['--color-backdrop-canvas', '#8B9096'],
    ['--color-fg-alias', 'var(--color-text)'],
    ['--color-danger-alias', 'var(--color-danger)'],
    ['--color-bg-alias', 'var(--color-surface)'],
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

  it('derives real stylesheet pairs and rejects missing manifest coverage', () => {
    const stylesheet = [{
      content: `
        .status {
          background: var(--color-surface);
          border: 1px solid var(--color-danger);
          color: var(--color-info);
        }
      `,
      path: 'fixture.css',
    }];
    const fixturePairs = [
      {
        background: '--color-surface',
        foreground: '--color-info',
        kind: 'normal-text',
        minimum: 4.5,
      },
      {
        background: '--color-surface',
        foreground: '--color-danger',
        kind: 'non-text',
        minimum: 3,
      },
    ] as const satisfies readonly ContrastPair[];

    expect(auditStylesheetContrastUsage(stylesheet, fixturePairs))
      .toEqual(fixturePairs);
    expect(() => auditStylesheetContrastUsage(stylesheet, []))
      .toThrow('Unmeasured stylesheet contrast pair');
    expect(() => auditStylesheetContrastUsage(stylesheet, [
      ...fixturePairs,
      {
        background: '--color-surface',
        foreground: '--color-warning',
        kind: 'normal-text',
        minimum: 4.5,
      },
    ])).toThrow('Manifest pair has no rendered stylesheet usage');
  });

  it('rejects semantic color usage without an auditable background context', () => {
    expect(() => auditStylesheetContrastUsage([{
      content: '.status { color: var(--color-info); }',
      path: 'fixture.css',
    }], contrastPairs)).toThrow(
      'fixture.css:.status has no semantic background context',
    );
  });

  it('audits inherited current-day slot text and icon contexts explicitly', () => {
    const stylesheet = [{
      content: `
        .free-slot {
          /* @contrast-on --color-surface --color-current-soft */
          background: transparent;
          color: var(--color-text-muted);
        }
        .free-slot svg {
          /* @contrast-non-text-on --color-surface --color-current-soft */
          color: var(--color-brand);
        }
      `,
      path: 'current-day.css',
    }];
    const pairs = [
      {background: '--color-surface', foreground: '--color-text-muted',
        kind: 'normal-text', minimum: 4.5},
      {background: '--color-current-soft', foreground: '--color-text-muted',
        kind: 'normal-text', minimum: 4.5},
      {background: '--color-surface', foreground: '--color-brand',
        kind: 'non-text', minimum: 3},
      {background: '--color-current-soft', foreground: '--color-brand',
        kind: 'non-text', minimum: 3},
    ] as const satisfies readonly ContrastPair[];

    expect(auditStylesheetContrastUsage(
      stylesheet,
      pairs,
      semanticAuditTokens(),
    )).toEqual(pairs);
  });

  it('validates a composited backdrop against its effective base', () => {
    const pair = {
      background: '--color-canvas',
      foreground: '--color-backdrop-canvas',
      kind: 'non-text',
      minimum: 3,
    } as const satisfies ContrastPair;

    expect(auditStylesheetContrastUsage([{
      content: `
        .backdrop {
          /* @contrast-composite-on --color-canvas --color-backdrop-canvas */
          background: color-mix(
            in srgb,
            var(--color-text) 48%,
            transparent
          );
        }
      `,
      path: 'backdrop.css',
    }], [pair], semanticAuditTokens())).toEqual([pair]);
  });

  it.each([
    ['lowercase currentcolor', `
      /* @contrast-default --color-surface */
      /* @contrast-default-foreground --color-text */
      .marker {
        /* @contrast-inherited-current-color --color-text --color-surface */
        border-color: currentcolor;
      }
    `],
    ['uppercase CURRENTCOLOR', `
      /* @contrast-default --color-surface */
      /* @contrast-default-foreground --color-text */
      .marker {
        /* @contrast-inherited-current-color --color-text --color-surface */
        outline: 1px solid CURRENTCOLOR;
      }
    `],
    ['mixed-case currentColor', `
      /* @contrast-default --color-surface */
      /* @contrast-default-foreground --color-text */
      .marker {
        /* @contrast-inherited-current-color --color-text --color-surface */
        border: 1px solid CurrentColor;
      }
    `],
    ['whitespace-var provenance bypass', `
      /* @contrast-default --color-surface */
      /* @contrast-default-foreground --color-text */
      .marker {
        /* @contrast-inherited-current-color --color-text --color-surface */
        color: var( --color-danger );
        border-color: currentColor;
      }
    `],
    ['direct-color provenance bypass', `
      /* @contrast-default --color-surface */
      /* @contrast-default-foreground --color-text */
      .marker {
        /* @contrast-inherited-current-color --color-text --color-surface */
        color: #b42318;
        border-color: currentColor;
      }
    `],
    ['important background provenance bypass', `
      /* @contrast-default --color-surface */
      .marker {
        /* @contrast-current-color --color-text --color-surface */
        background: var(--color-canvas) !important;
        background: var(--color-surface);
        color: var(--color-text);
        border-color: currentColor;
      }
    `],
    ['later same-selector override', `
      /* @contrast-default --color-surface */
      .marker {
        /* @contrast-current-color --color-text --color-surface */
        color: var(--color-text);
        border-color: currentColor;
      }
      .marker {
        color: var(--color-danger);
      }
    `],
    ['later pseudo-selector override', `
      /* @contrast-default --color-surface */
      .marker::before {
        /* @contrast-current-color --color-text --color-surface */
        color: var(--color-text);
        border-color: currentColor;
      }
      .marker::before {
        color: var(--color-danger);
      }
    `],
  ])('rejects %s at meaningful boundaries', (_name, content) => {
    expect(() => auditStylesheetContrastUsage([{
      content,
      path: 'implicit-current-color.css',
    }], [], semanticAuditTokens())).toThrow(
      'uses currentColor for a meaningful border/outline; use an explicit ' +
      'semantic token',
    );
  });

  it.each([
    '@contrast-current-color --color-text --color-surface',
    '@contrast-inherited-current-color --color-text --color-surface',
  ])('rejects obsolete or stale %s annotations', (annotation) => {
    expect(() => auditStylesheetContrastUsage([{
      content: `
        .marker {
          /* ${annotation} */
          display: block;
        }
      `,
      path: 'obsolete-current-color-annotation.css',
    }], [], semanticAuditTokens())).toThrow(
      'uses an obsolete currentColor contrast annotation; remove it and use ' +
      'an explicit semantic token',
    );
  });

  it('rejects nongoverned currentColor without a decorative exclusion', () => {
    expect(() => auditStylesheetContrastUsage([{
      content: '.decoration { box-shadow: 0 0 1px currentColor; }',
      path: 'nongoverned-current-color.css',
    }], [], semanticAuditTokens())).toThrow(
      'uses currentColor without an explicit decorative exclusion; use an ' +
      'explicit semantic token',
    );
  });

  it('preserves explicitly decorative currentColor backgrounds', () => {
    expect(auditStylesheetContrastUsage([{
      content: `
        .decoration {
          /* @contrast-decorative-background */
          background: currentColor;
        }
      `,
      path: 'decorative-current-color.css',
    }], [], semanticAuditTokens())).toEqual([]);
  });

  it('rejects missing inherited and stale composited context annotations', () => {
    expect(() => auditStylesheetContrastUsage([{
      content: `
        /* @contrast-default --color-surface */
        .free-slot {
          background: transparent;
          color: var(--color-text-muted);
        }
      `,
      path: 'missing-context.css',
    }], [{
      background: '--color-surface',
      foreground: '--color-text-muted',
      kind: 'normal-text',
      minimum: 4.5,
    }], semanticAuditTokens())).toThrow(
      'transparent semantic background requires explicit contrast context',
    );

    expect(() => auditStylesheetContrastUsage([{
      content: `
        .status {
          /* @contrast-composite-on --color-canvas --color-backdrop-canvas */
          background: var(--color-surface);
          color: var(--color-text);
        }
      `,
      path: 'stale-context.css',
    }], [{
      background: '--color-surface',
      foreground: '--color-text',
      kind: 'normal-text',
      minimum: 4.5,
    }], semanticAuditTokens())).toThrow(
      'Stale contrast context annotation',
    );
  });

  it('canonicalizes aliases before manifest coverage checks', () => {
    const aliasPair = {
      background: '--color-bg-alias',
      foreground: '--color-fg-alias',
      kind: 'normal-text',
      minimum: 4.5,
    } as const satisfies ContrastPair;

    expect(auditStylesheetContrastUsage([{
      content: `
        .status {
          background: var(--color-surface);
          color: var(--color-text);
        }
      `,
      path: 'alias.css',
    }], [aliasPair], semanticAuditTokens())).toEqual([{
      ...aliasPair,
      background: '--color-surface',
      foreground: '--color-text',
    }]);
  });

  it('audits production with zero implicit currentColor and prints evidence',
    () => {
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
    expect(result.stdout).toContain('58/58 pairs pass');
    expect(result.stdout).toContain(
      '58/58 rendered stylesheet pairs audited',
    );
  });
});
