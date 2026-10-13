import { describe, it, expect } from 'vitest';
import { LITERATURE_DATABASE } from '../data/literatureEvidence';
import { runAgroDecisionEngine } from '../engine/decisionEngine';
import { CurrentWeather, DailyForecast, HistoricalWeatherDay } from '../types/weather';

describe('16-Component Literature Extraction Evidence Repository', () => {
  it('contains all required research papers from docx #1', () => {
    const keys = Object.keys(LITERATURE_DATABASE);
    expect(keys).toContain('balitsa_antraknosa_2020');
    expect(keys).toContain('bbpadi_blas_2019');
    expect(keys).toContain('fao_irrigation_leaching_2019');
    expect(keys).toContain('ipb_bawang_moler_2021');
    expect(keys).toContain('balitkabi_jagung_faw_2022');
  });

  it('guarantees complete 16-field extraction for every paper', () => {
    for (const [, paper] of Object.entries(LITERATURE_DATABASE)) {
      expect(paper.id).toBeTruthy();
      expect(paper.crop).toBeTruthy();
      expect(paper.location).toBeTruthy();
      expect(paper.agriculturalOutcome).toBeTruthy();
      expect(paper.agriculturalProblem).toBeTruthy();
      expect(paper.weatherVariables.length).toBeGreaterThan(0);
      expect(paper.temporalResolution).toBeTruthy();
      expect(paper.lagWeatherHistory).toBeTruthy();
      expect(paper.growthStage).toBeTruthy();
      expect(paper.dataSource).toBeTruthy();
      expect(paper.statisticalMLMethod).toBeTruthy();
      expect(paper.mainFinding).toBeTruthy();
      expect(paper.strengthOfEvidence).toBeTruthy();
      expect(paper.linearNonlinearBehavior).toBeTruthy();
      expect(paper.limitation).toBeTruthy();
      expect(paper.applicabilityToTaniAdapt).toBeTruthy();
      expect(paper.feasibility).toBeTruthy();
      expect(paper.authors).toBeTruthy();
      expect(paper.year).toBeGreaterThanOrEqual(1998);
      expect(paper.title).toBeTruthy();
      expect(paper.journal).toBeTruthy();
      expect(paper.institution).toBeTruthy();
      expect(paper.applicableThreshold).toBeTruthy();
    }
  });
});

describe('Adversarial Worst-Case Stress Tests (break-ui standard)', () => {
  const dummyHistory: HistoricalWeatherDay[] = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-10-0${i + 1}`,
    tempMean: 18.0,
    tempMax: 22.0,
    tempMin: 15.0,
    rhMean: 95.0,
    vpdMean: 0.1,
    precipitation: 25.0
  }));

  const dummyForecast: DailyForecast[] = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-10-0${i + 8}`,
    tempMin: 16.0,
    tempMax: 22.0,
    weatherCode: 65,
    precipitationSum: 40.0,
    precipitationProbability: 95,
    windSpeedMax: 25.0
  }));

  it('handles extreme flood deluge (120mm rain, 98% RH, 7 consecutive wet days) without throwing', () => {
    const extremeFloodCurrent: CurrentWeather = {
      temperature: 17.5,
      relativeHumidity: 98,
      apparentTemperature: 17.5,
      precipitation: 65.0,
      rain: 65.0,
      windSpeed: 28.0,
      surfacePressure: 1010.0,
      vaporPressureDeficit: 0.05,
      weatherCode: 65,
      timestamp: new Date().toISOString()
    };

    const output = runAgroDecisionEngine(
      'cabai',
      60,
      extremeFloodCurrent,
      dummyHistory,
      dummyForecast,
      {
        consecutiveRainyDays: 7,
        rolling3dRain: 120.5,
        forecastRain24h: 120.5
      }
    );

    expect(output.result.overallRisk).toBe('TINGGI');
    expect(output.result.irrigation.status).toBe('DRAINASE_MENDESAK');
    expect(output.result.fertilization.safeToApply).toBe(false);
    expect(output.result.recommendations.length).toBeGreaterThan(0);
  });

  it('handles extreme drought heatwave (37°C, 35% RH, 18 consecutive dry days) without throwing', () => {
    const extremeDroughtCurrent: CurrentWeather = {
      temperature: 37.0,
      relativeHumidity: 35,
      apparentTemperature: 39.0,
      precipitation: 0.0,
      rain: 0.0,
      windSpeed: 12.0,
      surfacePressure: 1012.0,
      vaporPressureDeficit: 2.85,
      weatherCode: 0,
      timestamp: new Date().toISOString()
    };

    const dryHistory: HistoricalWeatherDay[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-10-0${i + 1}`,
      tempMean: 35.0,
      tempMax: 38.0,
      tempMin: 28.0,
      rhMean: 40.0,
      vpdMean: 2.8,
      precipitation: 0.0
    }));

    const dryForecast: DailyForecast[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-10-0${i + 8}`,
      tempMin: 24.0,
      tempMax: 38.0,
      weatherCode: 0,
      precipitationSum: 0.0,
      precipitationProbability: 5,
      windSpeedMax: 15.0
    }));

    const output = runAgroDecisionEngine(
      'jagung',
      55, // Silking stage (highly vulnerable to drought)
      extremeDroughtCurrent,
      dryHistory,
      dryForecast,
      {
        consecutiveDryDays: 18,
        consecutiveRainyDays: 0,
        rolling7dRain: 0.0,
        forecastRain48h: 0.0
      }
    );

    expect(output.result.irrigation.status).toBe('BUTUH_PENGAIRAN');
    expect(output.result.recommendations.length).toBeGreaterThan(0);
  });
});
