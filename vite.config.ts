import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';


export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');


  return {
    root: 'client',
    base: '/', // Ensures all compiled JS/CSS bundles resolve cleanly from root
    plugins: [react()],
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
  };
});