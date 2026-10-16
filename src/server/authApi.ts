import { IncomingMessage, ServerResponse } from 'http';
import { Pool } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Load .env or .env.local automatically in Node.js server context
function loadLocalEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch (err: any) {
        console.warn(`[TaniAdapt Auth] Gagal membaca ${file}:`, err.message);
      }
    }
  }
}
loadLocalEnv();

// PostgreSQL Pool configuration
let pool: Pool | null = null;
let isDbConnected = false;
let lastConnectionAttempt = 0;

// Fallback local storage files if PostgreSQL is not yet configured or offline
const LOCAL_DB_PATH = path.resolve(process.cwd(), 'data', 'local_users_db.json');
const LOCAL_PLOTS_PATH = path.resolve(process.cwd(), 'data', 'local_plots.json');

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

interface PlotRecord {
  id: string;
  user_id?: number | null;
  name: string;
  location_id: string;
  place_name: string;
  crop_id: string;
  plant_date: string;
  hst: number;
  stage_name?: string;
  risk?: string;
  area_ha?: number;
  trail?: any[];
  updated_at?: string;
}

function ensureLocalDb(): { users: UserRecord[]; profiles: ProfileRecord[] } {
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      const initial = { users: [], profiles: [] };
      try { fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2)); } catch {}
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
  } catch (err: any) {
    // In serverless / read-only filesystem environments, don't crash
    console.warn('[TaniAdapt Backend] Read-only filesystem, skipping local db file write:', err?.message || err);
  }
}

function ensureLocalPlots(): PlotRecord[] {
  try {
    const dir = path.dirname(LOCAL_PLOTS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(LOCAL_PLOTS_PATH)) {
      try { fs.writeFileSync(LOCAL_PLOTS_PATH, JSON.stringify([], null, 2)); } catch {}
      return [];
    }
    return JSON.parse(fs.readFileSync(LOCAL_PLOTS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveLocalPlots(plots: PlotRecord[]) {
  try {
    const dir = path.dirname(LOCAL_PLOTS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_PLOTS_PATH, JSON.stringify(plots, null, 2));
  } catch (err: any) {
    // In serverless / read-only filesystem environments, don't crash
    console.warn('[TaniAdapt Backend] Read-only filesystem, skipping local plots file write:', err?.message || err);
  }
}

let initPoolPromise: Promise<boolean> | null = null;

// Initialize PostgreSQL Pool & Schema with retry support
async function initPgPool(): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    isDbConnected = false;
    return false;
  }

  lastConnectionAttempt = Date.now();
  try {
    if (pool) {
      try { await pool.end(); } catch {}
      pool = null;
    }

    const isSsl = dbUrl.includes('sslmode=require') || 
                  dbUrl.includes('.neon.tech') || 
                  dbUrl.includes('supabase.co') || 
                  (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1'));

    pool = new Pool({
      connectionString: dbUrl.replace('&channel_binding=require', '').replace('channel_binding=require&', ''),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
      max: 10,
      ...(isSsl ? { ssl: { rejectUnauthorized: false } } : {})
    });

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
    client.release();
    isDbConnected = true;
    console.log('[TaniAdapt Backend] Terhubung ke PostgreSQL lokal dan skema database siap!');
    return true;
  } catch (err: any) {
    isDbConnected = false;
    // Log friendly warning without crashing server
    console.warn('[TaniAdapt Backend] PostgreSQL belum aktif/terjangkau. Menggunakan persistent local JSON fallback:', err.message);
    return false;
  }
}

// Start pool initialization at boot
initPoolPromise = initPgPool();

// Auto-reconnect helper (throttled every 6 seconds)
async function ensureDbConnection(): Promise<boolean> {
  if (isDbConnected && pool) return true;
  if (initPoolPromise) {
    return await initPoolPromise;
  }
  if (Date.now() - lastConnectionAttempt > 6000 || (!pool && process.env.DATABASE_URL)) {
    initPoolPromise = initPgPool();
    const res = await initPoolPromise;
    initPoolPromise = null;
    return res;
  }
  return isDbConnected;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'taniadapt_salt_2026').digest('hex');
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.end(JSON.stringify(data));
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  if ((req as any).body) {
    if (typeof (req as any).body === 'string') { try { return Promise.resolve(JSON.parse((req as any).body)); } catch { return Promise.resolve({}); } }
    return Promise.resolve((req as any).body);
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
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

export function authMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
  const urlObj = new URL(req.url || '/', 'http://localhost');
let pathname = urlObj.pathname;
  if (!pathname.startsWith('/api') && (pathname.startsWith('/auth') || pathname.startsWith('/plots'))) { pathname = '/api' + pathname; }

  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  // Handle /api/auth and /api/plots
  if (!pathname.startsWith('/api/auth') && !pathname.startsWith('/api/plots')) {
    return next();
  }

  return (async () => {
    try {
      await ensureDbConnection();

      // ========================================================================
      // 1. STATUS DATABASE ENDPOINT (/api/auth/status)
      // ========================================================================
      if (req.method === 'GET' && pathname === '/api/auth/status') {
        return sendJson(res, 200, {
          db_engine: isDbConnected ? 'PostgreSQL (Local / Network)' : 'Persistent Local Storage (PostgreSQL Fallback)',
          is_postgres: isDbConnected,
          database_url_configured: Boolean(process.env.DATABASE_URL),
        });
      }

      // ========================================================================
      // 2. REGISTER ENDPOINT (/api/auth/register)
      // ========================================================================
      if (req.method === 'POST' && pathname === '/api/auth/register') {
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
                await pool.query(
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
            planting_date: profile.planting_date || new Date().toISOString().split('T')[0],
            hst: profile.hst || 0,
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

      // ========================================================================
      // 3. LOGIN ENDPOINT (/api/auth/login)
      // ========================================================================
      if (req.method === 'POST' && pathname === '/api/auth/login') {
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

      // ========================================================================
      // 4. PROFILE UPDATE ENDPOINT (/api/auth/profile)
      // ========================================================================
      if (req.method === 'POST' && pathname === '/api/auth/profile') {
        const body = await parseJsonBody(req);
        const { user_id, profile } = body;

        if (!user_id || !profile) {
          return sendJson(res, 400, { error: 'User ID dan data profil wajib diisi.' });
        }

        if (isDbConnected && pool) {
          await pool.query(
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
               updated_at = NOW()`,
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

          const updated = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1', [user_id]);
          return sendJson(res, 200, { success: true, profile: updated.rows[0], db: 'postgresql' });
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
            planting_date: profile.planting_date || new Date().toISOString().split('T')[0],
            hst: profile.hst || 0,
            farm_area_ha: profile.farm_area_ha || 1.0,
            organization_name: profile.organization_name || '',
            updated_at: new Date().toISOString(),
          };
          localData.profiles.push(existing);
        }
        saveLocalDb(localData);
        return sendJson(res, 200, { success: true, profile: existing, db: 'local_fallback' });
      }

      // ========================================================================
      // 5. CRUD PETAK LAHAN ENDPOINT (/api/plots)
      // ========================================================================
      if (pathname === '/api/plots') {
        // GET /api/plots?user_id=123
        if (req.method === 'GET') {
          const userIdParam = urlObj.searchParams.get('user_id');
          const userId = userIdParam ? parseInt(userIdParam, 10) : null;

          if (isDbConnected && pool) {
            const query = userId
              ? 'SELECT * FROM plots WHERE user_id = $1 ORDER BY created_at ASC'
              : 'SELECT * FROM plots ORDER BY created_at ASC';
            const params = userId ? [userId] : [];
            const result = await pool.query(query, params);
            return sendJson(res, 200, { success: true, plots: result.rows, db: 'postgresql' });
          }

          const localPlots = ensureLocalPlots();
          const filtered = userId ? localPlots.filter(p => p.user_id === userId) : localPlots;
          return sendJson(res, 200, { success: true, plots: filtered, db: 'local_fallback' });
        }

        // POST /api/plots (Create or Update Plot)
        if (req.method === 'POST') {
          const body = await parseJsonBody(req);
          const { plot, user_id } = body;

          if (!plot || !plot.name) {
            return sendJson(res, 400, { error: 'Data petak lahan wajib diisi.' });
          }

          const plotId = plot.id || `plot-${Date.now()}`;
          const plantDate = plot.plantDate || new Date().toISOString().split('T')[0];

          if (isDbConnected && pool) {
            const upsertRes = await pool.query(
              `INSERT INTO plots (id, user_id, name, location_id, place_name, crop_id, plant_date, hst, stage_name, risk, area_ha, trail, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
               ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 location_id = EXCLUDED.location_id,
                 place_name = EXCLUDED.place_name,
                 crop_id = EXCLUDED.crop_id,
                 plant_date = EXCLUDED.plant_date,
                 hst = EXCLUDED.hst,
                 stage_name = EXCLUDED.stage_name,
                 risk = EXCLUDED.risk,
                 area_ha = EXCLUDED.area_ha,
                 trail = EXCLUDED.trail,
                 updated_at = NOW()
               RETURNING *`,
              [
                plotId,
                user_id || null,
                plot.name,
                plot.locationId || 'lembang',
                plot.placeName || '',
                plot.cropId || 'cabai',
                plantDate,
                plot.hst || 0,
                plot.stageName || '',
                plot.risk || 'RENDAH',
                plot.areaHa || 1.0,
                JSON.stringify(plot.trail || []),
              ]
            );
            return sendJson(res, 200, { success: true, plot: upsertRes.rows[0], db: 'postgresql' });
          }

          // Local JSON fallback
          const localPlots = ensureLocalPlots();
          const existingIdx = localPlots.findIndex(p => p.id === plotId);
          const plotRecord: PlotRecord = {
            id: plotId,
            user_id: user_id || null,
            name: plot.name,
            location_id: plot.locationId || 'lembang',
            place_name: plot.placeName || '',
            crop_id: plot.cropId || 'cabai',
            plant_date: plantDate,
            hst: plot.hst || 0,
            stage_name: plot.stageName || '',
            risk: plot.risk || 'RENDAH',
            area_ha: plot.areaHa || 1.0,
            trail: plot.trail || [],
            updated_at: new Date().toISOString(),
          };

          if (existingIdx >= 0) {
            localPlots[existingIdx] = plotRecord;
          } else {
            localPlots.push(plotRecord);
          }

          saveLocalPlots(localPlots);
          return sendJson(res, 200, { success: true, plot: plotRecord, db: 'local_fallback' });
        }

        // DELETE /api/plots?id=plot-1
        if (req.method === 'DELETE') {
          const id = urlObj.searchParams.get('id');
          if (!id) {
            return sendJson(res, 400, { error: 'ID petak lahan wajib dicantumkan.' });
          }

          if (isDbConnected && pool) {
            await pool.query('DELETE FROM plots WHERE id = $1', [id]);
            return sendJson(res, 200, { success: true, id, db: 'postgresql' });
          }

          const localPlots = ensureLocalPlots();
          const updated = localPlots.filter(p => p.id !== id);
          saveLocalPlots(updated);
          return sendJson(res, 200, { success: true, id, db: 'local_fallback' });
        }
      }

      sendJson(res, 404, { error: 'API endpoint not found' });
    } catch (err: any) {
      console.error('[TaniAdapt Backend Error]', err);
      sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
    }
  })();
}


