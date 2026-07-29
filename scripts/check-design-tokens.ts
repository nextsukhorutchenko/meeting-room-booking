import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {relative, resolve} from 'node:path';
import postcss, {type Declaration} from 'postcss';

export type DesignTokenViolation = {
  file: string;
  line: number;
  property: string;
  value: string;
  category:
    | 'border'
    | 'color'
    | 'dimension'
    | 'duration'
    | 'flex-basis'
    | 'font-size'
    | 'grid-track'
    | 'letter-spacing'
    | 'line-height'
    | 'radius'
    | 'shadow'
    | 'spacing'
    | 'transform-length';
};

type Category = DesignTokenViolation['category'];

type ValueNode =
  | {kind: 'function'; name: string; nodes: readonly ValueNode[]}
  | {kind: 'string'; value: string}
  | {kind: 'word'; value: string};

const allowedColorKeywords = new Set([
  'transparent',
  'currentcolor',
  'inherit',
  'canvas',
  'canvastext',
  'buttontext',
  'graytext',
  'linktext',
  'highlight',
]);

const namedColors = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige',
  'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown',
  'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral',
  'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan',
  'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki',
  'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred',
  'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray',
  'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
  'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick',
  'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold',
  'goldenrod', 'gray', 'green', 'greenyellow', 'grey', 'honeydew', 'hotpink',
  'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush',
  'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink',
  'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray',
  'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen',
  'linen', 'magenta', 'maroon', 'mediumaquamarine', 'mediumblue',
  'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue',
  'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace',
  'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod',
  'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff',
  'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple', 'red',
  'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen',
  'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray',
  'slategrey', 'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle',
  'tomato', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke', 'yellow',
  'yellowgreen',
]);

const viewportOrContainerUnit = /^(%|v(?:w|h|i|b|min|max)|s(?:vw|vh|vi|vb|vmin|vmax)|l(?:vw|vh|vi|vb|vmin|vmax)|d(?:vw|vh|vi|vb|vmin|vmax)|cq(?:w|h|i|b|min|max))$/;
const lengthPattern = /^-?(?:\d+(?:\.\d+)?|\.\d+)([a-z%]+)$/i;
const lengthUnit = /^(?:px|em|rem|ex|rex|cap|ch|ic|lh|rlh|cm|mm|q|in|pt|pc)$/;
const numberPattern = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
const timePattern = /^-?(?:\d+(?:\.\d+)?|\.\d+)(ms|s)$/i;
const colorFunctionNames = new Set(['rgb', 'rgba', 'hsl', 'hsla', 'oklch', 'lab']);

function parseValue(value: string, start = 0, end = value.length): readonly ValueNode[] {
  const nodes: ValueNode[] = [];
  let index = start;

  while (index < end) {
    const character = value[index];
    if (/\s|,|\//.test(character)) {
      index++;
      continue;
    }
    if (character === '"' || character === "'") {
      const quote = character;
      const valueStart = index++;
      while (index < end && value[index] !== quote) {
        if (value[index] === '\\') {
          index++;
        }
        index++;
      }
      index++;
      nodes.push({kind: 'string', value: value.slice(valueStart, index)});
      continue;
    }

    const valueStart = index;
    while (index < end && !/[\s,()/]/.test(value[index])) {
      index++;
    }
    const word = value.slice(valueStart, index);
    if (value[index] !== '(') {
      if (word) {
        nodes.push({kind: 'word', value: word});
      }
      if (value[index] === ')') {
        index++;
      }
      continue;
    }

    let depth = 1;
    const argumentStart = ++index;
    while (index < end && depth > 0) {
      if (value[index] === '"' || value[index] === "'") {
        const quote = value[index++];
        while (index < end && value[index] !== quote) {
          if (value[index] === '\\') {
            index++;
          }
          index++;
        }
      } else if (value[index] === '(') {
        depth++;
      } else if (value[index] === ')') {
        depth--;
      }
      index++;
    }
    nodes.push({
      kind: 'function',
      name: word.toLowerCase(),
      nodes: parseValue(value, argumentStart, index - 1),
    });
  }

  return nodes;
}

function flattenWords(nodes: readonly ValueNode[]): readonly string[] {
  return nodes.flatMap((node) => node.kind === 'word' ?
    [node.value] :
    node.kind === 'function' ? flattenWords(node.nodes) : []);
}

function allNodes(nodes: readonly ValueNode[]): readonly ValueNode[] {
  return nodes.flatMap((node) => node.kind === 'function' ?
    [node, ...allNodes(node.nodes)] : [node]);
}

function containsColorLiteral(nodes: readonly ValueNode[]): boolean {
  return allNodes(nodes).some((node) => {
    if (node.kind === 'function') {
      return colorFunctionNames.has(node.name);
    }
    if (node.kind !== 'word') {
      return false;
    }
    const value = node.value.toLowerCase();
    return value.startsWith('#') ||
      (namedColors.has(value) && !allowedColorKeywords.has(value));
  });
}

function isZero(word: string): boolean {
  return word === '0' || word === '0px';
}

function hasDisallowedLength(
  words: readonly string[],
  category: Category,
  property: string,
  selector: string,
  value: string,
): boolean {
  const centeredTransform = category === 'transform-length' && (
    /^translate\(\s*-50%\s*,\s*-50%\s*\)$/i.test(value.trim()) ||
    /^translate[XY]\(\s*-50%\s*\)$/i.test(value.trim())
  );

  return words.some((word) => {
    if (isZero(word)) {
      return false;
    }
    const length = word.match(lengthPattern);
    if (!length) {
      return false;
    }

    const unit = length[1].toLowerCase();
    if (
      unit !== 'fr' &&
      !lengthUnit.test(unit) &&
      !viewportOrContainerUnit.test(unit)
    ) {
      return false;
    }
    if (category === 'grid-track' && unit === 'fr') {
      return false;
    }
    if (
      (category === 'dimension' || category === 'grid-track' ||
        category === 'flex-basis') && viewportOrContainerUnit.test(unit)
    ) {
      return false;
    }
    if (
      category === 'transform-length' && unit === '%' && centeredTransform
    ) {
      return false;
    }
    if (
      category === 'border' &&
      (property === 'outline-width' || property === 'outline-offset') &&
      selector.includes(':focus-visible') &&
      word === '2px'
    ) {
      return false;
    }
    return true;
  });
}

function hasDisallowedLineHeight(words: readonly string[]): boolean {
  return words.some((word) => {
    if (isZero(word) || word === '1') {
      return false;
    }
    return numberPattern.test(word) || lengthPattern.test(word);
  });
}

function hasDisallowedTime(words: readonly string[]): boolean {
  return words.some((word) => timePattern.test(word));
}

function selectorFor(declaration: Declaration): string {
  let parent: {
    parent?: unknown;
    selector?: string;
    type?: string;
  } | undefined = declaration.parent;
  while (parent && parent.type !== 'rule') {
    parent = parent.parent as typeof parent;
  }
  return parent?.type === 'rule' ? parent.selector ?? '' : '';
}

function isSpacingProperty(property: string): boolean {
  return property === 'gap' || property === 'row-gap' ||
    property === 'column-gap' || property.startsWith('margin') ||
    property.startsWith('padding');
}

function isDimensionProperty(property: string): boolean {
  return /^(?:inset(?:-(?:block|inline)(?:-(?:start|end))?|-(?:top|right|bottom|left))?|top|right|bottom|left|(?:min|max-)?(?:width|height|inline-size|block-size))$/.test(property);
}

function classifyDeclaration(declaration: Declaration): readonly Category[] {
  if (declaration.prop.startsWith('--')) {
    return [];
  }

  const property = declaration.prop.toLowerCase();
  const value = declaration.value.trim();
  const nodes = parseValue(value);
  const words = flattenWords(nodes);
  const selector = selectorFor(declaration);
  const categories: Category[] = [];
  const add = (category: Category, condition: boolean) => {
    if (condition && !categories.includes(category)) {
      categories.push(category);
    }
  };

  if (isSpacingProperty(property)) {
    add('spacing', hasDisallowedLength(words, 'spacing', property, selector, value));
  }
  if (isDimensionProperty(property)) {
    add('dimension', hasDisallowedLength(words, 'dimension', property, selector, value));
  }
  if (property === 'grid-template-columns' || property === 'grid-template-rows' ||
    property === 'grid-template' || property === 'grid') {
    add('grid-track', hasDisallowedLength(words, 'grid-track', property, selector, value));
  }
  if (property === 'flex-basis' || property === 'flex') {
    add('flex-basis', hasDisallowedLength(words, 'flex-basis', property, selector, value));
  }
  if ((property.startsWith('border') && property !== 'border-radius') ||
    property === 'outline' || property === 'outline-width' ||
    property === 'outline-offset') {
    add('border', hasDisallowedLength(words, 'border', property, selector, value));
  }
  if (property === 'font-size') {
    add('font-size', hasDisallowedLength(words, 'font-size', property, selector, value));
  }
  if (property === 'line-height') {
    add('line-height', hasDisallowedLineHeight(words));
  }
  if (property === 'letter-spacing') {
    add('letter-spacing', hasDisallowedLength(words, 'letter-spacing', property, selector, value));
  }
  if (property === 'font') {
    const slashOffset = value.indexOf('/');
    const fontSizeWords = slashOffset === -1 ? words :
      flattenWords(parseValue(value.slice(0, slashOffset)));
    const lineHeightWords = slashOffset === -1 ? [] :
      flattenWords(parseValue(value.slice(slashOffset + 1))).slice(0, 1);
    add('font-size', hasDisallowedLength(
      fontSizeWords,
      'font-size',
      property,
      selector,
      value,
    ));
    add('line-height', hasDisallowedLineHeight(lineHeightWords));
  }
  if (property === 'border-radius') {
    add('radius', hasDisallowedLength(words, 'radius', property, selector, value));
  }
  if (property === 'box-shadow' || property === 'text-shadow') {
    add('shadow', hasDisallowedLength(words, 'shadow', property, selector, value));
  }
  if (property === 'transform' || property === 'translate') {
    add('transform-length', hasDisallowedLength(
      words,
      'transform-length',
      property,
      selector,
      value,
    ));
  }
  if (property === 'transition' || property === 'transition-duration' ||
    property === 'transition-delay' || property === 'animation' ||
    property === 'animation-duration' || property === 'animation-delay') {
    add('duration', hasDisallowedTime(words));
  }
  add('color', containsColorLiteral(nodes));

  return categories;
}

export function findDesignTokenViolations(input: {
  css: string;
  file: string;
}): readonly DesignTokenViolation[] {
  const root = postcss.parse(input.css, {from: input.file});
  const violations: DesignTokenViolation[] = [];

  root.walkDecls((declaration) => {
    for (const category of classifyDeclaration(declaration)) {
      violations.push({
        category,
        file: input.file,
        line: declaration.source?.start?.line ?? 1,
        property: declaration.prop,
        value: declaration.value,
      });
    }
  });

  return violations;
}

function styleFiles(includeLegacy: boolean): readonly string[] {
  const stylesDirectory = resolve('src/app/styles');
  const files = readdirSync(stylesDirectory)
    .filter((file) => file.endsWith('.css') && file !== 'tokens.css')
    .map((file) => resolve(stylesDirectory, file));

  if (includeLegacy) {
    files.push(resolve('src/app/globals.css'));
  }

  return files.sort();
}

function run(): void {
  const includeLegacy = process.argv.includes('--include-legacy');
  const violations = styleFiles(includeLegacy).flatMap((file) =>
    findDesignTokenViolations({
      css: readFileSync(file, 'utf8'),
      file: relative(process.cwd(), file).replaceAll('\\', '/'),
    }),
  );

  for (const violation of violations) {
    console.error(
      `${violation.file}:${violation.line} ${violation.property} ` +
        `[${violation.category}] ${violation.value}`,
    );
  }
  if (violations.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
