import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Rust builds and runtime profiles/evidence are not frontend source.
    watch: { ignored: ['**/.runtime/**', '**/target/**', '**/docs/examples/generated/**'] },
    proxy: { '/api/team': 'http://127.0.0.1:4317' },
  },
  build: { target: 'es2022' },
});
