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

---

## 4. TABEL PEMETAAN BERKAS ENGINE (M1 / M2 / M3) KE `src/engine`

Tabel di bawah mencatat pemetaan berkas engine hasil riset (Milestone 1, 2, dan 3) ke dalam `src/engine/` di repo `TaniAdapt`, termasuk status apakah berkas tersebut ADA atau TIDAK ADA:

| Berkas Riset / Mandat (M1–M3) | Status di `TaniAdapt/src/engine/` | Path Real / Padanan di Repo | Keterangan & Catatan |
| :--- | :--- | :--- | :--- |
| `rules.json` | **ADA** | `src/engine/rules.json` | Identik dengan rujukan kanonik riset (hash SHA-256 cocok). |
| `engine_output.schema.json` | **ADA** | `src/engine/engine_output.schema.json` | JSON Schema Draft 2020-12 valid, disinkronkan dari riset. |
| `golden_engine_vectors.json` | **ADA** | `src/engine/golden_engine_vectors.json` | Vektor uji benchmark FAO-56 & AgERA5 untuk paritas numerik. |
| `fao56.ts` / `fao56_penman_monteith.py` | **ADA** | `src/engine/waterBalance.ts` | Rumus FAO-56 PM diimplementasikan di `waterBalance.ts`. |
| `crop_water_stress.ts` | **ADA** | `src/engine/waterBalance.ts` | Logika TAW, RAW, dan kurva deplesi Dr terintegrasi di `waterBalance.ts`. |
| `crop_engines.ts` | **ADA** | `src/engine/cropEngines.ts` | Aturan fenologi dan OPT per komoditas. |
| `decision_engine.ts` | **ADA** | `src/engine/decisionEngine.ts` | Master orchestrator penggabung cuaca, biofisik, dan rules. |
| `feature_engineering.ts` | **ADA** | `src/engine/featureEngineering.ts` | Ekstraksi lag temporal hujan, RH, dan formula VPD Tetens. |
| `percentile.ts` / `climatology.ts` | **TIDAK ADA** | *(Tidak ada)* | Logika persentil klimatologi dieksekusi di backend riset Python, belum di-port ke modul terpisah di TS. |
| `taniaService.ts` / `ragService.ts` | **TIDAK ADA** | `src/services/groqService.ts` | Chatbot dan RAG dilayani oleh modul monolitik `groqService.ts`. |
| `localNarrativeFallback.ts` | **TIDAK ADA** | `src/dashboard.ts` | Templat narasi offline ditanam langsung di fungsi render UI `dashboard.ts`. |
| `modals.ts` | **TIDAK ADA** | `src/dashboard.ts` & `dashboard.html` | Modal interaktif masih menjadi bagian monolitik HTML dan `dashboard.ts`. |

