import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      // Forwards to `vercel dev` (default port 3000) when developing
      // against the serverless API locally.
      '/api': {
        target: 'http://localhost:3000',
      },
    },
  },
});
