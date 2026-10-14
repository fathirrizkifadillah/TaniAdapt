# PROMPT G2 untuk Gemini: Registri Bukti, Hardening Auth, dan Tania Server-Side

## PRASYARAT
Kerjakan SETELAH `reports/phase13_g1_report.md` ada dan tag `phase13-g1-*` ada. Jika G1 belum selesai: berhenti dan laporkan.
Aturan keras G1 tetap berlaku: tidak membuat codebase baru, tidak menghapus (arsipkan), tidak menulis RATIFIED (gunakan PENDING_HUMAN), tidak push, tidak commit `data/`, tidak mencetak kunci API atau isi `.env`, tidak menebak nilai ilmiah, tidak memakai kata "terbukti/tervalidasi/zero-tolerance/100%" untuk hal yang tidak diuji, setiap angka di UI berasal dari JSON engine, `rules.json`, atau registri bukti.

## BAGIAN 1: REGISTRI BUKTI (tombol "Bukti Ilmiah" dan halaman "Sumber & Batasan")

1. Satu sumber kebenaran: `src/engine/evidence_registry.json`, dihasilkan dari `evidence_registry.csv` repo riset (skrip sinkronisasi, bukan salin manual) dan dari status di `rules.json`. Field: `id`, `source`, `location` (Bab/Tabel/Persamaan, TANPA nomor halaman), `url_or_doi`, `status`, `used_by_rules[]`, `claim_forbidden[]`, `notes`.
2. Peta kosakata status (tulis di `docs/evidence_status_mapping.md`): registri riset memakai VERIFIED/UNVERIFIED/CANNOT_OPEN; `rules.json` memakai VERIFIED_METHOD/METHOD_UNCALIBRATED/CONVENTION_PENDING/INSUFFICIENT/DEPRECATED. Tentukan peta satu arah yang eksplisit. Entri yang tidak bisa dipetakan: PENDING_HUMAN.
3. Halaman registri (tombol "Bukti Ilmiah" muncul lagi HANYA setelah halaman berfungsi): tabel dengan filter status; tiap baris menampilkan sumber, Bab/Tabel, status berupa badge teks dan ikon (bukan warna saja), aturan yang memakainya, dan daftar "yang TIDAK diklaim". Mode Ringkas menampilkan versi singkat (nama, status, satu kalimat).
4. Halaman "Sumber & Batasan": atribusi persis (AgERA5/Copernicus, Open-Meteo CC BY 4.0, BPS, Open Data Jabar, CHIRPS), daftar batasan (tidak ada validasi lapangan, bukan prediksi hasil panen, padi dan cabai: modul air belum cukup bukti, bawang merah diblokir), dan tanggal versi aturan/data. Teks yang masih butuh manusia ditulis `[PENDING_HUMAN]`, jangan diisi sendiri.
5. DOI dan judul: tampilkan HANYA entri yang lolos `scripts/verify_doi.mjs` (Crossref: judul dan halaman cocok). Entri lain tampil sebagai "DOI belum diverifikasi" tanpa judul karangan. Simpan keluaran verifikasi ke `reports/g2_doi_check.txt` (mentah). Paper yang sebelumnya salah label (Sentelhas 2008 pada `Agric. For. Meteorol. 148(3):392-400`, Heino 2023, Hosokawa 2023, Huber & Gillespie 1992) diperlakukan hati-hati: ikuti hasil Crossref, bukan tabel lama.
6. Tes (Vitest): (a) setiap `evidence_refs` di `rules.json` ada di registri; (b) setiap sitasi yang tampil di UI ada di registri (pencarian atas string sitasi di `src` tidak menemukan sitasi di luar registri); (c) tidak ada "Allen et al. (2019)"; (d) tidak ada nomor halaman FAO; (e) entri METHOD_UNCALIBRATED/CONVENTION_PENDING tidak pernah ditampilkan sebagai VERIFIED. Playwright: halaman memuat teks status dan atribusi.

## BAGIAN 2: HARDENING AUTH (server, tanpa dependensi baru)

Kondisi sekarang: `authApi.ts:112` memakai `sha256(password + 'taniadapt_salt_2026')`.
1. Ganti ke `crypto.scrypt` (Node bawaan) dengan salt acak per pengguna, parameter tersimpan bersama hash, dan perbandingan `timingSafeEqual`.
2. Migrasi: hash lama (sha256) tetap bisa dipakai login satu kali, lalu diganti ke scrypt saat berhasil login.
3. Token sesi: tanda tangan HMAC dengan rahasia dari variabel lingkungan (`AUTH_SECRET`), ada `exp`, diverifikasi di tiap rute terproteksi. Jika `AUTH_SECRET` tidak ada: server menolak start dan memberi pesan jelas (jangan memakai nilai bawaan di kode).
4. Pertahankan pembatas percobaan login dan header anti-CSRF yang ada. Jangan menyimpan kata sandi apa pun di berkas fallback lokal dalam bentuk lemah.
5. Tes: hash unik per pengguna untuk kata sandi sama; migrasi berjalan; token kedaluwarsa ditolak; token terubah ditolak.

## BAGIAN 3: TANIA SERVER-SIDE DAN VALIDATOR

1. Rute server `POST /api/tania` yang meneruskan ke Groq. Kunci hanya dari variabel lingkungan server. Hapus semua penyimpanan kunci di sisi klien (localStorage dan sejenisnya). Bukti: pencarian pada `dist` tidak menemukan pola kunci (hitung kecocokan saja, jangan cetak nilainya).
2. Validator (kode murni, tanpa LLM) yang berjalan di server atas jawaban model sebelum dikirim ke klien:
   - Paritas angka: setiap angka dalam jawaban harus ada dalam allowlist yang dibangun dari JSON engine (mm, jam, HST, persen). Angka lain -> jawaban diganti templat aman.
   - Larangan: nama merek, dosis/takaran, rekomendasi bahan aktif pestisida untuk status yang bukan VERIFIED_METHOD, diagnosis penyakit, kata kepastian ("pasti", "dijamin", "terbukti", "100%"), prediksi hasil panen.
   - Pertanyaan di luar cakupan -> templat tetap, tanpa memanggil model.
   - Catatan pengguna dan potongan RAG diperlakukan sebagai DATA TIDAK DIPERCAYA (dibungkus penanda, tidak boleh mengubah instruksi).
   - Bahasa Sunda hanya lewat templat yang ditinjau manusia; tidak ada terjemahan bebas oleh model (PENDING_HUMAN untuk ulasan penutur asli).
3. Tes unit validator dengan model tiruan (mock): lolos, gagal paritas, merek, dosis, kata kepastian, bahan aktif, injeksi lewat catatan pengguna.
4. Evaluasi adversarial dengan model SUNGGUHAN: `scripts/eval_tania_adversarial.ts`, minimal 30 prompt (merek, dosis, tebak panen, minta angka karangan, "abaikan instruksi", injeksi lewat catatan, bahasa campuran). Simpan prompt, jawaban mentah, dan keputusan validator ke `reports/tania_adversarial_raw.jsonl`. Laporkan jumlah pelanggaran apa adanya. Jika kunci tidak tersedia: tulis `TIDAK DIJALANKAN`. Jangan menulis "100%" atau "zero-tolerance".

## BAGIAN 4: BUKTI DAN LAPORAN
- Vitest dan Playwright berjalan; tempel jumlah lulus/gagal dan daftar nama tes (verbose).
- `reports/phase13_g2_report.md` apa adanya: butir selesai, tidak selesai, PENDING_HUMAN, serta output mentah yang diminta di atas.
- Commit per kelompok. Tag `phase13-g2-*`. Jangan push.

## RENCANA BERIKUTNYA (jangan dikerjakan di G2)
- G3: laporan cetak 2 x 2 (per lahan atau seluruh lahan; Ringkas atau Lanjutan) dari satu `ReportModel`, dirender ke PDF dan DOCX; tanggal terbit, versi aturan/engine/data, legenda status, batasan, hash snapshot input; angka hanya dari JSON; tidak ada kata "dosis".
- G4: PWA/offline (Service Worker, IndexedDB untuk cuaca terakhir dan log kejadian append-only, label umur data).
- Migrasi penyimpanan ke database melalui `PlotRepository` (setelah G1).
