import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built app can be served from any sub-path or file host.
  base: './',
  build: {
    // three.js is a single large library and we intentionally ship it in one
    // chunk (no code-splitting benefit for a one-page WebGL app). Raise the
    // warning limit so `npm run build` is warning-free.
    chunkSizeWarningLimit: 1200,
  },
});
