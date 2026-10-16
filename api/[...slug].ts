import type { IncomingMessage, ServerResponse } from 'http';
import { authMiddleware } from '../src/server/authApi';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    return authMiddleware(req, res, () => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify({ error: 'Endpoint API tidak ditemukan' }));
    });
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify({ error: 'Serverless Handler Error', message: err?.message || String(err) }));
  }
}
