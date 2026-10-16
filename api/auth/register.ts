import { Pool } from 'pg';
import crypto from 'crypto';

let pool: Pool | null = null;
let tablesInitialized = false;

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

async function ensureDbSchema() {
  if (tablesInitialized) return;
  const p = getPgPool();
  const client = await p.connect();
  try {
    await client.query(
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        user_type VARCHAR(50) NOT NULL DEFAULT 'petani',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS farmer_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        commodity VARCHAR(100) DEFAULT 'cabai',
        location_name VARCHAR(255) DEFAULT 'Lembang, Kab. Bandung Barat',
        latitude DOUBLE PRECISION DEFAULT -6.8167,
        longitude DOUBLE PRECISION DEFAULT 107.6167,
        planting_date DATE DEFAULT CURRENT_DATE,
        hst INTEGER DEFAULT 0,
        farm_area_ha DOUBLE PRECISION DEFAULT 1.0,
        organization_name VARCHAR(255) DEFAULT '',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS plots (
        id VARCHAR(100) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        location_id VARCHAR(100) NOT NULL,
        place_name VARCHAR(255) NOT NULL,
        crop_id VARCHAR(50) NOT NULL,
        plant_date DATE NOT NULL,
        hst INTEGER DEFAULT 0,
        stage_name VARCHAR(255),
        risk VARCHAR(50) DEFAULT 'RENDAH',
        area_ha DOUBLE PRECISION DEFAULT 1.0,
        trail JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_plots_user_id ON plots(user_id);
    );
    tablesInitialized = true;
  } finally {
    client.release();
  }
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'taniadapt_salt_2026').digest('hex');
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
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
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
        'INSERT INTO users (email, password_hash, full_name, user_type) VALUES (, , , ) RETURNING id, email, full_name, user_type, created_at',
        [email.toLowerCase().trim(), passHash, full_name.trim(), user_type]
      );
      const user = userRes.rows[0];

      let profRow = null;
      if (profile) {
        const profRes = await p.query(
          INSERT INTO farmer_profiles (user_id, commodity, location_name, latitude, longitude, planting_date, hst, farm_area_ha, organization_name)
           VALUES (, , , , , , , , )
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
           RETURNING *,
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
          const plotId = plot--;
          await p.query(
            INSERT INTO plots (id, user_id, name, location_id, place_name, crop_id, plant_date, hst, stage_name, risk, area_ha)
             VALUES (, , , , , , , , , , )
             ON CONFLICT (id) DO NOTHING,
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
    res.statusCode = 200;
    return res.end(JSON.stringify({
      caught_error: true,
      message: err.message,
      stack: err.stack,
    }));
  }
}
