import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: {
      entry: fileURLToPath(new URL('inspector.jsx', import.meta.url)),
      formats: ['es'],
      fileName: () => 'inspector.js',
      cssFileName: 'inspector',
    },
  },
});
