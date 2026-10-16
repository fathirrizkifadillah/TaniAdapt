import { getPgPool, ensureDbSchema, parseReqBody } from '../dbHelper';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    await ensureDbSchema();
    const pool = getPgPool();

    if (req.method === 'GET') {
      const urlObj = new URL(req.url, 'http://localhost');
      const userId = urlObj.searchParams.get('user_id');
      if (!userId) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'user_id wajib disertakan' }));
      }
      const profRes = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1', [parseInt(userId, 10)]);
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, profile: profRes.rows[0] || null }));
    }

    if (req.method === 'POST') {
      const body = await parseReqBody(req);
      const { user_id, profile } = body;
      if (!user_id || !profile) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'User ID dan data profil wajib diisi.' }));
      }

      const profRes = await pool.query(
        `INSERT INTO user_profiles (user_id, commodity, location_name, latitude, longitude, planting_date, hst, farm_area_ha, organization_name, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           commodity = EXCLUDED.commodity,
           location_name = EXCLUDED.location_name,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           planting_date = EXCLUDED.planting_date,
           hst = EXCLUDED.hst,
           farm_area_ha = EXCLUDED.farm_area_ha,
           organization_name = EXCLUDED.organization_name,
           updated_at = NOW()
         RETURNING *`,
        [
          user_id,
          profile.commodity || 'cabai',
          profile.location_name || 'Lembang, Kab. Bandung Barat',
          profile.latitude || -6.8167,
          profile.longitude || 107.6167,
          profile.planting_date || new Date().toISOString().split('T')[0],
          profile.hst || 0,
          profile.farm_area_ha || 1.0,
          profile.organization_name || '',
        ]
      );

      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, profile: profRes.rows[0] }));
    }

    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  } catch (err: any) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
}
