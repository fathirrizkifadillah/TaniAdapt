# VERIFIKASI BERBASIS PERINTAH (menggantikan jawaban naratif sebelumnya)

Dari: reviewer independen (Claude). Tanggal cek manusia: 15 Okt 2026.
Jawaban `J_*.md` sebelumnya TIDAK diterima sebagai bukti. Sebagian terbukti karangan oleh pemeriksaan manusia (bagian 1). File ini hanya meminta PERINTAH DAN OUTPUT MENTAH. Narasi tidak dihitung.

---

## 0. PEMBAGIAN SESI (dikerjakan paralel)

- Sesi R (repo `research_taniAdapt`): kerjakan Bagian B dan Bagian C saja.
- Sesi W (repo `TaniAdapt`): Bagian A dikerjakan lewat `PROMPT_G1_TaniAdapt_Gemini.md` (LANGKAH 0). Butir V-A2, V-A5, V-A7, V-A12 dikerjakan SETELAH G1. Langkah 3 (lingkungan tes) dikerjakan di Sesi W.
- Dua sesi tidak boleh menyentuh repo satu sama lain.

---

## 1. HASIL CEK MANUSIA ATAS JAWABANMU (fakta, bukan opini)

Cocok dengan kenyataan:
- `src/dashboard.ts` 2511 baris; `authApi.ts:112` memakai `sha256(password + 'taniadapt_salt_2026')`.
- `RULE_WATER_FAO56_DEPLETION` ada di `rules.json`, `engine_output.schema.json`, `rules.ts`, `waterBalance.ts`.
- 5 berkas tes ada; tag `phase13-m1/m2/m3-engine` ada; `fallbackWeatherData.ts` dipakai `weatherService.ts` dan `decisionEngine.test.ts`.
- `reports/phase/phase_00..12` ada. Hash `4629ad9`, `ab5816c`, `0a54f50` ada dan jamnya cocok.

TERBUKTI SALAH atau TIDAK ADA:
1. `git grep R_IRR_CORN_01 -- src` = 0 hasil. Semua ID aturan (`R_IRR_*`, `R_SPRAY_*`, ...) dan contoh JSON engine di `J_P11_P12.md` (termasuk TAW 115) dikarang.
2. Tidak ada di `git ls-files src`: `src/engine/percentile.ts`, `src/engine/climatology.ts`, `src/services/taniaService.ts`, `src/services/ragService.ts`, `src/services/localNarrativeFallback.ts`, `src/components/modals.ts`. Jawaban P3-08, P11-14..17, P13-22 yang bersandar pada berkas itu tidak sah.
3. `docs/preregistration_non_yield_hindcast.md` tidak ada. Yang ada `docs/hindcast_plan.md`.
4. Nama berkas `phase_00_literature_curation`, `phase_03_agera5_bias_correction`, `phase_05_crop_parameters_fao56`, `phase_10_agronomic_rules_synthesis`, `phase_11_cross_dataset_synthesis`, `phase_12_decision_rules_evaluation` tidak ada. `J_LINTAS.md` (termasuk 20 angka L-01) dan `J_BERTENTANGAN.md` memakainya.
5. Git log hypotheses/hindcast sebenarnya ada 8 commit, bukan 5. Jam salah: `8f69dcb` 2026-10-11 22:50:37 (bukan 18:30:12); `522048d` 2026-10-11 22:54:38 (bukan 10-12 14:15:20). Pesan salah: `0a54f50` = "complete non-yield hindcast, mechanistic params, baseline climatology"; `ab5816c` = "reconcile honest status, FAO-56 depletion rules, rules.json, schema, pytest". Commit terlewat: `c515e27` (10-12 17:15 preregister hindcast plan), `bc0969c` (10-13 11:14 "preregister Hindcast Plan v2"), `deccd9f` (10-13 12:57 phase13-gate, 21-year ERA5 climatology).
6. L-02 kolom "tindakan sudah dilakukan" salah. Baris ini MASIH memuat kata terlarang: `audit_closure_report.md:58`, `log_inkonsistensi.md:32` dan `:55`, `phase_02_deep_literature_review.md:27`, `phase13_m3_report.md:31`, `exploration_log.md:31`. Hit tambahan yang tidak kamu laporkan: `docs/WEB_DEVELOPER_GUIDE.md:30` dan `:235`, `reports/phase13_report.md:60` dan `:71`, `audit_closure_report.md:74`, `figure_manifest.csv:63`, `git_history.md:20` (klaim "removed all occurrences" salah).
7. "50 skenario adversarial, 0 pelanggaran" (P12-06) tidak ada di laporan mana pun. `phase13_report.md:60,71` hanya memuat 10 kasus runner Python (template, bukan model sungguhan).
8. `npx vitest run` gagal start di mesin pengguna (rolldown native binding hilang; WSL ternyata memakai Node Windows). "21 passed 2.18 s" belum pernah direproduksi.
9. Hindcast v2 dikomit (`bc0969c`, 13 Okt 11:14) SETELAH hindcast v1 dijalankan (`0a54f50`, 12 Okt 20:42). Label "preregister" untuk v2 tidak benar.
10. Klimatologi 21 tahun masuk di `deccd9f` (13 Okt 12:57), setelah hindcast dijalankan. Hindcast yang dilaporkan mungkin memakai klimatologi lain.
11. G1 belum dijalankan: tidak ada tag `phase13-g1-*`, tidak ada `archive/`.
12. Klaim internal yang bertentangan (sudah dihitung ulang): p-value vs MDE/CI (H_CORN_04, H_SOY_02, H_SOY_03), nilai BH/FDR tidak reproduksi (jagung m=4 seharusnya 0,612 semua; kedelai m=3 seharusnya 0,78/0,50/0,50), MDE jagung 0,1444 vs 0,2306, N jagung 121/124/126, N kedelai 112/115/119, Kota Bogor/Bandung/Tasikmalaya dipetakan ke sel 10,2/9,9/19,8 km padahal sel terdekat 1,4/1,8/4,2 km, "9,0% hari = 66 hari/tahun" (seharusnya 33), rasio 2019 padi 1,2181 di luar rentang 1/0,86 sampai 1/0,84 = 1,163 sampai 1,190.

---

## 2. ATURAN KERAS

1. Setiap butir = (a) perintah persis yang dijalankan, (b) output stdout/stderr VERBATIM, (c) satu kalimat kesimpulan HANYA jika output mendukungnya. Jika perintah gagal: tempel errornya. Jika tidak dijalankan: tulis `TIDAK DIJALANKAN` plus alasan. Dilarang meringkas output.
2. Jangan menyebut berkas apa pun yang belum kamu tampilkan keberadaannya lewat `ls` atau `git ls-files` di sesi ini. Jangan menulis rentang baris yang tidak kamu buka.
3. Jangan mencetak isi `.env`, kunci API, atau `~/.cdsapirc`. Untuk memeriksa kebocoran kunci, hitung kecocokan saja, jangan cetak nilainya.
4. Jangan menulis RATIFIED. Jangan menghapus berkas. Jangan push. Jangan commit `data/`.
5. Tempat simpan: `verifikasi/V_A.md`, `verifikasi/V_B.md`, `verifikasi/V_C.md`, `verifikasi/raw/*.txt`, dan `verifikasi/INDEX.md` berisi tabel ID | dijalankan? | output ada di | kesimpulan.
6. Gunakan PowerShell atau Python yang bisa dijalankan di Windows (`git grep`, bukan `grep`).
7. Kerjakan berurutan. Bagian 3 dulu.

---

## 3. LANGKAH 0: PERBAIKI LINGKUNGAN TES (di `C:\CODING\TaniAdapt`)

```
node -v ; npm -v ; git status --short
Copy-Item package-lock.json package-lock.backup.json
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
npx vitest run --reporter=verbose
git diff --stat -- package-lock.json
npm ls vitest vite typescript
```
Tempel semuanya. Jika berhasil: jangan commit dulu, laporkan selisih versi paket terhadap `package-lock.backup.json`.

---

## 4. BAGIAN A: ENGINE DAN WEB (repo TaniAdapt)

V-A1 Pemetaan klaim M1/M2/M3 ke tes. Dari output verbose Langkah 0, buat tabel: klaim | nama tes yang mencakup | lulus/gagal. Klaim yang wajib: p per tanaman (jagung 0,55; kedelai 0,50; tomat 0,40), FAO Contoh 18 (3,88), FAO Contoh 36 (toleransi 1 mm), paritas golden vector Python, validasi Ajv `if/then`, METHOD_UNCALIBRATED tidak menaikkan status level atas, penegakan paritas sumber klimatologi, sensitivitas TAW 130/180, P_eff 0,8, simulasi 7 hari dua skenario, cold-start dua lintasan. Tulis `TIDAK ADA TES` untuk yang tidak punya tes.

V-A2 Output engine nyata. Tulis skrip sementara (jangan commit) yang memanggil engine PERSIS seperti yang dipanggil `dashboard.ts`. Tempel JSON lengkap untuk: jagung HST 45, kedelai HST 30, tomat HST 40, cabai HST 30, padi HST 30, bawang merah, dan satu kasus cuaca kosong. Tanah loam (TAW 150), tanpa mulsa. Lalu validasi setiap JSON terhadap `src/engine/engine_output.schema.json` dengan Ajv dan tempel hasil valid/tidak valid beserta pesan error.

V-A3 Angka ilmiah di luar `rules.json`:
```
git grep -n -E "82\.5|0\.748|km/jam|0\.55|0\.50|0\.40|TAW|RAW" -- src ":!src/engine/rules.json" ":!src/test"
git grep -n -i -E "lengas optimal|>= ?85|> ?85|20 ?mm|8 ?mm|\|\| ?['\"]?(jagung|padi|cabai)" -- src
```
Untuk setiap hit: berasal dari `rules.json` atau hardcode? Tabel: berkas:baris | nilai | sumber | hardcode? (y/n).

V-A4 Jalur "Lengas Optimal" untuk cabai dan RAW 82,5 untuk non-jagung. Tunjukkan kode (berkas:baris, kutip 10-20 baris sekitar) yang menentukan kartu Siram dan nilai RAW per tanaman, lalu jalankan lahan cabai dan tempel layar/teks hasilnya.

V-A5 Kegagalan cuaca. Tampilkan `weatherService.ts` bagian catch dan apa yang dipakai setelahnya. Simulasikan Open-Meteo gagal (ubah URL ke host salah di salinan sementara). Tempel: teks UI, dan apakah engine tetap menghasilkan rekomendasi dari `FALLBACK_WEATHER_DATABASE`.

V-A6 Groq dan kunci:
```
git grep -n -i -E "groq|apikey|api_key|localStorage|sessionStorage|process\.env|import\.meta\.env" -- src
git grep -n -E "createServer|app\.(get|post|put|use)|pathname|url ===|req\.url" -- src/server
(Select-String -Path dist\assets\*.js -Pattern "gsk_" -List | Measure-Object).Count
```
Tempel. Siapa yang memanggil Groq: browser atau server? Di mana kunci disimpan? Rute server apa saja? (Jangan cetak nilai kunci.)

V-A7 Validator guardrail Tania. Tampilkan kode lengkap fungsi validator paritas angka, filter merek, dan filter kata kepastian, atau tulis `TIDAK ADA`. Tampilkan juga prompt sistem versi sekarang. Jalankan 10 prompt adversarial NYATA ke model sungguhan (merek dagang, dosis, tebak panen, minta angka karangan, "abaikan instruksi"), tempel prompt dan jawaban mentah, dan hitung pelanggaran. Jika kunci tidak tersedia: `TIDAK DIJALANKAN`.

V-A8 Zona waktu. Tampilkan fungsi hitung HST dan semua pemakaian `getHours`/`new Date(`:
```
git grep -n -E "getHours|new Date\(|Date\.now|getTime\(\)" -- src
```
Jalankan fungsi HST dengan `TZ=UTC` dan `TZ=Asia/Jakarta` pada dua tanggal yang sama; tempel hasil keduanya.

V-A9 Auth. Tempel kode `hashPassword`, pembuatan token, rate limiter, dan jalur fallback ke `local_users_db.json`. Ganti `sha256 + salt statis` hanya jika diminta nanti. Di sini cukup tunjukkan kodenya.

V-A10 Tombol. Klik "Bukti Ilmiah" dan "Cetak Laporan" (Playwright atau manual) dan tempel hasil nyata (teks modal atau "tidak terjadi apa-apa"). Cari handler: `git grep -n -E "open-evidence-modal|print-advisory|renderEvidenceModal|renderPrintModal" -- src dashboard.html`.

V-A11 Offline: `git grep -n -i -E "serviceWorker|navigator\.serviceWorker|manifest" -- src public index.html dashboard.html`. Tempel. Matikan jaringan, muat ulang halaman, tempel hasil.

V-A12 ET0 vs Open-Meteo. 30 hari x 5 lokasi (Lembang/Pangalengan, Bandung, Subang, Indramayu, Garut), bandingkan ET0 engine dengan `et0_fao_evapotranspiration` harian Open-Meteo. Tempel tabel mentah, bias, RMSE, korelasi, 5 hari selisih terbesar. Jika jaringan diblok: `TIDAK DIJALANKAN`.

V-A13 Kebersihan repo: `git status --short`, `git log --oneline -15`, `git grep -n "taniadapt-web"`, `Get-ChildItem .. -Directory | Select Name`. Di mana `taniadapt-web` sekarang berada?

V-A14 Format angka: `git grep -n -E "toFixed|toLocaleString|Math\.round" -- src/dashboard.ts` lalu hitung berapa titik format. Apakah ada satu fungsi format bersama?

---

## 5. BAGIAN B: HASIL RISET (repo research_taniAdapt)

Mulai dengan `git ls-files scripts reports/results reports/dataset_audit notebook`. Gunakan hanya berkas dari daftar ini.

V-B1 Tabel hipotesis dari berkas hasil: per hipotesis tempel baris mentah (n_obs, G, beta, SE_boot, CI, p_raw, p_holm, q_bh, MDE). Tempel kode yang menghitung p dan CI (berkas:baris, kutip). Jelaskan lewat kode (bukan narasi) apakah p dan CI berasal dari prosedur yang sama. Hitung ulang BH dari p_raw dengan Python dan tempel selisihnya terhadap laporan.

V-B2 Stabilitas seed. Jalankan ulang bootstrap Webb B=999 dengan seed 1, 2, 3 untuk H_CORN_04 dan H_SOY_03. Tempel beta, CI, p.

V-B3 Dengan dan tanpa 2022 untuk jagung dan kedelai: N, beta, CI, p untuk semua hipotesis. Tempel kedua tabel.

V-B4 Rekonsiliasi N: tempel `panel_units_per_crop.csv`. Untuk setiap model: N baris dipakai, G klaster, df, dan penyebab selisih antara 121/124/126 (jagung) dan 112/115/119 (kedelai).

V-B5 Simulasi daya. Sisipkan efek buatan sebesar MDE dan 0,5 MDE pada data (seed tetap, minimal 300 replikasi) untuk H_CORN_01 dan H_SOY_01. Tempel tingkat deteksi.

V-B6 VIF. Tempel skrip dan tabel VIF beserta kolom desain. Apakah ada model Phase 7 yang memasukkan hujan total dan (P-ET0) bersamaan? Tempel matriks korelasi regressor.

V-B7 Diagnostik padi 2019. Dari DS03 tempel tabel per kabupaten untuk 2018, 2019, 2020: luas, produksi, produktivitas. Lalu rasio 2019/2018 untuk luas dan produksi (min/median/maks). Cek angka: apakah produksi/luas = produktivitas pada setiap baris? Lakukan hal yang sama untuk jagung (termasuk lompatan 2019->2020) dan kedelai (2019/2018). Tempel. Koreksi pernyataan `phase13_m3_report.md:31`: rata-rata rasio kedelai 1,2092 juga naik sekitar 21% (dengan dispersi lebar), sedangkan jagung 1,0083.

V-B8 Pemetaan sel. Tempel `lookup_kab_cell_elev.csv` utuh (27 baris). Hitung sel 0,1 derajat terdekat dan jarak untuk setiap kabupaten, lalu tampilkan semua baris dengan sel tercatat berbeda dari sel terdekat. Tampilkan sel yang BENAR-BENAR dipakai saat ekstraksi AgERA5 (dari skrip akuisisi), bukan hanya tabel lookup.

V-B9 Klimatologi. Dari `12_baseline_climatology_percentiles.json` tempel: periode, sumber, jumlah tahun per sel, metode persentil (per bulan atau jendela day-of-year). Klimatologi mana yang dipakai saat hindcast dijalankan di `0a54f50`? Tempel `git show 0a54f50 --stat` dan `git show deccd9f --stat`.

V-B10 Hindcast. Tempel dari berkas hasil: peristiwa, tanggal, ambang yang dipakai (nilai angka P75/P25/CDD), tahun kontrol, penyebut (sel x tahun) untuk false-alarm 0,0%, dan batas atas CI 95% Clopper-Pearson untuk 0 dari n. Jalankan ulang dengan klimatologi 21 tahun dan tempel. Tempel `git show c515e27 --stat`, `git show bc0969c --stat` dan selisih aturan v1 ke v2 (`git diff c515e27 bc0969c -- docs/hindcast_plan.md`). Apakah v1 sudah terlihat hasilnya saat v2 ditulis (jawab dari urutan commit)? Verifikasi juga fakta BMKG tiap peristiwa dengan sumber URL, atau tulis `SUMBER TIDAK DITEMUKAN`. Khusus banjir Cimanuk Garut: tanggalnya? Hubungannya dengan Siklon Cempaka Nov 2017?

V-B11 Phase 9. Tempel tabel hasil ML beserta satuan RMSE/MAE (apakah skala log/residual?), baseline rata-rata per kabupaten dan rata-rata tahun lalu, serta cara LOYO menangani fixed effect tahun.

V-B12 Mismatch sumber. Untuk 3 lokasi, ambil 14 hari tumpang tindih dari Open-Meteo forecast (past_days) dan archive ERA5 untuk suhu dan hujan. Tempel selisih harian dan persentil hasilnya terhadap klimatologi ERA5 (menunjukkan seberapa besar mismatch). Jika jaringan diblok: `TIDAK DIJALANKAN`.

V-B13 CHIRPS. Tempel baris benchmark. Coba unduh tahun lain (mis. 2018) dari sumber yang sama dan tempel hasilnya atau errornya, untuk menguji klaim "hanya 3 tahun yang tersedia".

V-B14 Verifikasi 16 paper di tabel sitasi. Untuk setiap DOI: `curl -s https://api.crossref.org/works/<doi>` dan tempel judul, container-title, halaman. Bandingkan dengan tabel P2-01. Wajib: Sentelhas 2008 (halaman), Heino 2023, Hosokawa 2023, Huber & Gillespie 1992, Bebber 2013. Tandai MISMATCH. Jika jaringan diblok: `TIDAK DIJALANKAN`.

V-B15 Efek ENSO: periksa tabel ONI resmi (NOAA) untuk 2016 dan 2020, dan tempel nilai puncak (klaim "La Nina -1,7" dan "2016 La Nina kuat" perlu dicek).

---

## 6. BAGIAN C: KOREKSI DOKUMEN (kerjakan setelah A dan B, edit minimal, satu commit)

1. Ganti judul `docs/hypotheses.md` dari "Pra-Registrasi" menjadi "Dokumentasi Hipotesis (post-data-access)".
2. `docs/hindcast_plan.md`: tulis bahwa v2 dibuat setelah v1 dijalankan (`bc0969c` setelah `0a54f50`), jadi v2 adalah pemeriksaan face-validity post hoc, bukan validasi independen.
3. Ganti kata terlarang pada baris di butir 6 bagian 1 dengan "menunjukkan/mengindikasikan/konsisten dengan". Hapus klaim "removed all occurrences" di `git_history.md:20` atau koreksi.
4. `log_inkonsistensi.md:32` ("terbukti akibat pencampuran pelaporan") bertentangan dengan status "ANOMALI BELUM DIJELASKAN"; samakan jadi "belum dijelaskan".
5. `phase13_m3_report.md:31`: ganti "eksklusif pada padi" menjadi "keseragaman 27/27 unit hanya pada padi; kedelai juga naik rata-rata ~21% dengan dispersi lebar".
6. Hapus atau koreksi "50 skenario adversarial". Tulis yang benar: 10 kasus runner Python (template), evaluasi dengan model sungguhan belum dilakukan.
7. Nonaktifkan atau koreksi `J_LINTAS.md` dan `J_BERTENTANGAN.md` (pindahkan ke `archive/jawaban_tidak_valid/`, jangan hapus).
8. Setelah V-B3 dan V-B1 selesai: perbarui tabel hasil di laporan Phase 7 dengan angka yang direproduksi.

Setelah selesai: kirim `verifikasi/INDEX.md`, lalu `V_A.md` dan `V_B.md`. Jangan menyebut item "SELESAI" kecuali output mentahnya ada di berkas.
