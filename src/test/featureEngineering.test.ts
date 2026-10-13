import { describe, it, expect } from 'vitest';
import { calculateVPD, extractTemporalFeatures } from '../engine/featureEngineering';
import { CurrentWeather, DailyForecast, HistoricalWeatherDay } from '../types/weather';

describe('Feature Engineering: VPD and Temporal Lag Features', () => {
  it('menghitung VPD dengan formula Tetens secara akurat', () => {
    // Pada suhu 25°C dan RH 50%, e_s ~ 3.17 kPa, e_a ~ 1.58 kPa, VPD ~ 1.58 kPa
    const vpd = calculateVPD(25, 50);
    expect(vpd).toBeGreaterThan(1.4);
    expect(vpd).toBeLessThan(1.7);

    // Pada RH 100%, VPD harus 0 (jenuh)
    const saturatedVPD = calculateVPD(25, 100);
    expect(saturatedVPD).toBe(0);

    // Pada RH 0%, VPD harus mendekati e_s
    const dryVPD = calculateVPD(25, 0);
    expect(dryVPD).toBeGreaterThan(3.0);
  });

  it('mengekstrak fitur lag hujan dan hari berturut-turut dengan benar', () => {
    const mockCurrent: CurrentWeather = {
      temperature: 24,
      relativeHumidity: 85,
      apparentTemperature: 25,
      precipitation: 5,
      rain: 5,
      weatherCode: 61,
      windSpeed: 10,
      surfacePressure: 1010,
      vaporPressureDeficit: 0.45,
      timestamp: '2026-10-13T07:00:00Z'
    };

    // Riwayat 7 hari: H-7 sampai H-1
    // 3 hari terakhir (H-3, H-2, H-1) berturut-turut hujan >= 5mm
    const mockHistory: HistoricalWeatherDay[] = [
      { date: 'H-7', precipitation: 0, tempMean: 24, tempMax: 28, tempMin: 20, rhMean: 75, vpdMean: 0.8 },
      { date: 'H-6', precipitation: 0, tempMean: 24, tempMax: 28, tempMin: 20, rhMean: 75, vpdMean: 0.8 },
      { date: 'H-5', precipitation: 2, tempMean: 24, tempMax: 28, tempMin: 20, rhMean: 78, vpdMean: 0.7 },
      { date: 'H-4', precipitation: 0, tempMean: 24, tempMax: 28, tempMin: 20, rhMean: 75, vpdMean: 0.8 },
      { date: 'H-3', precipitation: 10, tempMean: 23, tempMax: 26, tempMin: 19, rhMean: 88, vpdMean: 0.3 },
      { date: 'H-2', precipitation: 15, tempMean: 22, tempMax: 25, tempMin: 19, rhMean: 90, vpdMean: 0.2 },
      { date: 'H-1', precipitation: 8, tempMean: 23, tempMax: 26, tempMin: 20, rhMean: 87, vpdMean: 0.3 }
    ];

    const mockForecast: DailyForecast[] = [
      { date: 'Hari Ini', weatherCode: 61, tempMax: 26, tempMin: 20, precipitationSum: 12, precipitationProbability: 80, windSpeedMax: 12 },
      { date: 'Besok', weatherCode: 63, tempMax: 25, tempMin: 19, precipitationSum: 20, precipitationProbability: 85, windSpeedMax: 14 }
    ];

    const features = extractTemporalFeatures(mockCurrent, mockHistory, mockForecast);

    // Lag 1 hari (H-1) harus bernilai 8 mm
    expect(features.lag1Rain).toBe(8);

    // Rolling 3 hari (H-3 + H-2 + H-1) = 10 + 15 + 8 = 33 mm
    expect(features.rolling3dRain).toBe(33);

    // Hari hujan berturut-turut (H-1: 8>=5, H-2: 15>=5, H-3: 10>=5, H-4: 0<5) -> 3 hari
    expect(features.consecutiveRainyDays).toBe(3);

    // Hari kering berturut-turut harus 0 karena kemarin hujan
    expect(features.consecutiveDryDays).toBe(0);

    // Prakiraan 24h & 48h
    expect(features.forecastRain24h).toBe(17); // 12 + current 5
    expect(features.forecastRain48h).toBe(32); // 12 + 20
  });
});
