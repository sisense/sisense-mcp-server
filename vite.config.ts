import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error('INPUT environment variable is not set (e.g. INPUT=view.html)');
}

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    sourcemap: false,
    cssMinify: true,
    minify: true,
    rollupOptions: {
      input: INPUT,
    },
    outDir: 'dist',
    emptyOutDir: false,
  },
});
