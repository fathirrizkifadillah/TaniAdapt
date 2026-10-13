export interface CurrentWeather {
  temperature: number; // Celsius
  relativeHumidity: number; // %
  apparentTemperature: number; // Celsius
  precipitation: number; // mm in current hour
  rain: number; // mm
  weatherCode: number;
  windSpeed: number; // km/h
  surfacePressure: number; // hPa
  vaporPressureDeficit: number; // kPa
  timestamp: string;
}

export interface HourlyWeather {
  time: string;
  temperature: number;
  relativeHumidity: number;
  precipitation: number;
  precipitationProbability: number;
  vaporPressureDeficit: number;
}

export interface DailyForecast {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationSum: number; // mm/day
  precipitationProbability: number; // %
  windSpeedMax: number;
}

export interface HistoricalWeatherDay {
  date: string;
  precipitation: number; // mm
  tempMean: number; // Celsius
  tempMax: number;
  tempMin: number;
  rhMean: number; // %
  vpdMean: number; // kPa
}

export interface TemporalFeatures {
  // Lag rainfall features
  lag1Rain: number; // mm kemarin (D-1)
  lag3Rain: number; // mm 3 hari lalu (D-3)
  lag7Rain: number; // mm 7 hari lalu (D-7)
  lag14Rain: number; // mm 14 hari lalu (D-14)
  
  // Rolling rainfall sums
  rolling3dRain: number; // mm akumulasi 3 hari terakhir (D-3 s/d D-1)
  rolling7dRain: number; // mm akumulasi 7 hari terakhir
  rolling14dRain: number; // mm akumulasi 14 hari terakhir
  
  // Temporal spells
  consecutiveRainyDays: number; // Jumlah hari hujan berturut-turut (>= 5mm)
  consecutiveDryDays: number; // Jumlah hari kering berturut-turut (< 1mm)
  
  // Rolling microclimatic means
  rolling7dRH: number; // % kelembapan rata-rata 7 hari
  rolling7dTemp: number; // °C suhu rata-rata 7 hari
  
  // Transpiration / Atmospheric water stress
  currentVPD: number; // kPa saat ini
  rolling7dVPD: number; // kPa rata-rata 7 hari
  
  // 48-Hour forward-looking forecast features (untuk keputusan pupuk & drainase)
  forecastRain24h: number; // mm proyeksi hujan 24 jam ke depan
  forecastRain48h: number; // mm proyeksi hujan 48 jam ke depan
  maxPrecipProbabilityNext48h: number; // % probabilitas hujan tertinggi
}
