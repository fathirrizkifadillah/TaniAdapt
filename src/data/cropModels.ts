import { CropDefinition, CropId } from '../types/crop';

export const CROP_MODELS: Record<CropId, CropDefinition> = {
  cabai: {
    id: 'cabai',
    name: 'Cabai Merah',
    scientificName: 'Capsicum annuum L.',
    category: 'Hortikultura',
    description: 'Komoditas bernilai tinggi dengan sensitivitas ekstrim terhadap kelembapan tinggi, genangan perakaran, dan spora antraknosa.',
    totalDurationDays: 120,
    optimalTempRange: [22, 28],
    optimalRHRange: [60, 80],
    growthStages: [
      {
        id: 'c_seedling',
        name: 'Bibit & Adaptasi Lapang',
        minHST: 0,
        maxHST: 20,
        description: 'Fase perakaran awal dan pembentukan daun sejati pertama pasca pindah tanam.',
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Fosfat (P) tinggi untuk memacu perakaran',
        agronomicFocus: 'Cegah rebah kecambah (damping-off) dan sengatan terik berlebih'
      },
      {
        id: 'c_vegetative',
        name: 'Vegetatif & Percabangan',
        minHST: 21,
        maxHST: 45,
        description: "Pertumbuhan cabang 'Y' aktif dan biomassa daun lebat.",
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'SEDANG',
        keyNutrientNeed: 'Nitrogen (N) dan Kalium (K) berimbang',
        agronomicFocus: 'Sanitasi gulma dan perempelan tunas air bawah'
      },
      {
        id: 'c_flowering',
        name: 'Inisiasi Pembungaan',
        minHST: 46,
        maxHST: 65,
        description: 'Munculnya kuncup bunga pertama. Sangat rentan terhadap cekaman air (rontok bunga).',
        waterSensitivity: 'KRITIS',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Kalium (K), Kalsium (Ca), dan Boron (B)',
        agronomicFocus: 'Jaga lengas tanah stabil, hindari kekeringan mendadak'
      },
      {
        id: 'c_fruiting',
        name: 'Pembesaran Buah & Pematangan',
        minHST: 66,
        maxHST: 90,
        description: 'Buah memanjang dan mulai berubah warna. Kerentanan puncak terhadap antraknosa dan busuk buah.',
        waterSensitivity: 'TINGGI',
        diseaseVulnerability: 'KRITIS',
        keyNutrientNeed: 'Kalium (K) tinggi dan Kalsium (pencegahan busuk pantat buah/BER)',
        agronomicFocus: 'Kewaspadaan tinggi terhadap spora Colletotrichum saat cuaca lembap basah'
      },
      {
        id: 'c_harvesting',
        name: 'Panen Berulang',
        minHST: 91,
        maxHST: 120,
        description: 'Pemetikan buah merah bertahap tiap 5-7 hari sekali.',
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Pupuk susulan KNO3 untuk menjaga produktivitas petikan lanjutan',
        agronomicFocus: 'Petik saat embun pagi telah kering untuk mencegah busuk pascapanen'
      }
    ],
    diseases: [
      {
        id: 'antraknosa',
        name: 'Antraknosa (Patek)',
        pathogen: 'Colletotrichum acutatum / gloeosporioides',
        indonesianName: 'Patek / Cacar Buah Cabai',
        description: 'Bercak melingkar cekung dengan massa spora oranye/hitam pada buah matang dan daun.',
        triggers: {
          minConsecutiveRainDays: 3,
          minRH: 82,
          tempRange: [24, 28],
          minRolling3dRain: 25
        },
        preventiveAction: 'Semprot fungisida protektif berbahan aktif Mancozeb/Propineb sebelum hujan turun; perbaiki aerasi bedengan.',
        curativeAction: 'Rotasi ke fungisida sistemik berbahan Azoksistrobin / Difenokonazol jika bercak aktif ditemukan; petik dan musnahkan buah sakit.',
        literatureCitationId: 'balitsa_antraknosa_2020'
      },
      {
        id: 'hawar_phytophthora',
        name: 'Busuk Daun & Batang (Phytophthora)',
        pathogen: 'Phytophthora capsici',
        indonesianName: 'Hawar Batang / Busuk Daun',
        description: 'Batang menghitam basah, daun mendadak layu tanpa menguning terlebih dahulu saat tanah jenuh air.',
        triggers: {
          minConsecutiveRainDays: 2,
          minRolling3dRain: 40,
          minRH: 88
        },
        preventiveAction: 'Pastikan parit drainase bedengan kedalaman minimal 30 cm agar air tidak menggenang.',
        curativeAction: 'Kocorkan fungisida berbahan Metalaksil atau Fosetil-Aluminium pada pangkal batang terdampak.',
        literatureCitationId: 'balitsa_tomat_blight_2018'
      }
    ]
  },

  padi: {
    id: 'padi',
    name: 'Padi Sawah Irigasi',
    scientificName: 'Oryza sativa L.',
    category: 'Pangan',
    description: 'Komoditas pangan pokok strategis nasional dengan kebutuhan air dan dinamika nitrogen yang bergantung pada fase fenologi.',
    totalDurationDays: 115,
    optimalTempRange: [24, 32],
    optimalRHRange: [70, 90],
    growthStages: [
      {
        id: 'p_seedling',
        name: 'Vegetatif Awal & Perakaran',
        minHST: 0,
        maxHST: 20,
        description: 'Pemulihan bibit pasca tanam pindah dan pembentukan akar aktif.',
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'SEDANG',
        keyNutrientNeed: 'Dasar NPK berimbang',
        agronomicFocus: 'Ketinggian air macak-macak (1-2 cm) untuk menekan keong mas'
      },
      {
        id: 'p_tillering',
        name: 'Anakan Maksimum',
        minHST: 21,
        maxHST: 40,
        description: 'Pembentukan anakan produktif menentukan potensi jumlah malai.',
        waterSensitivity: 'TINGGI',
        diseaseVulnerability: 'SEDANG',
        keyNutrientNeed: 'Aplikasi Urea susulan I dan II',
        agronomicFocus: 'Terapkan irigasi berselang (AWD) untuk memperkuat perakaran'
      },
      {
        id: 'p_booting',
        name: 'Inisiasi Primordia & Bunting (Booting)',
        minHST: 41,
        maxHST: 65,
        description: 'Pembentukan malai di dalam pelepah daun. Sangat sensitif terhadap kekeringan dan blas daun/leher.',
        waterSensitivity: 'KRITIS',
        diseaseVulnerability: 'KRITIS',
        keyNutrientNeed: 'Kalium (KCl) untuk kekuatan dinding sel malai',
        agronomicFocus: 'Genangi air 3-5 cm terus-menerus; waspada embun tebal pagi pemicu blas'
      },
      {
        id: 'p_grain_filling',
        name: 'Pengisian Bulir (Milky to Dough)',
        minHST: 66,
        maxHST: 90,
        description: 'Bulir padi terisi pati cair hingga memadat.',
        waterSensitivity: 'TINGGI',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Unsur mikro Zink (Zn) dan Silika (Si)',
        agronomicFocus: 'Pertahankan air dangkal; cegah kepik beras dan walang sangit'
      },
      {
        id: 'p_ripening',
        name: 'Pemasakan & Pengeringan Lahan',
        minHST: 91,
        maxHST: 115,
        description: 'Malai menguning sempurna, kadar air bulir menurun menuju siap panen.',
        waterSensitivity: 'RENDAH',
        diseaseVulnerability: 'RENDAH',
        keyNutrientNeed: 'Tidak memerlukan pupuk tambahan',
        agronomicFocus: 'Keringkan sawah total 10 hari sebelum panen untuk mempermudah panen dan pemadatan gabah'
      }
    ],
    diseases: [
      {
        id: 'blas_padi',
        name: 'Penyakit Blas (Daun & Leher)',
        pathogen: 'Magnaporthe oryzae (Pyricularia oryzae)',
        indonesianName: 'Blas / Patah Leher Malai',
        description: 'Bercak belah ketupat runcing di kedua ujungnya pada daun; leher malai membusuk abu-abu hingga patah.',
        triggers: {
          minConsecutiveRainDays: 3,
          minRH: 86,
          tempRange: [22, 27],
          minRolling3dRain: 30
        },
        preventiveAction: 'Hindari kelebihan dosis pupuk Urea di musim hujan; semprot fungisida berbahan Trisiklazol pada awal fase bunting.',
        curativeAction: 'Aplikasi fungisida Kasugamisin atau Isoprotiolan segera saat bercak daun pertama teramati.',
        literatureCitationId: 'bbpadi_blas_2019'
      },
      {
        id: 'hdb_bakteri',
        name: 'Hawar Daun Bakteri (Kresek)',
        pathogen: 'Xanthomonas oryzae pv. oryzae',
        indonesianName: 'Kresek / Hawar Bakteri',
        description: 'Garis kuning kebasahan memanjang dari ujung helaian daun yang kemudian mengering putih keabuan.',
        triggers: {
          minConsecutiveRainDays: 2,
          minRolling3dRain: 35,
          minRH: 85
        },
        preventiveAction: 'Gunakan varietas tahan (Inpari 32/Ciherang); atur jarak tanam jajar legowo untuk sirkulasi udara optimal.',
        curativeAction: 'Semprot bakterisida berbahan Tembaga Oksiklorida atau Asam Oksolinat; kurangi genangan air sawah.',
        literatureCitationId: 'bbpadi_blas_2019'
      }
    ]
  },

  bawang_merah: {
    id: 'bawang_merah',
    name: 'Bawang Merah',
    scientificName: 'Allium cepa var. aggregatum',
    category: 'Rempah',
    description: 'Status Registri: DIBLOKIR / PENDING NEW DATA pada model Jawa Barat (Phase 5) karena ketiadaan data sentra terverifikasi; ditampilkan terbatas untuk studi komparasi drainase.',
    totalDurationDays: 65,
    optimalTempRange: [25, 32],
    optimalRHRange: [55, 75],
    growthStages: [
      {
        id: 'b_sprout',
        name: 'Pertunasan Awal',
        minHST: 0,
        maxHST: 15,
        description: 'Kemunculan tunas umbi dari permukaan bedengan.',
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'SEDANG',
        keyNutrientNeed: 'Fosfat dan sulfur untuk pembentukan akar awal',
        agronomicFocus: 'Siram ringan tiap pagi untuk mencuci sisa embun malam asam'
      },
      {
        id: 'b_tillering',
        name: 'Pembentukan Anakan',
        minHST: 16,
        maxHST: 30,
        description: 'Batang semu membelah membentuk rumpun anakan aktif.',
        waterSensitivity: 'TINGGI',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Nitrogen nitrat dan kalium seimbang',
        agronomicFocus: 'Jaga kebersihan parit antar bedengan'
      },
      {
        id: 'b_bulbing',
        name: 'Pembesaran Umbi (Bulbing)',
        minHST: 31,
        maxHST: 50,
        description: 'Umbi membengkak pesat. Fase paling menentukan tonase dan kualitas umbi.',
        waterSensitivity: 'KRITIS',
        diseaseVulnerability: 'KRITIS',
        keyNutrientNeed: 'Kalium sulfat (ZK) tinggi untuk kepadatan dan warna umbi',
        agronomicFocus: 'Peringatan mutlak: hindari genangan air hujan lebih dari 6 jam'
      },
      {
        id: 'b_maturation',
        name: 'Pematangan Umbi & Pengeringan',
        minHST: 51,
        maxHST: 65,
        description: 'Daun 70% rebah dan menguning alami, leher umbi mengecil.',
        waterSensitivity: 'RENDAH',
        diseaseVulnerability: 'SEDANG',
        keyNutrientNeed: 'Stop pemupukan',
        agronomicFocus: 'Hentikan penyiraman 7 hari sebelum panen agar kulit umbi kering dan tidak busuk simpan'
      }
    ],
    diseases: [
      {
        id: 'moler_fusarium',
        name: 'Penyakit Moler (Layu Otot / Fusarium)',
        pathogen: 'Fusarium oxysporum f.sp. cepae',
        indonesianName: 'Moler / Ngoler / Layu Kuning',
        description: 'Daun terpelintir (twister), melengkung abnormal, menguning dari ujung, umbi membusuk dan akar lenyap.',
        triggers: {
          minConsecutiveRainDays: 2,
          minRolling3dRain: 30,
          minRH: 82,
          tempRange: [26, 32]
        },
        preventiveAction: 'Kocor Trichoderma harzianum pada lubang tanam; taburkan kapur dolomit untuk menaikkan pH tanah ke 6.5.',
        curativeAction: 'Cabut segera tanaman terserang agar spora tidak menular via aliran air; kuras parit segera.',
        literatureCitationId: 'ipb_bawang_moler_2021'
      },
      {
        id: 'trotol_alternaria',
        name: 'Bercak Ungu (Trotol)',
        pathogen: 'Alternaria porri',
        indonesianName: 'Trotol / Bercak Ungu',
        description: 'Bercak kecil melekuk berwarna abu-abu keputihan dengan pusat ungu kecokelatan pada helaian daun.',
        triggers: {
          minConsecutiveRainDays: 3,
          minRH: 85,
          tempRange: [24, 29]
        },
        preventiveAction: 'Siram atau bilas daun di pagi hari setelah hujan malam untuk merontokkan spora yang menempel.',
        curativeAction: 'Aplikasi fungisida kontak Klorotalonil diselingi sistemik Difenokonazol.',
        literatureCitationId: 'ipb_bawang_moler_2021'
      }
    ]
  },

  jagung: {
    id: 'jagung',
    name: 'Jagung Hibrida Pangan',
    scientificName: 'Zea mays L.',
    category: 'Pangan',
    description: 'Komoditas palawija strategis dengan efisiensi fotosintesis C4, sangat sensitif terhadap cekaman air pada fase berbunga/silking.',
    totalDurationDays: 105,
    optimalTempRange: [23, 31],
    optimalRHRange: [50, 75],
    growthStages: [
      {
        id: 'j_veg_early',
        name: 'Vegetatif Awal (V1 - V5)',
        minHST: 0,
        maxHST: 20,
        description: 'Munculnya daun ke-1 hingga ke-5 dan pembentukan sistem perakaran primer.',
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'SEDANG',
        keyNutrientNeed: 'NPK dasar saat tanam',
        agronomicFocus: 'Pantau serbuan ulat grayak baru menetas pada titik tumbuh pucuk'
      },
      {
        id: 'j_veg_fast',
        name: 'Pertumbuhan Cepat (V6 - V12)',
        minHST: 21,
        maxHST: 45,
        description: 'Batang memanjang pesat, perakaran serabut dan akar tunjang berkembang.',
        waterSensitivity: 'TINGGI',
        diseaseVulnerability: 'SEDANG',
        keyNutrientNeed: 'Urea susulan dosis tinggi',
        agronomicFocus: 'Pembumbunan tanah ke pangkal batang untuk memperkokoh rebah angin'
      },
      {
        id: 'j_silking',
        name: 'Pembungaan & Penyerbukan (R1 Tasseling/Silking)',
        minHST: 46,
        maxHST: 60,
        description: 'Munculnya malai bunga jantan dan rambut tongkol. Periode paling kritis dalam daur hidup jagung.',
        waterSensitivity: 'KRITIS',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Kalium dan Fosfor untuk viabilitas polen',
        agronomicFocus: 'Cekaman kekeringan > 4 hari pada fase ini menurunkan persentase biji jadi hingga 40%'
      },
      {
        id: 'j_grain_fill',
        name: 'Pengisian Biji (R2 Blister - R4 Dough)',
        minHST: 61,
        maxHST: 85,
        description: 'Pati mengisi penuh biji jagung hingga terbentuk tongkol padat.',
        waterSensitivity: 'TINGGI',
        diseaseVulnerability: 'SEDANG',
        keyNutrientNeed: 'Penyelesaian translokasi fotosintat',
        agronomicFocus: 'Pastikan kelembapan tanah cukup, waspadai hawar daun helminthosporium'
      },
      {
        id: 'j_maturity',
        name: 'Masak Fisiologis (R6 Black Layer)',
        minHST: 86,
        maxHST: 105,
        description: 'Lapisan hitam terbentuk di pangkal biji, klobot mengering kecokelatan.',
        waterSensitivity: 'RENDAH',
        diseaseVulnerability: 'RENDAH',
        keyNutrientNeed: 'Tidak ada pemupukan',
        agronomicFocus: 'Biarkan tongkol mengering alami di batang hingga kadar air turun ke 20-25%'
      }
    ],
    diseases: [
      {
        id: 'ulat_grayak_faw',
        name: 'Ulat Grayak Jagung (FAW)',
        pathogen: 'Spodoptera frugiperda',
        indonesianName: 'Ulat Grayak FAW',
        description: 'Daun berlubang compang-camping dan terdapat kotoran mirip serbuk gergaji basah di dalam pucuk tanaman.',
        triggers: {
          tempRange: [25, 30],
          minRH: 65
        },
        preventiveAction: 'Tanam serempak dan pasang perangkap feromonoid sejak HST 7.',
        curativeAction: 'Aplikasi insektisida berbahan aktif Emamektin Benzoat atau Klorantraniliprol tepat mengarah ke corong daun saat sore hari.',
        literatureCitationId: 'balitkabi_jagung_faw_2022'
      },
      {
        id: 'hawar_maydis',
        name: 'Hawar Daun Maydis',
        pathogen: 'Bipolaris maydis (Helminthosporium maydis)',
        indonesianName: 'Hawar Daun Jagung',
        description: 'Bercak memanjang sempit di antara tulang daun, warna cokelat muda keabuan.',
        triggers: {
          minConsecutiveRainDays: 3,
          minRH: 85,
          tempRange: [22, 29]
        },
        preventiveAction: 'Gunakan varietas benih tahan (NK, Pioneer) dan atur populasi tidak terlalu rapat.',
        curativeAction: 'Semprot fungisida Azoksistrobin + Difenokonazol jika bercak telah mencapai daun di bawah tongkol utama.',
        literatureCitationId: 'balitkabi_jagung_faw_2022'
      }
    ]
  },

  tomat: {
    id: 'tomat',
    name: 'Tomat Sayur Dataran Tinggi/Sedang',
    scientificName: 'Solanum lycopersicum L.',
    category: 'Sayuran Buah',
    description: 'Sensitif terhadap perubahan lengas tanah mendadak (pemicu retak buah) dan penyakit hawar daun busuk kering.',
    totalDurationDays: 100,
    optimalTempRange: [18, 26],
    optimalRHRange: [60, 80],
    growthStages: [
      {
        id: 't_seedling',
        name: 'Bibit & Tegak Awal',
        minHST: 0,
        maxHST: 20,
        description: 'Fase perakaran dan adaptasi mulsa pasca transplanting.',
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Fosfat untuk perakaran dalam',
        agronomicFocus: 'Cegah layu bakteri Ralstonia dan rebah semai'
      },
      {
        id: 't_vegetative',
        name: 'Vegetatif & Percabangan',
        minHST: 21,
        maxHST: 40,
        description: 'Pemasangan ajir/lanjaran bambu dan pembentukan tajuk tegak.',
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'SEDANG',
        keyNutrientNeed: 'Nitrogen dan Kalium seimbang',
        agronomicFocus: 'Lakukan pewiwitan (pruning) tunas air lateral secara higienis'
      },
      {
        id: 't_flowering',
        name: 'Pembungaan & Pembentukan Dompolan',
        minHST: 41,
        maxHST: 60,
        description: 'Dompolan bunga mekar berurutan. Kebutuhan air harus sangat stabil.',
        waterSensitivity: 'KRITIS',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Kalsium dan Boron tinggi untuk mencegah gugur bunga',
        agronomicFocus: 'Cegah fluktuasi basah-kering tanah yang ekstrim'
      },
      {
        id: 't_fruiting',
        name: 'Pembesaran Buah (Fruit Bulking)',
        minHST: 61,
        maxHST: 80,
        description: 'Buah membesar cepat hingga mencapai ukuran maksimal hijau pekat.',
        waterSensitivity: 'KRITIS',
        diseaseVulnerability: 'KRITIS',
        keyNutrientNeed: 'Kalsium nitrat (mencegah busuk pantat buah/BER) dan Kalium',
        agronomicFocus: 'Bahaya retak buah (*fruit cracking*) jika hujan mendadak mengguyur setelah hari kering'
      },
      {
        id: 't_harvest',
        name: 'Pematangan & Panen',
        minHST: 81,
        maxHST: 100,
        description: 'Buah semburat merah oranye siap petik.',
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Suplemen kalium ringan',
        agronomicFocus: 'Petik saat buah mengkal untuk daya simpan maksimal'
      }
    ],
    diseases: [
      {
        id: 'busuk_daun_phytophthora',
        name: 'Hawar Daun / Busuk Kering (Late Blight)',
        pathogen: 'Phytophthora infestans',
        indonesianName: 'Busuk Kering / Hawar Daun Tomat',
        description: 'Bercak basah abu-abu kehijauan pada daun yang cepat melebar menjadi cokelat gelap dan membusukkan buah mentah.',
        triggers: {
          minConsecutiveRainDays: 2,
          minRH: 88,
          tempRange: [15, 23],
          minRolling3dRain: 25
        },
        preventiveAction: 'Semprot fungisida protektif Mankozeb sebelum awan hujan terbentuk; jarak tanam diperlebar untuk sirkulasi.',
        curativeAction: 'Semprot fungisida translaminar Simoksanil atau Dimetomorf segera setelah bercak daun pertama muncul.',
        literatureCitationId: 'balitsa_tomat_blight_2018'
      },
      {
        id: 'retak_buah',
        name: 'Retak Buah Fisiologis (Fruit Cracking)',
        pathogen: 'Cekaman Fisiologis (Non-Patogen)',
        indonesianName: 'Pecah / Retak Buah Tomat',
        description: 'Kulit buah merekah memanjang atau konsentris di dekat tangkai akibat lonjakan tekanan turgor mendadak.',
        triggers: {
          minRolling3dRain: 20
        },
        preventiveAction: 'Gunakan mulsa plastik perak hitam untuk menstabilkan lengas tanah; berikan kalsium teratur sejak fase berbunga.',
        curativeAction: 'Petik buah yang sudah mengkal lebih awal jika prakiraan cuaca menunjukkan hujan lebat ekstrem.',
        literatureCitationId: 'ipb_irigasi_vpd_2021'
      }
    ]
  },
  cabai_rawit: {
    id: 'cabai_rawit',
    name: 'Cabai Rawit',
    scientificName: 'Capsicum frutescens L.',
    category: 'Hortikultura',
    description: 'Cabai rawit lokal (cengek) dengan siklus panen panjang hingga 150 hari, sensitif terhadap kelembapan tinggi pemicu patek buah dan antraknosa.',
    totalDurationDays: 150,
    optimalTempRange: [22, 29],
    optimalRHRange: [60, 80],
    growthStages: [
      {
        id: 'cr_seedling',
        name: 'Bibit Baru Pindah Tanam (0–20 HST)',
        minHST: 0,
        maxHST: 20,
        description: 'Fase adaptasi akar muda pada bedengan tanah.',
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Fosfat untuk pacu perakaran',
        agronomicFocus: 'Jaga kelembapan tidak berlebih, hindari rebah kecambah'
      },
      {
        id: 'cr_vegetative',
        name: 'Tumbuh Cabang & Ranting Rimbun (21–50 HST)',
        minHST: 21,
        maxHST: 50,
        description: 'Pembentukan percabangan sekunder dan daun rimbun.',
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'SEDANG',
        keyNutrientNeed: 'Nitrogen dan Kalium seimbang',
        agronomicFocus: 'Wiwil tunas air bawah dan sanitasi gulma bedengan'
      },
      {
        id: 'cr_flowering',
        name: 'Mulai Keluar Bunga Lebat (51–75 HST)',
        minHST: 51,
        maxHST: 75,
        description: 'Bunga putih bermekaran serempak di ketiak cabang.',
        waterSensitivity: 'KRITIS',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Kalium, Kalsium, dan Boron anti rontok bunga',
        agronomicFocus: 'Jaga ketersediaan air stabil, jangan biarkan tanah retak'
      },
      {
        id: 'cr_fruiting',
        name: 'Buah Membesar & Matang Hijau/Merah (76–105 HST)',
        minHST: 76,
        maxHST: 105,
        description: 'Buah rawit padat terisi dan mulai menguning hingga merah.',
        waterSensitivity: 'TINGGI',
        diseaseVulnerability: 'KRITIS',
        keyNutrientNeed: 'Kalsium dan Kalium tinggi',
        agronomicFocus: 'Waspadai patek buah (antraknosa) saat cuaca basah'
      },
      {
        id: 'cr_harvesting',
        name: 'Masa Panen Petikan Berkala (106–150 HST)',
        minHST: 106,
        maxHST: 150,
        description: 'Pemetikan buah rawit bertahap tiap 5-7 hari sekali.',
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Pupuk susulan penopang pembungaan lanjutan',
        agronomicFocus: 'Petik saat embun kering untuk menjaga kesegaran buah'
      }
    ],
    diseases: [
      {
        id: 'antraknosa_rawit',
        name: 'Antraknosa / Patek Buah Rawit',
        pathogen: 'Colletotrichum acutatum',
        indonesianName: 'Patek Cabai Rawit',
        description: 'Bercak melingkar cekung dengan bintik hitam pada buah rawit masak.',
        triggers: {
          minConsecutiveRainDays: 3,
          minRH: 82,
          tempRange: [24, 28],
          minRolling3dRain: 25
        },
        preventiveAction: 'Semprot fungisida protektif kontak sebelum hujan lebat; petik dan musnahkan buah yang busuk.',
        curativeAction: 'Rotasi fungisida sistemik sesuai rekomendasi PPL.',
        literatureCitationId: 'balitsa_antraknosa_2020'
      },
      {
        id: 'layu_bakteri_rawit',
        name: 'Layu Bakteri Lahan Basah',
        pathogen: 'Ralstonia solanacearum',
        indonesianName: 'Layu Bakteri Cabai Rawit',
        description: 'Tanaman mendadak layu hijau segar saat siang hari akibat genangan parit.',
        triggers: {
          minRolling3dRain: 35,
          minRH: 88
        },
        preventiveAction: 'Perdalam parit bedengan minimal 30 cm agar air cepat tuntas terbuang.',
        curativeAction: 'Cabut dan buang tanaman layu agar tidak menular ke barisan lain.',
        literatureCitationId: 'balitsa_tomat_blight_2018'
      }
    ]
  },
  kedelai: {
    id: 'kedelai',
    name: 'Kedelai',
    scientificName: 'Glycine max (L.) Merr.',
    category: 'Pangan',
    description: 'Komoditas pangan legum semusim unggulan 17 sentra Jawa Barat, sensitif terhadap kekeringan fase pengisian polong (FAO-56 Zr=0.8m, p=0.50).',
    totalDurationDays: 85,
    optimalTempRange: [23, 30],
    optimalRHRange: [65, 85],
    growthStages: [
      {
        id: 'k_seedling',
        name: 'Kecambah & Daun Awal (0–15 HST)',
        minHST: 0,
        maxHST: 15,
        description: 'Munculnya daun trifoliate pertama pasca sebar benih.',
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'SEDANG',
        keyNutrientNeed: 'Inokulan Rhizobium bintil akar',
        agronomicFocus: 'Cegah genangan air berlebih yang membusukkan benih'
      },
      {
        id: 'k_vegetative',
        name: 'Tumbuh Percabangan Rimbun (16–30 HST)',
        minHST: 16,
        maxHST: 30,
        description: 'Pembentukan cabang vegetatif dan nodul bintil akar aktif.',
        waterSensitivity: 'SEDANG',
        diseaseVulnerability: 'SEDANG',
        keyNutrientNeed: 'Fosfat dan Kalium',
        agronomicFocus: 'Penyiangan gulma dan pembumbunan tanah barisan'
      },
      {
        id: 'k_flowering',
        name: 'Berbunga & Pembentukan Polong (31–50 HST)',
        minHST: 31,
        maxHST: 50,
        description: 'Kuntum bunga ungu/putih mekar dan mulai membentuk bakal polong.',
        waterSensitivity: 'TINGGI',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Kalium dan Kalsium penguat bunga',
        agronomicFocus: 'Jaga lengas tanah, kekurangan air menyebabkan bunga gugur'
      },
      {
        id: 'k_pod_fill',
        name: 'Pengisian Biji Polong (51–70 HST)',
        minHST: 51,
        maxHST: 70,
        description: 'Biji di dalam polong membesar dan padat terisi.',
        waterSensitivity: 'KRITIS',
        diseaseVulnerability: 'SEDANG',
        keyNutrientNeed: 'Kalium tinggi untuk bobot biji optimal',
        agronomicFocus: 'Fase paling haus air, jangan biarkan deplesi melewati batas RAW'
      },
      {
        id: 'k_maturation',
        name: 'Polong Menguning & Siap Panen (71–85 HST)',
        minHST: 71,
        maxHST: 85,
        description: 'Daun mulai rontok alami dan polong berubah cokelat kering.',
        waterSensitivity: 'RENDAH',
        diseaseVulnerability: 'TINGGI',
        keyNutrientNeed: 'Nihil pupuk kimia',
        agronomicFocus: 'Panen saat cuaca terik dan RH <= 75% untuk biji kering simpan'
      }
    ],
    diseases: [
      {
        id: 'karat_daun_kedelai',
        name: 'Karat Daun Kedelai',
        pathogen: 'Phakopsora pachyrhizi',
        indonesianName: 'Karat Daun Kedelai',
        description: 'Pustul cokelat kemerahan di bawah permukaan daun yang membuat daun menguning rontok prematur.',
        triggers: {
          minConsecutiveRainDays: 2,
          minRH: 85,
          tempRange: [20, 28]
        },
        preventiveAction: 'Tanam varietas tahan karat dan atur drainase lahan agar tidak lembap jenuh.',
        curativeAction: 'Semprot fungisida anjuran penyuluh lapangan jika gejala karat meluas.',
        literatureCitationId: 'balitkabi_kedelai_2021'
      },
      {
        id: 'ulat_polong_kedelai',
        name: 'Ulat Penggerek Polong',
        pathogen: 'Etiella zinckenella',
        indonesianName: 'Penggerek Polong Kedelai',
        description: 'Larva melubangi kulit polong dan memakan biji muda di dalamnya.',
        triggers: {
          minConsecutiveRainDays: 0,
          tempRange: [25, 32]
        },
        preventiveAction: 'Pasang perangkap feromon dan lakukan pengamatan rutin fase pembentukan polong.',
        curativeAction: 'Kendalikan dengan arahan Petugas Penyuluh Lapangan.',
        literatureCitationId: 'balitkabi_kedelai_2021'
      }
    ]
  }
};
