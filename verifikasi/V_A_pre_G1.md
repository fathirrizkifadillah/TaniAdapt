# VERIFIKASI V_A: ENGINE & WEB CODEBASE (PRE-G1 & POST-G1 AUDIT)

Audit dilakukan di repo `TaniAdapt` (`/mnt/c/CODING/TaniAdapt`). Output mentah disimpan di direktori `verifikasi/raw/`.

---

## V-A1. Pemetaan Klaim M1 / M2 / M3 ke Test Suite Nyata

Berdasarkan eksekusi `npx vitest run --reporter=verbose`:

| Klaim / Fitur Mandat | Nama Tes yang Mencakup | Status | Keterangan & Catatan Kritis |
| :--- | :--- | :--- | :--- |
| **p per tanaman (jagung 0.55, kedelai 0.50, tomat 0.40)** | `src/test/fao56AndResearchParity.test.ts > 2. Memverifikasi fraksi deplesi p dan kedalaman akar Zr dari FAO-56 Tabel 22` | **LULUS** | Menguji nilai fraksi deplesi FAO-56 Tabel 22 untuk jagung, kedelai, dan tomat. |
| **FAO-56 Contoh 18 Bab 4 (ET0 = 3.88 mm/hari)** | `src/test/fao56AndResearchParity.test.ts > 1. Memvalidasi benchmark Contoh 18...` & `src/test/goldenVectorsParity.test.ts > 1. Memvalidasi ET0 Contoh 18...` | **LULUS** | Paritas numerik terhadap benchmark Brussels/Uccle. |
| **FAO-56 Contoh 36 (Toleransi <= 1 mm TAW & RAW)** | `src/test/fao56AndResearchParity.test.ts > 3. Memvalidasi TAW (Eq. 82) dan RAW (Eq. 83) Contoh 36 FAO-56 pada 3 tekstur tanah` | **LULUS** | Menguji formula Eq. 82 dan 83 pada tekstur loam, sandy loam, dan silty clay loam. |
| **Paritas Golden Vector Python** | `src/test/goldenVectorsParity.test.ts > 1..4` | **LULUS** | 4 tes paritas (ET0 Contoh 18, 3 sampel tropis AgERA5, dinamika Kc titik fase, dan stres air) cocok 100% dengan golden JSON. |
| **Validasi Ajv Schema Draft 2020-12** | `src/test/schemaValidation.test.ts > 1..5` | **LULUS** | Menguji validasi payload dasar, penolakan properti liar (`additionalProperties: false`), validasi tanggal RFC 3339, dan penolakan stres abiotik non-VERIFIED. |
| **METHOD_UNCALIBRATED tidak menaikkan status level atas** | `src/test/schemaValidation.test.ts > 4. Menolak status kondisi_stres_abiotik jika tidak dipicu oleh aturan VERIFIED_METHOD` | **LULUS** | Memverifikasi aturan `if/then` skema JSON. |
| **Penegakan paritas sumber klimatologi** | `TIDAK ADA TES` | **TIDAK ADA TES** | Tidak ada unit test terpisah yang memverifikasi integritas hash sumber klimatologi 21-tahun di level web app. |
| **Sensitivitas TAW 130 / 180** | `src/test/fao56AndResearchParity.test.ts > 3. Memvalidasi TAW (Eq. 82) dan RAW (Eq. 83)...` | **LULUS** | Termasuk dalam cakupan uji 3 tekstur tanah. |
| **P_eff 0.8** | `TIDAK ADA TES` | **TIDAK ADA TES** | Nilai opsi sensitivitas 0.8 ada di dropdown pengaturan HTML, namun belum ada tes otomatis mandiri yang menguji divergensi deplesi saat Peff=0.8. |
| **Simulasi 7 hari dua skenario (prakiraan vs tanpa_hujan)** | `src/test/fao56AndResearchParity.test.ts > 6. Memverifikasi simulasi maju 7 hari dua skenario` | **LULUS** | Menguji divergensi skenario deplesi air selama 7 hari ke depan. |
| **Cold-start dua lintasan (pasti vs interval)** | `src/test/fao56AndResearchParity.test.ts > 7. Memverifikasi rekonstruksi cold-start ledger` | **LULUS** | Memvalidasi rekonstruksi deplesi awal Dr(0) saat riwayat siram kosong atau sebagian. |
| **Padi sawah modul air tidak aktif** | `src/test/fao56AndResearchParity.test.ts > 5. Memverifikasi status evidence_insufficient untuk air padi sawah` | **LULUS** | Memverifikasi penolakan perhitungan neraca air tidak jenuh pada padi sawah. |

---

## V-A2. Output Engine Nyata & Validasi Skema Ajv

Skrip eksekusi sementara `scripts/probe_engine_output.ts` dijalankan untuk mengevaluasi engine dengan input:
1. Jagung HST 45 (Loam, TAW 150)
2. Kedelai HST 30 (Loam, TAW 150)
3. Tomat HST 40 (Loam, TAW 150)
4. Cabai HST 30 (Loam, TAW 150) -> Status neraca air: `evidence_insufficient`
5. Padi HST 30 (Loam, TAW 150) -> Status neraca air: `evidence_insufficient`
6. Bawang Merah HST 25 -> Ditolak di UI / Engine hanya menghasilkan advisory fallback
7. Cuaca Kosong -> Ditangani fallback grace/pesan peringatan

Hasil validasi Ajv menunjukkan seluruh output engine untuk komoditas tervalidasi patuh 100% pada `src/engine/engine_output.schema.json`.

---

## V-A3. Audit Angka Ilmiah di Luar `rules.json`

Hasil grepping pada kode sumber `src/`:
1. `RAW 82.5 mm` (Jagung): Berasal dari perhitungan `TAW (150) * Zr (1.0) * p (0.55) = 82.5 mm`. Diikat di `rules.json`.
2. `RAW 60.0 mm` (Kedelai): `150 * 0.8 * 0.50 = 60.0 mm`. Diikat di `rules.json`.
3. `RAW 42.0 mm` (Tomat): `150 * 0.7 * 0.40 = 42.0 mm`. Diikat di `rules.json`.
4. `Ambang batas 8.0 mm / 12 jam`: Berasal dari `RULE_FERT_RAIN_12H` (`rules.json`, status `CONVENTION_PENDING`).
5. **Temuan Hardcode yang Telah Diperbaiki**:
   - Ambang 20 mm / sitasi Allen 2019 telah dihapus tuntas dari `cropEngines.ts`, `literatureEvidence.ts`, dan `dashboard.ts`.
   - Skor sintetis 0–100 pada risiko penyakit telah digantikan metrik empiris langsung.

---

## V-A4. Jalur Rekomendasi Air & RAW Per Komoditas

- **Jagung, Kedelai, Tomat**: Menghitung evapotranspirasi harian $ET_c = Kc \times ET_0$, deplesi kumulatif $D_r$, dan membandingkannya terhadap ambang kritis $RAW = p \times TAW \times Z_r$.
- **Cabai**: Sesuai mandat F1, alur deplesi tidak dijalankan. UI merender kartu abu-abu (`evidence_insufficient`) dan melarang klaim status "Lengas Optimal" atau "Perlu Pengairan" numerik.
- **Padi Sawah**: Dikecualikan dari model perkolasi air tak jenuh FAO-56.

---

## V-A5. Penanganan Kegagalan Cuaca (Graceful Degradation)

- Pada `src/services/weatherService.ts`, blok `try/catch` menangkap kegagalan fetch API Open-Meteo.
- Saat koneksi putus atau host salah, sistem menggunakan `FALLBACK_WEATHER_DATABASE` yang berbasis data klimatologis historis rata-rata bulanan.
- UI menampilkan penanda visual jelas bahwa data berasal dari data cadangan/klimatologis, bukan prakiraan cuaca langsung.

---

## V-A6. Arsitektur Groq & Manajemen Kunci API

- **Kondisi Sebelum G2**: Kunci API Groq dipanggil langsung dari sisi klien (browser) melalui `src/services/groqService.ts` dengan kunci disimpan di `localStorage` atau dibaca via `import.meta.env`.
- **Rekomendasi / Rencana G2**: Memindahkan pemanggilan ke endpoint server `POST /api/tania` sehingga bundle klien bebas 100% dari kebocoran token/kunci API.
