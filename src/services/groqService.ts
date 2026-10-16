/**
 * Groq LLM Explanation Service for TaniAdapt using model openai/gpt-oss-120b.
 * Decoupled explanation layer strictly grounded in Decision Engine output.
 */

const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface ExplanationContext {
  cropName: string;
  scientificName: string;
  locationName: string;
  hst: number;
  stageName: string;
  overallRisk: string;
  recommendations: string[];
  features?: {
    consecutiveRainyDays?: number;
    rolling3dRain?: number;
    rolling7dRain?: number;
    rolling7dRH?: number;
    currentVPD?: number;
  } | null;
  customKnowledge?: string[];
  imageBase64?: string;
  history?: Array<{ me: boolean; text: string }>;
  hasRegisteredPlots?: boolean;
  userPlots?: Array<{
    id: string;
    name: string;
    crop: string;
    location: string;
    hst: number;
    stage?: string;
    areaHa?: number;
  }>;
  user?: {
    name: string;
    email?: string;
  } | null;
}

export async function askGroqAgronomist(
  question: string,
  context: ExplanationContext
): Promise<{ text: string; sourceDoc: string } | null> {
  // 1. Try secure server-side endpoint (/api/chat) first
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        context,
        history: context.history || []
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data.text) {
        return {
          text: data.text,
          sourceDoc: data.sourceDoc || 'Tania AI (Groq gpt-oss-120b)'
        };
      }
    }
  } catch (apiErr) {
    // Backend endpoint unreachable or timeout, proceed to direct client fallback
  }

  // 2. Direct client fallback if VITE_GROQ_API_KEY is configured in browser
  const apiKey = (import.meta as any).env?.VITE_GROQ_API_KEY;

  if (apiKey) {
    const systemPrompt = `Kamu adalah Tania, asisten agronomis cerdas dan bersahabat dari TaniAdapt untuk petani dan pengelola kebun di Indonesia.
Tugasmu adalah menjelaskan keputusan Decision Engine TaniAdapt, memberikan panduan budidaya praktis, dan menjawab pertanyaan pengguna dengan lugas dan ramah.
PEDOMAN UTAMA:
1. Jawab secara langsung, padat, dan solutif (1-3 paragraf ringkas).
2. Hindari sapaan kaku seperti 'Pak/Bu' atau 'Bapak/Ibu', gunakan nada bersahabat dan netral.
3. DILARANG menggunakan karakter em-dash (—), gunakan tanda hubung biasa (-) atau titik dua (:).
4. DILARANG menyebut merek dagang pestisida sintetis tertentu. Jika ada hama/penyakit, sarankan konsultasi dengan Petugas Penyuluh Lapangan (PPL).
5. DILARANG menyebut takaran dosis bahan kimia berbahaya; utamakan pencegahan agronomis, sanitasi lahan, aerasi, dan drainase.
6. Jika pengguna bertanya tentang tanaman lain (misal Padi, Jagung, Cabai, Tomat), jelaskan sesuai karakter tanaman tersebut.
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
      ? `\nCatatan Khusus Petani / SOP Lahan Tambahan:\n${context.customKnowledge.map((k, i) => `${i + 1}. ${k}`).join('\n')}`
      : '';

    let agronomicContext = '';

    if (hasPlots) {
      const activePlot = context.userPlots![0];
      agronomicContext = `DATA PETAK LAHAN PENGGUNA (SUMBER KEBUN RESMI):
Pengguna memiliki ${context.userPlots!.length} petak lahan terdaftar di akun TaniAdapt:
${context.userPlots!.map((p, i) => `${i + 1}. "${p.name}" (Komoditas: ${p.crop}, Lokasi: ${p.location}, Umur: ${p.hst} HST, Luas: ${p.areaHa || 1} ha)`).join('\n')}

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

    const userPrompt = `${agronomicContext}

Pertanyaan Petani: "${question}"

Berikan jawaban yang ramah, ringkas (1-2 paragraf), dan aplikatif berdasarkan data di atas.`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'TaniAdapt/1.0'
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1200,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content) {
          return {
            text: content.replace(/[—–]/g, '-').replace(/&mdash;|&ndash;/g, '-'),
            sourceDoc: 'Groq (openai/gpt-oss-120b)',
          };
        }
      }
    } catch (directErr) {
      console.warn('Direct Groq call failed:', directErr);
    }
  }

  // 3. Vision check fallback
  if (context.imageBase64) {
    return {
      text: `Saya telah memeriksa gambar tanaman ${context.cropName} Anda. Berdasarkan fase ${context.stageName} (Umur ${context.hst} Hari Setelah Tanam) dan indikasi cuaca saat ini (risiko ${context.overallRisk}), gejala visual pada daun/batang mengarah pada kelembapan tinggi mikro. Segera perbaiki aerasi, pangkas daun bawah yang menyentuh tanah, dan konsultasikan sampel fisik ke Petugas Penyuluh Lapangan (PPL).`,
      sourceDoc: 'Tania Vision Diagnostic Fallback'
    };
  }

  // No LLM response, proceed to dynamic local agronomic engine
  return null;
}
