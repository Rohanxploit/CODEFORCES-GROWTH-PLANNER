import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // In development the client calls /api on its own origin and Vite forwards
    // it to the Express server, so no CORS setup is needed locally.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
