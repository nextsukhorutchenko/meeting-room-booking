import {describe, expect, it} from 'vitest';
import {findForbiddenControls} from '../../scripts/check-source-hygiene';

describe('findForbiddenControls', () => {
  it('reports a byte-order mark with its source index', () => {
    expect(findForbiddenControls('src/example.ts', '\uFEFFconst value = 1;\n'))
      .toEqual([{
        path: 'src/example.ts',
        index: 0,
        codePoint: 'U+FEFF',
      }]);
  });

  it('reports zero-width characters', () => {
    expect(findForbiddenControls(
      'src/example.ts',
      `a\u200Bb\u200Cc\u200Dd\u2060e`,
    )).toEqual([
      {path: 'src/example.ts', index: 1, codePoint: 'U+200B'},
      {path: 'src/example.ts', index: 3, codePoint: 'U+200C'},
      {path: 'src/example.ts', index: 5, codePoint: 'U+200D'},
      {path: 'src/example.ts', index: 7, codePoint: 'U+2060'},
    ]);
  });

  it('reports bidirectional formatting controls', () => {
    expect(findForbiddenControls(
      'README.md',
      `a\u061Cb\u200Ec\u200Fd\u202Ae\u202Ef\u2066g\u2069h`,
    )).toEqual([
      {path: 'README.md', index: 1, codePoint: 'U+061C'},
      {path: 'README.md', index: 3, codePoint: 'U+200E'},
      {path: 'README.md', index: 5, codePoint: 'U+200F'},
      {path: 'README.md', index: 7, codePoint: 'U+202A'},
      {path: 'README.md', index: 9, codePoint: 'U+202E'},
      {path: 'README.md', index: 11, codePoint: 'U+2066'},
      {path: 'README.md', index: 13, codePoint: 'U+2069'},
    ]);
  });

  it('reports format controls outside the historical hand-picked ranges', () => {
    expect(findForbiddenControls(
      'src/example.ts',
      `a\u00ADb\u2061c\u206Ad\u{E0001}e`,
    )).toEqual([
      {path: 'src/example.ts', index: 1, codePoint: 'U+00AD'},
      {path: 'src/example.ts', index: 3, codePoint: 'U+2061'},
      {path: 'src/example.ts', index: 5, codePoint: 'U+206A'},
      {path: 'src/example.ts', index: 7, codePoint: 'U+E0001'},
    ]);
  });

  it('reports forbidden C0, DEL, and C1 text controls', () => {
    expect(findForbiddenControls(
      'README.md',
      'a\u0000b\u0008c\u000Bd\u001Fe\u007Ff\u0085g\u009F',
    )).toEqual([
      {path: 'README.md', index: 1, codePoint: 'U+0000'},
      {path: 'README.md', index: 3, codePoint: 'U+0008'},
      {path: 'README.md', index: 5, codePoint: 'U+000B'},
      {path: 'README.md', index: 7, codePoint: 'U+001F'},
      {path: 'README.md', index: 9, codePoint: 'U+007F'},
      {path: 'README.md', index: 11, codePoint: 'U+0085'},
      {path: 'README.md', index: 13, codePoint: 'U+009F'},
    ]);
  });

  it('allows tab, line feed, and carriage return in text', () => {
    expect(findForbiddenControls(
      'README.md',
      'first\tcolumn\r\nsecond line\n',
    )).toEqual([]);
  });

  it('accepts normal Ukrainian text', () => {
    expect(findForbiddenControls(
      'src/example.ts',
      'Кімнату успішно заброньовано. Київський офіс працює з 09:00.',
    )).toEqual([]);
  });
});
