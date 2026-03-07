import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Use relative asset paths so the same build works at any URL prefix
  // (e.g. locally at / or behind nginx at /study/).
  base: './',

  // Serve files from public/ at the root during dev and copy them to dist/ on build.
  // This is where stimuli images live (public/stimuli/).
  publicDir: resolve(__dirname, 'public'),

  // Dev server settings — only used by `npm run dev`, not in production.
  server: {
    port: 3000,
    open: true,
  },
});
