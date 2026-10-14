# PROMPT G1 untuk Gemini: Perbaikan Kebenaran Isi dan Model Data TaniAdapt

## KONTEKS
TaniAdapt adalah aplikasi pendukung keputusan pertanian Jawa Barat (tampil di localhost:5173/dashboard.html).
Prinsip riset yang mengikat: Evidence -> Finding -> Model -> Decision Logic. Engine deterministik; LLM hanya menarasikan JSON engine; jika bukti kurang, jawabannya `evidence_insufficient`, bukan tebakan.

Tinjauan UI menemukan pelanggaran terhadap hasil riset. Tugas G1: perbaiki KEBENARAN ISI dan MODEL DATA.

## ATURAN KERAS
- Jangan membuat codebase baru. Jangan mengubah gaya visual secara besar-besaran.
- Jangan menulis status RATIFIED. Item yang butuh manusia: PENDING_HUMAN.
- Jangan push. Jangan commit data/. Jangan memindahkan tag lama.
- Jangan mencetak atau menyimpan kunci API (Groq maupun lainnya) atau isi ~/.cdsapirc.
- Jangan menebak nilai ilmiah, elevasi, atau sumber. Jika tidak jelas: PENDING_HUMAN.
- Jangan menulis "terbukti", "tervalidasi", "zero-tolerance", "100%" untuk hal yang tidak diuji.
- Setiap teks atau angka yang tampil di UI harus berasal dari salah satu: (a) field JSON keluaran engine, (b) entri evidence registry / rules.json, (c) teks statis yang ditinjau manusia. Tidak ada konten "terdengar benar" yang dikarang.

## LANGKAH 0: PETA CODEBASE (tanpa mengubah kode)
Tulis `docs/codebase_map.md`:
- Aplikasi yang melayani localhost:5173/dashboard.html adalah yang diperbaiki.
- Catat apakah ada lebih dari satu engine (mis. `src/engine` dan `taniadapt-web/src/lib/engine`) atau lebih dari satu UI. Jadikan SATU sumber (`rules.json` + satu paket engine). Jangan membiarkan dua salinan yang bisa berbeda. Laporkan apa yang kamu gabungkan atau hapus.
- Catat di mana kunci API Groq pengguna disimpan dan ke mana dikirim (laporkan saja, jangan menampilkan nilainya).

## LANGKAH 1: PERBAIKAN KEBENARAN (tiap butir punya tes; tes Playwright harus membaca teks di layar)

**F1. Cabai dan padi: modul air = evidence_insufficient.**
Kartu Siram menampilkan "Belum bisa dihitung (bukti belum cukup)" berlatar abu-abu. Jangan menampilkan Kc, Dr, RAW, atau "Lengas Optimal" untuk cabai/padi. Bawang merah: tidak bisa dipilih sama sekali (tampilkan alasannya di form tambah lahan). Hapus bawang merah dari data awal/demo.

**F2. Parameter per tanaman hanya dari rules.json.**
Untuk TAW 150 mm: RAW jagung 82,5; kedelai 60,0; tomat 42,0. Tanaman tanpa parameter = insufficient. TIDAK BOLEH ada fallback ke jagung (di screenshot, lahan cabai menampilkan RAW 82,5 = parameter jagung). Tes per tanaman.

**F3. Tab Analisis dan Tania mengikuti lahan yang dipilih.**
Jika belum ada yang dipilih, tampilkan pemilih lahan, bukan tanaman bawaan. Tes: lahan cabai tidak pernah memunculkan "Bawang Merah".

**F4. Hapus indikator buatan.**
Hapus "Indeks Risiko Penyakit 0-100", persentase per penyakit (mis. 15%, 20%), bar "Evidence: Faktor Berpengaruh", dan chip "Risiko SEDANG".
Alasan: tidak ada data label OPT (Phase 4) dan bobot faktor dikarang.
Gantinya: indikator mentah dari engine (jam RH >= 90% per hari, hari hujan berturut-turut) dengan badge status aturan (Metode belum dikalibrasi / Konvensi tim / Bukti belum cukup). Status ringkas per lahan = worst-of dari aksi yang terdefinisi.

**F5. Sitasi dan ambang.**
Hapus sitasi "Allen et al. (2019)" dan atribusi ambang pupuk "hujan 24-48 jam > 20 mm" (FAO-56 terbit 1998 dan tidak memuat ambang itu).
Semua ambang yang tampil di UI ("basah >= 3 hari", "udara > 85%", ambang pupuk, dll.) harus diambil dari rules.json lengkap dengan badge statusnya (aturan pupuk = 8 mm/12 jam, CONVENTION_PENDING).
Tes: pencarian pada kode UI tidak menemukan angka ambang yang di-hardcode; sitasi hanya dari evidence registry.

**F6. Format angka.**
Semua angka tampil lewat satu fungsi format (mm: 1 desimal). Di layar ada "2.9400000000000004 mm". Tes: tidak ada teks cocok /\d\.\d{4,}/ di halaman.

**F7. Elevasi satu sumber per lahan.**
Bayongbong tampil 1252 mdpl di feed dan 720 mdpl di Lahan Saya. Gunakan satu field elevasi per lahan di semua tab. Laporkan asal tiap nilai (lookup, DEM, input). Jika tidak bisa ditentukan: PENDING_HUMAN, jangan menebak.

**F8. "Jejak Kondisi".**
Hapus entri contoh (HST 1 / 49 / 55, "Sehat", "Waspada"). Isinya hanya kejadian yang diinput petani dan snapshot keluaran engine yang tersimpan. Hapus penilaian "Sehat" untuk tanaman (engine tidak menilai kesehatan tanaman).

**F9. Teks dan kontrol.**
- "Loam (Standar Jabar)" menjadi "Loam (asumsi, FAO-56 Bab 7 Tabel 19)".
- Isi dropdown Peff dari rules.json (P_eff = P sebagai bawaan; 0,8 P sebagai sensitivitas), atau hapus. Saat ini dropdown kosong.
- Ganti "terbukti" menjadi "tidak ada bukti" (mis. pada catatan ilmiah LOYO CV).
- Perbaiki penomoran hari: "Hari ini, Besok, ..." (bukan "H+3 (H+2)").
- Hapus label "PETANI" di header (mode adalah preferensi tampilan, bukan peran).

**F10. Tombol tanpa fungsi.**
"Bukti Ilmiah" dan "Cetak Laporan": sembunyikan sampai diimplementasi (G2 dan G3). Tidak boleh ada tombol yang tidak berfungsi.

**F11. Kartu Action Feed per lahan.**
- Tampilkan jam terbaik dan satu kalimat alasan dari JSON engine pada tiap kartu.
- Set kartu bergantung tanaman: padi (pupuk, semprot, drainase); cabai (semprot, pupuk, pangkas); jagung/kedelai/tomat (siram, semprot, pupuk).
- Tambahkan slot "Perlu perhatian" bila aksi lain berstatus WARN atau DANGER.
- Urutkan lahan dari yang paling mendesak.

**F12. Mode Ringkas vs Lanjutan.**
Mode Ringkas menyembunyikan baris ET0/Kc/Dr/VPD, tab Analisis Biofisik, dan simulator skenario. Mode Lanjutan menampilkannya. Simulator diberi label "simulasi, bukan prakiraan".

## LANGKAH 2: MODEL DATA DAN ALUR TAMBAH LAHAN
Entitas:

```
Kebun (opsional)
 └ Lahan: nama, kab/kota, koordinat, elevasi, kelas_tanah,
          sumber_air (tadah_hujan | irigasi), mulsa (ya | tidak)
    └ Penanaman: komoditas, tanggal_tanam, panen_kering
       └ Kejadian: jenis (siram | pupuk | catatan), tanggal, kedalaman_mm (nullable)
```

- Engine dijalankan per Penanaman. Musim baru = Penanaman baru di lahan yang sama (riwayat tidak hilang).
- Komoditas, lokasi, dan tanggal tanam diinput saat TAMBAH LAHAN, bukan saat login.
- Wizard 4 langkah: (1) nama dan lokasi (GPS atau cari desa/kecamatan); (2) komoditas dan tanggal tanam; (3) tanah dan sumber air; (4) ringkasan beserta catatan keterbatasan komoditas (mis. air cabai/padi: bukti belum cukup).
- Penyimpanan tetap seperti sekarang, tetapi lewat antarmuka repository (PlotRepository) agar nanti bisa diganti ke database tanpa mengubah UI.

## LANGKAH 3: TES DAN BUKTI
- Vitest untuk logika; Playwright untuk layar (membaca teks yang tampil).
- Skenario gagal-cuaca: cuaca gagal diambil -> pesan jujur, tidak ada angka karangan.
- Simpan screenshot tiap skenario di `reports/ui_qa/`: Mode Ringkas dan Lanjutan; lahan jagung, kedelai, tomat, cabai, padi.
- Tulis `reports/phase13_g1_report.md` apa adanya: jumlah tes lulus/gagal, butir F1-F12 yang selesai dan yang tidak, PENDING_HUMAN (termasuk persetujuan visual oleh manusia).
- Commit per kelompok. Tag `phase13-g1-*`. Jangan push.

## RENCANA BERIKUTNYA (jangan dikerjakan di G1)
- **G2:** Halaman Registri Bukti (tombol "Bukti Ilmiah"): ID, sumber, bab/tabel, status (VERIFIED / METHOD_UNCALIBRATED / CONVENTION_PENDING / INSUFFICIENT / CANNOT_OPEN), aturan yang memakainya, dan daftar yang tidak diklaim (`claim_forbidden`). Dibaca dari registry yang sama dengan engine.
- **G3:** Laporan cetak 2 x 2 dari satu `ReportModel` terstruktur, dirender ke PDF dan DOCX:
  - per lahan x Ringkas / Lanjutan
  - seluruh lahan x Ringkas / Lanjutan
  - memuat tanggal terbit, versi aturan/engine/data, legenda status bukti, batasan, dan hash snapshot input. Angka hanya dari JSON.
- **G4:** PWA/offline: Service Worker, IndexedDB untuk cuaca terakhir per sel dan log kejadian append-only, sinkron saat online, label umur data.
