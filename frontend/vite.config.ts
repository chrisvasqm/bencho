import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Same port vars as compose; the e2e tests set their own so they never share the dev stack.
const frontendPort = Number(process.env.FRONTEND_PORT ?? 10004);
const backendPort = Number(process.env.BACKEND_PORT ?? 10003);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: frontendPort,
    strictPort: true,
    proxy: { '/api': `http://localhost:${backendPort}` },
  },
});
