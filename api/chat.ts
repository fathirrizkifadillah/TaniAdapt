import fs from 'fs';
import path from 'path';

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
      } catch {}
    }
  }
}
loadLocalEnv();

function sanitizeChatOutput(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // 1. Remove table separator lines like |---|---|
  text = text.replace(/^[ \t]*\|?[\s\-:|]+\|[ \t]*$/gm, '');

  // 2. Convert table row lines | col1 | col2 | into clean bullet points
  text = text.replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_m, row) => {
    const parts = row.split('|').map((c: string) => c.trim()).filter(Boolean);
    if (parts.length === 0) return '';
    const firstLower = parts[0].toLowerCase();
    if (firstLower.includes('nama petak') || firstLower.includes('komoditas') || firstLower.includes('parameter')) return '';
    return `- ${parts.join(' - ')}`;
  });

  // 3. Strip code fences (```)
  text = text.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');

  // 4. Strip any HTML tags (<table>, <div>, etc.)
  text = text.replace(/<[^>]*>/g, '');

  // 5. Strip markdown blockquotes (> ...)
  text = text.replace(/^[ \t]*>[ \t]?/gm, '');

  // 6. Clean dashes and hyphens
  text = text.replace(/[\u2010-\u2015—–]/g, '-').replace(/&mdash;|&ndash;/g, '-');

  // 7. Collapse excess blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

function parseReqBody(req: any): Promise<any> {
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

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL = 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'openai/gpt-oss-20b';

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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'GROQ_API_KEY belum dikonfigurasi di server.' }));
  }

  try {
    const body = await parseReqBody(req);
    const { question, context = {}, history = [] } = body;

    if (!question) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Pertanyaan wajib disertakan.' }));
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

    // Format chat messages
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

    // Call Groq with primary model, fallback if needed
    let content = '';
    let usedModel = PRIMARY_MODEL;

    for (const modelToTry of [PRIMARY_MODEL, FALLBACK_MODEL]) {
      try {
        const groqRes = await fetch(GROQ_API_URL, {
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
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: 'Gagal mendapatkan jawaban dari model AI.' }));
    }

    const cleanedText = sanitizeChatOutput(content);

    res.statusCode = 200;
    return res.end(JSON.stringify({
      success: true,
      text: cleanedText,
      sourceDoc: `Tania AI (${usedModel.replace('openai/', '')})`
    }));
  } catch (err: any) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
}
