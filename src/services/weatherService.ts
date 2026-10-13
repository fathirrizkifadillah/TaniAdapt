import { CurrentWeather, DailyForecast, HistoricalWeatherDay, HourlyWeather } from '../types/weather';
import { FALLBACK_WEATHER_DATABASE, LocationWeatherData } from '../data/fallbackWeatherData';
import { calculateVPD } from '../engine/featureEngineering';

export interface WeatherFetchResult {
  current: CurrentWeather;
  hourly: HourlyWeather[];
  dailyForecast: DailyForecast[];
  history: HistoricalWeatherDay[];
  isLiveApi: boolean;
  dataSourceLabel: string;
}

export async function fetchAgriculturalWeather(
  locationId: string,
  latitude: number,
  longitude: number
): Promise<WeatherFetchResult> {
  const fallback = FALLBACK_WEATHER_DATABASE[locationId] || FALLBACK_WEATHER_DATABASE['lembang'];

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,surface_pressure&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,vapor_pressure_deficit&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&past_days=7&forecast_days=7&timezone=Asia%2FJakarta`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500); // 6.5s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Open-Meteo response not ok: ${res.status}`);
    }

    const data = await res.json();

    // Map Current Weather
    const c = data.current;
    const currentVPD = calculateVPD(c.temperature_2m, c.relative_humidity_2m);
    const current: CurrentWeather = {
      temperature: Number(c.temperature_2m.toFixed(1)),
      relativeHumidity: Math.round(c.relative_humidity_2m),
      apparentTemperature: Number(c.apparent_temperature.toFixed(1)),
      precipitation: Number(c.precipitation.toFixed(1)),
      rain: Number(c.rain.toFixed(1)),
      weatherCode: c.weather_code,
      windSpeed: Number(c.wind_speed_10m.toFixed(1)),
      surfacePressure: Math.round(c.surface_pressure),
      vaporPressureDeficit: currentVPD,
      timestamp: c.time
    };

    // Map Daily Data into History (past 7 days) and Forecast (today + next 6 days)
    // data.daily.time memiliki 14 hari: indeks 0..6 (past 7 days), indeks 7 (hari ini), indeks 8..13 (future)
    const dailyTimes: string[] = data.daily.time;
    const history: HistoricalWeatherDay[] = [];
    const dailyForecast: DailyForecast[] = [];

    for (let i = 0; i < dailyTimes.length; i++) {
      const timeStr = dailyTimes[i];
      const code = data.daily.weather_code[i];
      const tMax = Number(data.daily.temperature_2m_max[i].toFixed(1));
      const tMin = Number(data.daily.temperature_2m_min[i].toFixed(1));
      const precipSum = Number(data.daily.precipitation_sum[i].toFixed(1));
      const precipProb = Math.round(data.daily.precipitation_probability_max?.[i] ?? 40);
      const windMax = Number(data.daily.wind_speed_10m_max[i].toFixed(1));

      if (i < 7) {
        // Hari lampau (H-7 s/d H-1)
        const dayLabel = `H-${7 - i}`;
        const tempMean = Number(((tMax + tMin) / 2).toFixed(1));
        const rhMean = 80; // perkiraan rata-rata jika tidak ada sensor tanah langsung
        const vpdMean = calculateVPD(tempMean, rhMean);
        history.push({
          date: dayLabel,
          precipitation: precipSum,
          tempMean,
          tempMax: tMax,
          tempMin: tMin,
          rhMean,
          vpdMean
        });
      } else {
        // Hari ini (i = 7) dan hari ke depan
        const dayOffset = i - 7;
        const dayLabel = dayOffset === 0 ? 'Hari Ini' : dayOffset === 1 ? 'Besok' : `H+${dayOffset}`;
        dailyForecast.push({
          date: dayLabel,
          weatherCode: code,
          tempMax: tMax,
          tempMin: tMin,
          precipitationSum: precipSum,
          precipitationProbability: precipProb,
          windSpeedMax: windMax
        });
      }
    }

    // Map Hourly Data (ambil 6 slice terdekat dari siang hari ini)
    const hourlyTimes: string[] = data.hourly.time;
    const hourly: HourlyWeather[] = [];
    // Ambil rentang hari ini (misal indeks 24*7 = 168 ke depan)
    const startIdx = 24 * 7;
    for (let h = startIdx + 6; h <= startIdx + 21; h += 3) {
      if (h < hourlyTimes.length) {
        const timePart = hourlyTimes[h].split('T')[1] || '12:00';
        const hTemp = Number(data.hourly.temperature_2m[h].toFixed(1));
        const hRH = Math.round(data.hourly.relative_humidity_2m[h]);
        const hPrecip = Number(data.hourly.precipitation[h].toFixed(1));
        const hProb = Math.round(data.hourly.precipitation_probability[h] || 0);
        const hVPD = Number((data.hourly.vapor_pressure_deficit[h] || calculateVPD(hTemp, hRH)).toFixed(2));

        hourly.push({
          time: timePart,
          temperature: hTemp,
          relativeHumidity: hRH,
          precipitation: hPrecip,
          precipitationProbability: hProb,
          vaporPressureDeficit: hVPD
        });
      }
    }

    return {
      current,
      hourly: hourly.length > 0 ? hourly : fallback.hourly,
      dailyForecast: dailyForecast.length > 0 ? dailyForecast : fallback.dailyForecast,
      history: history.length > 0 ? history : fallback.history,
      isLiveApi: true,
      dataSourceLabel: 'Live Sensor Satelit (Open-Meteo API & GFS Model)'
    };
  } catch (err) {
    console.warn('Gagal memuat Open-Meteo live API, beralih ke dataset kalibrasi lokal:', err);
    return {
      current: fallback.current,
      hourly: fallback.hourly,
      dailyForecast: fallback.dailyForecast,
      history: fallback.history,
      isLiveApi: false,
      dataSourceLabel: 'Dataset Kalibrasi Mikroklimat Wilayah (Mode Offline Lahan)'
    };
  }
}
