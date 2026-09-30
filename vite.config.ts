import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the build works at a domain root (Vercel) and
  // under a sub-path like projek-cca.github.io/content-system/ (GitHub Pages).
  base: './',
});
