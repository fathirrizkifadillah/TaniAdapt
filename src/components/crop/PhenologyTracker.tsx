import React from 'react';
import { CropDefinition, GrowthStage } from '../../types/crop';
import { Droplets, Activity, Calendar } from 'lucide-react';

interface PhenologyTrackerProps {
  crop: CropDefinition;
  currentHST: number;
  activeStage: GrowthStage;
  onChangeHST: (hst: number) => void;
}

export const PhenologyTracker: React.FC<PhenologyTrackerProps> = ({
  crop,
  currentHST,
  activeStage,
  onChangeHST
}) => {
  const getSensitivityBadge = (level: GrowthStage['waterSensitivity']) => {
    switch (level) {
      case 'KRITIS':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
      case 'TINGGI':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
      case 'SEDANG':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    }
  };

  return (
    <div className="p-1 sm:p-1.5 rounded-2xl border border-moss-200/80 dark:border-moss-800/80 bg-moss-900/5 dark:bg-white/5 ring-1 ring-moss-900/10 dark:ring-white/10">
      <div className="rounded-xl bg-white dark:bg-field-darkCard p-3.5 sm:p-4 shadow-tactile space-y-3.5">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-field-header dark:text-white font-display">
              Fase Pertumbuhan & Fenologi ({crop.name})
            </h2>
            <p className="text-xs text-field-muted dark:text-moss-300">
              Geser umur tanaman (Hari Setelah Tanam / HST) untuk menganalisis pergeseran kerentanan fisiologis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-field-muted dark:text-moss-300">Umur Tanaman:</span>
            <span className="font-mono text-base font-bold bg-moss-900 text-white dark:bg-moss-800 px-3 py-1 rounded-xl border border-moss-700 shadow-sm tabular-nums">
              {currentHST} HST
            </span>
            <span className="text-xs text-field-muted dark:text-moss-400 font-mono tabular-nums">
              / {crop.totalDurationDays} Hari
            </span>
          </div>
        </div>

        {/* Interactive Range Slider */}
        <div>
          <input
            type="range"
            aria-label="Atur Umur Tanaman dalam Hari Setelah Tanam (HST)"
            min={0}
            max={crop.totalDurationDays}
            value={currentHST}
            onChange={(e) => onChangeHST(Number(e.target.value))}
            className="w-full h-2.5 bg-moss-100 dark:bg-moss-950 rounded-lg appearance-none cursor-pointer accent-moss-700 dark:accent-moss-500"
          />
          
          {/* Stage Timeline Segments */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mt-2.5">
            {crop.growthStages.map((stage: GrowthStage) => {
              const isActive = stage.id === activeStage.id;
              return (
                <button
                  key={stage.id}
                  onClick={() => onChangeHST(Math.round((stage.minHST + stage.maxHST) / 2))}
                  className={`text-left p-2 rounded-xl text-[11px] border transition-all active:scale-[0.97] ${
                    isActive
                      ? 'bg-moss-900 text-white border-moss-950 font-bold dark:bg-moss-700 dark:border-moss-600 shadow-sm ring-1 ring-emerald-400/30'
                      : 'bg-moss-50/50 dark:bg-moss-950/30 hover:bg-moss-100 dark:hover:bg-moss-900/40 text-field-muted dark:text-moss-300 border-field-border dark:border-field-darkBorder'
                  }`}
                >
                  <div className="font-mono text-[10px] opacity-80 truncate tabular-nums">
                    {stage.minHST}-{stage.maxHST} HST
                  </div>
                  <div className="truncate font-semibold mt-0.5">{stage.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Stage Deep Breakdown */}
        <div className="bg-moss-50/70 dark:bg-moss-950/40 border border-moss-200/80 dark:border-moss-800/80 rounded-xl p-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-moss-200/60 dark:border-moss-800/60">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase bg-moss-700 text-white px-2 py-0.5 rounded-md font-bold">
                  Fase Aktif
                </span>
                <h3 className="text-sm font-bold text-field-header dark:text-white">
                  {activeStage.name} ({activeStage.minHST} - {activeStage.maxHST} HST)
                </h3>
              </div>
              <p className="text-xs text-field-muted dark:text-moss-300 mt-1 leading-relaxed">
                {activeStage.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-mono px-2 py-1 rounded-lg border font-bold ${getSensitivityBadge(activeStage.waterSensitivity)}`}>
                <Droplets className="w-3 h-3 inline mr-1" />
                Air: {activeStage.waterSensitivity}
              </span>
              <span className={`text-[10px] font-mono px-2 py-1 rounded-lg border font-bold ${getSensitivityBadge(activeStage.diseaseVulnerability)}`}>
                <Activity className="w-3 h-3 inline mr-1" />
                Patogen: {activeStage.diseaseVulnerability}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="font-mono text-[10px] uppercase text-field-muted dark:text-moss-400 font-bold block mb-0.5">
                Fokus Agronomi & Pemantauan:
              </span>
              <div className="text-xs font-semibold text-field-header dark:text-white bg-white dark:bg-field-darkCard p-2 rounded-lg border border-field-border dark:border-field-darkBorder">
                {activeStage.agronomicFocus}
              </div>
            </div>

            <div>
              <span className="font-mono text-[10px] uppercase text-field-muted dark:text-moss-400 font-bold block mb-0.5">
                Kebutuhan Hara Prioritas:
              </span>
              <div className="text-xs font-semibold text-field-header dark:text-white bg-white dark:bg-field-darkCard p-2 rounded-lg border border-field-border dark:border-field-darkBorder">
                {activeStage.keyNutrientNeed}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
