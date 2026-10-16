import { getPgPool, ensureDbSchema } from '../dbHelper';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      db_engine: 'Persistent Local Storage (PostgreSQL Fallback)',
      is_postgres: false,
      database_url_configured: false,
    }));
  }

  try {
    await ensureDbSchema();
    const pool = getPgPool();
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    res.statusCode = 200;
    return res.end(JSON.stringify({
      db_engine: 'Neon Cloud PostgreSQL',
      is_postgres: true,
      database_url_configured: true,
      server_time: result.rows[0].now,
    }));
  } catch (err: any) {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      db_engine: 'Persistent Local Storage (PostgreSQL Fallback)',
      is_postgres: false,
      database_url_configured: true,
      error: err.message,
    }));
  }
}
