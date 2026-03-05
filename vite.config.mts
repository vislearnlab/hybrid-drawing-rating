import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  publicDir: resolve(__dirname, 'public'),
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    extensions: ['.ts', '.js', '.d.ts'],
  },
});
