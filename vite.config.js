import { defineConfig } from 'vite';

// Library build: single dependency-free IIFE file that exposes window.ViewBuilder.
// The CSS is imported with ?inline and injected into the component shadow root,
// so no separate stylesheet has to be deployed to the XPages app.
export default defineConfig({
  build: {
    target: 'es2018',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: 'src/lib/index.js',
      name: 'ViewBuilder',
      formats: ['iife'],
      fileName: () => 'view-builder.js',
    },
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
});
