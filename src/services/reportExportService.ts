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
              font: 'Segoe UI',
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
              font: 'Segoe UI',
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
                  font: 'Segoe UI',
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
          createDataCell(`${d.level} (${d.score}/100)`, 20),
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
                font: 'Segoe UI',
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
                font: 'Segoe UI',
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
                font: 'Segoe UI',
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
                font: 'Segoe UI',
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
                font: 'Segoe UI',
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
                font: 'Segoe UI',
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
                font: 'Segoe UI',
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
                font: 'Segoe UI',
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
