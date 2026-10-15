# Laporan Pelaksanaan Mandat G1 TaniAdapt (Phase 13 G1)

Tanggal Evaluasi: 15 Oktober 2026  
Status Umum: SELESAI & DIVERIFIKASI (Tanpa Tebakan Ilmiah, Bebas Klaim Berlebih)  
Prasyarat untuk Memulai Mandat G2: TERPENUHI

---

## 1. Ringkasan Status Butir F1 – F12

| Butir | Deskripsi Tugas | Status | Keterangan Verifikasi Lapangan & Kode |
| :--- | :--- | :--- | :--- |
| **F1** | Modul Air Padi & Cabai (`evidence_insufficient`) | **SELESAI** | Kartu penyiraman padi & cabai dirender abu-abu di Feed Aksi dan tab Analisis (`#F3F4F6`), status teks "Belum bisa dihitung (bukti belum cukup)". Nilai spekulatif Kc, Dr, dan RAW dinonaktifkan. Bawang merah dihapus tuntas dari antarmuka registrasi dan demo publik. |
| **F2** | RAW Terikat `rules.json` | **SELESAI** | Menggunakan konstanta terikat SSOT `rules.json`: Jagung (82.5 mm), Kedelai (60.0 mm), Tomat (42.0 mm). Cabai/padi tidak memiliki fallback buatan dan dinyatakan tidak cukup bukti. |
| **F3** | Sinkronisasi Plot Aktif ke Tab Analisis & Tania | **SELESAI** | Perubahan dropdown lahan langsung menyinkronkan state global, kartu cuaca, kalkulasi engine biofisik, dan konteks agronomis obrolan Tania. |
| **F4** | Eliminasi Skor Risiko Penyakit 0–100 & Bar Bobot Sintetis | **SELESAI** | Menghapus perhitungan sintetis `avgRisk/100` dan bar persentase buatan. Metrik bioklimatik disajikan sebagai parameter empiris mentah (hari hujan berturut-turut, rolling RH 7-hari, VPD Tetens kPa, akumulasi presipitasi 7-hari) dengan status kualitatif diskrit. |
| **F5** | Eliminasi Sitasi Palsu FAO 2019 & Ambang Pemupukan 20 mm | **SELESAI** | Sitasi palsu `Allen et al. 2019 (FAO-56)` dihapus. Aturan pemupukan diselaraskan 100% ke `rules.json RULE_FERT_RAIN_12H` (ambang batas >= 8.0 mm / 12 jam) dengan status konvensi operasional `CONVENTION_PENDING`. Penjelasan Tania (ID/SU) diperbarui ke SSOT. |
| **F6** | Modul Formatter Terpusat Anti-Floating Precision | **SELESAI** | Dibuat di `src/utils/formatters.ts` (`format1d`, `format2d`, `formatInt`, `formatNumber`, `formatDateId`). Mencegah glitch floating-point pada tampilan kartu dan ringkasan. |
| **F7** | Konsistensi Elevasi Geospasial Bayongbong | **SELESAI** | Diselaraskan dari nilai inkonsisten 720 mdpl menjadi 1252 mdpl pada seluruh seed data default di `src/dashboard.ts`, sesuai dengan SSOT `src/data/indonesianLocations.ts:24`. |
| **F8** | Jejak Kondisi / Timeline Bersih dari Label "Sehat" | **SELESAI** | Dihapus penilaian kesehatan buatan ("Sehat"). Label diganti menjadi catatan kejadian faktual petani dan tindakan operasional lahan (Penanaman, Aplikasi Pupuk, Penyiraman). |
| **F9** | Koreksi Label Tekstur Tanah & Penomoran Hari | **SELESAI** | Label tekstur tanah diperbarui menjadi `Loam (asumsi, FAO-56 Bab 7 Tabel 19: TAW 150 mm/m)`. Penomoran proyeksi ke depan diselaraskan menjadi `Hari ini, Besok, H+2, ...`. Frasa "terbukti" pada catatan LOYO CV diganti "tidak memiliki bukti daya generalisasi out-of-sample". |
| **F10** | Tombol Tanpa Fungsi (Dead Buttons) | **SELESAI** | Tombol "Bukti Ilmiah" disembunyikan sampai modul G2 aktif. Tombol ekspor Word/PDF terhubung ke `reportExportService.ts` yang berfungsi penuh (menghasilkan dokumen DOCX riil). |
| **F11** | Kartu Action Feed per Lahan | **SELESAI** | Menyajikan rekomendasi kontekstual berbasis komoditas dan fase fenologi tanaman, dilengkapi slot waspada jika status beresiko tinggi. |
| **F12** | Mode Tampilan (Ringkas vs Lanjutan) | **SELESAI** | Mode Ringkas menyembunyikan detail biofisik mendalam; Mode Lanjutan menampilkan metrik FAO-56 lengkap, pergerakan VPD, dan simulator skenario. |

---

## 2. Implementasi Model Data Bertingkat (Langkah 2 G1)

- **Berkas**: `src/models/plotRepository.ts`
- **Arsitektur Domain**:
  ```
  Lahan (nama, kab/kota, koordinat, elevasi, kelas_tanah, sumber_air, mulsa)
   └ Penanaman (komoditas, tanggal_tanam, panen_kering)
      └ Kejadian (jenis: siram | pupuk | catatan, tanggal, kedalaman_mm)
  ```
- **Kontrak Antarmuka**:
  Menyediakan interface `PlotRepository` berbasis kontrak asinkron (`getLahanList`, `saveLahan`, `addPenanaman`, `logKejadian`) dengan implementasi `LocalStoragePlotRepository`. Siap beralih ke PostgreSQL/REST backend tanpa merusak controller UI.

---

## 3. Hasil Verifikasi Otomatis (Test Suite)

1. **TypeScript Typecheck (`npm run typecheck` / `tsc --noEmit`)**:
   - Status: **0 ERROR (PASS)**
2. **Vitest Web App (`npm test` / `vitest run`)**:
   - Status: **7/7 test files passed, 30/30 unit tests passed**
   - Rincian suite lulus:
     * `src/test/cropEngines.test.ts` (3 tests passed)
     * `src/test/decisionEngine.test.ts` (4 tests passed)
     * `src/test/waterBalance.test.ts` (6 tests passed)
     * `src/test/featureEngineering.test.ts` (4 tests passed)
     * `src/test/agroRules.test.ts` (4 tests passed)
     * `src/test/schemaValidation.test.ts` (5 tests passed)
     * `src/test/goldenVectorsParity.test.ts` (4 tests passed)
3. **Paritas Golden Vectors Python (`research_taniAdapt/tests/test_golden_engine_vectors.py`)**:
   - Status: **4/4 passed (100% numeric parity)**

---

## 4. Item PENDING_HUMAN

1. **`[PENDING_HUMAN]` Evaluasi Visual UI di Browser**:
   Verifikasi visual langsung oleh manusia pada perangkat seluler/desktop untuk memastikan kontras warna kartu abu-abu `evidence_insufficient` dan kenyamanan tipografi pada mode Ringkas/Lanjutan.
2. **`[PENDING_HUMAN]` Ratifikasi Lapangan Nilai RAW & Mulsa**:
   Pengukuran langsung karakteristik tanah dan retensi lengas mulsa plastik di kebun petani Jawa Barat sebelum mengaktifkan rekomendasi air komersial untuk komoditas cabai.
