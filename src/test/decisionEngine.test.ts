import { describe, it, expect } from 'vitest';
import { runAgroDecisionEngine, resolveActiveGrowthStage } from '../engine/decisionEngine';
import { FALLBACK_WEATHER_DATABASE } from '../data/fallbackWeatherData';

describe('Master Decision Engine Orchestrator', () => {
  it('dapat menentukan fase fenologi (growth stage) secara akurat dari nilai HST', () => {
    // Cabai total 120 hari
    const seedling = resolveActiveGrowthStage('cabai', 10);
    expect(seedling.id).toBe('c_seedling');

    const flowering = resolveActiveGrowthStage('cabai', 55);
    expect(flowering.id).toBe('c_flowering');

    const fruiting = resolveActiveGrowthStage('cabai', 75);
    expect(fruiting.id).toBe('c_fruiting');

    // Bawang merah total 65 hari
    const bulbing = resolveActiveGrowthStage('bawang_merah', 40);
    expect(bulbing.id).toBe('b_bulbing');
  });

  it('menjalankan pipeline lengkap dan menghasilkan structured decision output yang terkalibrasi', () => {
    const lembangData = FALLBACK_WEATHER_DATABASE['lembang'];

    const { result, features } = runAgroDecisionEngine(
      'cabai',
      70, // Fase pembesaran buah cabai
      lembangData.current,
      lembangData.history,
      lembangData.dailyForecast
    );

    expect(result.cropId).toBe('cabai');
    expect(result.currentHST).toBe(70);
    expect(result.stageName).toBe('Pembesaran Buah & Pematangan');
    expect(result.overallRisk).toBeDefined();
    expect(result.diseaseRisks.length).toBeGreaterThan(0);
    expect(result.irrigation).toBeDefined();
    expect(result.fertilization).toBeDefined();
    expect(features.rolling3dRain).toBeGreaterThan(0);
    expect(features.currentVPD).toBeGreaterThan(0);
  });
});
