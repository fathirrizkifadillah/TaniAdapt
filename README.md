# TaniAdapt: Sistem Pendukung Keputusan Adaptasi Iklim Pertanian Presisi Berbasis Feature Engineering Temporal dan Determinisme Agronomis

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Tests-13%20Passed-success.svg)](https://vitest.dev/)
[![Design](https://img.shields.io/badge/UI%2FUX-Anti--AI--Slop-green.svg)](#desain--antarmuka)
[![Status](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **TaniAdapt** adalah platform sistem pendukung keputusan (*Clinical-Grade Decision Support System*) adaptasi iklim presisi untuk petani dan penyuluh pertanian lapangan di Indonesia. Dibangun dengan pendekatan **determinisme agronomis** berbasis literatur ilmiah tervalidasi (Balitsa, BB Padi, IPB, BRIN, FAO-56), fitur rekayasa cuaca temporal (*lag* 1–14 hari), dan asisten tanya-jawab *Retrieval-Augmented Generation* (RAG) tanpa halusinasi.

---

## Daftar Isi
1. [Latar Belakang & Masalah](#latar-belakang--masalah)
2. [Sentra Komoditas Utama](#sentra-komoditas-utama)
3. [Arsitektur Sistem & Prinsip Agronomi](#arsitektur-sistem--prinsip-agronomi)
4. [Fitur-Fitur Utama](#fitur-fitur-utama)
5. [Desain UI/UX & Prinsip Ramah Petani](#desain-uiux--prinsip-ramah-petani)
6. [Struktur Proyek](#struktur-proyek)
7. [Panduan Instalasi & Menjalankan](#panduan-instalasi--menjalankan)
8. [Pengujian Otomatis (Unit Tests)](#pengujian-otomatis-unit-tests)
9. [Basis Bukti Literatur Ilmiah](#basis-bukti-literatur-ilmiah)
10. [Lisensi & Kontribusi](#lisensi--kontribusi)

---

## Latar Belakang & Masalah

Variabilitas iklim ekstrem akibat fenomena El Niño dan La Niña telah meningkatkan ketidakpastian kalender tanam di Indonesia hingga 38%, memicu lonjakan serangan Organisme Pengganggu Tumbuhan (OPT) seperti *Pyricularia oryzae* (blas padi), *Colletotrichum capsici* (antraknosa cabai), dan *Alternaria porri* (trotol bawang), serta menyebabkan pemborosan pupuk akibat pencucian (*leaching*) hara hingga 40–60%.

Kebanyakan aplikasi cuaca komersial hanya menyajikan data titik harian tanpa konteks biologis tanaman. Sebaliknya, pendekatan *black-box AI* sering menghasilkan halusinasi rekomendasi dosis dan pestisida yang berisiko meracuni tanaman atau memicu resistensi hama.

**TaniAdapt menjawab tantangan ini dengan tiga pilar:**
1. **Feature Engineering Temporal:** Menangkap memori kelembapan dan curah hujan kumulatif masa lalu (lag 1–14 hari) yang menentukan spora jamur dan kejenuhan air tanah.
2. **Determinisme Agronomis:** Logika keputusan 100% deterministik, dapat diaudit, dan mengacu pada ambang batas resmi riset agrikultur Indonesia.
3. **RAG Explainability Berbasis Bukti:** Setiap rekomendasi dilengkapi alasan agronomis eksplisit dan sitasi ilmiah dengan 16 atribut metadata lengkap.

---

## Sentra Komoditas Utama

TaniAdapt mengintegrasikan model agroklimat spesifik untuk 3 sentra produksi pangan dan hortikultura strategis nasional:

| Komoditas | Lokasi Sentra | Koordinat | Fase Pertumbuhan | Patogen Utama yang Dimonitor |
| :--- | :--- | :--- | :--- | :--- |
| **Padi Sawah** (*Oryza sativa*) | **Subang**, Jawa Barat | 6.5595° S, 107.7695° E | Vegetatif (1–45 HST), Reproduktif (46–85 HST), Pematangan (86–115 HST) | Blas Daun/Leher (*Pyricularia oryzae*), Hawar Daun Bakteri (*Xanthomonas oryzae*) |
| **Cabai Merah** (*Capsicum annuum*) | **Garut**, Jawa Barat | 7.2278° S, 107.9087° E | Vegetatif (1–30 HST), Pembungaan (31–60 HST), Pembuahan (61–95 HST) | Antraknosa (*Colletotrichum capsici*), Layu Bakteri (*Ralstonia solanacearum*) |
| **Bawang Merah** (*Allium cepa*) | **Brebes**, Jawa Tengah | 6.8703° S, 109.0435° E | Awal (1–15 HST), Pembentukan Umbi (16–45 HST), Pematangan (46–60 HST) | Bercak Ungu/Trotol (*Alternaria porri*), Layu Fusarium (*Fusarium oxysporum*) |

---

## Arsitektur Sistem & Prinsip Agronomi

```
                     ┌─────────────────────────────────────────┐
                     │ Open-Meteo High-Res API / Cache Offline │
                     └────────────────────┬────────────────────┘
                                          │ (Suhu, RH, Presipitasi, Angin, Radiasi)
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │   Module: featureEngineering.ts        │
                     │  - Consecutive Rainy / Dry Days        │
                     │  - Rolling Sum 7d & 14d Precipitation  │
                     │  - Rolling Average Relative Humidity   │
                     │  - Tetens Formula VPD (kPa)            │
                     │  - 48-Hour Forecast Precipitation      │
                     └────────────────────┬────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
┌───────────────────────────────────┐           ┌───────────────────────────────────┐
│     Module: cropEngines.ts        │           │    Module: decisionEngine.ts      │
│  - Ambang Batas Fenologi Tanaman  │           │  - Skor Epidemiologi Penyakit     │
│  - Koefisien Tanaman (Kc FAO-56)  │──────────►│  - Status Irigasi & Drainase      │
│  - Kerentanan Fase Hari Setelah   │           │  - Jendela Aman Pemupukan         │
│    Tanam (HST)                    │           │  - Aksi Prioritas Lahan           │
└───────────────────────────────────┘           └─────────────────┬─────────────────┘
                                                                  │
                                                                  ▼
                                                ┌───────────────────────────────────┐
                                                │   TaniAdapt UI & Explainability   │
                                                │  - Dashboard Ramah Petani         │
                                                │  - Asisten Tanya RAG (Terbukti)   │
                                                │  - Modal 16-Field Bukti Ilmiah    │
                                                │  - Lembar Cetak Rekomendasi Lahan │
                                                └───────────────────────────────────┘
```

### Rumus & Metrik Kunci
1. **Defisit Tekanan Uap Air (VPD Tetens):**
   $$e_s(T) = 0.61078 \times \exp\left(\frac{17.27 \times T}{T + 237.3}\right)$$
   $$e_a = e_s \times \frac{RH}{100}$$
   $$\text{VPD} = e_s - e_a \quad (\text{dalam kPa})$$
   *Fungsi:* Mengukur tekanan transpirasi tanaman dan kondisi pengeringan permukaan daun.
2. **Kondisi Infeksi Spora Jamur:** Terpicu jika curah hujan berturut-turut $\ge 3$ hari atau kelembapan udara relatif (RH) rata-rata 7 hari $> 85\%$.
3. **Pencucian Hara Pupuk (*Anti-Leaching*):** Rekomendasi menunda pemupukan nitrogen jika akumulasi hujan 48 jam ke depan diproyeksikan $\ge 20$ mm guna mencegah pupuk hanyut ke saluran pembuangan.

---

## Fitur-Fitur Utama

- **Prakiraan Cuaca Lahan & Peringatan Dini:** Integrasi Open-Meteo API dengan resolusi lokal tinggi serta cadangan offline deterministik saat koneksi internet terputus di pelosok.
- **Simulator Stres Cuaca Ekstrem:**
  - `Normal`: Menampilkan data riil lapangan.
  - `Banjir`: Mensimulasikan curah hujan ekstrem $120\text{ mm/hari}$ berturut-turut untuk menguji kesiapan parit drainase dan pencegahan layu bakteri.
  - `Kemarau`: Mensimulasikan masa kering panjang 18 hari tanpa hujan ($\text{VPD} > 1.8\text{ kPa}$) untuk menguji kebutuhan irigasi dan kerentanan fase kritis.
- **Indikator Cuaca Lahan:** Menampilkan rangkuman riwayat hari hujan, total hujan 7 hari, total hujan 14 hari, kelembapan sepekan, hari kering, dan prakiraan hujan 2 hari ke depan.
- **Daftar Tindakan Prioritas:** Rekomendasi lapangan yang dikelompokkan berdasarkan urgensi (`HARI_INI`, `24_JAM`, `RUTIN`) dengan rasionalisasi agronomis eksplisit.
- **Percakapan Penjelasan Agronomis (RAG Grounded):** Menjawab pertanyaan petani mengenai alasan di balik saran sistem, bersumber langsung dari korpus literatur tanpa halusinasi.
- **Eksplorasi Bukti Ilmiah (16 Field):** Modal interaktif untuk memeriksa metadata riset (judul, penulis, tahun, lembaga, tanaman, variabel cuaca, ambang batas, dsb.).
- **Lembar Cetak Rekomendasi Lahan:** Fitur cetak/ekspor PDF ramah kertas A4 untuk dibawa langsung ke kebun atau dibagikan dalam pertemuan kelompok tani.

---

## Desain UI/UX & Prinsip Ramah Petani

TaniAdapt dibangun dengan filosofi **Anti-AI-Slop** dan **Human-First**:

1. **Bahasa Lapangan yang Mudah Dipahami Petani:**
   - Menghindari jargon kecerdasan buatan (*"Fitur Temporal yang Dibaca Engine"*, *"Deterministik"*, *"Anti-leaching"*).
   - Menggunakan istilah lugas: *"Kondisi & Riwayat Cuaca Lahan"*, *"Total Hujan 7 Hari Terakhir"*, *"Panduan agar pupuk tidak hanyut"*, *"Waspada jamur jika basah ≥ 3 hari"*.
2. **Palet Warna Organik Pertanian:**
   - *Deep Forest* (`#1E4D35`): Ketenangan dan kesuburan daun.
   - *Sage Ground* (`#CFE0C4` & `#F5F3E8`): Latar belakang alami dan ramah mata.
   - *Earthy Dark* (`#2A2C24`): Teks kontras tinggi yang mudah dibaca di bawah sinar matahari.
   - *Wheat Alert* (`#F0C98A` & `#8A470B`): Penanda bahaya dan peringatan drainase.
3. **Bebas Emoji (100% Vektor SVG):** Semua visual status menggunakan ikon SVG profesional yang terstandarisasi.
4. **Tipografi Berkelas:** Mengombinasikan *Newsreader* (editorial jurnal), *Bricolage Grotesque* (angka metrik tegas), dan *Plus Jakarta Sans* (keterbacaan antarmuka modern).

---

## Struktur Proyek

```text
taniadapt/
├── index.html                   # Landing page dan panduan metodologi ilmiah
├── dashboard.html               # Antarmuka dashboard sistem pendukung keputusan
├── package.json                 # Konfigurasi dependensi dan skrip proyek
├── tsconfig.json                # Root TypeScript Project References
├── tsconfig.app.json            # Konfigurasi TypeScript untuk aplikasi web (Vite)
├── tsconfig.node.json           # Konfigurasi TypeScript untuk Vite config
├── vite.config.ts               # Konfigurasi bundler Vite (multi-input SPA/MPA)
├── .editorconfig                # Standarisasi format editor (LF, UTF-8, 2 spaces)
├── .env.example                 # Template konfigurasi variabel lingkungan
├── .gitignore                   # Aturan pengabaian file repository yang komprehensif
├── css/
│   └── style.css                # Sistem token desain agritech organik TaniAdapt
├── public/                      # Aset statis & logo vektor SVG resmi TaniAdapt
├── scripts/                     # Skrip otomasi & audit kualitas (anti-slop-audit.mjs)
├── skills/                      # Dokumentasi aturan agronomis (agro-decision-engine)
└── src/
    ├── dashboard.ts             # Logika interaktif antarmuka dashboard (TypeScript murni)
    ├── vite-env.d.ts            # Pengetikan env client Vite
    ├── engine/                  # Core agrometeorological decision engine:
    │   ├── featureEngineering.ts# Algoritma rolling window, curah hujan kumulatif, VPD Tetens
    │   ├── cropEngines.ts       # Model fenologi, koefisien Kc FAO-56, ambang patogen
    │   └── decisionEngine.ts    # Evaluasi deterministik irigasi, pemupukan, drainase
    ├── services/                # Integrasi API cuaca eksternal & offline fallback
    │   └── weatherService.ts    # Handler Open-Meteo API & failover kalibrasi lokal
    ├── data/                    # Dataset model & literatur ilmiah terkalibrasi:
    │   ├── cropModels.ts        # Database parameter tanaman (Padi, Cabai, Bawang, Jagung, Tomat)
    │   ├── indonesianLocations.ts # Koordinat sentra pertanian strategis nasional
    │   ├── fallbackWeatherData.ts # Dataset kalibrasi offline darurat lahan
    │   └── literatureEvidence.ts# Database 8 literatur riset agrikultur (16 field metadata)
    ├── types/                   # Definisi tipe TypeScript (Crop, Decision, Weather, Location)
    └── test/                    # Suite pengujian unit otomatis (Vitest):
        ├── cropEngines.test.ts
        ├── decisionEngine.test.ts
        ├── featureEngineering.test.ts
        └── literatureAndStress.test.ts
```

---

## Panduan Instalasi & Menjalankan

### Kebutuhan Sistem
- [Node.js](https://nodejs.org/) versi 18.0.0 atau lebih baru
- NPM atau PNPM / Yarn

### 1. Kloning & Pemasangan Dependensi
```bash
git clone https://github.com/fathirrizkifadillah/TaniAdapt.git
cd TaniAdapt
npm install
```

### 2. Menjalankan Server Pengembangan (Dev Mode)
```bash
npm run dev
```
Aplikasi akan aktif di:
- **Landing Page:** [http://localhost:5173/](http://localhost:5173/)
- **Dashboard Rekomendasi:** [http://localhost:5173/dashboard.html](http://localhost:5173/dashboard.html)

### 3. Membangun Paket Produksi (Build)
```bash
npm run build
```
Hasil kompilasi yang dioptimasi dan ter-minifikasi akan tersimpan di direktori `dist/`.

---

## Pengujian Otomatis (Unit Tests)

Proyek ini dilengkapi dengan 13 unit tests komprehensif menggunakan **Vitest** untuk memverifikasi kebenaran matematika, kalkulasi VPD, ambang batas penyakit, status irigasi FAO-56, serta generator skenario stres ekstrem.

Jalankan pengujian dengan perintah:
```bash
npm run test
```

**Hasil Pengujian:**
```text
 ✓ src/test/featureEngineering.test.ts (2 tests)
 ✓ src/test/cropEngines.test.ts (5 tests)
 ✓ src/test/literatureAndStress.test.ts (4 tests)
 ✓ src/test/decisionEngine.test.ts (2 tests)

 Test Files  4 passed (4)
      Tests  13 passed (13)
```

---

## Basis Bukti Literatur Ilmiah

TaniAdapt mendasarkan seluruh aturan dan ambang batasnya pada publikasi riset terkemuka:

1. **Suryanti et al. (2015)** – *Epidemiologi Penyakit Trotol (Alternaria porri) pada Bawang Merah di Brebes*. Jurnal Hama dan Penyakit Tumbuhan Tropika.
2. **Hidayat et al. (2018)** – *Dinamika Perkembangan Antraknosa (Colletotrichum capsici) pada Cabai Merah Dataran Tinggi Garut*. Balai Penelitian Tanaman Sayuran (Balitsa).
3. **Allen, R. G., Pereira, L. S., Raes, D., & Smith, M. (1998)** – *Crop Evapotranspiration: Guidelines for Computing Crop Water Requirements*. FAO Irrigation and Drainage Paper 56.
4. **Aldrian, E. & Susanto, R. D. (2003)** – *Identification of Three Dominant Rainfall Regions within Indonesia and Their Relationship to ENSO*. International Journal of Climatology.
5. **BB Padi & Balitbangtan (2020)** – *Pedoman Pengelolaan Terpadu Penyakit Blas (Pyricularia oryzae) pada Padi Sawah Irigasi Subang*. Balai Besar Penelitian Tanaman Padi.
6. **Balitsa / Kementan (2019)** – *Standar Operasional Prosedur Pengendalian Layu Bakteri (Ralstonia solanacearum) pada Cabai Merah*.
7. **Departemen Agronomi & Hortikultura IPB (2021)** – *Dinamika Lengas Tanah dan Manajemen Drainase pada Lahan Sayuran Dataran Rendah*.
8. **Pusat Riset Iklim dan Atmosfer BRIN (2022)** – *Karakteristik Curah Hujan Ekstrem dan Implikasinya terhadap Kalender Tanam Jawa Barat*.

---

## Lisensi & Kontribusi

Proyek ini didistribusikan di bawah lisensi **MIT License**. Kontribusi dalam bentuk perbaikan model agrometeorologi, penambahan komoditas sentra baru, maupun penerjemahan bahasa daerah sangat disambut baik.
