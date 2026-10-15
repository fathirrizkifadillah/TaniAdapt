import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import engineSchema from '../engine/engine_output.schema.json';

describe('Engine Output Contract JSON Schema Draft 2020-12 Test Suite', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(engineSchema);

  const validBaselinePayload = {
    crop: 'jagung',
    location: {
      kabkota: 'KABUPATEN SUBANG',
      cell_id: 'CELL_(-6.5, 107.7)',
      weather_source: 'AgERA5_CDS'
    },
    as_of: '2026-10-13',
    issue_time: '2026-10-13T06:00:00+07:00',
    timezone: 'Asia/Jakarta',
    rules_version: 'v2.3-phase13-gate',
    data_version: 'agera5-v1.1',
    data_freshness_days: 0,
    layer: 'daily',
    source_data: 'forecast',
    forecast_uncertainty: 15.0,
    indicators: [
      {
        id: 'soil_water_depletion_Dr',
        rule_id: 'RULE_WATER_FAO56_DEPLETION',
        value: 45.2,
        unit: 'mm',
        relative_rank: 'typical',
        rank_basis: 'AgERA5_1991_2020',
        rank_basis_n: 30
      }
    ],
    actions: [
      {
        action: 'irrigation',
        window: '06.00 - 08.00 WIB',
        status_label: 'Sangat Aman',
        rule_ids: ['RULE_WATER_FAO56_DEPLETION'],
        rule_status: 'VERIFIED_METHOD',
        evidence_refs: ['FAO56_RAW_DEPLETION'],
        reason: 'Lengas tanah mencukupi; evapotranspirasi pagi tenang.'
      }
    ],
    hourly: [
      {
        hour: '06.00',
        status: 'SAFE',
        reason: 'Kondisi optimal pagi'
      },
      {
        hour: '12.00',
        status: 'WARN',
        reason: 'Radiasi terik siang'
      }
    ],
    status: 'normal',
    evidence_tier: 'published_model',
    evidence_refs: ['FAO56_ET0_PM', 'FAO56_KC_MAIZE'],
    claim_allowed: 'Lengas tanah mencukupi (Dr <= RAW); tidak memerlukan irigasi darurat.',
    claim_forbidden: ['calibrated yield forecast', 'empirical yield loss estimate'],
    limitations: ['Menggunakan asumsi kedalaman perakaran standar FAO-56 Tabel 22.'],
    action_ids: ['ACT_IRRIG_REPLENISHMENT']
  };

  it('1. Memvalidasi payload dasar yang sah lulus validasi schema', () => {
    const valid = validate(validBaselinePayload);
    if (!valid) {
      console.error(validate.errors);
    }
    expect(valid).toBe(true);
  });

  it('2. Menolak payload dengan properti tambahan tak terduga (additionalProperties: false)', () => {
    const invalidPayload = {
      ...validBaselinePayload,
      properti_siluman_tak_terdaftar: 'berbahaya'
    };
    const valid = validate(invalidPayload);
    expect(valid).toBe(false);
  });

  it('3. Menolak format tanggal/waktu yang melanggar RFC 3339 / ISO 8601', () => {
    const invalidPayload = {
      ...validBaselinePayload,
      as_of: '13-10-2026', // Format tidak valid (seharusnya YYYY-MM-DD)
    };
    const valid = validate(invalidPayload);
    expect(valid).toBe(false);
  });

  it('4. Menolak status kondisi_stres_abiotik jika tidak dipicu oleh aturan VERIFIED_METHOD', () => {
    // Schema Draft 2020-12 if/then: kondisi_stres_abiotik mensyaratkan trigger rule VERIFIED
    const unverifiedStressPayload = {
      ...validBaselinePayload,
      status: 'kondisi_stres_abiotik',
      actions: [
        {
          action: 'irrigation',
          window: '06.00 - 08.00 WIB',
          status_label: 'Darurat',
          rule_ids: ['RULE_WATER_FAO56_DEPLETION'],
          rule_status: 'METHOD_UNCALIBRATED', // Bukan VERIFIED_METHOD
          evidence_refs: ['FAO56_RAW_DEPLETION'],
          reason: 'Deplesi tanah'
        }
      ]
    };
    const valid = validate(unverifiedStressPayload);
    expect(valid).toBe(false);
  });

  it('5. Menolak status kondisi_mendukung_OPT di level atas (tak aktif di schema)', () => {
    const optStressPayload = {
      ...validBaselinePayload,
      status: 'kondisi_mendukung_OPT' // Tidak ada dalam enum status top-level
    };
    const valid = validate(optStressPayload);
    expect(valid).toBe(false);
  });
});
