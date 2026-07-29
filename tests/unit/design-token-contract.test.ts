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
});
