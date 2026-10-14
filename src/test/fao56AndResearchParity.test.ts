import { describe, it, expect } from 'vitest';
import {
  validateFao56Example18,
  calculateDailyET0,
  calculateDynamicKc,
  calculateTawRaw,
  evaluateWaterStress,
  simulate7DaysForward,
  reconstructColdStartDr,
  getFao56DepletionConfig,
  getRuleById
} from '../engine';

describe('FAO-56 Penman-Monteith & Agronomic Parity Suite', () => {
  it('1. Memvalidasi benchmark Contoh 18 Bab 4 FAO-56 (Brussels/Uccle) mendekati 3.88 mm/hari', () => {
    const et0 = validateFao56Example18();
    expect(et0).toBeGreaterThan(3.85);
    expect(et0).toBeLessThan(3.91);
    expect(Math.abs(et0 - 3.88)).toBeLessThanOrEqual(0.03);
  });

  it('2. Memverifikasi fraksi deplesi p dan kedalaman akar Zr dari FAO-56 Tabel 22', () => {
    const config = getFao56DepletionConfig();
    expect(config.crops.jagung.p_fraction).toBe(0.55);
    expect(config.crops.kedelai.p_fraction).toBe(0.50);
    expect(config.crops.tomat.p_fraction).toBe(0.40);
    expect(config.crops.padi.p_fraction).toBe(0.20);

    expect(config.crops.jagung.zr_chosen_m).toBe(1.0);
    expect(config.crops.kedelai.zr_chosen_m).toBe(0.8);
    expect(config.crops.tomat.zr_chosen_m).toBe(0.7);
  });

  it('3. Memvalidasi TAW (Eq. 82) dan RAW (Eq. 83) Contoh 36 FAO-56 pada 3 tekstur tanah (toleransi <= 1 mm)', () => {
    function calcEx36(thetaFc: number, thetaWp: number, zr: number, p: number) {
      const taw = 1000.0 * (thetaFc - thetaWp) * zr;
      const raw = p * taw;
      return { taw: Math.round(taw), raw: Math.round(raw) };
    }

    // Loamy sand (theta_fc = 0.15, theta_wp = 0.06 -> 90 mm/m)
    const lsTomato = calcEx36(0.15, 0.06, 0.8, 0.40);
    expect(Math.abs(lsTomato.taw - 72)).toBeLessThanOrEqual(1);
    expect(Math.abs(lsTomato.raw - 29)).toBeLessThanOrEqual(1);

    const lsMaize = calcEx36(0.15, 0.06, 1.2, 0.55);
    expect(Math.abs(lsMaize.taw - 108)).toBeLessThanOrEqual(1);
    expect(Math.abs(lsMaize.raw - 59)).toBeLessThanOrEqual(1);

    // Silt (theta_fc = 0.32, theta_wp = 0.15 -> 170 mm/m)
    const sTomato = calcEx36(0.32, 0.15, 0.8, 0.40);
    expect(Math.abs(sTomato.taw - 136)).toBeLessThanOrEqual(1);
    expect(Math.abs(sTomato.raw - 54)).toBeLessThanOrEqual(1);

    const sMaize = calcEx36(0.32, 0.15, 1.2, 0.55);
    expect(Math.abs(sMaize.taw - 204)).toBeLessThanOrEqual(1);
    expect(Math.abs(sMaize.raw - 112)).toBeLessThanOrEqual(1);

    // Silty clay (theta_fc = 0.35, theta_wp = 0.23 -> 120 mm/m)
    const scTomato = calcEx36(0.35, 0.23, 0.8, 0.40);
    expect(Math.abs(scTomato.taw - 96)).toBeLessThanOrEqual(1);
    expect(Math.abs(scTomato.raw - 38)).toBeLessThanOrEqual(1);

    const scMaize = calcEx36(0.35, 0.23, 1.2, 0.55);
    expect(Math.abs(scMaize.taw - 144)).toBeLessThanOrEqual(1);
    expect(Math.abs(scMaize.raw - 79)).toBeLessThanOrEqual(1);
  });

  it('4. Memvalidasi kurva dinamis Kc jagung (0.35 panen kering vs 0.60 panen basah)', () => {
    const kcIni = calculateDynamicKc('jagung', 10);
    expect(kcIni.kc).toBe(0.30);
    expect(kcIni.current_stage).toBe('ini');

    const kcMid = calculateDynamicKc('jagung', 70);
    expect(kcMid.kc).toBe(1.20);
    expect(kcMid.current_stage).toBe('mid');

    const kcDry = calculateDynamicKc('jagung', 125, true);
    const kcWet = calculateDynamicKc('jagung', 125, false);
    expect(kcDry.kc).toBe(0.35);
    expect(kcWet.kc).toBe(0.60);
  });

  it('5. Memverifikasi status evidence_insufficient untuk air padi sawah (rezim tergenang)', () => {
    const res = evaluateWaterStress('padi', 50, 40.0, 0.0);
    expect(res.status).toBe('evidence_insufficient');
    expect(res.insufficient_reason).toContain('tergenang');
  });

  it('6. Memverifikasi simulasi maju 7 hari dua skenario (prakiraan vs tanpa_hujan)', () => {
    const forecast = [
      { day: 1, date: '2026-10-14', precip_mm: 5.0, et0_mm: 4.0 },
      { day: 2, date: '2026-10-15', precip_mm: 12.0, et0_mm: 3.5 },
      { day: 3, date: '2026-10-16', precip_mm: 0.0, et0_mm: 4.5 },
      { day: 4, date: '2026-10-17', precip_mm: 0.0, et0_mm: 4.5 },
      { day: 5, date: '2026-10-18', precip_mm: 0.0, et0_mm: 5.0 },
      { day: 6, date: '2026-10-19', precip_mm: 0.0, et0_mm: 5.0 },
      { day: 7, date: '2026-10-20', precip_mm: 0.0, et0_mm: 5.0 }
    ];

    const sim = simulate7DaysForward('jagung', 50, 60.0, forecast);
    expect(sim.proyeksi_7hari.length).toBe(7);
    for (const p of sim.proyeksi_7hari) {
      expect(p.dr_tanpa_hujan_mm).toBeGreaterThanOrEqual(p.dr_prakiraan_mm);
    }
  });

  it('7. Memverifikasi rekonstruksi cold-start ledger (pasti vs interval)', () => {
    // Kasus hujan lebat melampaui deplesi -> terhapus ke kapasitas lapang (konvergen)
    const wetHistory = [
      { date: '2026-09-01', dap: 1, etc_mm: 3.0, precip_mm: 0.0 },
      { date: '2026-09-02', dap: 2, etc_mm: 2.0, precip_mm: 160.0 },
      { date: '2026-09-03', dap: 3, etc_mm: 4.0, precip_mm: 0.0 }
    ];
    const resConv = reconstructColdStartDr('jagung', wetHistory, []);
    expect(resConv.dr_awal_status).toBe('pasti');
    expect(resConv.konvergen_pada).toBe('2026-09-02');

    // Kasus kemarau panjang tanpa hujan -> interval
    const dryHistory = [
      { date: '2026-09-01', dap: 1, etc_mm: 4.0, precip_mm: 0.0 },
      { date: '2026-09-02', dap: 2, etc_mm: 4.0, precip_mm: 0.0 }
    ];
    const resInt = reconstructColdStartDr('jagung', dryHistory, []);
    expect(resInt.dr_awal_status).toBe('interval');
    expect(resInt.dr_interval_mm).toBeDefined();
  });

  it('8. Memverifikasi aturan penguncian pupuk 14 hari (RULE_FERT_LOCKOUT_14D)', () => {
    const rule = getRuleById('RULE_FERT_LOCKOUT_14D');
    expect(rule).toBeDefined();
    expect(rule?.status).toBe('CONVENTION_PENDING');
    expect(rule?.condition.threshold).toBe(14);
  });
});
