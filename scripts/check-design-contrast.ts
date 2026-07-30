import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import postcss from 'postcss';

export type ContrastPair = {
  foreground: string;
  background: string;
  kind: 'normal-text' | 'large-text' | 'non-text';
  minimum: 3 | 4.5;
};

export type ContrastResult = ContrastPair & {
  foregroundValue: string;
  backgroundValue: string;
  ratio: number;
  pass: boolean;
};

export const contrastPairs = [
  {foreground: '--color-text', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text', background: '--color-canvas',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text-muted', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text-muted', background: '--color-canvas',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text-subtle', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text-subtle', background: '--color-canvas',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-brand', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-surface', background: '--color-brand',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-surface', background: '--color-brand-hover',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-surface', background: '--color-brand-pressed',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-selected-text', background: '--color-brand-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-info', background: '--color-info-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-success', background: '--color-success-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-warning', background: '--color-warning-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-danger', background: '--color-danger-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-surface', background: '--color-danger',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-conflict-text', background: '--color-danger-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-own-text', background: '--color-own-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-other-text', background: '--color-info-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-current', background: '--color-current-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-disabled-text', background: '--color-disabled-bg',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-border-control', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-border-strong', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-brand', background: '--color-brand-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-info', background: '--color-info-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-success', background: '--color-success-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-warning', background: '--color-warning-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-danger', background: '--color-danger-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-conflict-text', background: '--color-danger-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-own-border', background: '--color-own-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-other-border', background: '--color-info-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-current', background: '--color-current-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-focus', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-focus-outer', background: '--color-focus',
    kind: 'non-text', minimum: 3},
] as const satisfies readonly ContrastPair[];

const sixDigitHex = /^#[0-9a-f]{6}$/i;

function colorChannels(token: string, value: string): readonly number[] {
  if (!sixDigitHex.test(value)) {
    throw new Error(
      `Contrast token ${token} must be a six-digit hex color; received ${value}`,
    );
  }
  return [1, 3, 5].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function relativeLuminance(token: string, value: string): number {
  const [red, green, blue] = colorChannels(token, value).map((channel) =>
    channel <= 0.04045 ?
      channel / 12.92 :
      ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function calculateContrastTable(
  tokens: ReadonlyMap<string, string>,
  pairs: readonly ContrastPair[],
): readonly ContrastResult[] {
  return pairs.map((pair) => {
    const foregroundValue = tokens.get(pair.foreground);
    const backgroundValue = tokens.get(pair.background);
    if (!foregroundValue) {
      throw new Error(`Missing contrast token: ${pair.foreground}`);
    }
    if (!backgroundValue) {
      throw new Error(`Missing contrast token: ${pair.background}`);
    }
    const foregroundLuminance = relativeLuminance(
      pair.foreground,
      foregroundValue,
    );
    const backgroundLuminance = relativeLuminance(
      pair.background,
      backgroundValue,
    );
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    return {
      ...pair,
      backgroundValue,
      foregroundValue,
      pass: ratio >= pair.minimum,
      ratio,
    };
  });
}

function readTokens(path: string): ReadonlyMap<string, string> {
  const root = postcss.parse(readFileSync(path, 'utf8'), {from: path});
  const tokens = new Map<string, string>();
  root.walkDecls(/^--/, (declaration) => {
    if (tokens.has(declaration.prop)) {
      throw new Error(`Duplicate design token: ${declaration.prop}`);
    }
    tokens.set(declaration.prop, declaration.value.trim());
  });
  return tokens;
}

function validatePairManifest(pairs: readonly ContrastPair[]): void {
  const keys = pairs.map((pair) =>
    `${pair.foreground}|${pair.background}|${pair.kind}|${pair.minimum}`);
  if (keys.length !== 34) {
    throw new Error(
      `Missing contrast pair: expected 34 required pairs, received ${keys.length}`,
    );
  }
  if (new Set(keys).size !== keys.length) {
    throw new Error('Duplicate contrast pair in required manifest');
  }
}

function markdown(results: readonly ContrastResult[]): string {
  const lines = [
    '# Roomwork token contrast',
    '',
    '| Foreground | Background | Kind | Ratio | Minimum | Result |',
    '| --- | --- | --- | ---: | ---: | --- |',
    ...results.map((result) =>
      `| ${result.foreground} (${result.foregroundValue}) | ` +
      `${result.background} (${result.backgroundValue}) | ${result.kind} | ` +
      `${result.ratio.toFixed(2)}:1 | ${result.minimum}:1 | ` +
      `${result.pass ? 'PASS' : 'FAIL'} |`),
    '',
    'decorative-only exclusions: `--color-surface-subtle` and ' +
      '`--color-border-subtle` are not meaningful boundaries.',
    'Disabled control boundaries are exempt from non-text contrast; the ' +
      '`--color-disabled-text` / `--color-disabled-bg` text pair is measured.',
    '',
    `${results.filter(({pass}) => pass).length}/${results.length} pairs pass.`,
    '',
  ];
  return lines.join('\n');
}

function textReport(results: readonly ContrastResult[]): string {
  return [
    ...results.map((result) =>
      `${result.foreground} on ${result.background}: ` +
      `${result.ratio.toFixed(2)}:1 ` +
      `(minimum ${result.minimum}:1) ${result.pass ? 'PASS' : 'FAIL'}`),
    `${results.filter(({pass}) => pass).length}/${results.length} pairs pass.`,
  ].join('\n');
}

function run(): void {
  try {
    validatePairManifest(contrastPairs);
    const tokens = readTokens(resolve('src/app/styles/tokens.css'));
    const results = calculateContrastTable(tokens, contrastPairs);
    const format = process.argv.includes('--format') ?
      process.argv[process.argv.indexOf('--format') + 1] :
      'text';
    if (format !== 'text' && format !== 'markdown') {
      throw new Error(`Unsupported contrast output format: ${format}`);
    }
    process.stdout.write(
      `${format === 'markdown' ? markdown(results) : textReport(results)}\n`,
    );
    if (results.some(({pass}) => !pass)) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run();
}
