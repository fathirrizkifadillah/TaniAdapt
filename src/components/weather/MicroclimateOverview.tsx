import React from 'react';
import { CurrentWeather, TemporalFeatures } from '../../types/weather';
import { MetricTile } from '../common/MetricTile';
import { Thermometer, Droplets, CloudRain, Wind, Gauge, Activity } from 'lucide-react';

interface MicroclimateOverviewProps {
  current: CurrentWeather;
  features: TemporalFeatures;
  dataSourceLabel: string;
}

export const MicroclimateOverview: React.FC<MicroclimateOverviewProps> = ({
  current,
  features,
  dataSourceLabel
}) => {
  // Evaluasi status anomali cuaca
  const tempStatus = current.temperature > 34 ? 'warning' : 'normal';
  const rhStatus = current.relativeHumidity > 88 ? 'warning' : 'normal';
  const rainStatus = features.rolling3dRain > 30 ? 'alert' : features.rolling3dRain > 15 ? 'warning' : 'normal';
  const vpdStatus = features.currentVPD > 1.8 ? 'warning' : features.currentVPD < 0.4 ? 'alert' : 'normal';

  return (
    <div className="bg-white dark:bg-field-darkCard border border-field-border dark:border-field-darkBorder rounded-xl p-4 shadow-tactile">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-field-header dark:text-white font-display">
            Mikroklimat Lahan & Riwayat Temporal
          </h2>
          <p className="text-xs text-field-muted dark:text-moss-300">
            Sumber Data: <span className="font-mono">{dataSourceLabel}</span>
          </p>
        </div>
        <div className="text-[11px] font-mono text-field-muted dark:text-moss-300 bg-moss-50 dark:bg-moss-900/40 px-2 py-0.5 rounded border border-moss-200 dark:border-moss-800">
          Sinkronisasi: {new Date(current.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <MetricTile
          label="Suhu Udara"
          value={current.temperature}
          unit="°C"
          subtext={`Terasa: ${current.apparentTemperature}°C`}
          icon={Thermometer}
          status={tempStatus}
        />

        <MetricTile
          label="Kelembapan"
          value={current.relativeHumidity}
          unit="% RH"
          subtext={`Rerata 7d: ${features.rolling7dRH}%`}
          icon={Droplets}
          status={rhStatus}
        />

        <MetricTile
          label="Hujan 3 Hari"
          value={features.rolling3dRain}
          unit="mm"
          subtext={`Kemarin: ${features.lag1Rain} mm`}
          icon={CloudRain}
          status={rainStatus}
        />

        <MetricTile
          label="VPD Lahan"
          value={features.currentVPD}
          unit="kPa"
          subtext={features.currentVPD < 0.5 ? 'Transpirasi Rendah' : features.currentVPD > 1.6 ? 'Evaporasi Cepat' : 'Zona Nyaman Tanaman'}
          icon={Activity}
          status={vpdStatus}
        />

        <MetricTile
          label="Prakiraan 24h"
          value={features.forecastRain24h}
          unit="mm"
          subtext={`Peluang: ${features.maxPrecipProbabilityNext48h}%`}
          icon={CloudRain}
          status={features.forecastRain24h > 25 ? 'alert' : 'normal'}
        />

        <MetricTile
          label="Kecepatan Angin"
          value={current.windSpeed}
          unit="km/j"
          subtext={`Tekanan: ${current.surfacePressure} hPa`}
          icon={Wind}
          status="normal"
        />
      </div>

      {/* Temporal Lag Insights Banner */}
      <div className="mt-3 pt-3 border-t border-field-border/60 dark:border-field-darkBorder/60 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5 text-moss-600 dark:text-moss-400" />
          <span className="text-field-muted dark:text-moss-300">Pola Cuaca Lampau:</span>
          <span className="font-semibold text-field-header dark:text-white">
            {features.consecutiveRainyDays > 0
              ? `${features.consecutiveRainyDays} Hari Hujan Berturut-turut`
              : `${features.consecutiveDryDays} Hari Kering Berturut-turut`}
          </span>
        </div>
        <div className="text-field-muted dark:text-moss-400">
          Akumulasi Hujan 7 Hari: <span className="font-semibold text-field-header dark:text-white">{features.rolling7dRain} mm</span> | 14 Hari: <span className="font-semibold text-field-header dark:text-white">{features.rolling14dRain} mm</span>
        </div>
      </div>
    </div>
  );
};
