import { Pool } from 'pg';
import crypto from 'crypto';

let pool: Pool | null = null;

function getPgPool(): Pool {
  if (pool) return pool;
  const rawUrl = process.env.DATABASE_URL || '';
  const cleanUrl = rawUrl.replace('&channel_binding=require', '').replace('channel_binding=require&', '');
  pool = new Pool({
    connectionString: cleanUrl,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    max: 10,
    ssl: { rejectUnauthorized: false }
  });
  return pool;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'taniadapt_salt_2026').digest('hex');
}

function parseReqBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'string') {
      try { return Promise.resolve(JSON.parse(req.body)); } catch { return Promise.resolve({}); }
    }
    return Promise.resolve(req.body);
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => (body += chunk));
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  try {
    const body = await parseReqBody(req);
    const { email, password } = body;

    if (!email || !password) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Email dan password wajib diisi.' }));
    }

    const p = getPgPool();
    const passHash = hashPassword(password);

    const userRes = await p.query(
      'SELECT id, email, full_name, user_type, created_at, password_hash FROM users WHERE email = ',
      [email.toLowerCase().trim()]
    );

    if (userRes.rows.length === 0) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'Email atau kata sandi tidak cocok.' }));
    }

    const row = userRes.rows[0];
    if (row.password_hash !== passHash) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'Email atau kata sandi tidak cocok.' }));
    }

    const { password_hash, ...user } = row;
    const profRes = await p.query('SELECT * FROM farmer_profiles WHERE user_id = ', [user.id]);
    const profile = profRes.rows[0] || null;

    res.statusCode = 200;
    return res.end(JSON.stringify({
      success: true,
      user,
      profile,
      db: 'postgresql',
    }));
  } catch (err: any) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
}
