import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dist = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');
const external = ['vue', '@vue/runtime-core', 'react', 'react-dom', '@nuxt/kit', '@nuxt/schema'];

const entries = {
  'responsive-media': 'index.js',
  'responsive-media/vue': 'vue-responsive.js',
  'responsive-media/react': 'react-responsive.js',
  'responsive-media/presets': 'presets.js',
  'responsive-media/container': 'container-state.js',
  'responsive-media/testing': 'testing.js',
};

const imports = {
  'createResponsiveState (root)': ['index.js', 'createResponsiveState'],
  'useResponsive (vue)': ['vue-responsive.js', 'useResponsive'],
  'useMediaQuery (vue)': ['vue-responsive.js', 'useMediaQuery'],
  'defineResponsive (vue)': ['vue-responsive.js', 'defineResponsive'],
  'useResponsive (react)': ['react-responsive.js', 'useResponsive'],
};

async function measure(contents) {
  const result = await build({
    stdin: { contents, resolveDir: dist, loader: 'js' },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    external,
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].contents;
  return { min: code.length, gzip: gzipSync(code).length };
}

const kb = (bytes) => `${(bytes / 1024).toFixed(2)} kB`;
const row = (name, size) => `| ${name.padEnd(30)} | ${kb(size.min).padStart(9)} | ${kb(size.gzip).padStart(9)} |`;

console.log('| Entry point                    |       min |      gzip |');
console.log('| ------------------------------ | --------- | --------- |');
for (const [name, file] of Object.entries(entries)) {
  console.log(row(name, await measure(`export * from './${file}';`)));
}

console.log('');
console.log('| Import                         |       min |      gzip |');
console.log('| ------------------------------ | --------- | --------- |');
for (const [name, [file, symbol]] of Object.entries(imports)) {
  console.log(row(name, await measure(`import { ${symbol} } from './${file}'; console.log(${symbol});`)));
}
