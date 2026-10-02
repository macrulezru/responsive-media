// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const external = ['vue', '@vue/runtime-core', 'react', 'react-dom', '@nuxt/kit', '@nuxt/schema'];

async function bundle(contents: string): Promise<string> {
  const result = await build({
    stdin: { contents, resolveDir: root, loader: 'ts' },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    external,
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

describe('tree shaking', () => {
  it('declares the package free of side effects', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.sideEffects).toBe(false);
  });

  it('does not pull the shared state into a bundle that only needs a media query', async () => {
    const code = await bundle("import { useMediaQuery } from './src/vue-responsive'; console.log(useMediaQuery)");
    expect(code).not.toContain('syncCSSVars');
    expect(code).not.toContain('getSsrState');
    expect(code.length).toBeLessThan(2048);
  });

  it('drops the shared state from a bundle that only builds CSS strings', async () => {
    const code = await bundle("import { toScssModule } from './src/css'; console.log(toScssModule)");
    expect(code).not.toContain('syncCSSVars');
    expect(code).not.toContain('getSsrState');
  });

  it('keeps the shared state when something uses it', async () => {
    const code = await bundle("import { responsiveState } from './src/index'; console.log(responsiveState)");
    expect(code).toContain('syncCSSVars');
  });

  it('keeps createResponsiveState working without the shared singleton', async () => {
    const code = await bundle("import { createResponsiveState } from './src/index'; console.log(createResponsiveState)");
    expect(code).toContain('syncCSSVars');
    expect(code.length).toBeLessThan(8 * 1024);
  });
});
