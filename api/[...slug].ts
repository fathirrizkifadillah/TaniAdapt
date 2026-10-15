import type { IncomingMessage, ServerResponse } from 'http';
import { authMiddleware } from '../src/server/authApi';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return authMiddleware(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Endpoint API tidak ditemukan' }));
  });
}
