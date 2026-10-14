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
}

export async function askGroqAgronomist(
  question: string,
  context: ExplanationContext
): Promise<{ text: string; sourceDoc: string } | null> {
  const apiKey = (import.meta as any).env?.VITE_GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  const systemPrompt = `Kamu adalah Asisten Agronomis TaniAdapt untuk petani di Indonesia.
Tugasmu HANYA menjelaskan keputusan dari Decision Engine TaniAdapt berdasarkan data yang diberikan.

ATURAN KERAS:
1. DILARANG mengarang angka atau data cuaca di luar konteks.
2. DILARANG menyebut merek dagang pestisida sintetis apa pun (seperti Antracol, Daconil, Regent, Roundup, Curacron, Decis, dll.). Jika ada hama/penyakit, selalu sarankan konsultasi dengan Petugas Penyuluh Lapangan (PPL).
3. DILARANG menyebut takaran dosis bahan kimia (seperti ml/liter, kg/ha, sendok makan).
4. DILARANG menebak atau menjanjikan tonase hasil panen (yield).
5. DILARANG menggunakan kata 'pasti', 'terbukti', 'dijamin', '100%'.
6. Gunakan bahasa Indonesia yang santun, lugas, bersahabat, dan mudah dipahami petani di kebun.`;

  const userPrompt = `Data dari Decision Engine TaniAdapt:
- Tanaman: ${context.cropName} (${context.scientificName})
- Lokasi: ${context.locationName}
- Umur: ${context.hst} HST (Fase: ${context.stageName})
- Status Risiko Keseluruhan: ${context.overallRisk}
- Rekomendasi Utama: ${context.recommendations.join('; ')}
${context.features ? `- Fitur Cuaca: Hujan berurutan = ${context.features.consecutiveRainyDays || 0} hari, Hujan 3 hari = ${context.features.rolling3dRain || 0} mm, Hujan 7 hari = ${context.features.rolling7dRain || 0} mm, RH 7 hari = ${context.features.rolling7dRH || 0}%, VPD = ${context.features.currentVPD?.toFixed(2) || 0} kPa` : ''}

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
