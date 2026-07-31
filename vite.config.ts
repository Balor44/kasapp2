import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';


export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');


  return {
    // Point Vite directly to the client directory where index.html lives
    root: 'client',
    plugins: [react()],
    build: {
      // OutDir relative to client root -> outputs to ../dist at root
      outDir: '../dist',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  };
});
