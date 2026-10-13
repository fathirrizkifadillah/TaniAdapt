import { CurrentWeather, DailyForecast, HistoricalWeatherDay, HourlyWeather } from '../types/weather';

export interface LocationWeatherData {
  locationId: string;
  current: CurrentWeather;
  hourly: HourlyWeather[];
  dailyForecast: DailyForecast[];
  history: HistoricalWeatherDay[];
}

export const FALLBACK_WEATHER_DATABASE: Record<string, LocationWeatherData> = {
  lembang: {
    locationId: 'lembang',
    current: {
      temperature: 21.4,
      relativeHumidity: 87,
      apparentTemperature: 21.8,
      precipitation: 4.2,
      rain: 4.2,
      weatherCode: 61, // Slight rain
      windSpeed: 8.5,
      surfacePressure: 875,
      vaporPressureDeficit: 0.33,
      timestamp: new Date().toISOString()
    },
    hourly: [
      { time: '06:00', temperature: 18.2, relativeHumidity: 94, precipitation: 0.0, precipitationProbability: 20, vaporPressureDeficit: 0.12 },
      { time: '09:00', temperature: 21.0, relativeHumidity: 88, precipitation: 0.2, precipitationProbability: 35, vaporPressureDeficit: 0.30 },
      { time: '12:00', temperature: 23.5, relativeHumidity: 82, precipitation: 1.8, precipitationProbability: 65, vaporPressureDeficit: 0.52 },
      { time: '15:00', temperature: 21.4, relativeHumidity: 87, precipitation: 4.2, precipitationProbability: 80, vaporPressureDeficit: 0.33 },
      { time: '18:00', temperature: 19.8, relativeHumidity: 92, precipitation: 2.1, precipitationProbability: 60, vaporPressureDeficit: 0.18 },
      { time: '21:00', temperature: 18.5, relativeHumidity: 95, precipitation: 0.5, precipitationProbability: 40, vaporPressureDeficit: 0.10 }
    ],
    dailyForecast: [
      { date: 'Hari Ini', weatherCode: 61, tempMax: 24.1, tempMin: 17.5, precipitationSum: 8.8, precipitationProbability: 80, windSpeedMax: 12 },
      { date: 'Besok', weatherCode: 63, tempMax: 23.0, tempMin: 17.2, precipitationSum: 14.5, precipitationProbability: 85, windSpeedMax: 14 },
      { date: 'H+2', weatherCode: 65, tempMax: 22.4, tempMin: 16.9, precipitationSum: 22.0, precipitationProbability: 90, windSpeedMax: 15 },
      { date: 'H+3', weatherCode: 61, tempMax: 23.8, tempMin: 17.0, precipitationSum: 6.2, precipitationProbability: 60, windSpeedMax: 11 },
      { date: 'H+4', weatherCode: 3, tempMax: 24.5, tempMin: 17.8, precipitationSum: 1.5, precipitationProbability: 40, windSpeedMax: 9 },
      { date: 'H+5', weatherCode: 2, tempMax: 25.1, tempMin: 18.0, precipitationSum: 0.0, precipitationProbability: 25, windSpeedMax: 8 },
      { date: 'H+6', weatherCode: 61, tempMax: 23.9, tempMin: 17.4, precipitationSum: 5.1, precipitationProbability: 55, windSpeedMax: 10 }
    ],
    history: [
      { date: 'H-7', precipitation: 2.4, tempMean: 21.1, tempMax: 24.0, tempMin: 17.2, rhMean: 81, vpdMean: 0.48 },
      { date: 'H-6', precipitation: 0.0, tempMean: 22.3, tempMax: 25.1, tempMin: 18.0, rhMean: 76, vpdMean: 0.65 },
      { date: 'H-5', precipitation: 1.2, tempMean: 21.8, tempMax: 24.4, tempMin: 17.5, rhMean: 80, vpdMean: 0.51 },
      { date: 'H-4', precipitation: 12.8, tempMean: 20.6, tempMax: 23.1, tempMin: 17.0, rhMean: 89, vpdMean: 0.27 },
      { date: 'H-3', precipitation: 18.4, tempMean: 20.1, tempMax: 22.4, tempMin: 16.8, rhMean: 91, vpdMean: 0.21 },
      { date: 'H-2', precipitation: 15.6, tempMean: 20.4, tempMax: 22.8, tempMin: 17.1, rhMean: 90, vpdMean: 0.24 },
      { date: 'H-1', precipitation: 9.2, tempMean: 21.0, tempMax: 23.6, tempMin: 17.4, rhMean: 88, vpdMean: 0.30 }
    ]
  },

  subang_pantura: {
    locationId: 'subang_pantura',
    current: {
      temperature: 31.2,
      relativeHumidity: 74,
      apparentTemperature: 36.1,
      precipitation: 0.0,
      rain: 0.0,
      weatherCode: 2, // Partly cloudy
      windSpeed: 14.2,
      surfacePressure: 1010,
      vaporPressureDeficit: 1.18,
      timestamp: new Date().toISOString()
    },
    hourly: [
      { time: '06:00', temperature: 25.0, relativeHumidity: 88, precipitation: 0.0, precipitationProbability: 10, vaporPressureDeficit: 0.38 },
      { time: '09:00', temperature: 29.5, relativeHumidity: 78, precipitation: 0.0, precipitationProbability: 15, vaporPressureDeficit: 0.91 },
      { time: '12:00', temperature: 33.1, relativeHumidity: 68, precipitation: 0.0, precipitationProbability: 25, vaporPressureDeficit: 1.62 },
      { time: '15:00', temperature: 31.2, relativeHumidity: 74, precipitation: 0.0, precipitationProbability: 40, vaporPressureDeficit: 1.18 },
      { time: '18:00', temperature: 28.4, relativeHumidity: 82, precipitation: 1.2, precipitationProbability: 50, vaporPressureDeficit: 0.69 },
      { time: '21:00', temperature: 26.5, relativeHumidity: 86, precipitation: 0.0, precipitationProbability: 20, vaporPressureDeficit: 0.48 }
    ],
    dailyForecast: [
      { date: 'Hari Ini', weatherCode: 2, tempMax: 33.4, tempMin: 24.5, precipitationSum: 1.2, precipitationProbability: 45, windSpeedMax: 18 },
      { date: 'Besok', weatherCode: 61, tempMax: 32.1, tempMin: 24.2, precipitationSum: 7.5, precipitationProbability: 60, windSpeedMax: 16 },
      { date: 'H+2', weatherCode: 63, tempMax: 30.5, tempMin: 23.8, precipitationSum: 18.2, precipitationProbability: 80, windSpeedMax: 20 },
      { date: 'H+3', weatherCode: 2, tempMax: 32.8, tempMin: 24.0, precipitationSum: 2.1, precipitationProbability: 35, windSpeedMax: 15 },
      { date: 'H+4', weatherCode: 1, tempMax: 34.0, tempMin: 24.6, precipitationSum: 0.0, precipitationProbability: 15, windSpeedMax: 14 },
      { date: 'H+5', weatherCode: 1, tempMax: 34.5, tempMin: 25.0, precipitationSum: 0.0, precipitationProbability: 10, windSpeedMax: 12 },
      { date: 'H+6', weatherCode: 2, tempMax: 33.7, tempMin: 24.8, precipitationSum: 0.8, precipitationProbability: 25, windSpeedMax: 13 }
    ],
    history: [
      { date: 'H-7', precipitation: 0.0, tempMean: 29.5, tempMax: 34.0, tempMin: 24.8, rhMean: 71, vpdMean: 1.22 },
      { date: 'H-6', precipitation: 0.0, tempMean: 30.1, tempMax: 34.5, tempMin: 25.1, rhMean: 69, vpdMean: 1.34 },
      { date: 'H-5', precipitation: 4.5, tempMean: 28.8, tempMax: 33.2, tempMin: 24.2, rhMean: 77, vpdMean: 0.92 },
      { date: 'H-4', precipitation: 14.2, tempMean: 27.5, tempMax: 31.0, tempMin: 23.9, rhMean: 84, vpdMean: 0.59 },
      { date: 'H-3', precipitation: 22.0, tempMean: 27.1, tempMax: 30.4, tempMin: 23.5, rhMean: 86, vpdMean: 0.50 },
      { date: 'H-2', precipitation: 8.5, tempMean: 28.0, tempMax: 31.8, tempMin: 24.0, rhMean: 82, vpdMean: 0.68 },
      { date: 'H-1', precipitation: 0.0, tempMean: 29.2, tempMax: 33.6, tempMin: 24.5, rhMean: 75, vpdMean: 1.02 }
    ]
  },

  brebes: {
    locationId: 'brebes',
    current: {
      temperature: 30.5,
      relativeHumidity: 78,
      apparentTemperature: 35.8,
      precipitation: 0.0,
      rain: 0.0,
      weatherCode: 3, // Overcast
      windSpeed: 16.0,
      surfacePressure: 1011,
      vaporPressureDeficit: 0.97,
      timestamp: new Date().toISOString()
    },
    hourly: [
      { time: '06:00', temperature: 26.0, relativeHumidity: 89, precipitation: 0.0, precipitationProbability: 15, vaporPressureDeficit: 0.37 },
      { time: '09:00', temperature: 29.8, relativeHumidity: 80, precipitation: 0.0, precipitationProbability: 20, vaporPressureDeficit: 0.84 },
      { time: '12:00', temperature: 32.5, relativeHumidity: 72, precipitation: 0.5, precipitationProbability: 45, vaporPressureDeficit: 1.36 },
      { time: '15:00', temperature: 30.5, relativeHumidity: 78, precipitation: 2.5, precipitationProbability: 60, vaporPressureDeficit: 0.97 },
      { time: '18:00', temperature: 28.0, relativeHumidity: 85, precipitation: 6.0, precipitationProbability: 75, vaporPressureDeficit: 0.57 },
      { time: '21:00', temperature: 26.8, relativeHumidity: 90, precipitation: 1.0, precipitationProbability: 40, vaporPressureDeficit: 0.35 }
    ],
    dailyForecast: [
      { date: 'Hari Ini', weatherCode: 61, tempMax: 32.8, tempMin: 25.1, precipitationSum: 10.0, precipitationProbability: 70, windSpeedMax: 19 },
      { date: 'Besok', weatherCode: 65, tempMax: 29.5, tempMin: 24.0, precipitationSum: 38.5, precipitationProbability: 95, windSpeedMax: 24 },
      { date: 'H+2', weatherCode: 63, tempMax: 30.2, tempMin: 24.4, precipitationSum: 16.0, precipitationProbability: 75, windSpeedMax: 18 },
      { date: 'H+3', weatherCode: 2, tempMax: 32.0, tempMin: 24.8, precipitationSum: 2.0, precipitationProbability: 30, windSpeedMax: 15 },
      { date: 'H+4', weatherCode: 1, tempMax: 33.5, tempMin: 25.2, precipitationSum: 0.0, precipitationProbability: 15, windSpeedMax: 14 },
      { date: 'H+5', weatherCode: 1, tempMax: 34.0, tempMin: 25.5, precipitationSum: 0.0, precipitationProbability: 10, windSpeedMax: 13 },
      { date: 'H+6', weatherCode: 2, tempMax: 33.0, tempMin: 25.0, precipitationSum: 1.2, precipitationProbability: 25, windSpeedMax: 16 }
    ],
    history: [
      { date: 'H-7', precipitation: 0.0, tempMean: 30.0, tempMax: 34.2, tempMin: 25.2, rhMean: 70, vpdMean: 1.29 },
      { date: 'H-6', precipitation: 0.0, tempMean: 30.4, tempMax: 34.8, tempMin: 25.5, rhMean: 68, vpdMean: 1.40 },
      { date: 'H-5', precipitation: 2.0, tempMean: 29.8, tempMax: 33.6, tempMin: 25.0, rhMean: 74, vpdMean: 1.10 },
      { date: 'H-4', precipitation: 18.0, tempMean: 28.2, tempMax: 31.5, tempMin: 24.4, rhMean: 83, vpdMean: 0.65 },
      { date: 'H-3', precipitation: 25.4, tempMean: 27.6, tempMax: 30.2, tempMin: 24.1, rhMean: 87, vpdMean: 0.48 },
      { date: 'H-2', precipitation: 12.0, tempMean: 28.5, tempMax: 32.0, tempMin: 24.6, rhMean: 81, vpdMean: 0.74 },
      { date: 'H-1', precipitation: 4.5, tempMean: 29.2, tempMax: 33.0, tempMin: 24.9, rhMean: 77, vpdMean: 0.94 }
    ]
  }
};
