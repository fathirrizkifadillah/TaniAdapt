import { getPgPool, ensureDbSchema, parseReqBody, hashPassword } from '../dbHelper.js';

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
    const { email, password, full_name, user_type = 'petani', profile } = body;

    if (!email || !password || !full_name) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Email, password, dan nama lengkap wajib diisi.' }));
    }

    await ensureDbSchema();
    const p = getPgPool();
    const passHash = hashPassword(password);

    try {
      const userRes = await p.query(
        'INSERT INTO users (email, password_hash, full_name, user_type) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, user_type, created_at',
        [email.toLowerCase().trim(), passHash, full_name.trim(), user_type]
      );
      const user = userRes.rows[0];

      let profRow = null;
      if (profile) {
        const profRes = await p.query(
          `INSERT INTO user_profiles (user_id, commodity, location_name, latitude, longitude, planting_date, hst, farm_area_ha, organization_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
            user.id,
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
        profRow = profRes.rows[0];
      }

      if (profile && (profile.organization_name || profile.commodity)) {
        try {
          const plotId = `plot-${user.id}-${Date.now().toString(36)}`;
          await p.query(
            `INSERT INTO plots (id, user_id, name, location_id, place_name, crop_id, plant_date, hst, stage_name, risk, area_ha)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO NOTHING`,
            [
              plotId,
              user.id,
              profile.organization_name || 'Petak Utama',
              'loc-lembang',
              profile.location_name || 'Lembang, Kab. Bandung Barat',
              profile.commodity || 'cabai',
              profile.planting_date || new Date().toISOString().split('T')[0],
              profile.hst || 0,
              'Vegetatif Awal',
              'RENDAH',
              profile.farm_area_ha || 1.0,
            ]
          );
        } catch (plotErr) {
          console.warn('[TaniAdapt Backend] Inisialisasi plot baru:', plotErr);
        }
      }

      res.statusCode = 201;
      return res.end(JSON.stringify({
        success: true,
        user,
        profile: profRow,
        db: 'postgresql',
      }));
    } catch (dbErr: any) {
      if (dbErr.code === '23505') {
        res.statusCode = 409;
        return res.end(JSON.stringify({ error: 'Email sudah terdaftar. Silakan login.' }));
      }
      throw dbErr;
    }
  } catch (err: any) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: err.message || 'Internal server error',
    }));
  }
}
