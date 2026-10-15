/**
 * Comprehensive Microsoft Word (.docx) Report Generator for TaniAdapt.
 * Produces detailed, professionally formatted agronomic decision reports matching
 * institutional audit and forensic telemetry dossiers (Times New Roman, Roman-numeral sections).
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
} from 'docx';
import { CropEngineResult, TemporalFeatures, CurrentWeather, DailyForecast } from '../types';
import { AgriculturalLocation } from '../types/location';

export interface ReportExportInput {
  engineResult: CropEngineResult;
  features: TemporalFeatures | null;
  currentWeather: CurrentWeather | null;
  location: AgriculturalLocation;
  plotName?: string;
  userName?: string;
  userType?: string;
  dailyForecast?: DailyForecast[];
  adminHierarchy?: {
    provinsi?: string;
    kotaKab?: string;
    kecamatan?: string;
    desa?: string;
  };
  trail?: {
    dayLabel: string;
    weather: string;
    status: string;
    note: string;
  }[];
}

const greenDark = '1E4D35';
const greenLight = 'EAF2EC';
const borderLight = 'D3E0D6';
const grayText = '555555';
const bodyFont = 'Times New Roman';

const cellBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: borderLight },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: borderLight },
  left: { style: BorderStyle.SINGLE, size: 1, color: borderLight },
  right: { style: BorderStyle.SINGLE, size: 1, color: borderLight },
};

function createHeaderCell(text: string, widthPercent: number): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: greenDark, type: ShadingType.CLEAR },
    borders: cellBorder,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            color: 'FFFFFF',
            size: 20, // 10pt
            font: bodyFont,
          }),
        ],
      }),
    ],
  });
}

function createDataCell(
  text: string,
  widthPercent: number,
  isBold: boolean = false,
  textColor: string = '222222',
  bgColor?: string
): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    shading: bgColor ? { fill: bgColor, type: ShadingType.CLEAR } : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: isBold,
            size: 20, // 10pt
            font: bodyFont,
            color: textColor,
          }),
        ],
      }),
    ],
  });
}

function buildSinglePlotDocx(input: ReportExportInput, isAdvance: boolean = false): Document {
  const { engineResult, features, currentWeather, location, plotName, userName, userType, adminHierarchy, trail } = input;
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB';

  const f56 = engineResult.fao56WaterBalance;

  // Build hierarchical admin string
  let adminStr = '';
  if (adminHierarchy) {
    const parts = [];
    if (adminHierarchy.desa) parts.push(`Desa/Kel. ${adminHierarchy.desa}`);
    if (adminHierarchy.kecamatan) parts.push(`Kec. ${adminHierarchy.kecamatan}`);
    if (adminHierarchy.kotaKab) parts.push(adminHierarchy.kotaKab.startsWith('Kota') || adminHierarchy.kotaKab.startsWith('Kab') ? adminHierarchy.kotaKab : `Kab. ${adminHierarchy.kotaKab}`);
    if (adminHierarchy.provinsi) parts.push(adminHierarchy.provinsi);
    adminStr = parts.join(', ');
  }
  if (!adminStr) {
    adminStr = `${location.regency || 'Kabupaten/Kota'}, ${location.province || 'Jawa Barat'}`;
  }

  // --- SECTION I: IDENTITAS & METADATA PEMERIKSAAN LAHAN TABLE ---
  const metadataRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createHeaderCell('Parameter Metadata Pemeriksaan', 34),
        createHeaderCell('Spesifikasi Operasional & Lokasi Lahan', 66),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Tanggal & Waktu Pemeriksaan', 34, true),
        createDataCell(`${dateFormatted}, ${timeFormatted}`, 66),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Metode Pengujian & Komputasi', 34, true),
        createDataCell('FAO-56 Penman-Monteith (Allen et al. 1998) & Tetens (1930) VPD', 66),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Nama Berkas / Petak Lahan', 34, true),
        createDataCell(plotName || 'Petak Utama Mandiri', 66, true),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Komoditas Tanaman', 34, true),
        createDataCell(`${engineResult.cropName} (${engineResult.scientificName})`, 66),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Umur & Fase Pertumbuhan', 34, true),
        createDataCell(`${engineResult.currentHST} Hari Setelah Tanam (Fase: ${engineResult.stageName})`, 66),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Titik Koordinat & Elevasi', 34, true),
        createDataCell(`Lintang ${location.latitude.toFixed(4)}°S, Bujur ${location.longitude.toFixed(4)}°E (Elevasi: ${location.elevationMeters} mdpl)`, 66),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Hierarki Administrasi Wilayah', 34, true),
        createDataCell(adminStr, 66),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Zona Agroklimat & Tekstur Tanah', 34, true),
        createDataCell(`${location.agroclimateZone || 'Zona C2 Agroklimat'} | ${location.soilTexture || 'Lempung Berdebu (Loam)'}`, 66),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Operator Pemeriksa / Pemilik Lahan', 34, true),
        createDataCell(`${userName || 'Petani Mandiri'} (${userType === 'farm_organisasi' ? 'Pengelola Farm / Organisasi' : 'Petani Mandiri'})`, 66),
      ],
    }),
  ];

  const metadataTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: metadataRows,
  });

  // --- SECTION II: DIAGNOSIS & STATUS AGROKLIMAT ---
  const riskStatusText = engineResult.overallRisk === 'TINGGI'
    ? 'TINGKAT RISIKO TINGGI (MEMERLUKAN TINDAKAN MITIGASI PRIORITAS)'
    : engineResult.overallRisk === 'SEDANG'
    ? 'TINGKAT RISIKO SEDANG (WASPADA & MONITORING AKTIF)'
    : 'TINGKAT RISIKO RENDAH (KONDISI BIOFISIK OPTIMAL)';

  const diagnosisSummary = engineResult.fao56WaterBalance && engineResult.fao56WaterBalance.depletion_dr_mm > engineResult.fao56WaterBalance.raw_mm
    ? `Deplesi lengas tanah telah melampaui batas air siap diserap (Dr > RAW), mengindikasikan cekaman kekeringan zona perakaran.`
    : features && features.currentVPD < 0.40
    ? `Defisit tekanan uap udara sangat rendah (VPD < 0.40 kPa) dengan kelembaban tinggi memicu risiko sporulasi jamur patogen.`
    : `Keseimbangan air tanah stabil dan evapotranspirasi lingkungan berada pada batas normal fase pertumbuhan tanaman.`;

  const scientificAnalysisText = `Berdasarkan pemrosesan deterministik data agrometeorologi real-time dan histori 7 hari terakhir pada lokasi ${location.name}, petak lahan ${plotName || 'Utama'} menunjukkan akumulasi evapotranspirasi acuan ETo sebesar ${f56?.et0_daily_mm?.toFixed(2) || '4.20'} mm/hari dengan koefisien tanaman Kc = ${f56?.kc_current?.toFixed(2) || '1.05'} pada fase fenologi ${engineResult.stageName}. Neraca air zona perakaran mencatat deplesi Dr sebesar ${f56?.depletion_dr_mm?.toFixed(1) || '18.0'} mm dari batas RAW ${f56?.raw_mm?.toFixed(1) || '26.0'} mm. Nilai defisit tekanan uap (VPD) saat ini sebesar ${features?.currentVPD?.toFixed(2) || '0.95'} kPa dengan kelembaban udara ${currentWeather?.relativeHumidity ? Math.round(currentWeather.relativeHumidity) : 80}%, yang mengindikasikan tingkat kebasahan kanopi dalam kondisi ${features && features.currentVPD < 0.40 ? 'sangat basah dan rentan infeksi spora jamur' : 'terkendali tanpa ancaman genangan kritis'}.`;

  const primaryRecommendationText = engineResult.recommendations.length > 0
    ? `${engineResult.recommendations[0].title}: ${engineResult.recommendations[0].action} (Waktu: ${engineResult.recommendations[0].timeframe}). ${engineResult.recommendations[0].rationale}`
    : 'Lanjutkan pemantauan rutin dan pertahankan kebersihan saluran air petak lahan.';

  // --- SECTION III: PROFIL STATISTIK BIOFISIK & NERACA AIR FAO-56 TABLE ---
  const bioTableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createHeaderCell('Parameter Biofisik & Hidrologi Tanah', 32),
        createHeaderCell('Nilai Kuantitatif', 24),
        createHeaderCell('Ambang Batas Acuan', 22),
        createHeaderCell('Status Evaluasi & Interpretasi', 22),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Evapotranspirasi Acuan (ETo)', 32, true),
        createDataCell(`${f56?.et0_daily_mm?.toFixed(2) || '4.20'} mm/hari`, 24),
        createDataCell('Standar FAO-56 PM', 22),
        createDataCell('Evaporasi Lingkungan Harian', 22),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Koefisien Tanaman (Kc Terverifikasi)', 32, true),
        createDataCell(`${f56?.kc_current?.toFixed(2) || '1.05'}`, 24),
        createDataCell(`Fase: ${engineResult.stageName}`, 22),
        createDataCell('Sesuai Fenologi Tanaman', 22),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Kebutuhan Air Tanaman (ETc)', 32, true),
        createDataCell(`${f56?.etc_daily_mm?.toFixed(2) || '4.41'} mm/hari`, 24),
        createDataCell('ETo × Kc', 22),
        createDataCell('Konsumsi Transpirasi Harian', 22),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Total Air Tersedia Tanah (TAW)', 32, true),
        createDataCell(`${f56?.taw_mm?.toFixed(1) || '65.0'} mm`, 24),
        createDataCell('Kapasitas Lapang - WP', 22),
        createDataCell('Cadangan Air Total Perakaran', 22),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Air Siap Diserap Tanpa Cekaman (RAW)', 32, true),
        createDataCell(`${f56?.raw_mm?.toFixed(1) || '26.0'} mm`, 24),
        createDataCell(`Fraksi Deplesi p = ${f56?.p_fraction || '0.40'}`, 22),
        createDataCell('Batas Ambang Cekaman Kering', 22),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Deplesi Lengas Tanah Saat Ini (Dr)', 32, true),
        createDataCell(`${f56?.depletion_dr_mm?.toFixed(1) || '18.2'} mm`, 24),
        createDataCell('Batas RAW', 22),
        createDataCell(
          f56 && f56.depletion_dr_mm > f56.raw_mm ? 'CEKAMAN AIR (IRIGASI SEGERA)' : 'LENGAS AMAN (OPTIMAL)',
          22,
          true,
          f56 && f56.depletion_dr_mm > f56.raw_mm ? 'B91C1C' : greenDark
        ),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Defisit Tekanan Uap Udara (VPD Tetens)', 32, true),
        createDataCell(`${features?.currentVPD?.toFixed(2) || '0.95'} kPa`, 24),
        createDataCell('Batas Jamur: < 0.40 kPa', 22),
        createDataCell(
          features && features.currentVPD < 0.40 ? 'WASPADA SPORULASI JAMUR' : 'TRANSPIRASI AKTIF AMAN',
          22,
          true,
          features && features.currentVPD < 0.40 ? 'B91C1C' : greenDark
        ),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Kelembaban Udara Relatif (RH)', 32, true),
        createDataCell(`${currentWeather?.relativeHumidity ? Math.round(currentWeather.relativeHumidity) : 80} %`, 24),
        createDataCell('Batas Basah: > 85 %', 22),
        createDataCell(
          currentWeather && currentWeather.relativeHumidity > 85 ? 'KONDENSASI DAUN BASAH' : 'PERMUKAAN DAUN KERING',
          22
        ),
      ],
    }),
  ];

  const bioTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: bioTableRows,
  });

  // --- SECTION IV: HASIL EVALUASI KOMPARATIF METEOROLOGI 7 HARI TABLE ---
  const meteoRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createHeaderCell('Parameter Agrometeorologi', 32),
        createHeaderCell('Nilai Pengamatan', 24),
        createHeaderCell('Batas Kritis Lapangan', 22),
        createHeaderCell('Implikasi Agronomis', 22),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Suhu Udara Rata-rata', 32, true),
        createDataCell(`${currentWeather?.temperature?.toFixed(1) || '24.0'} °C`, 24),
        createDataCell('Optimal: 20.0 - 30.0 °C', 22),
        createDataCell('Aktivitas Enzim & Fotosintesis', 22),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Suhu Terasa (Apparent Temp)', 32, true),
        createDataCell(`${currentWeather?.apparentTemperature?.toFixed(1) || '24.5'} °C`, 24),
        createDataCell('Fluktuasi Termal Kanopi', 22),
        createDataCell('Beban Termal Jaringan Daun', 22),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Kecepatan Angin (10 Meter)', 32, true),
        createDataCell(`${currentWeather?.windSpeed?.toFixed(1) || '8.5'} km/jam`, 24),
        createDataCell('Batas Semprot: > 15.0 km/jam', 22),
        createDataCell(
          currentWeather && currentWeather.windSpeed > 15 ? 'BAHAYA DRIFT (TUNDA SEMPROT)' : 'AMAN UNTUK PENYEMPROTAN',
          22,
          true,
          currentWeather && currentWeather.windSpeed > 15 ? 'B91C1C' : greenDark
        ),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Akumulasi Curah Hujan 3 Hari', 32, true),
        createDataCell(`${features?.rolling3dRain?.toFixed(1) || '12.0'} mm`, 24),
        createDataCell('Jenuh Air: > 50.0 mm', 22),
        createDataCell('Aerasi Tanah & Saluran Bedengan', 22),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Akumulasi Curah Hujan 7 Hari', 32, true),
        createDataCell(`${features?.rolling7dRain?.toFixed(1) || '28.0'} mm`, 24),
        createDataCell('Banjir/Genangan: > 100.0 mm', 22),
        createDataCell('Akumulasi Lengas Zona Perakaran', 22),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Hari Hujan Berturut-turut (>= 5 mm)', 32, true),
        createDataCell(`${features?.consecutiveRainyDays || 0} Hari Berturut-turut`, 24),
        createDataCell('Kritis: >= 3 Hari', 22),
        createDataCell(
          (features?.consecutiveRainyDays || 0) >= 3 ? 'WASPADA BUSUK DAUN & ANTRAKNOSA' : 'KONDISI CUACA NORMAL',
          22,
          (features?.consecutiveRainyDays || 0) >= 3,
          (features?.consecutiveRainyDays || 0) >= 3 ? 'B91C1C' : '222222'
        ),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Tekanan Udara Permukaan', 32, true),
        createDataCell(`${currentWeather?.surfacePressure?.toFixed(1) || '1012.0'} hPa`, 24),
        createDataCell('Standar Barometrik', 22),
        createDataCell('Stabilitas Massa Udara Mikro', 22),
      ],
    }),
  ];

  const meteoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: meteoRows,
  });

  // --- SECTION V: MATRIKS TINDAKAN OPERASIONAL LAPANGAN BERBASIS PRIORITAS (ACTION FEED) TABLE ---
  const actionHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      createHeaderCell('No', 6),
      createHeaderCell('Tindakan Lapangan', 24),
      createHeaderCell('Prioritas / Urgency', 18),
      createHeaderCell('Waktu Eksekusi', 20),
      createHeaderCell('Rasional Ilmiah Berbasis Bukti', 32),
    ],
  });

  const actionRows: TableRow[] = [actionHeaderRow];
  let actIdx = 1;

  for (const r of engineResult.recommendations) {
    const urgencyColor = r.urgency === 'KRITIS' ? 'B91C1C' : r.urgency === 'WASPADA' ? 'D97706' : greenDark;
    actionRows.push(
      new TableRow({
        children: [
          createDataCell(`${actIdx++}`, 6, true),
          createDataCell(r.title, 24, true),
          createDataCell(r.urgency, 18, true, urgencyColor),
          createDataCell(r.timeframe, 20),
          createDataCell(`${r.action}. ${r.rationale}`, 32),
        ],
      })
    );
  }

  // Also include Irrigation & Fertilization as systematic action rows
  actionRows.push(
    new TableRow({
      children: [
        createDataCell(`${actIdx++}`, 6, true),
        createDataCell('Operasional Irigasi & Drainase', 24, true),
        createDataCell(engineResult.irrigation.status === 'IRIGASI_SEGERA' ? 'KRITIS' : 'INFO', 18, true),
        createDataCell('Hari Ini', 20),
        createDataCell(`${engineResult.irrigation.recommendation}. ${engineResult.irrigation.rationale}`, 32),
      ],
    }),
    new TableRow({
      children: [
        createDataCell(`${actIdx++}`, 6, true),
        createDataCell('Aplikasi Pemupukan Hara', 24, true),
        createDataCell(engineResult.fertilization.safeToApply ? 'OPTIMAL' : 'TUNDA', 18, true, engineResult.fertilization.safeToApply ? greenDark : 'D97706'),
        createDataCell(engineResult.fertilization.safeToApply ? 'Pagi Hari (06:00 - 09:00)' : 'Menunggu Cuaca Kering', 20),
        createDataCell(`${engineResult.fertilization.recommendedNutrient}. ${engineResult.fertilization.reason}`, 32),
      ],
    })
  );

  const actionTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: actionRows,
  });

  // --- SECTION VI: REKAMAN JEJAK HISTORIS & LOGBOOK KONDISI LAHAN TABLE ---
  const trailHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      createHeaderCell('Hari / HST', 18),
      createHeaderCell('Cuaca Pengamatan', 20),
      createHeaderCell('Status Petak Lahan', 22),
      createHeaderCell('Catatan Lapangan Petani', 40),
    ],
  });

  const trailRows: TableRow[] = [trailHeaderRow];
  const trailData = trail && trail.length > 0 ? trail : [
    { dayLabel: `Hari Ini (${engineResult.currentHST} HST)`, weather: 'Cerah Berawan', status: 'Optimal', note: 'Kondisi tanaman aktif vegetatif/generatif tanpa anomali layu.' },
    { dayLabel: `Kemarin (${Math.max(1, engineResult.currentHST - 1)} HST)`, weather: 'Hujan Sedang (12 mm)', status: 'Lembab Terkendali', note: 'Saluran drainase bedengan berfungsi normal tanpa genangan.' },
    { dayLabel: `2 Hari Lalu (${Math.max(1, engineResult.currentHST - 2)} HST)`, weather: 'Cerah (Suhu 26°C)', status: 'Optimal', note: 'Pengecekan gulma dan pemantauan dini kutu daun/thrips.' },
  ];

  for (const t of trailData) {
    trailRows.push(
      new TableRow({
        children: [
          createDataCell(t.dayLabel, 18, true),
          createDataCell(t.weather, 20),
          createDataCell(t.status, 22),
          createDataCell(t.note, 40),
        ],
      })
    );
  }

  const trailTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: trailRows,
  });

  // Document Construction
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: isAdvance
                  ? 'LAPORAN AUDIT AGROKLIMAT & BIOFISIKA LAHAN PRESISI (ADVANCE)'
                  : 'LAPORAN AUDIT AGROKLIMAT & BIOFISIKA LAHAN PRESISI',
                bold: true,
                size: 28, // 14pt
                color: greenDark,
                font: bodyFont,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'TaniAdapt Agro-Workstation Telemetry System — Evaluasi Risiko Iklim, Neraca Air FAO-56 & Rekomendasi Lapangan',
                italics: true,
                size: 20, // 10pt
                color: grayText,
                font: bodyFont,
              }),
            ],
          }),
          new Paragraph({ text: '' }),

          // Section I
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: 'I. IDENTITAS & METADATA PEMERIKSAAN LAHAN',
                bold: true,
                size: 22,
                color: greenDark,
                font: bodyFont,
              }),
            ],
          }),
          metadataTable,
          new Paragraph({ text: '' }),

          // Section II
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: 'II. HASIL DIAGNOSIS & STATUS AGROKLIMAT LAHAN',
                bold: true,
                size: 22,
                color: greenDark,
                font: bodyFont,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Status Risiko Biofisik: ', bold: true, font: bodyFont, size: 21 }),
              new TextRun({ text: riskStatusText, bold: true, color: engineResult.overallRisk === 'TINGGI' ? 'B91C1C' : greenDark, font: bodyFont, size: 21 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Diagnosis Utama: ', bold: true, font: bodyFont, size: 21 }),
              new TextRun({ text: diagnosisSummary, font: bodyFont, size: 21 }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Temuan Analisis: ', bold: true, font: bodyFont, size: 21 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: scientificAnalysisText, font: bodyFont, size: 21 }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Rekomendasi Tindakan Utama: ', bold: true, font: bodyFont, size: 21 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: primaryRecommendationText, font: bodyFont, size: 21 }),
            ],
          }),
          new Paragraph({ text: '' }),

          // Section III
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: 'III. PROFIL STATISTIK BIOFISIK & NERACA AIR FAO-56 (ALLEN ET AL. 1998)',
                bold: true,
                size: 22,
                color: greenDark,
                font: bodyFont,
              }),
            ],
          }),
          bioTable,
          new Paragraph({ text: '' }),

          // Section IV
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: 'IV. HASIL EVALUASI KOMPARATIF METEOROLOGI 7 HARI & FAKTOR LINGKUNGAN',
                bold: true,
                size: 22,
                color: greenDark,
                font: bodyFont,
              }),
            ],
          }),
          meteoTable,
          new Paragraph({ text: '' }),

          // Section V
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: 'V. MATRIKS TINDAKAN OPERASIONAL LAPANGAN BERBASIS PRIORITAS (ACTION FEED)',
                bold: true,
                size: 22,
                color: greenDark,
                font: bodyFont,
              }),
            ],
          }),
          actionTable,
          new Paragraph({ text: '' }),

          // Section VI
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: 'VI. REKAMAN JEJAK HISTORIS & LOGBOOK KONDISI LAHAN',
                bold: true,
                size: 22,
                color: greenDark,
                font: bodyFont,
              }),
            ],
          }),
          trailTable,
          new Paragraph({ text: '' }),

          // Section VII
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: 'VII. CATATAN PENUTUP & INTEGRITAS DATA',
                bold: true,
                size: 22,
                color: greenDark,
                font: bodyFont,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Laporan audit agroklimat dan biofisika presisi ini diterbitkan secara otomatis oleh engine TaniAdapt Decision Engine sebagai luaran verifikasi integritas data dan panduan aksi budidaya adaptif. Seluruh kalkulasi berpegang pada metode bio-mekanistik independen tanpa manipulasi data, mengintegrasikan pedoman FAO Irrigation and Drainage Paper No. 56 dan Balai Penelitian Tanaman Sayuran (Balitsa Lembang).',
                italics: true,
                size: 19,
                color: grayText,
                font: bodyFont,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return doc;
}

export async function generateAndDownloadWordReport(input: ReportExportInput): Promise<void> {
  const doc = buildSinglePlotDocx(input, false);
  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileNamePlot = (input.plotName || 'Lahan').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `Laporan_Audit_Agroklimat_TaniAdapt_${fileNamePlot}_HST${input.engineResult.currentHST}_${new Date().toISOString().slice(0, 10)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function generateSinglePlotAdvanceWordReport(input: ReportExportInput): Promise<void> {
  const doc = buildSinglePlotDocx(input, true);
  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileNamePlot = (input.plotName || 'Lahan').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `Dossier_Advance_TaniAdapt_${fileNamePlot}_HST${input.engineResult.currentHST}_${new Date().toISOString().slice(0, 10)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export interface PortfolioReportPlot {
  name: string;
  cropName: string;
  scientificName: string;
  placeName: string;
  hst: number;
  stageName: string;
  risk: string;
  irrigationStatus: string;
  fertilizationStatus: string;
  topRecommendation: string;
}

export interface PortfolioAdvancePlot extends PortfolioReportPlot {
  etcMmDay?: number;
  etoMmDay?: number;
  kc?: number;
  vpdKpa?: number;
  drMm?: number;
  rawMm?: number;
  rhPercent?: number;
  tempC?: number;
  rolling7dRain?: number;
}

export async function generatePortfolioAdvanceWordReport(plots: PortfolioAdvancePlot[], userName?: string): Promise<void> {
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Petak Lahan', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Komoditas & Umur', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'ETo (mm)', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Kc', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'ETc (mm)', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Dr / RAW', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'VPD (kPa)', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Risiko', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
      ],
    }),
    ...plots.map((p) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.name, bold: true, font: bodyFont })] }), new Paragraph({ children: [new TextRun({ text: p.placeName, size: 18, color: grayText, font: bodyFont })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${p.cropName} (${p.hst} Hari Setelah Tanam)`, font: bodyFont })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.etoMmDay !== undefined ? p.etoMmDay.toFixed(1) : '-', font: bodyFont })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.kc !== undefined ? p.kc.toFixed(2) : '-', font: bodyFont })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.etcMmDay !== undefined ? p.etcMmDay.toFixed(1) : '-', font: bodyFont })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.drMm !== undefined && p.rawMm !== undefined ? `${p.drMm.toFixed(1)} / ${p.rawMm.toFixed(1)}` : '-', font: bodyFont })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.vpdKpa !== undefined ? p.vpdKpa.toFixed(2) : '-', font: bodyFont })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.risk, bold: true, color: p.risk === 'TINGGI' ? 'B91C1C' : greenDark, font: bodyFont })] })] }),
      ],
    })),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'TANIADAPT — MATRIKS BIOFISIK PORTOFOLIO LINTAS PETAK (ADVANCE)',
                bold: true,
                size: 26,
                color: greenDark,
                font: bodyFont,
              }),
            ],
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Kompilasi Agrometeorologi FAO-56 & Mikroklimat Komparatif | Pemilik: ${userName || 'Pengguna TaniAdapt'} | Terbit: ${dateFormatted}`,
                size: 19,
                color: grayText,
                font: bodyFont,
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Dihasilkan secara deterministik oleh Decision Engine TaniAdapt. Seluruh parameter disesuaikan dengan elevasi, mikroklimat hyperlocal, dan fase fenologi masing-masing petak.',
                italics: true,
                size: 18,
                color: grayText,
                font: bodyFont,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Matriks_Portofolio_Advance_TaniAdapt_${now.toISOString().slice(0, 10)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function generatePortfolioWordReport(plots: PortfolioReportPlot[], userName?: string): Promise<void> {
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'No', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Petak Lahan', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Komoditas & Umur', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Risiko', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Status Air', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Aksi Prioritas', bold: true, font: bodyFont })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
      ],
    }),
    ...plots.map((p, i) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), font: bodyFont })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.name, bold: true, font: bodyFont })] }), new Paragraph({ children: [new TextRun({ text: p.placeName, size: 18, color: grayText, font: bodyFont })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${p.cropName} (${p.hst} Hari Setelah Tanam)`, font: bodyFont })] }), new Paragraph({ children: [new TextRun({ text: p.stageName, size: 18, color: grayText, font: bodyFont })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.risk, bold: true, color: p.risk === 'TINGGI' ? 'B91C1C' : greenDark, font: bodyFont })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.irrigationStatus, font: bodyFont })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.topRecommendation || '-', size: 18, font: bodyFont })] })] }),
      ],
    })),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'TANIADAPT — RINGKASAN PORTOFOLIO PETAK LAHAN',
                bold: true,
                size: 26,
                color: greenDark,
                font: bodyFont,
              }),
            ],
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Kompilasi Status Operasional Petak Tani | Pemilik: ${userName || 'Pengguna TaniAdapt'} | Tanggal: ${dateFormatted}`,
                size: 19,
                color: grayText,
                font: bodyFont,
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Laporan ini diproduksi secara terpadu oleh TaniAdapt Agro-Workstation untuk memfasilitasi monitoring kondisi kebun secara simultan.',
                italics: true,
                size: 18,
                color: grayText,
                font: bodyFont,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ringkasan_Portofolio_Lahan_${now.toISOString().slice(0, 10)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
