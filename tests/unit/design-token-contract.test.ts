import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {findDesignTokenViolations} from '../../scripts/check-design-tokens';

describe('findDesignTokenViolations', () => {
  it.each([
    ['grid-track', '.rail { grid-template-columns: 248px minmax(0, 1fr); }'],
    ['grid-track', '.shell { grid-template-rows: 56px minmax(0, 1fr); }'],
    ['flex-basis', '.rail { flex-basis: 248px; }'],
    ['border', '.control { border: 1px solid currentColor; }'],
    ['border', '.control { border-width: 1px; }'],
    ['font-size', '.meta { font-size: 13px; }'],
    ['line-height', '.meta { line-height: 18px; }'],
    ['letter-spacing', '.label { letter-spacing: 0.02em; }'],
    ['transform-length', '.popover { transform: translateX(12px); }'],
    ['transform-length', '.scene { transform: perspective(600px); }'],
    ['color', '.control { color: #123456; }'],
    ['spacing', '.control { padding: 10px; }'],
    ['dimension', '.control { width: 52px; }'],
    ['radius', '.control { border-radius: 6px; }'],
    ['shadow', '.popover { box-shadow: 0 8px 24px rgb(0 0 0 / 14%); }'],
    ['duration', '.control { transition-duration: 180ms; }'],
  ] as const)('rejects the %s literal fixture', (category, css) => {
    expect(findDesignTokenViolations({css, file: 'fixture.css'})).toContainEqual(
      expect.objectContaining({category}),
    );
  });

  it.each([
    'min-width',
    'max-width',
    'min-height',
    'max-height',
    'min-inline-size',
    'max-inline-size',
    'min-block-size',
    'max-block-size',
  ])('rejects literal dimensions in %s', (property) => {
    expect(findDesignTokenViolations({
      css: `.surface { ${property}: 248px; }`,
      file: 'min-max-size.css',
    })).toContainEqual(expect.objectContaining({
      category: 'dimension',
      property,
    }));
  });

  it('classifies escaped CSS named colors through the value AST', () => {
    expect(findDesignTokenViolations({
      css: '.control { color: r\\65 d; }',
      file: 'escaped-color.css',
    })).toContainEqual(expect.objectContaining({category: 'color'}));
  });

  it.each([
    ['.spinner { animation: spin 0.8s linear infinite; }', ['duration']],
    ['.delayed { animation-delay: 180ms; }', ['duration']],
    [
      '.meta { font: 500 13px/18px var(--font-sans); }',
      ['font-size', 'line-height'],
    ],
    [
      '.workspace { grid-template: "rail main" 56px / 248px 1fr; }',
      ['grid-track'],
    ],
    ['.rail { flex: 0 0 248px; }', ['flex-basis']],
  ] as const)(
    'extracts governed shorthand tokens from %s',
    (css, expectedCategories) => {
      expect(
        findDesignTokenViolations({css, file: 'shorthand.css'}).map(
          ({category}) => category,
        ),
      ).toEqual(expectedCategories);
    },
  );

  it('allows only the documented structural and focus literals', () => {
    const css = `
      .structure {
        margin: 0;
        padding: 0px;
        width: 100%;
        min-height: 100dvh;
        max-inline-size: 100cqw;
        flex-basis: 50%;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        grid-template-rows: auto minmax(0, 1fr);
        line-height: 1;
        transform: translate(-50%, -50%);
        transform: rotate(360deg);
      }
      .structure:focus-visible {
        outline-width: 2px;
        outline-offset: 2px;
      }
    `;

    expect(findDesignTokenViolations({css, file: 'allowed.css'})).toEqual([]);
  });

  it('keeps the complete global style manifest in its approved order', () => {
    expect(readFileSync('src/app/styles/manifest.css', 'utf8')
      .match(/^@import [^;]+;$/gm)).toEqual([
      '@import "../globals.css";',
      '@import "./tokens.css";',
      '@import "./base.css";',
      '@import "./ui.css";',
      '@import "./shell.css";',
      '@import "./auth.css";',
      '@import "./schedule-layout.css";',
      '@import "./timetable.css";',
      '@import "./agenda.css";',
      '@import "./booking-surface.css";',
      '@import "./notifications.css";',
      '@import "./my-bookings.css";',
    ]);
  });

  it('has no governed literals in manifest-owned or legacy styles', () => {
    const styleFiles = readdirSync('src/app/styles')
      .filter((file) => file.endsWith('.css') && file !== 'tokens.css')
      .map((file) => resolve('src/app/styles', file))
      .concat(resolve('src/app/globals.css'));

    expect(styleFiles.flatMap((file) => findDesignTokenViolations({
      css: readFileSync(file, 'utf8'),
      file,
    }))).toEqual([]);
  });

  it('limits raw focus geometry to the approved forced-color declarations', () => {
    const styles = readdirSync('src/app/styles')
      .filter((file) => file.endsWith('.css') && file !== 'tokens.css')
      .map((file) => readFileSync(resolve('src/app/styles', file), 'utf8'))
      .concat(readFileSync('src/app/globals.css', 'utf8'))
      .join('\n');
    const rawFocusGeometry = styles.match(
      /outline-(?:width|offset)\s*:\s*2px\s*;/g,
    ) ?? [];

    expect(rawFocusGeometry).toEqual([
      'outline-width: 2px;',
      'outline-offset: 2px;',
    ]);
  });

  it('uses measured semantic backgrounds for meaningful disabled and status text', () => {
    const agenda = readFileSync('src/app/styles/agenda.css', 'utf8');
    const bookings = readFileSync('src/app/styles/my-bookings.css', 'utf8');

    expect(agenda).toMatch(
      /\.day-agenda-past\s*\{[\s\S]*?background:\s*var\(--color-disabled-bg\)/,
    );
    expect(bookings).toMatch(
      /\.booking-status\s*\{[\s\S]*?background:\s*var\(--color-surface\)/,
    );
  });
});
