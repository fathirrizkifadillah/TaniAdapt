/**
 * Pure TypeScript implementation of Root Zone Soil Water Depletion (Dr)
 * based on FAO-56 Chapter 8 (Allen et al., 1998).
 * Parameters strictly parsed from rules.json (Table 19 & Table 22).
 */

import { getFao56DepletionConfig } from './rules';
import { calculateDynamicKc, SupportedCrop } from './kc';

export interface WaterBalanceParameters {
  crop: SupportedCrop;
  soil_texture: string;
  root_depth_m: number;
  taw_mm: number;
  raw_mm: number;
  p_fraction: number;
  taw_basis_mm_m: number;
}

export interface WaterStressEvaluation {
  crop: SupportedCrop;
  status: 'normal' | 'kondisi_stres_abiotik' | 'evidence_insufficient';
  evidence_refs: string[];
  depletion_dr_mm: number;
  raw_threshold_mm: number;
  taw_mm: number;
  root_depth_m: number;
  p_fraction: number;
  recommendation: string;
  sensitif_terhadap_asumsi_tanah: boolean;
  asumsi_deplesi_awal_dr0: number;
  insufficient_reason?: string;
}

export function calculateTawRaw(
  crop: SupportedCrop,
  _dap: number,
  soilTawMmPerM: number = 150.0
): WaterBalanceParameters {
  const config = getFao56DepletionConfig();
  let cropKey: string = crop;
  if (crop === 'cabai_rawit') cropKey = 'cabai';

  const cropConfig = config.crops[cropKey];

  const zr: number = cropConfig ? cropConfig.zr_chosen_m : 1.0;
  const p: number = cropConfig ? cropConfig.p_fraction : 0.55;

  // FAO-56 Eq. 82: TAW = 1000 * (theta_fc - theta_wp) * Zr
  const taw = Number((soilTawMmPerM * zr).toFixed(2));
  // FAO-56 Eq. 83: RAW = p * TAW
  const raw = Number((p * taw).toFixed(2));

  return {
    crop,
    soil_texture: config.soil.texture_default || 'loam',
    root_depth_m: zr,
    taw_mm: taw,
    raw_mm: raw,
    p_fraction: p,
    taw_basis_mm_m: soilTawMmPerM,
  };
}

export function updateDailyDepletion(
  previousDrMm: number,
  dailyEtcMm: number,
  dailyPrecipMm: number,
  tawMm: number
): number {
  // FAO-56 Eq. 85: Dr(t) = Dr(t-1) - P_eff + ETc (0 <= Dr <= TAW)
  const effectiveRain = Math.max(0.0, dailyPrecipMm);
  const nextDr = previousDrMm - effectiveRain + dailyEtcMm;
  return Number(Math.max(0.0, Math.min(tawMm, nextDr)).toFixed(2));
}

export function evaluateWaterStress(
  crop: SupportedCrop,
  dap: number,
  currentDepletionDrMm: number,
  initialDr0Mm: number = 0.0
): WaterStressEvaluation {
  // Padi check: Rice is cultivated in ponded wetland regimes
  if (crop === 'padi') {
    return {
      crop,
      status: 'evidence_insufficient',
      evidence_refs: ['FAO56_KC_RICE'],
      depletion_dr_mm: currentDepletionDrMm,
      raw_threshold_mm: 0.0,
      taw_mm: 0.0,
      root_depth_m: 1.0,
      p_fraction: 0.2,
      recommendation:
        'Modul penyiraman deplesi tanah tidak berlaku untuk padi sawah tergenang (ponded wetland regime); membutuhkan model perkolasi genangan lokal.',
      sensitif_terhadap_asumsi_tanah: false,
      asumsi_deplesi_awal_dr0: initialDr0Mm,
      insufficient_reason:
        'Padi sawah di Jawa Barat dibudidayakan dalam kondisi tergenang air; rumus deplesi lengas tanah tak jenuh (RAW = p * TAW) tidak berlaku.',
    };
  }

  // Cabai check: Unverified Kc in FAO-56 Table 12
  if (crop === 'cabai' || crop === 'cabai_rawit' || crop === 'bawang_merah') {
    return {
      crop,
      status: 'evidence_insufficient',
      evidence_refs: [],
      depletion_dr_mm: currentDepletionDrMm,
      raw_threshold_mm: 0.0,
      taw_mm: 0.0,
      root_depth_m: 0.8,
      p_fraction: 0.5,
      recommendation:
        crop === 'bawang_merah'
          ? 'Bawang Merah diblokir resmi dari operasional engine Jawa Barat karena ketiadaan data sentra terpercaya (Phase 5).'
          : 'Modul deplesi air cabai tropis berstatus unverified (FAO-56 hanya mencantumkan paprika subtropis). Pantau kelembapan lubang mulsa secara manual.',
      sensitif_terhadap_asumsi_tanah: false,
      asumsi_deplesi_awal_dr0: initialDr0Mm,
      insufficient_reason:
        crop === 'bawang_merah'
          ? 'Ketiadaan data sentra valid di Jawa Barat.'
          : 'Ketiadaan koefisien Kc cabai tropis bermulsa plastik pada FAO-56 Tabel 12.',
    };
  }

  // Baseline evaluation with standard Loam TAW = 150 mm/m
  const baseParams = calculateTawRaw(crop, dap, 150.0);
  const isBaseStressed = currentDepletionDrMm > baseParams.raw_mm;

  // Sensitivity analysis against TAW 130 and 180 mm/m (FAO-56 Table 19 loam limits)
  const lowParams = calculateTawRaw(crop, dap, 130.0);
  const highParams = calculateTawRaw(crop, dap, 180.0);
  const isLowStressed = currentDepletionDrMm > lowParams.raw_mm;
  const isHighStressed = currentDepletionDrMm > highParams.raw_mm;

  const isSensitive = isLowStressed !== isHighStressed;

  const status = isBaseStressed ? 'kondisi_stres_abiotik' : 'normal';
  const recommendation = isBaseStressed
    ? 'Irigasi replenishment segera diperlukan; deplesi melampaui batas air siap serap (Dr > RAW).'
    : 'Lengas tanah mencukupi (Dr <= RAW); tidak memerlukan irigasi darurat.';

  return {
    crop,
    status,
    evidence_refs: isBaseStressed
      ? ['RULE_WATER_FAO56_DEPLETION', 'FAO56_RAW_DEPLETION']
      : ['FAO56_RAW_DEPLETION'],
    depletion_dr_mm: currentDepletionDrMm,
    raw_threshold_mm: baseParams.raw_mm,
    taw_mm: baseParams.taw_mm,
    root_depth_m: baseParams.root_depth_m,
    p_fraction: baseParams.p_fraction,
    recommendation,
    sensitif_terhadap_asumsi_tanah: isSensitive,
    asumsi_deplesi_awal_dr0: initialDr0Mm,
  };
}

export interface ForwardDayInput {
  day: number;
  date: string;
  precip_mm: number;
  et0_mm: number;
}

export interface ProyeksiHariItem {
  hari: number;
  tanggal: string;
  dr_prakiraan_mm: number;
  dr_tanpa_hujan_mm: number;
  raw_mm: number;
}

export interface ForwardSimulationResult {
  proyeksi_7hari: ProyeksiHariItem[];
  hari_pertama_melewati_raw_prakiraan: string | null;
  hari_pertama_melewati_raw_tanpa_hujan: string | null;
}

export function simulate7DaysForward(
  crop: SupportedCrop,
  currentDap: number,
  currentDrMm: number,
  forecastDays: ForwardDayInput[],
  panenKering: boolean = true,
  soilTawMmPerM: number = 150.0
): ForwardSimulationResult {
  const proyeksi: ProyeksiHariItem[] = [];
  let drPrakiraan = currentDrMm;
  let drTanpaHujan = currentDrMm;
  let firstCrossingPrakiraan: string | null = null;
  let firstCrossingTanpaHujan: string | null = null;

  for (const day of forecastDays) {
    const dayDap = currentDap + day.day;
    const kc = calculateDynamicKc(crop, dayDap, panenKering).kc;
    const etc = Number((kc * day.et0_mm).toFixed(2));
    const tawRaw = calculateTawRaw(crop, dayDap, soilTawMmPerM);

    // Update prakiraan scenario: stop updating if crossed RAW (Ks not modeled)
    if (firstCrossingPrakiraan === null) {
      drPrakiraan = updateDailyDepletion(drPrakiraan, etc, day.precip_mm, tawRaw.taw_mm);
      if (drPrakiraan > tawRaw.raw_mm) {
        firstCrossingPrakiraan = day.date;
      }
    }

    // Update tanpa_hujan scenario: rain = 0
    if (firstCrossingTanpaHujan === null) {
      drTanpaHujan = updateDailyDepletion(drTanpaHujan, etc, 0.0, tawRaw.taw_mm);
      if (drTanpaHujan > tawRaw.raw_mm) {
        firstCrossingTanpaHujan = day.date;
      }
    }

    proyeksi.push({
      hari: day.day,
      tanggal: day.date,
      dr_prakiraan_mm: Number(drPrakiraan.toFixed(2)),
      dr_tanpa_hujan_mm: Number(drTanpaHujan.toFixed(2)),
      raw_mm: Number(tawRaw.raw_mm.toFixed(2)),
    });
  }

  return {
    proyeksi_7hari: proyeksi,
    hari_pertama_melewati_raw_prakiraan: firstCrossingPrakiraan,
    hari_pertama_melewati_raw_tanpa_hujan: firstCrossingTanpaHujan,
  };
}
