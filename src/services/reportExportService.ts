/**
 * Comprehensive Microsoft Word (.docx) Report Generator for TaniAdapt.
 * Produces detailed, professionally formatted agronomic decision reports.
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
}

export async function generateAndDownloadWordReport(input: ReportExportInput): Promise<void> {
  const { engineResult, features, currentWeather, location, plotName, userName, userType } = input;
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

  const greenDark = '1E4D35';
  const greenLight = 'EAF2EC';
  const borderLight = 'D3E0D6';
  const grayText = '555555';

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
              font: 'Times New Roman',
            }),
          ],
        }),
      ],
    });
  }

  function createDataCell(text: string, widthPercent: number, isBold: boolean = false): TableCell {
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      borders: cellBorder,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold: isBold,
              size: 20, // 10pt
              font: 'Times New Roman',
              color: '222222',
            }),
          ],
        }),
      ],
    });
  }

  // --- SECTION 1: PROFIL LAHAN & TANAMAN TABLE ---
  const profileRows = [
    new TableRow({
      children: [
        createDataCell('Komoditas Tanaman', 30, true),
        createDataCell(`${engineResult.cropName} (${engineResult.scientificName})`, 70),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Petak Lahan', 30, true),
        createDataCell(plotName || 'Petak Utama', 70),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Lokasi Sentra', 30, true),
        createDataCell(`${location.name} (${location.province}) — Koordinat: ${location.latitude.toFixed(4)}°S, ${location.longitude.toFixed(4)}°E (Elevasi: ${location.elevationMeters} mdpl)`, 70),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Umur Tanaman (HST)', 30, true),
        createDataCell(`${engineResult.currentHST} Hari Setelah Tanam (HST)`, 70),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Fase Fenologi Aktif', 30, true),
        createDataCell(`${engineResult.stageName} — ${engineResult.stageDescription}`, 70),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Pengguna / Pengelola', 30, true),
        createDataCell(`${userName || 'Petani Mandiri'} (${userType === 'farm_organisasi' ? 'Pengelola Farm / Organisasi' : 'Petani Mandiri'})`, 70),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Waktu Terbit Laporan', 30, true),
        createDataCell(`${dateFormatted}, ${timeFormatted}`, 70),
      ],
    }),
  ];

  const profileTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: profileRows,
  });

  // --- SECTION 2: STATUS RISIKO & MIKROKLIMAT TABLE ---
  const riskColor = engineResult.overallRisk === 'TINGGI' ? 'B91C1C' : engineResult.overallRisk === 'SEDANG' ? 'B45309' : '15803D';
  const riskRows = [
    new TableRow({
      children: [
        createHeaderCell('Parameter Agrometeorologi', 50),
        createHeaderCell('Nilai Observasi / Status', 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Tingkat Risiko Keseluruhan', 50, true),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: engineResult.overallRisk,
                  bold: true,
                  size: 22,
                  color: riskColor,
                  font: 'Times New Roman',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Suhu Udara Lapangan', 50, true),
        createDataCell(`${currentWeather?.temperature ?? 26.5} °C (Terasa: ${currentWeather?.apparentTemperature ?? 27.0} °C)`, 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Kelembapan Relatif Udara (RH)', 50, true),
        createDataCell(`${currentWeather?.relativeHumidity ?? 80} %`, 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Kecepatan Angin (10m)', 50, true),
        createDataCell(`${currentWeather?.windSpeed ?? 5.0} km/jam`, 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Defisit Tekanan Uap (VPD)', 50, true),
        createDataCell(`${features?.currentVPD?.toFixed(2) ?? '0.95'} kPa (Formula Tetens)`, 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Hari Hujan Berurutan (>= 5 mm)', 50, true),
        createDataCell(`${features?.consecutiveRainyDays ?? 0} hari berturut-turut`, 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Akumulasi Hujan 3 Hari & 7 Hari', 50, true),
        createDataCell(`3 Hari: ${features?.rolling3dRain ?? 0} mm | 7 Hari: ${features?.rolling7dRain ?? 0} mm`, 50),
      ],
    }),
  ];

  const riskTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: riskRows,
  });

  // --- SECTION 3: REKOMENDASI TINDAKAN LAPANGAN TABLE ---
  const recHeaderRow = new TableRow({
    children: [
      createHeaderCell('Tindakan', 20),
      createHeaderCell('Tingkat Urgensi', 20),
      createHeaderCell('Instruksi Operasional Lapangan', 40),
      createHeaderCell('Dasar Sains / Agronomi', 20),
    ],
  });

  const recRows = [recHeaderRow];
  for (const r of engineResult.recommendations) {
    recRows.push(
      new TableRow({
        children: [
          createDataCell(r.title, 20, true),
          createDataCell(r.urgency === 'HARI_INI' ? 'HARI INI (Mendesak)' : 'RUTIN (Waspada)', 20),
          createDataCell(r.action, 40),
          createDataCell(r.rationale, 20),
        ],
      })
    );
  }

  // Add Irrigation and Fertilization specifics
  recRows.push(
    new TableRow({
      children: [
        createDataCell('Irigasi / Drainase', 20, true),
        createDataCell(engineResult.irrigation.status, 20),
        createDataCell(engineResult.irrigation.recommendation, 40),
        createDataCell(engineResult.irrigation.rationale, 20),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Pemupukan Hara', 20, true),
        createDataCell(engineResult.fertilization.safeToApply ? 'AMAN' : 'TUNDA', 20),
        createDataCell(engineResult.fertilization.recommendedNutrient, 40),
        createDataCell(engineResult.fertilization.reason, 20),
      ],
    })
  );

  const recTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: recRows,
  });

  // --- SECTION 4: RINCIAN RISIKO HAMA & PENYAKIT TABLE ---
  const diseaseHeaderRow = new TableRow({
    children: [
      createHeaderCell('Nama Penyakit / Hama', 25),
      createHeaderCell('Patogen / Biologi', 25),
      createHeaderCell('Tingkat Risiko', 20),
      createHeaderCell('Tindakan Preventif Terdaftar', 30),
    ],
  });

  const diseaseRows = [diseaseHeaderRow];
  for (const d of engineResult.diseaseRisks) {
    diseaseRows.push(
      new TableRow({
        children: [
          createDataCell(d.diseaseName, 25, true),
          createDataCell(d.pathogen, 25),
          createDataCell(`${d.level}`, 20),
          createDataCell(d.preventiveAdvice, 30),
        ],
      })
    );
  }

  const diseaseTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: diseaseRows,
  });

  // Build the complete document
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
                text: 'TANIADAPT — LAPORAN REKOMENDASI AGROADVISORY',
                bold: true,
                size: 32, // 16pt
                color: greenDark,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Sistem Pendukung Keputusan Adaptasi Iklim & Manajemen Risiko Budidaya Lapangan',
                italics: true,
                size: 20, // 10pt
                color: grayText,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({ text: '' }), // spacer

          // Section 1
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: '1. Profil Lahan dan Fase Tanaman',
                bold: true,
                size: 24,
                color: greenDark,
                font: 'Times New Roman',
              }),
            ],
          }),
          profileTable,
          new Paragraph({ text: '' }),

          // Section 2
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: '2. Status Risiko & Parameter Agrometeorologi',
                bold: true,
                size: 24,
                color: greenDark,
                font: 'Times New Roman',
              }),
            ],
          }),
          riskTable,
          new Paragraph({ text: '' }),

          // Section 3
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: '3. Rekomendasi Tindakan Operasional di Lapangan',
                bold: true,
                size: 24,
                color: greenDark,
                font: 'Times New Roman',
              }),
            ],
          }),
          recTable,
          new Paragraph({ text: '' }),

          // Section 4
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: '4. Evaluasi Kerentanan Hama & Penyakit (OPT)',
                bold: true,
                size: 24,
                color: greenDark,
                font: 'Times New Roman',
              }),
            ],
          }),
          diseaseTable,
          new Paragraph({ text: '' }),

          // Disclaimer & Signature
          new Paragraph({
            children: [
              new TextRun({
                text: 'Catatan Pertanggungjawaban Ilmiah:',
                bold: true,
                size: 18,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Laporan ini diproduksi secara deterministik oleh Decision Engine TaniAdapt berbasis kaidah agrometeorologi FAO-56 Penman-Monteith dan parameter penelitian Balai Penelitian Tanaman Sayuran (Balitsa). Sistem tidak memberikan resep dosis kimia sintetis; konsultasikan pilihan bahan aktif dan pengendalian kimiawi dengan Petugas Penyuluh Lapangan (PPL) setempat.',
                italics: true,
                size: 18,
                color: grayText,
                font: 'Times New Roman',
              }),
            ],
          }),
        ],
      },
    ],
  });

  // Pack into blob and trigger download
  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileNameCrop = engineResult.cropId || 'tanaman';
  a.download = `Laporan_AgroAdvisory_TaniAdapt_${fileNameCrop}_HST${engineResult.currentHST}_${now.toISOString().slice(0, 10)}.docx`;
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

export async function generateSinglePlotAdvanceWordReport(input: ReportExportInput): Promise<void> {
  const { engineResult, features, currentWeather, location, plotName, userName, userType } = input;
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

  const greenDark = '1E4D35';
  const borderLight = 'D3E0D6';
  const grayText = '555555';

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
              size: 20,
              font: 'Times New Roman',
            }),
          ],
        }),
      ],
    });
  }

  function createDataCell(text: string, widthPercent: number, isBold: boolean = false): TableCell {
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      borders: cellBorder,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold: isBold,
              size: 20,
              font: 'Times New Roman',
              color: '222222',
            }),
          ],
        }),
      ],
    });
  }

  const f56 = engineResult.fao56;
  const faoRows = [
    new TableRow({
      children: [
        createHeaderCell('Parameter Biofisik FAO-56 PM', 50),
        createHeaderCell('Nilai Komputasi & Satuan', 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Evapotranspirasi Acuan (ETo)', 50, true),
        createDataCell(`${f56?.et0_daily_mm?.toFixed(2) || '-'} mm/hari (Metode Penman-Monteith)`, 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Koefisien Tanaman (Kc Terverifikasi)', 50, true),
        createDataCell(`${f56?.kc_current?.toFixed(2) || '-'} (${engineResult.stageName})`, 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Kebutuhan Air Tanaman (ETc = ETo × Kc)', 50, true),
        createDataCell(`${f56?.etc_daily_mm?.toFixed(2) || '-'} mm/hari`, 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Kapasitas Air Siap Diserap (RAW)', 50, true),
        createDataCell(`${f56?.raw_mm?.toFixed(2) || '-'} mm (p = ${f56?.p_fraction || 0.4})`, 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Total Air Tersedia (TAW)', 50, true),
        createDataCell(`${f56?.taw_mm?.toFixed(2) || '-'} mm`, 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Deplesi Lengas Tanah Saat Ini (Dr)', 50, true),
        createDataCell(`${f56?.depletion_dr_mm?.toFixed(2) || '-'} mm ${f56 && f56.depletion_dr_mm > f56.raw_mm ? '[CEKAMAN AIR]' : '[LENGAS AMAN]'}`, 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Defisit Tekanan Uap (VPD Tetens)', 50, true),
        createDataCell(`${features?.currentVPD.toFixed(2) || '-'} kPa (Suhu: ${currentWeather?.temperature.toFixed(1)}°C, RH: ${Math.round(currentWeather?.relativeHumidity || 0)}%)`, 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Akumulasi Hujan 7 Hari', 50, true),
        createDataCell(`${features?.rolling7dRain?.toFixed(1) || '-'} mm (Hari Hujan Berturut-turut: ${features?.consecutiveRainyDays || 0} hari)`, 50),
      ],
    }),
    new TableRow({
      children: [
        createDataCell('Status Evaluasi Cekaman (Stress Flag)', 50, true),
        createDataCell(f56?.is_stressed ? 'CEKAMAN AIR TERDETEKSI' : 'LENGAS TANAH OPTIMAL', 50),
      ],
    }),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'TANIADAPT — DOSSIER BIOFISIK & AGROMETEOROLOGI LANJUTAN',
                bold: true,
                size: 30,
                color: greenDark,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Laporan Spesifikasi Mekanistik Lahan Tunggal (Mode Riset / Universitas / Pengelola Kebun)',
                italics: true,
                size: 20,
                color: grayText,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: `1. Identitas Lahan: ${plotName || 'Petak Utama'} — ${engineResult.cropName} (${engineResult.currentHST} HST)`,
                bold: true,
                size: 24,
                color: greenDark,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Lokasi: ${location.name} (${location.elevationMeters} mdpl) | Pengguna: ${userName || 'Petani Mandiri'} | Terbit: ${dateFormatted}, ${timeFormatted}`,
                size: 19,
                color: grayText,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: '2. Neraca Air & Parameter Biofisik Komputasional (FAO-56 Penman-Monteith)',
                bold: true,
                size: 24,
                color: greenDark,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: faoRows,
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: '3. Evaluasi Risiko Patogen & Tindakan Adaptif',
                bold: true,
                size: 24,
                color: greenDark,
                font: 'Times New Roman',
              }),
            ],
          }),
          ...engineResult.recommendations.map(r => new Paragraph({
            children: [
              new TextRun({ text: `• [${r.urgency}] ${r.title}: `, bold: true, font: 'Times New Roman' }),
              new TextRun({ text: `${r.action} — Rasional: ${r.rationale}`, font: 'Times New Roman' }),
            ],
          })),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Metodologi & Ketentuan Riset: Dihitung secara deterministik tanpa resep kimia sintetis komersial. Berpedoman pada Balitsa Lembang, BB Padi Sukamandi, dan FAO Irrigation and Drainage Paper No. 56.',
                italics: true,
                size: 18,
                color: grayText,
                font: 'Times New Roman',
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
  const fileNameCrop = engineResult.cropId || 'tanaman';
  a.download = `Dossier_Advance_TaniAdapt_${fileNameCrop}_HST${engineResult.currentHST}_${now.toISOString().slice(0, 10)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function generatePortfolioAdvanceWordReport(plots: PortfolioAdvancePlot[], userName?: string): Promise<void> {
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const greenDark = '1E4D35';
  const greenLight = 'EAF2EC';
  const grayText = '555555';

  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Petak Lahan', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Komoditas & HST', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'ETo (mm)', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Kc', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'ETc (mm)', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Dr / RAW', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'VPD (kPa)', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Risiko', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
      ],
    }),
    ...plots.map((p) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.name, bold: true, font: 'Times New Roman' })] }), new Paragraph({ children: [new TextRun({ text: p.placeName, size: 18, color: grayText, font: 'Times New Roman' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${p.cropName} (${p.hst} HST)`, font: 'Times New Roman' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.etoMmDay !== undefined ? p.etoMmDay.toFixed(1) : '-', font: 'Times New Roman' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.kc !== undefined ? p.kc.toFixed(2) : '-', font: 'Times New Roman' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.etcMmDay !== undefined ? p.etcMmDay.toFixed(1) : '-', font: 'Times New Roman' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.drMm !== undefined && p.rawMm !== undefined ? `${p.drMm.toFixed(1)} / ${p.rawMm.toFixed(1)}` : '-', font: 'Times New Roman' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.vpdKpa !== undefined ? p.vpdKpa.toFixed(2) : '-', font: 'Times New Roman' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.risk, bold: true, color: p.risk === 'TINGGI' ? 'B91C1C' : greenDark, font: 'Times New Roman' })] })] }),
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
                text: 'TaniAdapt — Matriks Biofisik Portofolio Lintas Petak (Mode Advance)',
                bold: true,
                size: 26,
                color: greenDark,
                font: 'Times New Roman',
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
                font: 'Times New Roman',
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
                font: 'Times New Roman',
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
  const greenDark = '1E4D35';
  const greenLight = 'EAF2EC';
  const borderLight = 'D3E0D6';
  const grayText = '555555';

  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'No', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Petak Lahan', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Komoditas & HST', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Risiko', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Status Air', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Aksi Prioritas', bold: true, font: 'Times New Roman' })] })],
          shading: { fill: greenLight, type: ShadingType.CLEAR, color: 'auto' },
        }),
      ],
    }),
    ...plots.map((p, i) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), font: 'Times New Roman' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.name, bold: true, font: 'Times New Roman' })] }), new Paragraph({ children: [new TextRun({ text: p.placeName, size: 18, color: grayText, font: 'Times New Roman' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${p.cropName} (${p.hst} HST)`, font: 'Times New Roman' })] }), new Paragraph({ children: [new TextRun({ text: p.stageName, size: 18, color: grayText, font: 'Times New Roman' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.risk, bold: true, color: p.risk === 'TINGGI' ? 'B91C1C' : greenDark, font: 'Times New Roman' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.irrigationStatus, font: 'Times New Roman' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.topRecommendation || '-', size: 18, font: 'Times New Roman' })] })] }),
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
                text: 'TaniAdapt — Laporan Portofolio Lahan Pertanian',
                bold: true,
                size: 28,
                color: greenDark,
                font: 'Times New Roman',
              }),
            ],
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Ringkasan Tindakan & Risiko Lintas Petak | Pemilik: ${userName || 'Pengguna TaniAdapt'} | Tanggal: ${dateFormatted}`,
                size: 20,
                color: grayText,
                font: 'Times New Roman',
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
                text: 'Catatan:',
                bold: true,
                size: 18,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: ' Rekomendasi dihitung secara independen per petak menggunakan data mikroklimat lokasi dan tahapan fenologi tanaman masing-masing.',
                size: 18,
                font: 'Times New Roman',
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
  a.download = `Laporan_Portofolio_TaniAdapt_${now.toISOString().slice(0, 10)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
