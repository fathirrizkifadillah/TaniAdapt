import { Pool } from 'pg';

let pool: Pool | null = null;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ connected: false, error: 'DATABASE_URL not set' }));
  }

  try {
    if (!pool) {
      const cleanDbUrl = dbUrl.replace('&channel_binding=require', '').replace('channel_binding=require&', '');
      pool = new Pool({
        connectionString: cleanDbUrl,
        ssl: { rejectUnauthorized: false }
      });
    }
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ connected: true, server_time: result.rows[0].now }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ connected: false, error: err.message }));
  }
}
