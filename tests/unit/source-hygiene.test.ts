import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {generate, parse, walk, type Rule} from 'css-tree';
import {describe, expect, it, vi} from 'vitest';
import {
  findForbiddenControls,
  isExcludedTrackedPath,
  listTrackedPaths,
  scanTrackedTextFiles,
} from '../../scripts/check-source-hygiene';

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

describe('tracked source inventory', () => {
  it('enumerates NUL-delimited tracked paths through git', () => {
    const run = vi.fn().mockReturnValue('src/a.ts\0README.md\0');

    expect(listTrackedPaths(run)).toEqual(['src/a.ts', 'README.md']);
    expect(run).toHaveBeenCalledWith('git', ['ls-files', '-z'], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  });

  it('excludes generated and test-artifact paths explicitly', () => {
    expect(isExcludedTrackedPath('src/generated/prisma/client.ts')).toBe(true);
    expect(isExcludedTrackedPath('coverage/report.json')).toBe(true);
    expect(isExcludedTrackedPath('src/modules/auth/auth.service.ts')).toBe(
      false,
    );
  });

  it('skips a known real binary asset', () => {
    const icon = readFileSync('src/app/favicon.ico');

    expect(scanTrackedTextFiles({
      readFile: () => icon,
      trackedPaths: () => ['src/app/favicon.ico'],
    })).toEqual([]);
  });

  it('fails closed on UTF-16 and malformed UTF-8 text-like files', () => {
    const files = new Map<string, Buffer>([
      [
        'src/generated/prisma/ignored.ts',
        Buffer.from('\uFEFFignored generated source'),
      ],
      ['assets/logo.png', Buffer.from([0x00, 0xFF, 0x00, 0xFF])],
      [
        'src/utf16.ts',
        Buffer.from('\uFEFFconst value = 1;', 'utf16le'),
      ],
      ['src/malformed.ts', Buffer.from([0x63, 0xC3, 0x28])],
      ['src/clean.ts', Buffer.from('const value = 1;\n', 'utf8')],
    ]);

    expect(scanTrackedTextFiles({
      readFile: (path) => files.get(path) as Buffer,
      trackedPaths: () => [...files.keys()],
    })).toEqual([
      {path: 'src/utf16.ts', error: 'UNSUPPORTED_TEXT_ENCODING'},
      {path: 'src/malformed.ts', error: 'UNSUPPORTED_TEXT_ENCODING'},
    ]);
  });
});

function selectorsIn(path: string): Set<string> {
  const selectors = new Set<string>();
  const ast = parse(readFileSync(path, 'utf8'), {
    context: 'stylesheet',
    positions: false,
  });
  walk(ast, {
    visit: 'Rule',
    enter(node: Rule) {
      if (node.prelude.type === 'SelectorList') {
        generate(node.prelude).split(',').forEach((selector) => {
          selectors.add(selector.trim());
        });
      }
    },
  });
  return selectors;
}

describe('global stylesheet ownership', () => {
  it('keeps Tailwind global and requires consumers for retained class selectors', () => {
    const globals = readFileSync('src/app/globals.css', 'utf8');
    const globalSelectors = selectorsIn('src/app/globals.css');
    const ownerPaths = [
      'src/app/styles/base.css',
      'src/app/styles/ui.css',
      'src/app/styles/shell.css',
      'src/app/styles/auth.css',
      'src/app/styles/schedule-layout.css',
      'src/app/styles/timetable.css',
      'src/app/styles/agenda.css',
      'src/app/styles/booking-surface.css',
      'src/app/styles/notifications.css',
      'src/app/styles/my-bookings.css',
    ];
    const ownerSelectors = new Set(
      ownerPaths.flatMap((path) => [...selectorsIn(path)]),
    );

    expect(globals).toMatch(/^@import "tailwindcss";/);
    const componentSource = [
      ...readdirSync('src/components', {recursive: true}),
    ]
      .filter((path) => path.toString().endsWith('.tsx'))
      .map((path) => readFileSync(
        resolve('src/components', path.toString()),
        'utf8',
      ))
      .join('\n');
    for (const selector of globalSelectors) {
      const className = selector.match(/\.([a-z][\w-]*)/)?.[1];
      expect(
        className && componentSource.includes(className),
        `${selector} must have a component consumer`,
      ).toBe(true);
    }
    expect([...globalSelectors]).toEqual([]);
    expect(ownerSelectors).toContain('.app-toast');
    expect(componentSource).toContain('className="app-toast"');
    expect(componentSource).not.toContain('className="toast"');
    expect([...globalSelectors].filter((selector) =>
      ownerSelectors.has(selector))).toEqual([]);

    const utilitySources = [
      'src/app/layout.tsx',
      'src/components/ui/alert.tsx',
      'src/components/ui/button.tsx',
      'src/components/ui/field.tsx',
    ].map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(utilitySources).toMatch(
      /className="[^"]*(?:flex|grid|size-4|text-sm)[^"]*"/,
    );
  });
});
