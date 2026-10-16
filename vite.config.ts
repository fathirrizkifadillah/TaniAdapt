import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from './src/server/authApi';
import { setupTelemetryWebSocketServer } from './src/server/wsServer';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    {
      name: 'taniadapt-auth-api',
      configureServer(server) {
        server.middlewares.use(authMiddleware);
        if (server.httpServer) {
          setupTelemetryWebSocketServer(server.httpServer);
        }
      },
      configurePreviewServer(server) {
        server.middlewares.use(authMiddleware);
        if (server.httpServer) {
          setupTelemetryWebSocketServer(server.httpServer);
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
