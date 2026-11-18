import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base + hash routing: the same build works on Cloudflare Pages (root)
// and on GitHub Pages project URLs (https://user.github.io/repo-name/).
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: { target: 'es2020' },
});
