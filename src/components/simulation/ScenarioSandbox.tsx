import React from 'react';
import { TemporalFeatures } from '../../types/weather';
import { X, SlidersHorizontal, RotateCcw, AlertTriangle, CloudRain, Sun, CheckCircle } from 'lucide-react';

interface ScenarioSandboxProps {
  isOpen: boolean;
  onClose: () => void;
  features: TemporalFeatures;
  temperature: number;
  rh: number;
  currentHST: number;
  maxHST: number;
  onUpdateScenario: (params: {
    tempOverride?: number;
    rhOverride?: number;
    hstOverride?: number;
    consecutiveRainyOverride?: number;
    consecutiveDryOverride?: number;
    rolling3dRainOverride?: number;
    forecast24hOverride?: number;
  }) => void;
  onResetScenario: () => void;
}

export const ScenarioSandbox: React.FC<ScenarioSandboxProps> = ({
  isOpen,
  onClose,
  features,
  temperature,
  rh,
  currentHST,
  maxHST,
  onUpdateScenario,
  onResetScenario
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
      <div className="bg-white dark:bg-field-darkCard border border-field-border dark:border-field-darkBorder rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-field-border dark:border-field-darkBorder bg-moss-900 text-white">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-bold text-sm leading-tight font-display">
                Sandbox Simulasi Skenario Cuaca (What-If Analysis)
              </h2>
              <span className="text-[11px] text-moss-200 font-mono">
                Uji Respon Dinamis Decision Engine terhadap Variasi Cuaca Ekstrem
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup Panel Simulasi Skenario"
            className="p-1 rounded-lg hover:bg-moss-800 text-moss-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Controls */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          
          {/* Quick Preset Scenarios */}
          <div>
            <div className="text-xs font-mono uppercase text-field-muted dark:text-moss-400 font-semibold mb-2">
              Preset Skenario Cepat untuk Penjurian:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => {
                  onUpdateScenario({
                    tempOverride: 25,
                    rhOverride: 92,
                    consecutiveRainyOverride: 4,
                    consecutiveDryOverride: 0,
                    rolling3dRainOverride: 55,
                    forecast24hOverride: 40
                  });
                }}
                className="p-2.5 rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 text-left hover:bg-rose-100 transition-all"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-300">
                  <CloudRain className="w-3.5 h-3.5" />
                  <span>Hujan Ekstrem 4 Hari</span>
                </div>
                <div className="text-[10px] text-field-muted dark:text-moss-300 mt-1">
                  Uji pemicu antraknosa, moler, dan instruksi drainase mendesak.
                </div>
              </button>

              <button
                onClick={() => {
                  onUpdateScenario({
                    tempOverride: 33,
                    rhOverride: 55,
                    consecutiveRainyOverride: 0,
                    consecutiveDryOverride: 6,
                    rolling3dRainOverride: 0,
                    forecast24hOverride: 0
                  });
                }}
                className="p-2.5 rounded-lg border border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 text-left hover:bg-amber-100 transition-all"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <Sun className="w-3.5 h-3.5" />
                  <span>Kemarau / Kering 6 Hari</span>
                </div>
                <div className="text-[10px] text-field-muted dark:text-moss-300 mt-1">
                  Uji respon stres air fase berbunga/silking dan evaporasi tinggi.
                </div>
              </button>

              <button
                onClick={() => {
                  onUpdateScenario({
                    tempOverride: 27,
                    rhOverride: 75,
                    consecutiveRainyOverride: 1,
                    consecutiveDryOverride: 1,
                    rolling3dRainOverride: 8,
                    forecast24hOverride: 5
                  });
                }}
                className="p-2.5 rounded-lg border border-emerald-300 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 text-left hover:bg-emerald-100 transition-all"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Kondisi Ideal Normal</span>
                </div>
                <div className="text-[10px] text-field-muted dark:text-moss-300 mt-1">
                  Uji jendela aman aplikasi pupuk dan operasional rutin.
                </div>
              </button>
            </div>
          </div>

          {/* Interactive Sliders */}
          <div className="space-y-3.5 pt-2 border-t border-field-border dark:border-field-darkBorder">
            
            {/* Prakiraan Hujan 24h */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-field-header dark:text-white font-semibold">Proyeksi Hujan 24 Jam ke Depan:</span>
                <span className="font-bold text-moss-800 dark:text-emerald-400">{features.forecastRain24h} mm</span>
              </div>
              <input
                type="range"
                aria-label="Atur Proyeksi Curah Hujan 24 Jam ke Depan dalam milimeter"
                min={0}
                max={70}
                value={features.forecastRain24h}
                onChange={(e) => onUpdateScenario({ forecast24hOverride: Number(e.target.value) })}
                className="w-full h-2 bg-moss-100 dark:bg-moss-900 rounded-lg appearance-none cursor-pointer accent-moss-700"
              />
            </div>

            {/* Akumulasi Hujan 3 Hari Terakhir */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-field-header dark:text-white font-semibold">Akumulasi Hujan 3 Hari Terakhir (Lag):</span>
                <span className="font-bold text-moss-800 dark:text-emerald-400">{features.rolling3dRain} mm</span>
              </div>
              <input
                type="range"
                aria-label="Atur Akumulasi Curah Hujan 3 Hari Terakhir dalam milimeter"
                min={0}
                max={90}
                value={features.rolling3dRain}
                onChange={(e) => onUpdateScenario({ rolling3dRainOverride: Number(e.target.value) })}
                className="w-full h-2 bg-moss-100 dark:bg-moss-900 rounded-lg appearance-none cursor-pointer accent-moss-700"
              />
            </div>

            {/* Hari Hujan Berturut-turut */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-field-header dark:text-white font-semibold">Hari Hujan Berturut-turut (Consecutive Rain):</span>
                <span className="font-bold text-moss-800 dark:text-emerald-400">{features.consecutiveRainyDays} hari</span>
              </div>
              <input
                type="range"
                aria-label="Atur Jumlah Hari Hujan Berturut-turut"
                min={0}
                max={7}
                value={features.consecutiveRainyDays}
                onChange={(e) => onUpdateScenario({ consecutiveRainyOverride: Number(e.target.value) })}
                className="w-full h-2 bg-moss-100 dark:bg-moss-900 rounded-lg appearance-none cursor-pointer accent-moss-700"
              />
            </div>

            {/* Kelembapan Relatif */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-field-header dark:text-white font-semibold">Kelembapan Udara (RH):</span>
                <span className="font-bold text-moss-800 dark:text-emerald-400">{rh}%</span>
              </div>
              <input
                type="range"
                aria-label="Atur Kelembapan Relatif Udara dalam persen"
                min={45}
                max={98}
                value={rh}
                onChange={(e) => onUpdateScenario({ rhOverride: Number(e.target.value) })}
                className="w-full h-2 bg-moss-100 dark:bg-moss-900 rounded-lg appearance-none cursor-pointer accent-moss-700"
              />
            </div>

            {/* Suhu Udara */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-field-header dark:text-white font-semibold">Suhu Udara Lapang:</span>
                <span className="font-bold text-moss-800 dark:text-emerald-400">{temperature}°C</span>
              </div>
              <input
                type="range"
                aria-label="Atur Suhu Udara Lapangan dalam derajat Celcius"
                min={16}
                max={36}
                value={temperature}
                onChange={(e) => onUpdateScenario({ tempOverride: Number(e.target.value) })}
                className="w-full h-2 bg-moss-100 dark:bg-moss-900 rounded-lg appearance-none cursor-pointer accent-moss-700"
              />
            </div>

            {/* Umur Tanaman (HST) */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-field-header dark:text-white font-semibold">Umur Tanaman (HST):</span>
                <span className="font-bold text-moss-800 dark:text-emerald-400">{currentHST} HST</span>
              </div>
              <input
                type="range"
                aria-label="Atur Umur Tanaman dalam Hari Setelah Tanam"
                min={0}
                max={maxHST}
                value={currentHST}
                onChange={(e) => onUpdateScenario({ hstOverride: Number(e.target.value) })}
                className="w-full h-2 bg-moss-100 dark:bg-moss-900 rounded-lg appearance-none cursor-pointer accent-moss-700"
              />
            </div>

          </div>

          <div className="pt-3 border-t border-field-border dark:border-field-darkBorder flex items-center justify-between">
            <button
              onClick={onResetScenario}
              className="text-xs font-mono font-semibold text-field-muted hover:text-field-header dark:hover:text-white inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset ke Data Asli Lokasi</span>
            </button>
            <button
              onClick={onClose}
              className="bg-moss-800 hover:bg-moss-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
            >
              Terapkan & Lihat Hasil Engine
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
