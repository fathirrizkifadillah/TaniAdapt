import { Pool } from 'pg';
import crypto from 'crypto';

let pool: Pool | null = null;
let tablesInitialized = false;

export function getPgPool(): Pool {
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

export async function ensureDbSchema() {
  if (tablesInitialized) return;
  const p = getPgPool();
  const client = await p.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        user_type VARCHAR(50) NOT NULL DEFAULT 'petani',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
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
    `);
    tablesInitialized = true;
  } finally {
    client.release();
  }
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'taniadapt_salt_2026').digest('hex');
}

export function parseReqBody(req: any): Promise<any> {
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
