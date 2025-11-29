import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, 'renderer'),
  base: './',
  build: {
    outDir: path.join(__dirname, 'dist-renderer'),
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'renderer', 'src'),
    },
  },
  server: {
    port: 5173,
  },
});
