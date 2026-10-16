import { getPgPool, hashPassword, parseReqBody } from '../dbHelper';

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
      'SELECT id, email, full_name, user_type, created_at, password_hash FROM users WHERE email = $1',
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

    const user = {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      user_type: row.user_type,
      created_at: row.created_at,
    };

    const profRes = await p.query('SELECT * FROM user_profiles WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1', [user.id]);

    res.statusCode = 200;
    return res.end(JSON.stringify({
      success: true,
      user,
      profile: profRes.rows[0] || null,
      db: 'postgresql',
    }));
  } catch (err: any) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
}
