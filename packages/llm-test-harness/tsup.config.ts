import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['@anthropic-ai/sdk', 'openai', 'js-yaml', 'ajv'],
  esbuildOptions(options) {
    options.target = 'es2020'
  },
})
