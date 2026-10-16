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
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const LOCAL_DB_PATH = isVercel ? path.resolve('/tmp', 'local_users_db.json') : path.resolve(process.cwd(), 'data', 'local_users_db.json');
const LOCAL_PLOTS_PATH = isVercel ? path.resolve('/tmp', 'local_plots.json') : path.resolve(process.cwd(), 'data', 'local_plots.json');

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
// Lazy initialization on request
initPoolPromise = null;

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

function sanitizeChatOutput(raw: string): string {
  if (!raw) return '';
  let text = raw;
  text = text.replace(/^[ \t]*\|?[\s\-:|]+\|[ \t]*$/gm, '');
  text = text.replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_m, row) => {
    const parts = row.split('|').map((c: string) => c.trim()).filter(Boolean);
    if (parts.length === 0) return '';
    const firstLower = parts[0].toLowerCase();
    if (firstLower.includes('nama petak') || firstLower.includes('komoditas') || firstLower.includes('parameter')) return '';
    return `- ${parts.join(' - ')}`;
  });
  text = text.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/^[ \t]*>[ \t]?/gm, '');
  text = text.replace(/[\u2010-\u2015—–]/g, '-').replace(/&mdash;|&ndash;/g, '-');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

export async function authMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
  const urlObj = new URL(req.url || '/', 'http://localhost');
  let pathname = urlObj.pathname;
  if (!pathname.startsWith('/api') && (pathname.startsWith('/auth') || pathname.startsWith('/plots'))) { pathname = '/api' + pathname; }

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  // Handle /api/auth, /api/plots, and /api/chat
  if (!pathname.startsWith('/api/auth') && !pathname.startsWith('/api/plots') && !pathname.startsWith('/api/chat')) {
    next();
    return;
  }

  try {
    // ========================================================================
    // 0. CHAT ASSISTANT ENDPOINT (/api/chat)
    // ========================================================================
    if (req.method === 'POST' && pathname === '/api/chat') {
      const body = await parseJsonBody(req);
      const { question, context = {}, history = [] } = body;
      const apiKey = process.env.GROQ_API_KEY;

      if (!apiKey) {
        return sendJson(res, 503, { error: 'GROQ_API_KEY belum dikonfigurasi di server.' });
      }

      const systemPrompt = `Kamu adalah Tania, asisten agronomis cerdas dan bersahabat dari TaniAdapt untuk petani dan pengelola kebun di Indonesia.
Tugasmu adalah menjelaskan keputusan Decision Engine TaniAdapt, memberikan panduan budidaya praktis, dan menjawab pertanyaan pengguna dengan lugas dan ramah.

PEDOMAN UTAMA:
1. Jawab secara langsung, padat, dan solutif (1-3 paragraf ringkas).
2. Hindari sapaan kaku seperti 'Pak/Bu' atau 'Bapak/Ibu', gunakan nada bersahabat dan netral.
3. DILARANG menggunakan karakter em-dash (—), gunakan tanda hubung biasa (-) atau titik dua (:).
4. DILARANG menyebut merek dagang pestisida sintetis tertentu (seperti Antracol, Daconil, Regent, Roundup, Curacron, Decis, dll.). Jika ada hama/penyakit, sarankan konsultasi dengan Petugas Penyuluh Lapangan (PPL).
5. DILARANG menyebut takaran dosis bahan kimia berbahaya; utamakan prinsip pencegahan agronomis, sanitasi lahan, aerasi bedengan, dan pengaturan air.
6. Jika pengguna bertanya tentang tanaman lain (misal Padi, Jagung, Cabai, Tomat), berikan penjelasan agronomis relevan sesuai karakter tanaman tersebut.
7. Jika pengguna menanyakan kepemilikan lahan atau meminta analisis lahan ("analisis dong", "lahan saya apa?"), rujuk konteks lahan di bawah:
- Jika pengguna sudah memiliki lahan terdaftar, HANYA analisis dan bahas petak lahan milik pengguna tersebut. DILARANG memunculkan atau menyebut simulasi tanaman lain (seperti cabai merah) yang tidak dimiliki pengguna.
- Jika pengguna belum mendaftarkan lahan, sampaikan dengan jujur bahwa belum ada lahan terdaftar dan ajak mendaftarkan lahan pertama lewat "+ Tambah Petak".
8. FORMAT RESPON WAJIB HANYA TEKS BIASA:
- DILARANG KERAS membuat tabel markdown (garis berisi karakter pipa '|' dan '---'), tabel HTML, atau kisi-kisi kolom apapun. Antarmuka web TIDAK BISA merender tabel dan akan rusak.
- DILARANG KERAS menggunakan tag HTML (seperti table, tr, td, div, span, dll.), blok kode pagar triple-backtick, rumus LaTeX, simbol ASCII rumit, atau kutipan blok (>).
- Format jawaban HANYA boleh berupa teks mengalir (paragraf), daftar berbutir menggunakan tanda strip (-), atau penomoran angka (1., 2., 3.).
- Jika menyajikan informasi beberapa lahan atau ringkasan data, tulis dalam bentuk poin berbutir (- Lahan: ..., Komoditas: ...) atau kalimat paragraf rapi, BUKAN TABEL.`;

      const hasPlots = Boolean(context.hasRegisteredPlots && Array.isArray(context.userPlots) && context.userPlots.length > 0);
      const customKbBlock = context.customKnowledge && context.customKnowledge.length > 0
        ? `\nCatatan Khusus Petani / SOP Lahan Tambahan:\n${context.customKnowledge.map((k: string, i: number) => `${i + 1}. ${k}`).join('\n')}`
        : '';

      let agronomicContext = '';

      if (hasPlots) {
        const activePlot = context.userPlots[0];
        agronomicContext = `DATA PETAK LAHAN PENGGUNA (SUMBER KEBUN RESMI):
Pengguna memiliki ${context.userPlots.length} petak lahan terdaftar di akun TaniAdapt:
${context.userPlots.map((p: any, i: number) => `${i + 1}. "${p.name}" (Komoditas: ${p.crop}, Lokasi: ${p.location}, Umur: ${p.hst} HST, Luas: ${p.areaHa || 1} ha)`).join('\n')}

Lahan Aktif Pengguna Saat Ini:
- Nama Petak: "${activePlot.name}"
- Komoditas: ${context.cropName || activePlot.crop} (${context.scientificName || ''})
- Lokasi Kebun: ${context.locationName || activePlot.location}
- Umur Tanaman: ${context.hst || activePlot.hst} Hari Setelah Tanam (Fase: ${context.stageName || activePlot.stage || 'Aktif'})
- Status Risiko Lapangan: ${context.overallRisk || 'RENDAH'}
- Rekomendasi Lapangan Engine: ${Array.isArray(context.recommendations) && context.recommendations.length > 0 ? context.recommendations.join('; ') : 'Pantau perkembangan lahan rutin.'}
${context.features ? `- Ringkasan Cuaca: Hujan berturut-turut = ${context.features.consecutiveRainyDays || 0} hari, Hujan 3d = ${context.features.rolling3dRain || 0} mm, Hujan 7d = ${context.features.rolling7dRain || 0} mm, RH = ${context.features.rolling7dRH || 80}%, VPD = ${context.features.currentVPD || 1.8} kPa` : ''}
${customKbBlock}`;
      } else {
        agronomicContext = `STATUS KEPEMILIKAN LAHAN PENGGUNA:
Pengguna BELUM memiliki atau BELUM mendaftarkan petak lahan apapun di akun TaniAdapt (Total petak terdaftar: 0).
PANDUAN KHUSUS KEPEMILIKAN:
- Pengguna belum mendaftarkan lahan. JANGAN PERNAH mengarang atau mengasumsikan pengguna mengelola kebun cabai, padi, atau tanaman apapun.
- Jika pengguna meminta analisis ("analisis dong"), menanyakan tentang lahannya, atau meminta rekomendasi tindakan kebunnya, sampaikan secara ramah dan terus terang bahwa belum ada petak lahan yang terdaftar di akunnya.
- Ajak pengguna mendaftarkan lahan pertama mereka lewat tombol "+ Tambah Petak" di bilah navigasi atas atau menu "Petak Lahan Saya".`;
      }

      const messages: any[] = [
        { role: 'system', content: `${systemPrompt}\n\n${agronomicContext}` }
      ];

      if (Array.isArray(history)) {
        for (const h of history.slice(-6)) {
          if (h && h.text) {
            messages.push({
              role: h.me ? 'user' : 'assistant',
              content: h.text
            });
          }
        }
      }

      messages.push({ role: 'user', content: question });

      let content = '';
      let usedModel = 'openai/gpt-oss-120b';

      for (const modelToTry of ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']) {
        try {
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'User-Agent': 'TaniAdapt/1.0'
            },
            body: JSON.stringify({
              model: modelToTry,
              messages,
              max_tokens: 1200,
              temperature: 0.3
            })
          });

          if (groqRes.ok) {
            const data = (await groqRes.json()) as any;
            const candidate = data?.choices?.[0]?.message?.content?.trim();
            if (candidate) {
              content = candidate;
              usedModel = modelToTry;
              break;
            }
          }
        } catch (callErr) {
          console.warn(`Groq model ${modelToTry} failed:`, callErr);
        }
      }

      if (!content) {
        return sendJson(res, 502, { error: 'Gagal mendapatkan jawaban dari model AI.' });
      }

      const cleanedText = sanitizeChatOutput(content);
      return sendJson(res, 200, {
        success: true,
        text: cleanedText,
        sourceDoc: `Tania AI (${usedModel.replace('openai/', '')})`
      });
    }

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
            
            // Map snake_case dari PostgreSQL ke camelCase untuk frontend
            const mappedPlots = result.rows.map(r => ({
              id: r.id,
              name: r.name,
              locationId: r.location_id,
              placeName: r.place_name,
              cropId: r.crop_id,
              plantDate: r.plant_date,
              hst: r.hst,
              stageName: r.stage_name,
              risk: r.risk,
              areaHa: r.area_ha,
              trail: Array.isArray(r.trail) ? r.trail : (typeof r.trail === 'string' ? JSON.parse(r.trail) : []),
            }));
            
            return sendJson(res, 200, { success: true, plots: mappedPlots, db: 'postgresql' });
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
}




