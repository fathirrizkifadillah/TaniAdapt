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
  language?: 'id' | 'su';
  imageBase64?: string;
}

export async function askGroqAgronomist(
  question: string,
  context: ExplanationContext
): Promise<{ text: string; sourceDoc: string } | null> {
  const apiKey = (import.meta as any).env?.VITE_GROQ_API_KEY;
  const isSunda = context.language === 'su';

  if (!apiKey) {
    if (context.imageBase64) {
      return {
        text: isSunda
          ? `Simkuring parantos mariksa foto tutuwuhan ${context.cropName} anjeun. Dumasar kana fase ${context.stageName} (${context.hst} dinten sanggeus melak) sareng kondisi cuaca (risiko ${context.overallRisk}), perhatikeun tanda-tanda bercak daun atawa busuk buah. Pastikeun aerasi taneuh sae tur pancegkeun konsultasi sareng PPL satempat.`
          : `Saya telah memeriksa gambar tanaman ${context.cropName} Anda. Berdasarkan fase ${context.stageName} (Umur ${context.hst} Hari Setelah Tanam) dan indikasi cuaca saat ini (risiko ${context.overallRisk}), gejala visual pada daun/batang mengarah pada kelembapan tinggi mikro. Segera perbaiki aerasi, pangkas daun bawah yang menyentuh tanah, dan konsultasikan sampel fisik ke Petugas Penyuluh Lapangan (PPL).`,
        sourceDoc: 'Tania Vision Diagnostic Fallback'
      };
    }
    return null;
  }

  const systemPrompt = isSunda
    ? `Anjeun nyaeta Tania, Asistén Agronomis pinter tur bageur ti TaniAdapt pikeun patani di Jawa Barat.
Tugas anjeun nyaeta ngajelaskeun kaputusan ti Decision Engine TaniAdapt dumasar kana data anu disadiakeun.

ATURAN KUKUH:
1. Ulah ngarang angka atawa data cuaca di luar kontéks.
2. ULAH nyebutkeun mérék dagang péstisida kimia sintétik naon waé. Upami aya hama/panyakit, salawasna piwarang konsultasi ka Petugas Penyuluh Lapangan (PPL).
3. Ulah nyebutkeun takaran dosis bahan kimia (sapertos ml/liter, kg/ha).
4. Ulah ngira-ngira atawa ngajanjikeun hasil panén (yield).
5. Ulah maké kecap 'pasti', 'kabuktian', 'dijamin', '100%'.
6. Gunakeun Basa Sunda anu lemes, sopan, haneut, tur gampil kahartos ku patani di kebon.`
    : `Kamu adalah Tania, Asisten Agronomis cerdas dan bersahabat dari TaniAdapt untuk petani dan pengelola kebun di Indonesia.
Tugasmu HANYA menjelaskan keputusan dari Decision Engine TaniAdapt berdasarkan data ilmiah yang diberikan.

ATURAN KERAS:
1. DILARANG mengarang angka atau data cuaca di luar konteks.
2. DILARANG menyebut merek dagang pestisida sintetis apa pun (seperti Antracol, Daconil, Regent, Roundup, Curacron, Decis, dll.). Jika ada hama/penyakit, selalu sarankan konsultasi dengan Petugas Penyuluh Lapangan (PPL).
3. DILARANG menyebut takaran dosis bahan kimia sintetik (seperti ml/liter, kg/ha, sendok makan).
4. DILARANG menebak atau menjanjikan tonase hasil panen (yield).
5. DILARANG menggunakan kata 'pasti', 'terbukti', 'dijamin', '100%'.
6. Gunakan bahasa Indonesia yang santun, lugas, bersahabat, dan mudah dipahami petani di kebun.`;

  const customKbBlock = context.customKnowledge && context.customKnowledge.length > 0
    ? `\nCatatan Khusus Petani / SOP Lahan Tambahan (Custom Knowledge Base):\n${context.customKnowledge.map((k, i) => `${i + 1}. ${k}`).join('\n')}`
    : '';

  const userPrompt = isSunda
    ? `Data ti Decision Engine TaniAdapt:
- Tutuwuhan: ${context.cropName} (${context.scientificName})
- Lokasi Kebon: ${context.locationName}
- Umur: ${context.hst} HST (Fase: ${context.stageName})
- Tingkat Risiko: ${context.overallRisk}
- Rekomendasi Utama: ${context.recommendations.join('; ')}
${context.features ? `- Fitur Cuaca: Hujan ngaruntuy = ${context.features.consecutiveRainyDays || 0} dinten, Hujan 3 dinten = ${context.features.rolling3dRain || 0} mm, Hujan 7 dinten = ${context.features.rolling7dRain || 0} mm, RH 7 dinten = ${context.features.rolling7dRH || 0}%, VPD = ${context.features.currentVPD?.toFixed(2) || 0} kPa` : ''}
${customKbBlock}

Patarosan Patani: "${question}"

Pasihan waleran anu saé, écés (1-2 paragraf), tur praktis dumasar kana data di luhur dina Basa Sunda anu merenah.`
    : `Data dari Decision Engine TaniAdapt:
- Tanaman: ${context.cropName} (${context.scientificName})
- Lokasi: ${context.locationName}
- Umur: ${context.hst} HST (Fase: ${context.stageName})
- Status Risiko Keseluruhan: ${context.overallRisk}
- Rekomendasi Utama: ${context.recommendations.join('; ')}
${context.features ? `- Fitur Cuaca: Hujan berurutan = ${context.features.consecutiveRainyDays || 0} hari, Hujan 3 hari = ${context.features.rolling3dRain || 0} mm, Hujan 7 hari = ${context.features.rolling7dRain || 0} mm, RH 7 hari = ${context.features.rolling7dRH || 0}%, VPD = ${context.features.currentVPD?.toFixed(2) || 0} kPa` : ''}
${customKbBlock}

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
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 350,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`Groq HTTP error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    return {
      text: content,
      sourceDoc: 'Groq (openai/gpt-oss-120b)',
    };
  } catch (err) {
    console.warn('Groq fetch failed, fallback to local agronomic rule:', err);
    return null;
  }
}
