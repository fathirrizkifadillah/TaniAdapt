import { describe, it, expect } from 'vitest';
import {
  validateFao56Example18,
  calculateDailyET0,
  calculateDynamicKc,
  calculateTawRaw,
  evaluateWaterStress
} from '../engine';
import goldenVectors from './golden_engine_vectors.json';

describe('Golden Engine Vectors Parity Test (FAO-56 & Water Balance)', () => {
  it('1. Memvalidasi ET0 Contoh 18 Bab 4 FAO-56 (Brussels/Uccle)', () => {
    const et0 = validateFao56Example18();
    const expected = goldenVectors.et0_example18.expected_mm_day;
    const tolerance = goldenVectors.et0_example18.tolerance;
    expect(Math.abs(et0 - expected)).toBeLessThanOrEqual(tolerance);
  });

  it('2. Memvalidasi 3 sampel tropis AgERA5 (Subang, Lembang, Indramayu)', () => {
    for (const sample of goldenVectors.et0_tropical_samples) {
      const inp = sample.inputs;
      const calculated = calculateDailyET0(
        inp.tmax_c,
        inp.tmin_c,
        inp.dewpoint_c,
        inp.wind_10m_ms,
        inp.solar_radiation_mj_m2_day,
        inp.elevation_m,
        inp.latitude_deg,
        inp.day_of_year
      );
      // Toleransi <= 0.05 mm/hari antar implementasi Python dan TypeScript
      expect(Math.abs(calculated - sample.expected_et0)).toBeLessThanOrEqual(0.05);
    }
  });

  it('3. Memvalidasi kurva dinamik Kc pada titik-titik jangkar fase (ini, mid, late)', () => {
    // Pada engine TypeScript operasional web, Kc dihitung dari parameter rules.json
    // Uji titik awal (ini), tengah (mid), dan akhir (late)
    const kcJagungIni = calculateDynamicKc('jagung', 10);
    expect(kcJagungIni.kc).toBe(0.30);

    const kcJagungMid = calculateDynamicKc('jagung', 60);
    expect(kcJagungMid.kc).toBe(1.20);

    const kcJagungEndKering = calculateDynamicKc('jagung', 125, true);
    expect(kcJagungEndKering.kc).toBe(0.35);

    const kcJagungEndBasah = calculateDynamicKc('jagung', 125, false);
    expect(kcJagungEndBasah.kc).toBe(0.60);

    const kcKedelaiMid = calculateDynamicKc('kedelai', 50);
    expect(kcKedelaiMid.kc).toBe(1.15);

    const kcTomatMid = calculateDynamicKc('tomat', 80);
    expect(kcTomatMid.kc).toBe(1.15);
  });

  it('4. Memvalidasi determinisme evaluasi stres air FAO-56', () => {
    // Uji status normal vs stres abiotik pada jagung (RAW baseline = 82.5 mm pada TAW=150)
    const tawRaw = calculateTawRaw('jagung', 60, 150.0);
    expect(tawRaw.taw_mm).toBe(150.0);
    expect(tawRaw.raw_mm).toBe(82.5);

    // Deplesi di bawah ambang RAW -> status normal
    const safeRes = evaluateWaterStress('jagung', 60, 40.0);
    expect(safeRes.status).toBe('normal');

    // Deplesi melampaui RAW -> status kondisi_stres_abiotik
    const stressRes = evaluateWaterStress('jagung', 60, 90.0);
    expect(stressRes.status).toBe('kondisi_stres_abiotik');

    // Padi sawah tergenang -> status evidence_insufficient
    const padiRes = evaluateWaterStress('padi', 30, 10.0);
    expect(padiRes.status).toBe('evidence_insufficient');
  });
});
