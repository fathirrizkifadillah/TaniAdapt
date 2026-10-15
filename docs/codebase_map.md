# PETA CODEBASE TANIADAPT (Langkah 0 PROMPT G1)

Tanggal penyusunan: 15 Oktober 2026.
Pemeriksa: Hermes Agent.

---

## 1. APLIKASI WEB OPERASIONAL

- **Aplikasi yang melayani `localhost:5173/dashboard.html`**:
  - Direktori root: `/mnt/c/CODING/TaniAdapt`
  - Stack teknis: Vite SPA murni + vanilla TypeScript (tanpa framework React/Vue/Next.js).
  - Entry point: `index.html` dan `dashboard.html`.
  - Skrip pengontrol UI utama: `src/dashboard.ts` (monolitik UI controller, ~2.511 baris).
  - Skrip server lokal (auth & data): `src/server/authApi.ts` (Node.js HTTP server native di port 3001).

---

## 2. KEPEMILIKAN DAN SINKRONISASI ENGINE

- **Apakah ada duplikasi engine di direktori lain?**:
  - Tidak ditemukan direktori `taniadapt-web` di lingkungan lokal (`/mnt/c/CODING/*`).
  - Direktori engine operasional aplikasi: `/mnt/c/CODING/TaniAdapt/src/engine`.
  - Direktori rujukan kanonik riset: `/mnt/c/CODING/research_taniAdapt/rules/rules.json`, `/mnt/c/CODING/research_taniAdapt/schemas/engine_output.schema.json`, dan `/mnt/c/CODING/research_taniAdapt/tests/golden_engine_vectors.json`.
- **Mekanisme Satu Sumber Kebenaran (Single Source of Truth)**:
  - Berkas `rules.json`, `engine_output.schema.json`, dan `golden_engine_vectors.json` disinkronkan langsung via `research_taniAdapt/scripts/sync_engine_to_web.py`.
  - Hash SHA-256 terverifikasi identik antara repo riset dan `TaniAdapt/src/engine/`.
  - Paket engine yang melayani aplikasi adalah tunggal di `TaniAdapt/src/engine`.

---

## 3. PENYIMPANAN DAN PENGIRIMAN KUNCI API GROQ

- **Lokasi Penyimpanan Saat Ini**:
  - Kunci pengguna dimuat melalui environment variable Vite: `(import.meta as any).env?.VITE_GROQ_API_KEY`.
  - Definisi pemanggilan: `src/services/groqService.ts` baris 33.
- **Tujuan Pengiriman Saat Ini**:
  - Dikirim langsung dari browser pengguna ke endpoint pihak ketiga: `https://api.groq.com/openai/v1/chat/completions` melalui `fetch()`.
- **Temuan Keamanan / Risiko**:
  - Karena menggunakan prefix `VITE_`, nilai token di-injeksi langsung ke bundle client-side JavaScript produksi (`dist/assets/dashboard-*.js`).
  - Token Groq aktif ditemukan terekspos di berkas `dist/assets/dashboard-iTOvwjiK.js`.
- **Rencana Mitigasi (Sesuai PROMPT G2)**:
  - Seluruh panggilan Groq akan dialihkan melalui server proxy lokal `POST /api/tania`.
  - Kunci hanya dibaca dari environment variable server Node (`process.env.GROQ_API_KEY`).
  - Seluruh referensi `VITE_GROQ_API_KEY` dan penyimpanan kunci di browser (localStorage) dihapus tuntas.
