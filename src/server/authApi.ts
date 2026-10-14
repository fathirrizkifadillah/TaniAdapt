import { IncomingMessage, ServerResponse } from 'http';
import { Pool } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// PostgreSQL Pool configuration
// Uses process.env.DATABASE_URL or default local connection
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/taniadapt';

let pool: Pool | null = null;
let isDbConnected = false;

// Fallback local storage file if PostgreSQL is not yet configured or credentials mismatch
const LOCAL_DB_PATH = path.resolve(process.cwd(), 'data', 'local_users_db.json');

interface UserRecord {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  user_type: 'petani' | 'farm_organisasi';
  created_at: string;
}

interface ProfileRecord {
  user_id: number;
  commodity: string;
  location_name: string;
  latitude: number;
  longitude: number;
  planting_date: string;
  hst: number;
  farm_area_ha: number;
  organization_name?: string;
  updated_at: string;
}

function ensureLocalDb(): { users: UserRecord[]; profiles: ProfileRecord[] } {
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      const initial = { users: [], profiles: [] };
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }
    return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8'));
  } catch {
    return { users: [], profiles: [] };
  }
}

function saveLocalDb(data: { users: UserRecord[]; profiles: ProfileRecord[] }) {
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn('Failed to save local db:', err);
  }
}

// Initialize PostgreSQL Schema
async function initPgPool() {
  if (pool) return;
  try {
    pool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        user_type VARCHAR(50) DEFAULT 'petani',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        commodity VARCHAR(50) NOT NULL,
        location_name VARCHAR(255) NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        planting_date DATE,
        hst INTEGER DEFAULT 55,
        farm_area_ha DOUBLE PRECISION DEFAULT 1.0,
        organization_name VARCHAR(255),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    client.release();
    isDbConnected = true;
    console.log('[TaniAdapt Auth] Connected to PostgreSQL successfully!');
  } catch (err: any) {
    isDbConnected = false;
    console.warn('[TaniAdapt Auth] PostgreSQL not reachable, using persistent local fallback DB:', err.message);
  }
}

// Start pool initialization
initPgPool();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'taniadapt_salt_2026').digest('hex');
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export function authMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = req.url || '';

  if (!url.startsWith('/api/auth')) {
    return next();
  }

  // Handle API Auth endpoints
  (async () => {
    try {
      if (req.method === 'GET' && url === '/api/auth/status') {
        return sendJson(res, 200, {
          db_engine: isDbConnected ? 'PostgreSQL 17' : 'Persistent Local Storage (PostgreSQL Fallback)',
          is_postgres: isDbConnected,
        });
      }

      if (req.method === 'POST' && url === '/api/auth/register') {
        const body = await parseJsonBody(req);
        const { email, password, full_name, user_type = 'petani', profile } = body;

        if (!email || !password || !full_name) {
          return sendJson(res, 400, { error: 'Email, password, dan nama lengkap wajib diisi.' });
        }

        const passHash = hashPassword(password);

        if (isDbConnected && pool) {
          try {
            const userRes = await pool.query(
              'INSERT INTO users (email, password_hash, full_name, user_type) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, user_type, created_at',
              [email.toLowerCase().trim(), passHash, full_name.trim(), user_type]
            );
            const user = userRes.rows[0];

            let profRow = null;
            if (profile) {
              const profRes = await pool.query(
                `INSERT INTO user_profiles (user_id, commodity, location_name, latitude, longitude, planting_date, hst, farm_area_ha, organization_name)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [
                  user.id,
                  profile.commodity || 'cabai',
                  profile.location_name || 'Lembang, Kab. Bandung Barat',
                  profile.latitude || -6.8167,
                  profile.longitude || 107.6167,
                  profile.planting_date || '2026-08-19',
                  profile.hst || 55,
                  profile.farm_area_ha || 1.0,
                  profile.organization_name || '',
                ]
              );
              profRow = profRes.rows[0];
            }

            return sendJson(res, 201, {
              success: true,
              user,
              profile: profRow,
              db: 'postgresql',
            });
          } catch (dbErr: any) {
            if (dbErr.code === '23505') {
              return sendJson(res, 409, { error: 'Email sudah terdaftar. Silakan login.' });
            }
            throw dbErr;
          }
        }

        // Local DB Fallback
        const localData = ensureLocalDb();
        if (localData.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
          return sendJson(res, 409, { error: 'Email sudah terdaftar. Silakan login.' });
        }

        const newUser: UserRecord = {
          id: localData.users.length + 1,
          email: email.toLowerCase().trim(),
          password_hash: passHash,
          full_name: full_name.trim(),
          user_type,
          created_at: new Date().toISOString(),
        };
        localData.users.push(newUser);

        let newProfile: ProfileRecord | null = null;
        if (profile) {
          newProfile = {
            user_id: newUser.id,
            commodity: profile.commodity || 'cabai',
            location_name: profile.location_name || 'Lembang, Kab. Bandung Barat',
            latitude: profile.latitude || -6.8167,
            longitude: profile.longitude || 107.6167,
            planting_date: profile.planting_date || '2026-08-19',
            hst: profile.hst || 55,
            farm_area_ha: profile.farm_area_ha || 1.0,
            organization_name: profile.organization_name || '',
            updated_at: new Date().toISOString(),
          };
          localData.profiles.push(newProfile);
        }

        saveLocalDb(localData);
        return sendJson(res, 201, {
          success: true,
          user: {
            id: newUser.id,
            email: newUser.email,
            full_name: newUser.full_name,
            user_type: newUser.user_type,
            created_at: newUser.created_at,
          },
          profile: newProfile,
          db: 'local_fallback',
        });
      }

      if (req.method === 'POST' && url === '/api/auth/login') {
        const body = await parseJsonBody(req);
        const { email, password } = body;

        if (!email || !password) {
          return sendJson(res, 400, { error: 'Email dan password wajib diisi.' });
        }

        const passHash = hashPassword(password);

        if (isDbConnected && pool) {
          const userRes = await pool.query(
            'SELECT id, email, full_name, user_type, created_at, password_hash FROM users WHERE email = $1',
            [email.toLowerCase().trim()]
          );
          if (userRes.rows.length === 0 || userRes.rows[0].password_hash !== passHash) {
            return sendJson(res, 401, { error: 'Email atau password salah.' });
          }
          const user = userRes.rows[0];
          delete user.password_hash;

          const profRes = await pool.query(
            'SELECT * FROM user_profiles WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1',
            [user.id]
          );

          return sendJson(res, 200, {
            success: true,
            user,
            profile: profRes.rows[0] || null,
            db: 'postgresql',
          });
        }

        // Local DB Fallback
        const localData = ensureLocalDb();
        const user = localData.users.find(
          u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password_hash === passHash
        );

        if (!user) {
          return sendJson(res, 401, { error: 'Email atau password salah.' });
        }

        const profile = localData.profiles.find(p => p.user_id === user.id) || null;

        return sendJson(res, 200, {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            user_type: user.user_type,
            created_at: user.created_at,
          },
          profile,
          db: 'local_fallback',
        });
      }

      if (req.method === 'POST' && url === '/api/auth/profile') {
        const body = await parseJsonBody(req);
        const { user_id, profile } = body;

        if (!user_id || !profile) {
          return sendJson(res, 400, { error: 'User ID dan data profil wajib diisi.' });
        }

        if (isDbConnected && pool) {
          await pool.query(
            `INSERT INTO user_profiles (user_id, commodity, location_name, latitude, longitude, planting_date, hst, farm_area_ha, organization_name, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             ON CONFLICT (id) DO UPDATE SET
               commodity = EXCLUDED.commodity,
               location_name = EXCLUDED.location_name,
               latitude = EXCLUDED.latitude,
               longitude = EXCLUDED.longitude,
               planting_date = EXCLUDED.planting_date,
               hst = EXCLUDED.hst,
               farm_area_ha = EXCLUDED.farm_area_ha,
               organization_name = EXCLUDED.organization_name,
               updated_at = NOW()`,
            [
              user_id,
              profile.commodity || 'cabai',
              profile.location_name || 'Lembang, Kab. Bandung Barat',
              profile.latitude || -6.8167,
              profile.longitude || 107.6167,
              profile.planting_date || '2026-08-19',
              profile.hst || 55,
              profile.farm_area_ha || 1.0,
              profile.organization_name || '',
            ]
          );

          const updated = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1', [user_id]);
          return sendJson(res, 200, { success: true, profile: updated.rows[0] });
        }

        // Local DB Fallback
        const localData = ensureLocalDb();
        let existing = localData.profiles.find(p => p.user_id === user_id);
        if (existing) {
          Object.assign(existing, profile, { updated_at: new Date().toISOString() });
        } else {
          existing = {
            user_id,
            commodity: profile.commodity || 'cabai',
            location_name: profile.location_name || 'Lembang, Kab. Bandung Barat',
            latitude: profile.latitude || -6.8167,
            longitude: profile.longitude || 107.6167,
            planting_date: profile.planting_date || '2026-08-19',
            hst: profile.hst || 55,
            farm_area_ha: profile.farm_area_ha || 1.0,
            organization_name: profile.organization_name || '',
            updated_at: new Date().toISOString(),
          };
          localData.profiles.push(existing);
        }
        saveLocalDb(localData);
        return sendJson(res, 200, { success: true, profile: existing });
      }

      sendJson(res, 404, { error: 'Auth endpoint not found' });
    } catch (err: any) {
      console.error('[TaniAdapt Auth Error]', err);
      sendJson(res, 500, { error: 'Internal Auth Server Error', message: err.message });
    }
  })();
}
