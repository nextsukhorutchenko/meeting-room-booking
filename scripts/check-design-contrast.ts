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
  {foreground: '--color-text-muted', background: '--color-current-soft',
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
  {foreground: '--color-disabled-text', background: '--color-current-soft',
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
  {foreground: '--color-brand', background: '--color-current-soft',
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
  {foreground: '--color-text', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-backdrop-surface', background: '--color-surface',
    kind: 'non-text', minimum: 3},
  {foreground: '--color-backdrop-canvas', background: '--color-canvas',
    kind: 'non-text', minimum: 3},
] as const satisfies readonly ContrastPair[];

const sixDigitHex = /^#[0-9a-f]{6}$/i;
const semanticToken = /var\((--color-[a-z-]+)\)/g;
const solidSemanticToken = /^var\((--color-[a-z-]+)\)$/;
const compositeColor = /color-mix\(\s*in\s+srgb\s*,\s*var\((--color-[a-z-]+)\)\s+([0-9.]+)%\s*,\s*transparent\s*\)/i;

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

function canonicalPair(
  pair: ContrastPair,
  tokens?: ReadonlyMap<string, string>,
): ContrastPair {
  return {
    ...pair,
    background: canonicalToken(pair.background, tokens),
    foreground: canonicalToken(pair.foreground, tokens),
  };
}

function annotationGroups(
  comments: readonly string[],
  annotation: string,
): {groups: readonly (readonly string[])[]; malformed: boolean} {
  const groups: string[][] = [];
  let malformed = false;
  for (const comment of comments) {
    const marker = `${annotation} `;
    const start = comment.indexOf(marker);
    if (start < 0) continue;
    const tokens = comment
      .slice(start + marker.length)
      .match(/--color-[a-z-]+/g) ?? [];
    if (tokens.length !== 2) {
      malformed = true;
    } else {
      groups.push(tokens);
    }
  }
  return {groups, malformed};
}

function compositeHex(
  foreground: string,
  background: string,
  foregroundPercent: number,
): string {
  const foregroundChannels = [1, 3, 5].map((offset) =>
    Number.parseInt(foreground.slice(offset, offset + 2), 16));
  const backgroundChannels = [1, 3, 5].map((offset) =>
    Number.parseInt(background.slice(offset, offset + 2), 16));
  const alpha = foregroundPercent / 100;
  return `#${foregroundChannels.map((channel, index) =>
    Math.round(channel * alpha + backgroundChannels[index] * (1 - alpha))
      .toString(16)
      .padStart(2, '0')).join('')}`.toUpperCase();
}

export function auditStylesheetContrastUsage(
  stylesheets: readonly StylesheetSource[],
  manifest: readonly ContrastPair[],
  tokens?: ReadonlyMap<string, string>,
): readonly ContrastPair[] {
  const usage = new Map<string, ContrastPair>();
  const issues: string[] = [];
  const canonicalManifest = manifest.map((pair) => canonicalPair(pair, tokens));
  const manifestKeys = new Set(canonicalManifest.map(pairKey));
  if (manifestKeys.size !== canonicalManifest.length) {
    issues.push('Duplicate canonical contrast pair in manifest');
  }

  function record(
    foreground: string,
    background: string,
    kind: ContrastPair['kind'],
    path: string,
    selector: string,
  ) {
    const pair = canonicalPair({
      background: canonicalToken(background, tokens),
      foreground: canonicalToken(foreground, tokens),
      kind,
      minimum: kind === 'normal-text' ? 4.5 : 3,
    }, tokens);
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
      const nonTextBackgrounds = annotationTokens(
        comments,
        '@contrast-non-text-on',
      );
      const compositeContexts = annotationGroups(
        comments,
        '@contrast-composite-on',
      );
      const currentColorContexts = annotationGroups(
        comments,
        '@contrast-current-color',
      );
      const decorativeBackground = comments.some((comment) =>
        comment.includes('@contrast-decorative-background'));
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
      const backgroundDeclarations = declarations
        .filter((declaration) =>
          declaration.prop === 'background' ||
          declaration.prop === 'background-color');
      const backgrounds = backgroundDeclarations
        .flatMap((declaration) => {
          const match = declaration.value.trim().match(solidSemanticToken);
          return match ? [match[1]] : [];
        });
      const transparentBackground = backgroundDeclarations.some(
        (declaration) => declaration.value.trim() === 'transparent',
      );
      const composites = backgroundDeclarations.flatMap((declaration) => {
        const match = declaration.value.match(compositeColor);
        return match ? [{
          foreground: match[1],
          percentage: Number.parseFloat(match[2]),
        }] : [];
      });
      const colorMixCount = backgroundDeclarations.filter((declaration) =>
        declaration.value.includes('color-mix(')).length;
      const boundaryDeclarations = declarations
        .filter((declaration) =>
          (
            declaration.prop.startsWith('border') &&
            !/(radius|width|style)$/.test(declaration.prop)
          ) ||
          declaration.prop === 'outline' ||
          declaration.prop === 'outline-color');
      const boundaries = boundaryDeclarations
        .flatMap((declaration) => tokensIn(declaration.value));
      const currentColorBoundary = boundaryDeclarations.some((declaration) =>
        /\bcurrentColor\b/i.test(declaration.value));

      if (compositeContexts.malformed || currentColorContexts.malformed) {
        issues.push(
          `${stylesheet.path}:${rule.selector} has malformed contrast ` +
          'context annotation',
        );
      }
      if (colorMixCount !== composites.length) {
        issues.push(
          `${stylesheet.path}:${rule.selector} has unsupported color-mix ` +
          'syntax; use the audited semantic-token/transparent form',
        );
      }
      if (composites.length > 0 && compositeContexts.groups.length === 0) {
        issues.push(
          `${stylesheet.path}:${rule.selector} color-mix backdrop requires ` +
          'explicit @contrast-composite-on context',
        );
      }
      if (composites.length === 0 && compositeContexts.groups.length > 0) {
        issues.push(
          `${stylesheet.path}:${rule.selector} Stale contrast context ` +
          'annotation for a missing color-mix backdrop',
        );
      }
      if (currentColorBoundary && currentColorContexts.groups.length === 0) {
        issues.push(
          `${stylesheet.path}:${rule.selector} currentColor boundary requires ` +
          'explicit @contrast-current-color context',
        );
      }
      if (!currentColorBoundary && currentColorContexts.groups.length > 0) {
        issues.push(
          `${stylesheet.path}:${rule.selector} Stale contrast context ` +
          'annotation for a missing currentColor boundary',
        );
      }
      if (
        transparentBackground &&
        annotatedBackgrounds.length === 0 &&
        !decorativeBackground
      ) {
        issues.push(
          `${stylesheet.path}:${rule.selector} transparent semantic ` +
          'background requires explicit contrast context',
        );
      }
      if (
        transparentBackground &&
        foregrounds.length === 0 &&
        annotatedForegrounds.length === 0 &&
        !decorativeBackground
      ) {
        issues.push(
          `${stylesheet.path}:${rule.selector} transparent inherited ` +
          'foreground requires explicit @contrast-with context',
        );
      }
      if (nonTextBackgrounds.length > 0 && foregrounds.length === 0) {
        issues.push(
          `${stylesheet.path}:${rule.selector} Stale contrast context ` +
          'annotation without a semantic foreground',
        );
      }
      if (
        annotatedBackgrounds.length > 0 &&
        backgrounds.length > 0 &&
        !transparentBackground
      ) {
        issues.push(
          `${stylesheet.path}:${rule.selector} Stale contrast context ` +
          'annotation beside an explicit semantic background',
        );
      }
      if (
        annotatedForegrounds.length > 0 &&
        backgrounds.length === 0 &&
        !transparentBackground
      ) {
        issues.push(
          `${stylesheet.path}:${rule.selector} Stale contrast context ` +
          'annotation without a semantic background',
        );
      }
      if (annotatedBoundaries.length > 0 && backgrounds.length === 0) {
        issues.push(
          `${stylesheet.path}:${rule.selector} Stale contrast boundary ` +
          'annotation without a semantic background',
        );
      }

      for (const composite of composites) {
        if (
          !Number.isFinite(composite.percentage) ||
          composite.percentage < 0 ||
          composite.percentage > 100
        ) {
          issues.push(
            `${stylesheet.path}:${rule.selector} has invalid color-mix ` +
            'percentage',
          );
          continue;
        }
        for (const [base, effective] of compositeContexts.groups) {
          if (tokens) {
            const foregroundToken = canonicalToken(
              composite.foreground,
              tokens,
            );
            const baseToken = canonicalToken(base, tokens);
            const effectiveToken = canonicalToken(effective, tokens);
            const foregroundValue = tokens.get(foregroundToken);
            const baseValue = tokens.get(baseToken);
            const effectiveValue = tokens.get(effectiveToken);
            if (
              !foregroundValue || !baseValue || !effectiveValue ||
              !sixDigitHex.test(foregroundValue) ||
              !sixDigitHex.test(baseValue) ||
              !sixDigitHex.test(effectiveValue)
            ) {
              issues.push(
                `${stylesheet.path}:${rule.selector} composite context ` +
                'requires six-digit semantic token values',
              );
            } else {
              const expected = compositeHex(
                foregroundValue,
                baseValue,
                composite.percentage,
              );
              if (expected !== effectiveValue.toUpperCase()) {
                issues.push(
                  `${stylesheet.path}:${rule.selector} composite token ` +
                  `${effectiveToken} must resolve to ${expected}`,
                );
              }
            }
          }
          record(
            effective,
            base,
            'non-text',
            stylesheet.path,
            rule.selector,
          );
        }
      }
      for (const [foreground, background] of currentColorContexts.groups) {
        record(
          foreground,
          background,
          'non-text',
          stylesheet.path,
          rule.selector,
        );
      }

      const inheritedBackgrounds = transparentBackground ?
        annotatedBackgrounds :
        [];
      const textBackgrounds = backgrounds.length > 0 ?
        backgrounds :
        inheritedBackgrounds.length > 0 ?
          inheritedBackgrounds :
          annotatedBackgrounds.length > 0 ?
          annotatedBackgrounds :
          defaultBackgrounds;
      if (
        foregrounds.length > 0 &&
        nonTextBackgrounds.length === 0 &&
        textBackgrounds.length === 0
      ) {
        issues.push(
          `${stylesheet.path}:${rule.selector} has no semantic background ` +
          'context; add an adjacent @contrast-on annotation',
        );
      }
      for (const foreground of foregrounds) {
        for (const background of nonTextBackgrounds.length > 0 ?
          nonTextBackgrounds :
          textBackgrounds) {
          record(
            foreground,
            background,
            nonTextBackgrounds.length > 0 ? 'non-text' : 'normal-text',
            stylesheet.path,
            rule.selector,
          );
        }
      }

      if (transparentBackground && foregrounds.length === 0) {
        for (const foreground of annotatedForegrounds) {
          for (const background of annotatedBackgrounds) {
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

  for (const pair of canonicalManifest) {
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
  if (keys.length !== 58) {
    throw new Error(
      `Missing contrast pair: expected 58 required pairs, received ${keys.length}`,
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
