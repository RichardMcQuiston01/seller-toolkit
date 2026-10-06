import { defineConfig } from 'tsup';

// One entry per public subpath. Add new modules here and in package.json
// "exports" together.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'review-window': 'src/review-window.ts',
    'thank-you': 'src/thank-you.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  platform: 'neutral',
  tsconfig: 'tsconfig.json',
});
