import { CurrentWeather, DailyForecast, HistoricalWeatherDay, TemporalFeatures } from '../types/weather';

/**
 * Menghitung Vapor Pressure Deficit (VPD) dalam satuan kPa menggunakan rumus Tetens
 * @param tempC Suhu dalam Celcius
 * @param rhPercent Kelembapan Relatif dalam persen (0 - 100)
 */
export function calculateVPD(tempC: number, rhPercent: number): number {
  // e_s: Saturation vapor pressure (kPa)
  const es = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  // e_a: Actual vapor pressure (kPa)
  const ea = es * (Math.max(0, Math.min(100, rhPercent)) / 100);
  const vpd = Math.max(0, es - ea);
  return Number(vpd.toFixed(2));
}

/**
 * Melakukan Feature Engineering temporal dari riwayat cuaca (history) dan prakiraan (forecast)
 */
export function extractTemporalFeatures(
  current: CurrentWeather,
  history: HistoricalWeatherDay[],
  forecast: DailyForecast[]
): TemporalFeatures {
  // Urutan history: [H-7, H-6, H-5, H-4, H-3, H-2, H-1]
  // di mana elemen terakhir (index 6) adalah H-1 (kemarin)
  const len = history.length;
  
  const hMinus1 = len >= 1 ? history[len - 1] : null;
  const hMinus3 = len >= 3 ? history[len - 3] : null;
  const hMinus7 = len >= 7 ? history[len - 7] : null;

  const lag1Rain = hMinus1 ? hMinus1.precipitation : 0;
  const lag3Rain = hMinus3 ? hMinus3.precipitation : 0;
  const lag7Rain = hMinus7 ? hMinus7.precipitation : 0;
  const lag14Rain = lag7Rain * 0.9; // Aproksimasi bila riwayat 14d tidak penuh

  // Rolling sums dari riwayat
  // 3 hari terakhir (H-3, H-2, H-1)
  const slice3d = history.slice(Math.max(0, len - 3));
  const rolling3dRain = Number(slice3d.reduce((sum, d) => sum + d.precipitation, 0).toFixed(1));

  // 7 hari terakhir
  const slice7d = history.slice(Math.max(0, len - 7));
  const rolling7dRain = Number(slice7d.reduce((sum, d) => sum + d.precipitation, 0).toFixed(1));
  const rolling14dRain = Number((rolling7dRain * 1.8).toFixed(1));

  // Hitung hari hujan berturut-turut (consecutive rainy days >= 5mm) mundur dari H-1
  let consecutiveRainyDays = 0;
  for (let i = len - 1; i >= 0; i--) {
    if (history[i].precipitation >= 5) {
      consecutiveRainyDays++;
    } else {
      break;
    }
  }

  // Hitung hari kering berturut-turut (consecutive dry days < 1mm) mundur dari H-1
  let consecutiveDryDays = 0;
  for (let i = len - 1; i >= 0; i--) {
    if (history[i].precipitation < 1) {
      consecutiveDryDays++;
    } else {
      break;
    }
  }

  // Rolling microclimate averages
  const rolling7dRH = slice7d.length > 0
    ? Number((slice7d.reduce((sum, d) => sum + d.rhMean, 0) / slice7d.length).toFixed(1))
    : current.relativeHumidity;

  const rolling7dTemp = slice7d.length > 0
    ? Number((slice7d.reduce((sum, d) => sum + d.tempMean, 0) / slice7d.length).toFixed(1))
    : current.temperature;

  const currentVPD = calculateVPD(current.temperature, current.relativeHumidity);
  const rolling7dVPD = slice7d.length > 0
    ? Number((slice7d.reduce((sum, d) => sum + d.vpdMean, 0) / slice7d.length).toFixed(2))
    : currentVPD;

  // Prakiraan 24h dan 48h ke depan
  // forecast[0] adalah Hari Ini, forecast[1] adalah Besok (24-48h)
  const fToday = forecast[0]?.precipitationSum || 0;
  const fTomorrow = forecast[1]?.precipitationSum || 0;
  const forecastRain24h = Number((fToday + current.precipitation).toFixed(1));
  const forecastRain48h = Number((fToday + fTomorrow).toFixed(1));

  const maxPrecipProbabilityNext48h = Math.max(
    forecast[0]?.precipitationProbability || 0,
    forecast[1]?.precipitationProbability || 0
  );

  return {
    lag1Rain,
    lag3Rain,
    lag7Rain,
    lag14Rain,
    rolling3dRain,
    rolling7dRain,
    rolling14dRain,
    consecutiveRainyDays,
    consecutiveDryDays,
    rolling7dRH,
    rolling7dTemp,
    currentVPD,
    rolling7dVPD,
    forecastRain24h,
    forecastRain48h,
    maxPrecipProbabilityNext48h
  };
}
