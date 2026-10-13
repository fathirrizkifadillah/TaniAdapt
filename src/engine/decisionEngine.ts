import { CropId, GrowthStage } from '../types/crop';
import { CurrentWeather, DailyForecast, HistoricalWeatherDay, TemporalFeatures } from '../types/weather';
import { CropEngineResult } from '../types/decision';
import { CROP_MODELS } from '../data/cropModels';
import { extractTemporalFeatures } from './featureEngineering';
import {
  evaluateBawangMerahEngine,
  evaluateCabaiEngine,
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
    computedAt: new Date().toISOString()
  };

  return { result, features };
}
