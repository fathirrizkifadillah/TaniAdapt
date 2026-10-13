import { describe, it, expect } from 'vitest';
import {
  evaluateCabaiEngine,
  evaluatePadiEngine,
  evaluateBawangMerahEngine,
  evaluateJagungEngine,
  evaluateTomatEngine
} from '../engine/cropEngines';
import { CROP_MODELS } from '../data/cropModels';
import { CurrentWeather, DailyForecast, TemporalFeatures } from '../types/weather';

const baseWeather: CurrentWeather = {
  temperature: 25,
  relativeHumidity: 88,
  apparentTemperature: 26,
  precipitation: 4,
  rain: 4,
  weatherCode: 61,
  windSpeed: 10,
  surfacePressure: 1010,
  vaporPressureDeficit: 0.35,
  timestamp: '2026-10-13T07:00:00Z'
};

const baseForecast: DailyForecast[] = [
  { date: 'Hari Ini', weatherCode: 61, tempMax: 26, tempMin: 20, precipitationSum: 15, precipitationProbability: 80, windSpeedMax: 12 },
  { date: 'Besok', weatherCode: 63, tempMax: 25, tempMin: 19, precipitationSum: 25, precipitationProbability: 85, windSpeedMax: 14 }
];

const wetTemporalFeatures: TemporalFeatures = {
  lag1Rain: 12,
  lag3Rain: 15,
  lag7Rain: 5,
  lag14Rain: 2,
  rolling3dRain: 42,
  rolling7dRain: 60,
  rolling14dRain: 90,
  consecutiveRainyDays: 4,
  consecutiveDryDays: 0,
  rolling7dRH: 89,
  rolling7dTemp: 24.5,
  currentVPD: 0.35,
  rolling7dVPD: 0.32,
  forecastRain24h: 30,
  forecastRain48h: 55,
  maxPrecipProbabilityNext48h: 85
};

describe('Crop Engines: Indonesian Scientific Validation', () => {
  it('Cabai Merah: Memvalidasi alarm antraknosa tingkat TINGGI saat hujan 4 hari berturut-turut', () => {
    const cabai = CROP_MODELS['cabai'];
    const fruitStage = cabai.growthStages.find(s => s.id === 'c_fruiting')!;

    const result = evaluateCabaiEngine(fruitStage, 75, wetTemporalFeatures, baseWeather, baseForecast);

    expect(result.overallRisk).toBe('TINGGI');
    const antraknosa = result.diseaseRisks.find(d => d.diseaseId === 'antraknosa');
    expect(antraknosa).toBeDefined();
    expect(antraknosa?.level).toBe('TINGGI');
    expect(result.recommendations.some(r => r.id === 'rec_cabai_antraknosa')).toBe(true);
    // Instruksi tunda pupuk karena hujan lebat
    expect(result.fertilization.safeToApply).toBe(false);
  });

  it('Padi Sawah: Memvalidasi alarm Blas tingkat TINGGI saat fase bunting di cuaca basah', () => {
    const padi = CROP_MODELS['padi'];
    const bootingStage = padi.growthStages.find(s => s.id === 'p_booting')!;

    const result = evaluatePadiEngine(bootingStage, 55, wetTemporalFeatures, baseWeather, baseForecast);

    expect(result.overallRisk).toBe('TINGGI');
    const blas = result.diseaseRisks.find(d => d.diseaseId === 'blas_padi');
    expect(blas?.level).toBe('TINGGI');
    expect(result.irrigation.status).toBe('BUTUH_PENGAIRAN'); // Fase bunting butuh genangan stabil
  });

  it('Bawang Merah: Memvalidasi instruksi DRAINASE MENDESAK saat akumulasi hujan tinggi', () => {
    const bawang = CROP_MODELS['bawang_merah'];
    const bulbStage = bawang.growthStages.find(s => s.id === 'b_bulbing')!;

    const result = evaluateBawangMerahEngine(bulbStage, 40, wetTemporalFeatures, baseWeather, baseForecast);

    expect(result.irrigation.status).toBe('DRAINASE_MENDESAK');
    expect(result.recommendations.some(r => r.id === 'rec_bawang_drainase')).toBe(true);
  });

  it('Jagung: Memvalidasi alarm kebutuhan air kritis saat kemarau pada fase silking R1', () => {
    const jagung = CROP_MODELS['jagung'];
    const silkingStage = jagung.growthStages.find(s => s.id === 'j_silking')!;

    const dryFeatures: TemporalFeatures = {
      ...wetTemporalFeatures,
      consecutiveRainyDays: 0,
      consecutiveDryDays: 5,
      rolling3dRain: 0,
      forecastRain24h: 0,
      currentVPD: 1.9
    };

    const dryWeather: CurrentWeather = {
      ...baseWeather,
      temperature: 32,
      relativeHumidity: 50,
      precipitation: 0
    };

    const result = evaluateJagungEngine(silkingStage, 50, dryFeatures, dryWeather, baseForecast);

    expect(result.irrigation.status).toBe('BUTUH_PENGAIRAN');
    expect(result.recommendations.some(r => r.id === 'rec_jagung_irigasi_silking')).toBe(true);
  });

  it('Tomat: Memvalidasi late blight tingkat TINGGI di suhu sejuk dataran tinggi (19°C) dan RH jenuh', () => {
    const tomat = CROP_MODELS['tomat'];
    const fruitStage = tomat.growthStages.find(s => s.id === 't_fruiting')!;

    const coolHighlandWeather: CurrentWeather = {
      ...baseWeather,
      temperature: 19,
      relativeHumidity: 92
    };

    const result = evaluateTomatEngine(fruitStage, 70, wetTemporalFeatures, coolHighlandWeather, baseForecast);

    const lateBlight = result.diseaseRisks.find(d => d.diseaseId === 'busuk_daun_phytophthora');
    expect(lateBlight?.level).toBe('TINGGI');
    expect(result.recommendations.some(r => r.id === 'rec_tomat_blight')).toBe(true);
  });
});
