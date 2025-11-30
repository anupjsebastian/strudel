import { getLeafLocations } from '@strudel/mini';
import { parse } from 'acorn';
import escodegen from 'escodegen';
import { walk } from 'estree-walker';

// Module cache to store imported modules
const moduleCache = new Map();
let fileLoader = null;

/**
 * Register a file loader function for resolving and loading .str files
 * @param {Function} loader - async function(path) => string
 */
export function registerFileLoader(loader) {
  fileLoader = loader;
}

/**
 * Clear the module cache
 */
export function clearModuleCache() {
  moduleCache.clear();
}

let widgetMethods = [];
export function registerWidgetType(type) {
  widgetMethods.push(type);
}

let languages = new Map();
// config = { getLocations: (code: string, offset?: number) => number[][] }
// see mondough.mjs for example use
// the language will kick in when the code contains a template literal of type
// example: mondo`...` will use language of type "mondo"
// TODO: refactor tidal.mjs to use this
export function registerLanguage(type, config) {
  languages.set(type, config);
}

export function transpiler(input, options = {}) {
  const { wrapAsync = false, addReturn = true, emitMiniLocations = true, emitWidgets = true } = options;

  let ast = parse(input, {
    ecmaVersion: 2022,
    sourceType: 'module',
    allowAwaitOutsideFunction: true,
    locations: true,
  });

  let miniLocations = [];
  const collectMiniLocations = (value, node) => {
    const minilang = languages.get('minilang');
    if (minilang) {
      const code = `[${value}]`;
      const locs = minilang.getLocations(code, node.start);
      miniLocations = miniLocations.concat(locs);
    } else {
      const leafLocs = getLeafLocations(`"${value}"`, node.start, input);
      miniLocations = miniLocations.concat(leafLocs);
    }
  };
  let widgets = [];
  let imports = [];  // Track import statements
  let exports = {};  // Track export declarations

  walk(ast, {
    enter(node, parent /* , prop, index */) {
      // Handle import declarations
      if (node.type === 'ImportDeclaration') {
        imports.push(node);
        this.remove();  // Remove import from AST, we'll handle it differently
        return;
      }
      // Handle export declarations
      if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          // export const x = ...
          exports[node.declaration.declarations[0].id.name] = true;
          // Keep the declaration but remove export keyword
          this.replace(node.declaration);
          return;
        }
      }
      if (isLanguageLiteral(node)) {
        const { name } = node.tag;
        const language = languages.get(name);
        const code = node.quasi.quasis[0].value.raw;
        const offset = node.quasi.start + 1;
        if (emitMiniLocations) {
          const locs = language.getLocations(code, offset);
          miniLocations = miniLocations.concat(locs);
        }
        this.skip();
        return this.replace(languageWithLocation(name, code, offset));
      }
      if (isTemplateLiteral(node, 'tidal')) {
        const raw = node.quasi.quasis[0].value.raw;
        const offset = node.quasi.start + 1;
        if (emitMiniLocations) {
          const stringLocs = collectHaskellMiniLocations(raw, offset);
          miniLocations = miniLocations.concat(stringLocs);
        }
        this.skip();
        return this.replace(tidalWithLocation(raw, offset));
      }
      if (isBackTickString(node, parent)) {
        const { quasis } = node;
        const { raw } = quasis[0].value;
        this.skip();
        emitMiniLocations && collectMiniLocations(raw, node);
        return this.replace(miniWithLocation(raw, node));
      }
      if (isStringWithDoubleQuotes(node)) {
        const { value } = node;
        this.skip();
        emitMiniLocations && collectMiniLocations(value, node);
        return this.replace(miniWithLocation(value, node));
      }
      if (isSliderFunction(node)) {
        emitWidgets &&
          widgets.push({
            from: node.arguments[0].start,
            to: node.arguments[0].end,
            value: node.arguments[0].raw, // don't use value!
            min: node.arguments[1]?.value ?? 0,
            max: node.arguments[2]?.value ?? 1,
            step: node.arguments[3]?.value,
            type: 'slider',
          });
        return this.replace(sliderWithLocation(node));
      }
      if (isWidgetMethod(node)) {
        const type = node.callee.property.name;
        const index = widgets.filter((w) => w.type === type).length;
        const widgetConfig = {
          to: node.end,
          index,
          type,
          id: options.id,
        };
        emitWidgets && widgets.push(widgetConfig);
        return this.replace(widgetWithLocation(node, widgetConfig));
      }
      if (isBareSamplesCall(node, parent)) {
        return this.replace(withAwait(node));
      }
      if (isLabelStatement(node)) {
        return this.replace(labelToP(node));
      }
    },
    leave(node, parent, prop, index) { },
  });

  let { body } = ast;

  if (!body.length) {
    console.warn('empty body -> fallback to silence');
    body.push({
      type: 'ExpressionStatement',
      expression: {
        type: 'Identifier',
        name: 'silence',
      },
    });
  } else if (addReturn && !body?.[body.length - 1]?.expression) {
    // If last statement is not an expression (e.g., just variable declarations from exports),
    // and we need to add return, add silence
    console.warn('no expression to return -> fallback to silence');
    body.push({
      type: 'ExpressionStatement',
      expression: {
        type: 'Identifier',
        name: 'silence',
      },
    });
  }

  // add return to last statement
  if (addReturn && body.length > 0 && body[body.length - 1].expression) {
    const { expression } = body[body.length - 1];
    body[body.length - 1] = {
      type: 'ReturnStatement',
      argument: expression,
    };
  }

  let output = escodegen.generate(ast);

  // Process imports if there are any
  if (imports.length > 0 && options.onImport) {
    // Pass imports to handler for external resolution
    const importInfo = imports.map(imp => ({
      source: imp.source.value,
      specifiers: imp.specifiers.map(spec => ({
        imported: spec.imported?.name || 'default',
        local: spec.local.name,
      })),
    }));
    options.onImport(importInfo);
  }

  if (wrapAsync) {
    output = `(async ()=>{${output}})()`;
  }
  if (!emitMiniLocations) {
    return { output, imports, exports };
  }
  return { output, miniLocations, widgets, imports, exports };
}

function isStringWithDoubleQuotes(node, locations, code) {
  if (node.type !== 'Literal') {
    return false;
  }
  return node.raw[0] === '"';
}

function isBackTickString(node, parent) {
  return node.type === 'TemplateLiteral' && parent.type !== 'TaggedTemplateExpression';
}

function miniWithLocation(value, node) {
  const { start: fromOffset } = node;

  const minilang = languages.get('minilang');
  let name = 'm';
  if (minilang && minilang.name) {
    name = minilang.name; // name is expected to be exported from the package of the minilang
  }

  return {
    type: 'CallExpression',
    callee: {
      type: 'Identifier',
      name,
    },
    arguments: [
      { type: 'Literal', value },
      { type: 'Literal', value: fromOffset },
    ],
    optional: false,
  };
}

// these functions are connected to @strudel/codemirror -> slider.mjs
// maybe someday there will be pluggable transpiler functions, then move this there
function isSliderFunction(node) {
  return node.type === 'CallExpression' && node.callee.name === 'slider';
}

function isWidgetMethod(node) {
  return node.type === 'CallExpression' && widgetMethods.includes(node.callee.property?.name);
}

function sliderWithLocation(node) {
  const id = 'slider_' + node.arguments[0].start; // use loc of first arg for id
  // add loc as identifier to first argument
  // the sliderWithID function is assumed to be sliderWithID(id, value, min?, max?)
  node.arguments.unshift({
    type: 'Literal',
    value: id,
    raw: id,
  });
  node.callee.name = 'sliderWithID';
  return node;
}

export function getWidgetID(widgetConfig) {
  // the widget id is used as id for the dom element + as key for eventual resources
  // for example, for each scope widget, a new analyser + buffer (large) is created
  // that means, if we use the index index of line position as id, less garbage is generated
  // return `widget_${widgetConfig.to}`; // more gargabe
  //return `widget_${widgetConfig.index}_${widgetConfig.to}`; // also more garbage
  return `${widgetConfig.id || ''}_widget_${widgetConfig.type}_${widgetConfig.index}`; // less garbage
}

function widgetWithLocation(node, widgetConfig) {
  const id = getWidgetID(widgetConfig);
  // add loc as identifier to first argument
  // the sliderWithID function is assumed to be sliderWithID(id, value, min?, max?)
  node.arguments.unshift({
    type: 'Literal',
    value: id,
    raw: id,
  });
  return node;
}

function isBareSamplesCall(node, parent) {
  return node.type === 'CallExpression' && node.callee.name === 'samples' && parent.type !== 'AwaitExpression';
}

function withAwait(node) {
  return {
    type: 'AwaitExpression',
    argument: node,
  };
}

function isLabelStatement(node) {
  return node.type === 'LabeledStatement';
}

// converts label expressions to p calls: "x: y" to "y.p('x')"
// see https://codeberg.org/uzu/strudel/issues/990
function labelToP(node) {
  return {
    type: 'ExpressionStatement',
    expression: {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        object: node.body.expression,
        property: {
          type: 'Identifier',
          name: 'p',
        },
      },
      arguments: [
        {
          type: 'Literal',
          value: node.label.name,
          raw: `'${node.label.name}'`,
        },
      ],
    },
  };
}

function isLanguageLiteral(node) {
  return node.type === 'TaggedTemplateExpression' && languages.has(node.tag.name);
}

// tidal highlighting
// this feels kind of stupid, when we also know the location inside the string op (tidal.mjs)
// but maybe it's the only way

function isTemplateLiteral(node, value) {
  return node.type === 'TaggedTemplateExpression' && node.tag.name === value;
}

function collectHaskellMiniLocations(haskellCode, offset) {
  return haskellCode
    .split('')
    .reduce((acc, char, i) => {
      if (char !== '"') {
        return acc;
      }
      if (!acc.length || acc[acc.length - 1].length > 1) {
        acc.push([i + 1]);
      } else {
        acc[acc.length - 1].push(i);
      }
      return acc;
    }, [])
    .map(([start, end]) => {
      const miniString = haskellCode.slice(start, end);
      return getLeafLocations(`"${miniString}"`, offset + start - 1);
    })
    .flat();
}

function tidalWithLocation(value, offset) {
  return {
    type: 'CallExpression',
    callee: {
      type: 'Identifier',
      name: 'tidal',
    },
    arguments: [
      { type: 'Literal', value },
      { type: 'Literal', value: offset },
    ],
    optional: false,
  };
}

function languageWithLocation(name, value, offset) {
  return {
    type: 'CallExpression',
    callee: {
      type: 'Identifier',
      name: name,
    },
    arguments: [
      { type: 'Literal', value },
      { type: 'Literal', value: offset },
    ],
    optional: false,
  };
}

/**
 * Process imports from a .str file and resolve them
 * @param {string} code - The source code
 * @param {Function} fileLoader - async function(path) => string to load file contents
 * @param {Object} options - Transpiler options
 * @returns {Promise<{output: string, exports: Object, imports: Array}>}
 */
export async function transpileWithImports(code, fileLoader, options = {}) {
  // Check if code has imports
  if (!code.includes('import ')) {
    // No imports, just transpile normally
    return transpiler(code, options);
  }

  // Track module exports for imported files
  const moduleExports = new Map();

  // Helper to resolve and load a module
  async function loadModule(modulePath) {
    if (moduleCache.has(modulePath)) {
      return moduleCache.get(modulePath);
    }

    if (!fileLoader) {
      throw new Error('No file loader registered. Call registerFileLoader() first.');
    }

    const moduleCode = await fileLoader(modulePath);
    const result = await transpileWithImports(moduleCode, fileLoader, { ...options, addReturn: false });

    moduleCache.set(modulePath, result);
    return result;
  }

  // First pass: transpile to get import info
  const firstPass = transpiler(code, { ...options, onImport: () => { } });

  if (!firstPass.imports || firstPass.imports.length === 0) {
    return firstPass;
  }

  // Load all imported modules
  const importPromises = firstPass.imports.map(async (importNode) => {
    const modulePath = importNode.source.value;
    const module = await loadModule(modulePath);
    return { modulePath, module, node: importNode };
  });

  const loadedModules = await Promise.all(importPromises);

  // Build import prefix code
  let importCode = '';
  loadedModules.forEach(({ modulePath, module, node }) => {
    // Store exports for this module
    moduleExports.set(modulePath, module.exports || {});

    // For each imported specifier, create a variable
    node.specifiers.forEach(spec => {
      const importedName = spec.imported?.name || 'default';
      const localName = spec.local.name;

      // Check if the export exists
      if (module.exports && !module.exports[importedName]) {
        console.warn(`Warning: '${importedName}' is not exported from '${modulePath}'`);
      }

      importCode += `const ${localName} = globalThis.__strudelModules__['${modulePath}'].${importedName};\n`;
    });
  });

  // Inject loaded module code and exports into global scope
  let preamble = '';
  loadedModules.forEach(({ modulePath, module }) => {
    if (!module.exports || Object.keys(module.exports).length === 0) {
      return;
    }

    preamble += `if (!globalThis.__strudelModules__) globalThis.__strudelModules__ = {};\n`;
    preamble += `if (!globalThis.__strudelModules__['${modulePath}']) {\n`;
    preamble += `  globalThis.__strudelModules__['${modulePath}'] = {};\n`;

    // Execute the module code to populate exports
    preamble += `  (function() {\n`;
    preamble += `    ${module.output}\n`;
    Object.keys(module.exports).forEach(exportName => {
      preamble += `    globalThis.__strudelModules__['${modulePath}'].${exportName} = ${exportName};\n`;
    });
    preamble += `  })();\n`;
    preamble += `}\n`;
  });

  // Combine: preamble + imports + original code (without import statements)
  const finalOutput = preamble + importCode + firstPass.output;

  return {
    ...firstPass,
    output: finalOutput,
  };
}
