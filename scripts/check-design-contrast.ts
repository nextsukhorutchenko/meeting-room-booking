import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
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

export type StylesheetSource = {
  content: string;
  path: string;
};

export const contrastPairs = [
  {foreground: '--color-text', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text', background: '--color-surface-subtle',
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
  {foreground: '--color-brand', background: '--color-canvas',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-brand-hover', background: '--color-brand-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-brand-hover', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text-muted', background: '--color-brand-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text', background: '--color-brand-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-surface', background: '--color-brand',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-surface', background: '--color-brand-hover',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-surface', background: '--color-conflict-text',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-info', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-success', background: '--color-success-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-success', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-warning', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-danger', background: '--color-danger-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-danger', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-surface', background: '--color-danger',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-own-text', background: '--color-own-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-other-text', background: '--color-info-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-disabled-text', background: '--color-disabled-bg',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-disabled-text', background: '--color-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text-muted', background: '--color-disabled-bg',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text-muted', background: '--color-info-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text', background: '--color-info-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-danger', background: '--color-info-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text-muted', background: '--color-own-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-text', background: '--color-own-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-danger', background: '--color-own-surface',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-danger', background: '--color-brand-soft',
    kind: 'normal-text', minimum: 4.5},
  {foreground: '--color-border-control', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-brand', background: '--color-brand-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-brand', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-brand-hover', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-info', background: '--color-info-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-danger', background: '--color-danger-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-danger', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-surface', background: '--color-danger',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-conflict-text', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-own-border', background: '--color-own-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-own-border', background: '--color-success-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-other-border', background: '--color-info-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-current', background: '--color-info-soft',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-current', background: '--color-own-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-info', background: '--color-own-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-focus', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-focus', background: '--color-canvas',
    kind: 'non-text', minimum: 3},
] as const satisfies readonly ContrastPair[];

const sixDigitHex = /^#[0-9a-f]{6}$/i;
const semanticToken = /var\((--color-[a-z-]+)\)/g;
const solidSemanticToken = /^var\((--color-[a-z-]+)\)$/;

function pairKey(pair: ContrastPair): string {
  return `${pair.foreground}|${pair.background}|${pair.kind}|${pair.minimum}`;
}

function tokensIn(value: string): readonly string[] {
  return [...value.matchAll(semanticToken)].map((match) => match[1]);
}

function annotationTokens(
  comments: readonly string[],
  annotation: string,
): readonly string[] {
  return comments.flatMap((comment) => {
    const marker = `${annotation} `;
    const start = comment.indexOf(marker);
    if (start < 0) return [];
    return comment
      .slice(start + marker.length)
      .match(/--color-[a-z-]+/g) ?? [];
  });
}

function canonicalToken(
  token: string,
  tokens?: ReadonlyMap<string, string>,
  visited = new Set<string>(),
): string {
  if (!tokens || visited.has(token)) return token;
  visited.add(token);
  const alias = tokens.get(token)?.match(solidSemanticToken)?.[1];
  return alias ? canonicalToken(alias, tokens, visited) : token;
}

export function auditStylesheetContrastUsage(
  stylesheets: readonly StylesheetSource[],
  manifest: readonly ContrastPair[],
  tokens?: ReadonlyMap<string, string>,
): readonly ContrastPair[] {
  const usage = new Map<string, ContrastPair>();
  const issues: string[] = [];
  const manifestKeys = new Set(manifest.map(pairKey));

  function record(
    foreground: string,
    background: string,
    kind: ContrastPair['kind'],
    path: string,
    selector: string,
  ) {
    const pair = {
      background: canonicalToken(background, tokens),
      foreground: canonicalToken(foreground, tokens),
      kind,
      minimum: kind === 'normal-text' ? 4.5 : 3,
    } as const satisfies ContrastPair;
    const key = pairKey(pair);
    usage.set(key, pair);
    if (!manifestKeys.has(key)) {
      issues.push(
        `Unmeasured stylesheet contrast pair ${pair.foreground} on ` +
        `${pair.background} (${pair.kind}) at ${path}:${selector}`,
      );
    }
  }

  for (const stylesheet of stylesheets) {
    const root = postcss.parse(stylesheet.content, {from: stylesheet.path});
    const rootComments = root.nodes
      .filter((node) => node.type === 'comment')
      .map((node) => node.text);
    const defaultBackgrounds = annotationTokens(
      rootComments,
      '@contrast-default',
    );
    const defaultForegrounds = annotationTokens(
      rootComments,
      '@contrast-default-foreground',
    );
    root.walkRules((rule) => {
      const comments = rule.nodes
        .filter((node) => node.type === 'comment')
        .map((node) => node.text);
      const annotatedBackgrounds = annotationTokens(
        comments,
        '@contrast-on',
      );
      const annotatedForegrounds = annotationTokens(
        comments,
        '@contrast-with',
      );
      const annotatedBoundaries = annotationTokens(
        comments,
        '@contrast-boundary-with',
      );
      const decorativeBoundaries = new Set([
        '--color-border-subtle',
        ...annotationTokens(comments, '@contrast-decorative'),
      ].map((token) => canonicalToken(token, tokens)));
      const exemptBoundaries = new Set([
        '--color-disabled-bg',
        ...annotationTokens(comments, '@contrast-exempt-boundary'),
      ].map((token) => canonicalToken(token, tokens)));
      const declarations = rule.nodes.filter((node) =>
        node.type === 'decl');
      const foregrounds = declarations
        .filter((declaration) => declaration.prop === 'color')
        .flatMap((declaration) => tokensIn(declaration.value));
      const backgrounds = declarations
        .filter((declaration) =>
          declaration.prop === 'background' ||
          declaration.prop === 'background-color')
        .flatMap((declaration) => {
          const match = declaration.value.trim().match(solidSemanticToken);
          return match ? [match[1]] : [];
        });
      const boundaries = declarations
        .filter((declaration) =>
          (
            declaration.prop.startsWith('border') &&
            !/(radius|width|style)$/.test(declaration.prop)
          ) ||
          declaration.prop === 'outline' ||
          declaration.prop === 'outline-color')
        .flatMap((declaration) => tokensIn(declaration.value));

      const textBackgrounds = backgrounds.length > 0 ?
        backgrounds :
        annotatedBackgrounds.length > 0 ?
          annotatedBackgrounds :
          defaultBackgrounds;
      if (foregrounds.length > 0 && textBackgrounds.length === 0) {
        issues.push(
          `${stylesheet.path}:${rule.selector} has no semantic background ` +
          'context; add an adjacent @contrast-on annotation',
        );
      }
      for (const foreground of foregrounds) {
        for (const background of textBackgrounds) {
          record(
            foreground,
            background,
            'normal-text',
            stylesheet.path,
            rule.selector,
          );
        }
      }

      const decorativeBackground = comments.some((comment) =>
        comment.includes('@contrast-decorative-background'));
      if (
        backgrounds.length > 0 &&
        foregrounds.length === 0 &&
        annotatedForegrounds.length === 0 &&
        defaultForegrounds.length === 0 &&
        !decorativeBackground
      ) {
        issues.push(
          `${stylesheet.path}:${rule.selector} has no semantic foreground ` +
          'context; add @contrast-with or @contrast-decorative-background',
        );
      }
      if (foregrounds.length === 0 && !decorativeBackground) {
        for (const foreground of annotatedForegrounds.length > 0 ?
          annotatedForegrounds :
          defaultForegrounds) {
          for (const background of backgrounds) {
            record(
              foreground,
              background,
              'normal-text',
              stylesheet.path,
              rule.selector,
            );
          }
        }
      }

      for (const boundary of annotatedBoundaries) {
        for (const background of backgrounds) {
          record(
            boundary,
            background,
            'non-text',
            stylesheet.path,
            rule.selector,
          );
        }
      }

      for (const boundary of boundaries) {
        const canonicalBoundary = canonicalToken(boundary, tokens);
        if (
          decorativeBoundaries.has(canonicalBoundary) ||
          exemptBoundaries.has(canonicalBoundary)
        ) {
          continue;
        }
        const distinctBackgrounds = backgrounds.filter((background) =>
          canonicalToken(background, tokens) !== canonicalBoundary);
        const boundaryBackgrounds = annotatedBackgrounds.length > 0 ?
          annotatedBackgrounds :
          distinctBackgrounds.length > 0 ?
            distinctBackgrounds :
            defaultBackgrounds;
        if (boundaryBackgrounds.length === 0) {
          issues.push(
            `${stylesheet.path}:${rule.selector} has no semantic background ` +
            `for boundary ${canonicalBoundary}`,
          );
          continue;
        }
        for (const background of boundaryBackgrounds) {
          record(
            boundary,
            background,
            'non-text',
            stylesheet.path,
            rule.selector,
          );
        }
      }
    });
  }

  for (const pair of manifest) {
    if (!usage.has(pairKey(pair))) {
      issues.push(
        `Manifest pair has no rendered stylesheet usage: ${pair.foreground} ` +
        `on ${pair.background} (${pair.kind})`,
      );
    }
  }

  if (issues.length > 0) {
    throw new Error(issues.join('\n'));
  }
  return [...usage.values()];
}

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

function readManifestStylesheets(path: string): readonly StylesheetSource[] {
  const root = postcss.parse(readFileSync(path, 'utf8'), {from: path});
  const stylesheets: StylesheetSource[] = [];
  root.walkAtRules('import', (rule) => {
    const relativePath = rule.params.match(/^["'](.+)["']$/)?.[1];
    if (!relativePath) return;
    const stylesheetPath = resolve(dirname(path), relativePath);
    if (stylesheetPath.endsWith('tokens.css')) return;
    stylesheets.push({
      content: readFileSync(stylesheetPath, 'utf8'),
      path: stylesheetPath.replaceAll('\\', '/'),
    });
  });
  return stylesheets;
}

function validatePairManifest(pairs: readonly ContrastPair[]): void {
  const keys = pairs.map((pair) =>
    `${pair.foreground}|${pair.background}|${pair.kind}|${pair.minimum}`);
  if (keys.length !== 52) {
    throw new Error(
      `Missing contrast pair: expected 52 required pairs, received ${keys.length}`,
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
    'decorative-only exclusion: `--color-border-subtle` is not a meaningful ' +
      'boundary.',
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
    const manifestPath = resolve('src/app/styles/manifest.css');
    const tokens = readTokens(resolve('src/app/styles/tokens.css'));
    const usage = auditStylesheetContrastUsage(
      readManifestStylesheets(manifestPath),
      contrastPairs,
      tokens,
    );
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
    process.stdout.write(
      `${usage.length}/${usage.length} rendered stylesheet pairs audited.\n`,
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
