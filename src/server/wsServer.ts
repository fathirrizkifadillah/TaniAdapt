import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

export function setupTelemetryWebSocketServer(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url || '';
    if (url.startsWith('/ws/telemetry') || url.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    // Send immediate handshake
    ws.send(
      JSON.stringify({
        type: 'TELEMETRY_CONNECTED',
        status: 'STREAMING_ACTIVE',
        timestamp: new Date().toISOString(),
        message: 'Terkoneksi ke live telemetri stasiun cuaca TaniAdapt',
      })
    );

    // Periodic heartbeat pulse every 8 seconds
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'TELEMETRY_PULSE',
            timestamp: new Date().toISOString(),
            status: 'HEALTHY',
          })
        );
      }
    }, 8000);

    ws.on('message', (message: string) => {
      try {
        const payload = JSON.parse(message.toString());
        if (payload.type === 'PING') {
          ws.send(
            JSON.stringify({
              type: 'PONG',
              timestamp: new Date().toISOString(),
            })
          );
        }
      } catch {
        // ignore malformed frame
      }
    });

    ws.on('close', () => {
      clearInterval(interval);
    });
  });

  console.log('[TaniAdapt WS] Real-time Telemetry WebSocket Server initialized at /ws/telemetry');
}
