import { describe, it, expect, beforeEach } from 'vitest';
import { transpiler, transpileWithImports, clearModuleCache } from '../transpiler.mjs';
import { createMemoryFileLoader } from '../fileLoader.mjs';

describe('Module Import/Export Support', () => {
  beforeEach(() => {
    clearModuleCache();
    // Clear any previously set module exports
    if (globalThis.__strudelModules__) {
      delete globalThis.__strudelModules__;
    }
  });

  it('parses export declarations without throwing sourceType error', () => {
    const code = 'export const drums = s("bd sd")';
    expect(() => transpiler(code, { addReturn: false })).not.toThrow();
  });

  it('parses import declarations without throwing sourceType error', () => {
    const code = 'import { drums } from "./patterns.str"';
    expect(() => transpiler(code, { addReturn: false })).not.toThrow();
  });

  it('tracks exports in transpiler output', () => {
    const code = `
      export const drums = s("bd sd")
      export const bass = n("c2")
    `;
    const result = transpiler(code, { addReturn: false });
    expect(result.exports).toBeDefined();
    expect(result.exports.drums).toBe(true);
    expect(result.exports.bass).toBe(true);
  });

  it('tracks imports in transpiler output', () => {
    const code = 'import { drums, bass } from "./patterns.str"';
    const result = transpiler(code, { addReturn: false });
    expect(result.imports).toBeDefined();
    expect(result.imports.length).toBe(1);
    expect(result.imports[0].source.value).toBe('./patterns.str');
  });

  it('removes export keyword from output', () => {
    const code = 'export const drums = s("bd sd")';
    const result = transpiler(code, { addReturn: false });
    expect(result.output).not.toContain('export');
    expect(result.output).toContain('const drums');
  });

  it('removes import statements from output', () => {
    const code = `
      import { drums } from "./patterns.str"
      drums
    `;
    const result = transpiler(code, { addReturn: false });
    expect(result.output).not.toContain('import');
  });

  describe('transpileWithImports', () => {
    it('loads and resolves a simple import', async () => {
      const files = {
        './patterns.str': 'export const drums = s("bd sd")',
      };
      const fileLoader = createMemoryFileLoader(files);

      const code = `
        import { drums } from "./patterns.str"
        drums.fast(2)
      `;

      const result = await transpileWithImports(code, fileLoader, { addReturn: true });
      
      expect(result.output).toContain('drums');
      expect(result.output).toContain('globalThis.__strudelModules__');
    });

    it('handles multiple imports from same file', async () => {
      const files = {
        './patterns.str': `
          export const drums = s("bd sd")
          export const bass = n("c2")
        `,
      };
      const fileLoader = createMemoryFileLoader(files);

      const code = `
        import { drums, bass } from "./patterns.str"
        stack(drums, bass)
      `;

      const result = await transpileWithImports(code, fileLoader);
      expect(result.output).toContain('drums');
      expect(result.output).toContain('bass');
    });

    it('handles imports from multiple files', async () => {
      const files = {
        './drums.str': 'export const drums = s("bd sd")',
        './bass.str': 'export const bass = n("c2")',
      };
      const fileLoader = createMemoryFileLoader(files);

      const code = `
        import { drums } from "./drums.str"
        import { bass } from "./bass.str"
        stack(drums, bass)
      `;

      const result = await transpileWithImports(code, fileLoader);
      expect(result.output).toContain('drums');
      expect(result.output).toContain('bass');
      expect(result.output).toContain('__strudelModules__');
    });

    it('handles nested imports (transitive dependencies)', async () => {
      const files = {
        './patterns.str': `
          import { kick } from "./drums.str"
          export const pattern = kick
        `,
        './drums.str': 'export const kick = s("bd")',
      };
      const fileLoader = createMemoryFileLoader(files);

      const code = `
        import { pattern } from "./patterns.str"
        pattern
      `;

      const result = await transpileWithImports(code, fileLoader);
      expect(result.output).toContain('pattern');
    });

    it('caches modules to avoid reloading', async () => {
      let loadCount = 0;
      const files = {
        './patterns.str': 'export const drums = s("bd")',
      };
      const fileLoader = async (path) => {
        loadCount++;
        return createMemoryFileLoader(files)(path);
      };

      // First transpile
      await transpileWithImports('import { drums } from "./patterns.str"\ndrums', fileLoader);
      expect(loadCount).toBe(1);

      // Second transpile should use cache
      await transpileWithImports('import { drums } from "./patterns.str"\ndrums', fileLoader);
      expect(loadCount).toBe(1); // Still 1, not 2
    });

    it('handles code without imports normally', async () => {
      const fileLoader = createMemoryFileLoader({});
      const code = 's("bd sd")';
      const result = await transpileWithImports(code, fileLoader);
      
      expect(result.output).toContain('bd sd');
      expect(result.output).not.toContain('import');
    });

    it('auto-adds .str extension to imports', async () => {
      const files = {
        './patterns.str': 'export const drums = s("bd")',
      };
      const fileLoader = createMemoryFileLoader(files);

      const code = `
        import { drums } from "./patterns"
        drums
      `;

      const result = await transpileWithImports(code, fileLoader);
      expect(result.output).toContain('drums');
    });
  });
});
