import { CropId, GrowthStage } from '../types/crop';
import { CurrentWeather, DailyForecast, HistoricalWeatherDay, TemporalFeatures } from '../types/weather';
import { CropEngineResult, BioMechanisticFao56Result } from '../types/decision';
import { CROP_MODELS } from '../data/cropModels';
import { extractTemporalFeatures } from './featureEngineering';
import { calculateDailyET0 } from './fao56';
import { calculateDynamicKc } from './kc';
import { calculateTawRaw, evaluateWaterStress, updateDailyDepletion, simulate7DaysForward } from './waterBalance';
import {
  evaluateBawangMerahEngine,
  evaluateCabaiEngine,
  evaluateCabaiRawitEngine,
  evaluateKedelaiEngine,
  evaluateJagungEngine,
  evaluatePadiEngine,
  evaluateTomatEngine
} from './cropEngines';

/**
 * Mencari fase fenologi tanaman yang aktif berdasarkan Hari Setelah Tanam (HST)
 */
export function resolveActiveGrowthStage(cropId: CropId, hst: number): GrowthStage {
  const crop = CROP_MODELS[cropId];
  if (!crop) {
    throw new Error(`Crop ID tidak ditemukan: ${cropId}`);
  }

  // Cari stage yang mencakup nilai HST
  const found = crop.growthStages.find(stage => hst >= stage.minHST && hst <= stage.maxHST);
  if (found) return found;

  // Fallback jika HST melebihi batas atau di bawah 0
  if (hst < 0) return crop.growthStages[0];
  return crop.growthStages[crop.growthStages.length - 1];
}

/**
 * Menjalankan Decision Engine Utama untuk tanaman, fase pertumbuhan, dan data cuaca
 */
export function runAgroDecisionEngine(
  cropId: CropId,
  currentHST: number,
  current: CurrentWeather,
  history: HistoricalWeatherDay[],
  forecast: DailyForecast[],
  customFeaturesOverride?: Partial<TemporalFeatures>
): { result: CropEngineResult; features: TemporalFeatures } {
  const crop = CROP_MODELS[cropId];
  if (!crop) {
    throw new Error(`Tanaman tidak terdaftar: ${cropId}`);
  }

  // 1. Tentukan Fase Fenologi
  const stage = resolveActiveGrowthStage(cropId, currentHST);

  // 2. Feature Engineering Temporal
  let features = extractTemporalFeatures(current, history, forecast);
  if (customFeaturesOverride) {
    features = { ...features, ...customFeaturesOverride };
  }

  // 3. Panggil Crop-Specific Decision Engine
  let evalOutput;
  switch (cropId) {
    case 'cabai':
      evalOutput = evaluateCabaiEngine(stage, currentHST, features, current, forecast);
      break;
    case 'cabai_rawit':
      evalOutput = evaluateCabaiRawitEngine(stage, currentHST, features, current, forecast);
      break;
    case 'kedelai':
      evalOutput = evaluateKedelaiEngine(stage, currentHST, features, current, forecast);
      break;
    case 'padi':
      evalOutput = evaluatePadiEngine(stage, currentHST, features, current, forecast);
      break;
    case 'bawang_merah':
      evalOutput = evaluateBawangMerahEngine(stage, currentHST, features, current, forecast);
      break;
    case 'jagung':
      evalOutput = evaluateJagungEngine(stage, currentHST, features, current, forecast);
      break;
    case 'tomat':
      evalOutput = evaluateTomatEngine(stage, currentHST, features, current, forecast);
      break;
    default:
      throw new Error(`Engine belum diimplementasikan untuk crop: ${cropId}`);
  }

  // 4. Hitung Komputasi Biofisik Mekanistik FAO-56 Penman-Monteith & Neraca Air
  const tmax = forecast[0]?.tempMax ?? (current.temperature + 4);
  const tmin = forecast[0]?.tempMin ?? Math.max(10, current.temperature - 4);
  const dewpoint = current.temperature - (100 - current.relativeHumidity) / 5;
  const wind10mMs = current.windSpeed / 3.6;
  const solarRadiation = 20.0; // Rata-rata radiasi harian Jawa Barat (MJ/m2/hari)
  const elevation = 150.0;
  const latitude = -6.8;
  const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);

  const et0 = Number(calculateDailyET0(tmax, tmin, dewpoint, wind10mMs, solarRadiation, elevation, latitude, dayOfYear).toFixed(2));
  const kcCurve = calculateDynamicKc(cropId as any, currentHST);
  const etc = Number((kcCurve.kc * et0).toFixed(2));

  const tawRaw = calculateTawRaw(cropId as any, currentHST);
  const estimatedDr0 = Math.min(tawRaw.taw_mm, Math.max(0, features.consecutiveDryDays * etc - features.rolling3dRain));
  const waterEval = evaluateWaterStress(cropId as any, currentHST, estimatedDr0, 0.0);

  // Sensitivitas Peff
  const altDr = updateDailyDepletion(estimatedDr0, etc, 0.8 * current.precipitation, 150.0);
  const altWaterEval = evaluateWaterStress(cropId as any, currentHST, altDr, 0.0);
  const sensitifHujanEfektif = cropId !== 'padi' && cropId !== 'cabai' && cropId !== 'cabai_rawit' && cropId !== 'bawang_merah'
    ? waterEval.status !== altWaterEval.status
    : false;

  // Proyeksi 7 Hari
  const forecast7Days = forecast.slice(0, 7).map((d, i) => ({
    day: i + 1,
    date: d.date,
    precip_mm: d.precipitationSum || 0,
    et0_mm: et0,
  }));
  const sim7d = simulate7DaysForward(cropId as any, currentHST, estimatedDr0, forecast7Days);

  const fao56Result: BioMechanisticFao56Result = {
    et0_daily_mm: et0,
    kc_current: kcCurve.kc,
    etc_daily_mm: etc,
    taw_mm: tawRaw.taw_mm,
    raw_mm: tawRaw.raw_mm,
    depletion_dr_mm: estimatedDr0,
    root_depth_m: tawRaw.root_depth_m,
    p_fraction: tawRaw.p_fraction,
    is_stressed: waterEval.status === 'kondisi_stres_abiotik',
    sensitif_terhadap_asumsi_tanah: waterEval.sensitif_terhadap_asumsi_tanah,
    sensitif_terhadap_asumsi_hujan_efektif: sensitifHujanEfektif,
    proyeksi_7hari: sim7d.proyeksi_7hari,
    hari_pertama_melewati_raw_prakiraan: sim7d.hari_pertama_melewati_raw_prakiraan,
    hari_pertama_melewati_raw_tanpa_hujan: sim7d.hari_pertama_melewati_raw_tanpa_hujan,
    dr_awal_status: 'pasti',
  };

  const result: CropEngineResult = {
    cropId,
    cropName: crop.name,
    scientificName: crop.scientificName,
    currentHST,
    stageName: stage.name,
    stageDescription: stage.description,
    stageVulnerability: stage.diseaseVulnerability,
    overallRisk: evalOutput.overallRisk,
    diseaseRisks: evalOutput.diseaseRisks,
    irrigation: evalOutput.irrigation,
    fertilization: evalOutput.fertilization,
    recommendations: evalOutput.recommendations,
    temporalSummary: evalOutput.temporalSummary,
    computedAt: new Date().toISOString(),
    fao56: fao56Result
  };

  return { result, features };
}
