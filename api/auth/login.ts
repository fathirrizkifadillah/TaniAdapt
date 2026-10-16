import { getPgPool, ensureDbSchema, hashPassword, parseReqBody } from '../dbHelper.ts';

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

    await ensureDbSchema();
    const pool = getPgPool();
    const passHash = hashPassword(password);

    const userRes = await pool.query(
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
    const profRes = await pool.query('SELECT * FROM farmer_profiles WHERE user_id = ', [user.id]);
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
