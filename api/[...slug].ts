import type { IncomingMessage, ServerResponse } from 'http';
import { authMiddleware } from '../src/server/authApi';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    await authMiddleware(req, res, () => {
      if (!res.writableEnded) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Endpoint API tidak ditemukan' }));
      }
    });
  } catch (err: any) {
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Serverless Handler Error', message: err?.message || String(err) }));
    }
  }
}
