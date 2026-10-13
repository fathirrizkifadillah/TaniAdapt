import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { DailyForecast, HistoricalWeatherDay } from '../../types/weather';

interface TemporalLagChartProps {
  history: HistoricalWeatherDay[];
  forecast: DailyForecast[];
  isDark?: boolean;
}

export const TemporalLagChart: React.FC<TemporalLagChartProps> = ({
  history,
  forecast,
  isDark = false
}) => {
  // Gabungkan history (H-7 s/d H-1) dan forecast (Hari Ini s/d H+6)
  const chartData = [
    ...history.map(h => ({
      label: h.date,
      tipe: 'Riwayat (Lag)',
      curahHujan: h.precipitation,
      suhu: h.tempMean,
      kelembapan: h.rhMean,
    })),
    ...forecast.map(f => ({
      label: f.date,
      tipe: f.date === 'Hari Ini' ? 'Hari Ini' : 'Prakiraan',
      curahHujan: f.precipitationSum,
      suhu: Number(((f.tempMax + f.tempMin) / 2).toFixed(1)),
      kelembapan: f.precipitationProbability > 60 ? 86 : 72, // Estimasi kelembapan berdasar probabilitas
    }))
  ];

  const gridColor = isDark ? '#1f2f25' : '#e4e7e2';
  const textColor = isDark ? '#9cb0a2' : '#556358';

  return (
    <div className="bg-white dark:bg-field-darkCard border border-field-border dark:border-field-darkBorder rounded-xl p-4 shadow-tactile">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-field-header dark:text-white font-display">
            Analisis Dinamika Temporal: Riwayat Cuaca (Lag) vs Prakiraan
          </h2>
          <p className="text-xs text-field-muted dark:text-moss-300">
            Menunjukkan bagaimana akumulasi hujan lampau membentuk tekanan penyakit dan memicu ambang aksi
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-500 inline-block"></span> Hujan Lampau
          </span>
          <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block"></span> Prakiraan
          </span>
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
            <span className="w-3 h-0.5 bg-amber-500 inline-block"></span> Suhu (°C)
          </span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="label"
              stroke={textColor}
              fontSize={11}
              fontFamily="JetBrains Mono"
              tickLine={false}
            />
            {/* Axis Kiri: Curah Hujan (mm) */}
            <YAxis
              yAxisId="rain"
              orientation="left"
              stroke={textColor}
              fontSize={11}
              fontFamily="JetBrains Mono"
              tickLine={false}
              unit=" mm"
            />
            {/* Axis Kanan: Suhu (°C) */}
            <YAxis
              yAxisId="temp"
              orientation="right"
              stroke={textColor}
              fontSize={11}
              fontFamily="JetBrains Mono"
              tickLine={false}
              unit="°"
              domain={[10, 40]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#121c16' : '#ffffff',
                borderColor: isDark ? '#1d2d23' : '#dde2da',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'JetBrains Mono'
              }}
            />
            <Legend wrapperStyle={{ display: 'none' }} />
            
            {/* Pembatas Garis: Riwayat vs Prakiraan */}
            <ReferenceLine
              x="Hari Ini"
              stroke="#b58364"
              strokeDasharray="4 4"
              label={{
                value: 'Titik Keputusan (Hari Ini)',
                position: 'top',
                fill: '#b58364',
                fontSize: 10,
                fontFamily: 'JetBrains Mono'
              }}
            />

            {/* Bar Curah Hujan */}
            <Bar
              yAxisId="rain"
              dataKey="curahHujan"
              name="Presipitasi (mm)"
              fill="#3b82f6"
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />

            {/* Line Suhu Rata-rata */}
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="suhu"
              name="Suhu (°C)"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3, fill: '#f59e0b' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[11px] text-field-muted dark:text-moss-400 font-mono text-center">
        Pola 7 Hari Lampau (H-7 s/d H-1) membentuk variabel Lag 1d, Lag 3d, Consecutive Rainy Days, dan Kejenuhan Lengas Tanah.
      </div>
    </div>
  );
};
