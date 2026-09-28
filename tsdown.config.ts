import manifest from './package.json' with { type: 'json' }
import { defineConfig } from 'tsdown'
export default defineConfig([{
  entry: ['src/index.ts'], outDir: 'lib', format: 'esm', platform: 'node', target: 'es2024', clean: false, dts: false,
  deps: { neverBundle: [/^@deepseek-ai\//, /^@earendil-works\//] },
  outputOptions: { entryFileNames: '[name].js' },
}, {
  entry: { client: 'src/client/index.tsx' }, outDir: 'lib', format: 'cjs', platform: 'browser', target: 'es2024', clean: false,
  deps: { neverBundle: [/^@deepseek-ai\//, 'react', 'react/jsx-runtime'] },
  outputOptions: {
    entryFileNames: 'client.js', banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(manifest.name)}, factory: (require) => {`,
    footer: 'return module.exports; } });', intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}])
