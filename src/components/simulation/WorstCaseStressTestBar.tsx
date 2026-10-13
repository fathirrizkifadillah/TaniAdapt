import React from 'react';
import { SlidersHorizontal, ShieldAlert, Sparkles, Check, Flame, CloudLightning, Leaf } from 'lucide-react';

export type StressMode = 'NORMAL' | 'WORST_FLOOD' | 'WORST_DROUGHT' | 'CUSTOM';

interface WorstCaseStressTestBarProps {
  currentMode: StressMode;
  onChangeMode: (mode: StressMode) => void;
  onOpenCustomModal: () => void;
}

export const WorstCaseStressTestBar: React.FC<WorstCaseStressTestBarProps> = ({
  currentMode,
  onChangeMode,
  onOpenCustomModal
}) => {
  return (
    <div className="p-2 sm:p-2.5 rounded-2xl border border-moss-200 dark:border-moss-800 bg-moss-900/5 dark:bg-white/5 ring-1 ring-moss-900/10 dark:ring-white/10 no-print">
      <div className="rounded-xl bg-white dark:bg-field-darkCard p-2.5 sm:p-3 shadow-tactile flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        
        {/* Title & Badge */}
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            currentMode === 'NORMAL'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : currentMode === 'WORST_FLOOD'
              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              : currentMode === 'WORST_DROUGHT'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
          }`}>
            {currentMode === 'NORMAL' && <Leaf className="w-4 h-4" />}
            {currentMode === 'WORST_FLOOD' && <CloudLightning className="w-4 h-4" />}
            {currentMode === 'WORST_DROUGHT' && <Flame className="w-4 h-4" />}
            {currentMode === 'CUSTOM' && <SlidersHorizontal className="w-4 h-4" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-display text-field-header dark:text-white">
                Kontrol Data & Adversarial Stress-Test (Break-UI Standard)
              </span>
              <span className="text-[10px] font-mono uppercase bg-moss-100 dark:bg-moss-900 text-moss-800 dark:text-emerald-300 px-2 py-0.2 rounded font-semibold border border-moss-200 dark:border-moss-800">
                Live Evaluator
              </span>
            </div>
            <p className="text-[11px] text-field-muted dark:text-moss-400">
              {currentMode === 'NORMAL' && 'Menampilkan kondisi iklim aktual dari satelit/stasiun BMKG terdekat.'}
              {currentMode === 'WORST_FLOOD' && 'Uji batas: Curah hujan ekstrem 120 mm, RH 98%, 7 hari hujan beruntun, tanah jenuh.'}
              {currentMode === 'WORST_DROUGHT' && 'Uji batas: Kekeringan kritis 18 hari, suhu 37°C, VPD 3.12 kPa (cekaman stomata).'}
              {currentMode === 'CUSTOM' && 'Parameter dimanipulasi manual melalui sandbox what-if.'}
            </p>
          </div>
        </div>

        {/* Segmented Control Buttons */}
        <div className="flex flex-wrap items-center gap-1 bg-moss-50 dark:bg-moss-950/80 p-1 rounded-xl border border-field-border dark:border-field-darkBorder">
          
          <button
            onClick={() => onChangeMode('NORMAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
              currentMode === 'NORMAL'
                ? 'bg-white dark:bg-field-darkCard text-emerald-800 dark:text-emerald-300 shadow-sm'
                : 'text-field-muted dark:text-moss-400 hover:text-field-header dark:hover:text-white'
            }`}
          >
            <Leaf className="w-3.5 h-3.5" />
            <span>Kondisi Riil Lahan</span>
          </button>

          <button
            onClick={() => onChangeMode('WORST_FLOOD')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
              currentMode === 'WORST_FLOOD'
                ? 'bg-rose-700 text-white shadow-sm'
                : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            <CloudLightning className="w-3.5 h-3.5" />
            <span>Worst-Case: Banjir/Lembap Ekstrem</span>
          </button>

          <button
            onClick={() => onChangeMode('WORST_DROUGHT')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
              currentMode === 'WORST_DROUGHT'
                ? 'bg-amber-700 text-white shadow-sm'
                : 'text-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Worst-Case: Cekaman Kemarau</span>
          </button>

          <button
            onClick={onOpenCustomModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
              currentMode === 'CUSTOM'
                ? 'bg-moss-800 text-white shadow-sm'
                : 'text-field-muted dark:text-moss-400 hover:text-field-header dark:hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Kustom Sandbox</span>
          </button>

        </div>

      </div>
    </div>
  );
};
