import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

function loadLocalEnv() {
  const envFiles = ['.env.local', '.env'];
  const env = {};
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
            if (!env[key]) {
              env[key] = val;
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch (err) {
        console.warn(`[Warning] Gagal membaca ${file}:`, err.message);
      }
    }
  }
  return env;
}

const env = loadLocalEnv();
const rawUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/taniadapt';

console.log('🌱 =========================================================');
console.log('🌱 TaniAdapt: Inisialisasi Database PostgreSQL Lokal');
console.log('🌱 =========================================================\n');

async function run() {
  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    console.error(`❌ Format DATABASE_URL tidak valid: "${rawUrl}"`);
    console.error('   Contoh format yang benar: postgresql://postgres:password_anda@localhost:5432/taniadapt');
    process.exit(1);
  }

  const dbName = targetUrl.pathname.replace(/^\//, '') || 'taniadapt';
  const isCloudDb = rawUrl.includes('.neon.tech') || rawUrl.includes('supabase.co') || rawUrl.includes('sslmode=require');
  const sslConfig = isCloudDb ? { rejectUnauthorized: false } : false;

  console.log(`📌 Konfigurasi Target:`);
  console.log(`   Host     : ${targetUrl.hostname}:${targetUrl.port || 5432}`);
  console.log(`   Database : ${dbName}`);
  console.log(`   Tipe     : ${isCloudDb ? 'Cloud PostgreSQL (Neon / Supabase / SSL)' : 'Lokal PostgreSQL'}\n`);

  if (!isCloudDb) {
    console.log('1️⃣  Menguji koneksi ke server PostgreSQL lokal...');
    const serverUrl = new URL(targetUrl.toString());
    serverUrl.pathname = '/postgres';
    let serverClient = new Client({ connectionString: serverUrl.toString(), connectionTimeoutMillis: 4000 });
    try {
      await serverClient.connect();
      console.log('   ✅ Terhubung ke server PostgreSQL.');
      
      console.log(`\n2️⃣  Memeriksa keberadaan database "${dbName}"...`);
      const checkDb = await serverClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
      if (checkDb.rows.length === 0) {
        console.log(`   ⚙️  Database "${dbName}" belum ada. Membuat database baru...`);
        await serverClient.query(`CREATE DATABASE "${dbName}"`);
        console.log(`   ✅ Database "${dbName}" berhasil dibuat!`);
      } else {
        console.log(`   ✅ Database "${dbName}" sudah tersedia.`);
      }
    } catch (err) {
      console.log(`   ℹ️  Pengecekan db root dilewati (${err.message}). Melanjutkan ke database target.`);
    } finally {
      try { await serverClient.end(); } catch {}
    }
  } else {
    console.log('1️⃣  Database Cloud terdeteksi (Neon/Remote). Menggunakan koneksi langsung dengan SSL...');
  }

  console.log(`\n${isCloudDb ? '2️⃣' : '3️⃣'}  Menghubungkan ke database "${dbName}" dan menjalankan DDL skema...`);
  const dbClient = new Client({ 
    connectionString: rawUrl, 
    connectionTimeoutMillis: 8000,
    ...(sslConfig ? { ssl: sslConfig } : {})
  });
  try {
    await dbClient.connect();

    const ddlPath = path.resolve(process.cwd(), 'scripts', 'init-db.sql');
    let ddlSql;
    if (fs.existsSync(ddlPath)) {
      ddlSql = fs.readFileSync(ddlPath, 'utf-8');
    } else {
      ddlSql = `
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
      `;
    }

    await dbClient.query(ddlSql);
    console.log('   ✅ Skema tabel berhasil disiapkan:');
    console.log('      - users          (Akun petani/organisasi)');
    console.log('      - user_profiles  (Preferensi komoditas & lokasi)');
    console.log('      - plots          (Sinkronisasi petak lahan)');

    // 4. Migrasi data lokal jika ada
    const localDbPath = path.resolve(process.cwd(), 'data', 'local_users_db.json');
    if (fs.existsSync(localDbPath)) {
      try {
        const localData = JSON.parse(fs.readFileSync(localDbPath, 'utf-8'));
        if (Array.isArray(localData.users) && localData.users.length > 0) {
          console.log(`\n4️⃣  Mendeteksi ${localData.users.length} akun pada fallback lokal (data/local_users_db.json)...`);
          let migrated = 0;
          for (const u of localData.users) {
            const insUser = await dbClient.query(
              `INSERT INTO users (email, password_hash, full_name, user_type, created_at)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
               RETURNING id`,
              [u.email.toLowerCase().trim(), u.password_hash, u.full_name, u.user_type || 'petani', u.created_at || new Date().toISOString()]
            );
            const userId = insUser.rows[0].id;
            const prof = (localData.profiles || []).find(p => p.user_id === u.id);
            if (prof) {
              await dbClient.query(
                `INSERT INTO user_profiles (user_id, commodity, location_name, latitude, longitude, planting_date, hst, farm_area_ha, organization_name, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (user_id) DO UPDATE SET
                   commodity = EXCLUDED.commodity,
                   location_name = EXCLUDED.location_name,
                   latitude = EXCLUDED.latitude,
                   longitude = EXCLUDED.longitude,
                   planting_date = EXCLUDED.planting_date,
                   hst = EXCLUDED.hst,
                   farm_area_ha = EXCLUDED.farm_area_ha,
                   organization_name = EXCLUDED.organization_name,
                   updated_at = EXCLUDED.updated_at`,
                [
                  userId,
                  prof.commodity || 'cabai',
                  prof.location_name || 'Lembang, Kab. Bandung Barat',
                  prof.latitude || -6.8167,
                  prof.longitude || 107.6167,
                  prof.planting_date || '2026-08-19',
                  prof.hst || 55,
                  prof.farm_area_ha || 1.0,
                  prof.organization_name || '',
                  prof.updated_at || new Date().toISOString()
                ]
              );
            }
            migrated++;
          }
          console.log(`   ✅ Berhasil memigrasi ${migrated} akun lokal ke PostgreSQL.`);
        }
      } catch (migErr) {
        console.warn('   ⚠️  Migrasi data lokal dilewati:', migErr.message);
      }
    }

    console.log('\n🎉 =========================================================');
    console.log('🎉 Setup Backend PostgreSQL Selesai & Terhubung Sempurna!');
    console.log('🎉 Jalankan dev server dengan: npm run dev');
    console.log('🎉 =========================================================\n');
  } catch (err) {
    console.error('\n❌ Terjadi kesalahan saat migrasi skema:', err.message);
    process.exit(1);
  } finally {
    try { await dbClient.end(); } catch {}
  }
}

run();
