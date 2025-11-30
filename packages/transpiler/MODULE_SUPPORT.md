# Module Import/Export Support for Strudel

This feature adds ES6 `import`/`export` support to Strudel `.str` files, enabling better code organization and pattern reusability.

## Usage

### Basic Example

**patterns.str**
```javascript
// Export individual patterns
export const drums = s("bd sd bd sd")
export const bass = n("c2 e2 g2 c3").s("sawtooth")
export const melody = n("0 2 4 7").scale("C:minor").s("piano")

// You can also export computed values
export const tempo = 120
```

**main.str**
```javascript
import { drums, bass, melody } from "./patterns.str"

// Use imported patterns
stack(
  drums,
  bass.slow(2),
  melody.fast(2)
)
```

### Setting Up the File Loader

#### In Browser/Web Environment

```javascript
import { transpileWithImports, registerFileLoader } from '@strudel/transpiler';
import { createBrowserFileLoader } from '@strudel/transpiler/fileLoader.mjs';

// Register the file loader
const fileLoader = createBrowserFileLoader(window.location.href);
registerFileLoader(fileLoader);

// Transpile code with imports
const code = `
import { drums } from "./patterns.str"
drums.fast(2)
`;

const result = await transpileWithImports(code, fileLoader);
// result.output contains the transpiled code with all imports resolved
```

#### In Node.js Environment

```javascript
import { transpileWithImports } from '@strudel/transpiler';
import { createNodeFileLoader } from '@strudel/transpiler/fileLoader.mjs';

const fileLoader = createNodeFileLoader('/path/to/your/strudel/files');
const code = `import { drums } from "./patterns.str"\ndrums`;

const result = await transpileWithImports(code, fileLoader);
```

#### For Testing (Memory Loader)

```javascript
import { transpileWithImports } from '@strudel/transpiler';
import { createMemoryFileLoader } from '@strudel/transpiler/fileLoader.mjs';

const files = {
  './patterns.str': 'export const drums = s("bd sd")',
  './melody.str': 'export const lead = n("0 2 4 7").s("piano")'
};

const fileLoader = createMemoryFileLoader(files);
const code = `
import { drums } from "./patterns.str"
import { lead } from "./melody.str"
stack(drums, lead)
`;

const result = await transpileWithImports(code, fileLoader);
```

## Features

- ✅ Named exports: `export const pattern = ...`
- ✅ Named imports: `import { pattern1, pattern2 } from "./file.str"`
- ✅ Relative file paths: `"./file.str"`, `"../shared/patterns.str"`
- ✅ Auto file extension: `"./file"` automatically resolves to `"./file.str"`
- ✅ Module caching: Files are only loaded and transpiled once
- ✅ Circular dependency detection (via module cache)
- ⚠️ Default exports not yet supported
- ⚠️ Wildcard imports (`import * as`) not yet supported

## API

### `transpileWithImports(code, fileLoader, options)`

Transpile Strudel code with import/export support.

**Parameters:**
- `code` (string): The Strudel code to transpile
- `fileLoader` (Function): Async function `(path) => string` that loads file contents
- `options` (Object): Transpiler options (same as standard `transpiler()` function)

**Returns:** Promise<{output, miniLocations, widgets, imports, exports}>

### `registerFileLoader(loader)`

Register a global file loader (optional, can also pass directly to `transpileWithImports`).

**Parameters:**
- `loader` (Function): Async function `(path) => string`

### `clearModuleCache()`

Clear the module cache. Useful when files change during development.

## Implementation Details

The module system works by:

1. Parsing code with `sourceType: 'module'` to support import/export syntax
2. Extracting import/export declarations from the AST
3. Recursively loading imported files using the provided file loader
4. Transpiling imported files and caching results
5. Injecting module exports into `globalThis.__strudelModules__`
6. Replacing import statements with variable declarations that reference cached exports
7. Generating final output with all dependencies resolved

## Migration Guide

### Before (no modules):
```javascript
// Everything in one file
const drums = s("bd sd")
const bass = n("c2 e2").s("sawtooth")
const melody = n("0 2 4 7").scale("C:minor")

stack(drums, bass, melody)
```

### After (with modules):

**drums.str**
```javascript
export const kicks = s("bd*4")
export const snares = s("~ sd")
export const drums = stack(kicks, snares)
```

**main.str**
```javascript
import { drums } from "./drums.str"
import { bass } from "./bass.str"
import { melody } from "./melody.str"

stack(drums, bass, melody)
```

## Notes

- Module paths are always relative to the file loader's base path
- Exports are stored in `globalThis.__strudelModules__` to work with Strudel's `Function()` evaluation
- Circular imports are handled via the module cache
- All imports are static (dynamic `import()` not supported)
