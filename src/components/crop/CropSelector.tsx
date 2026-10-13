import React from 'react';
import { CropId } from '../../types/crop';
import { CROP_MODELS } from '../../data/cropModels';

interface CropSelectorProps {
  selectedCropId: CropId;
  onSelectCrop: (cropId: CropId) => void;
}

export const CropSelector: React.FC<CropSelectorProps> = ({
  selectedCropId,
  onSelectCrop
}) => {
  const cropList = Object.values(CROP_MODELS);

  return (
    <div className="p-1 sm:p-1.5 rounded-2xl border border-moss-200/80 dark:border-moss-800/80 bg-moss-900/5 dark:bg-white/5 ring-1 ring-moss-900/10 dark:ring-white/10">
      <div className="rounded-xl bg-white dark:bg-field-darkCard p-3.5 sm:p-4 shadow-tactile">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-field-header dark:text-white font-display">
              Pilih Komoditas Tanaman
            </h2>
            <p className="text-xs text-field-muted dark:text-moss-300">
              Engine analitik disesuaikan dengan kurva fenologi dan ambang batas spesifik masing-masing tanaman
            </p>
          </div>
          <span className="text-[11px] font-mono bg-moss-100 dark:bg-moss-900 text-moss-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold border border-moss-200 dark:border-moss-800">
            5 Crop Engines
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {cropList.map((crop) => {
            const isSelected = crop.id === selectedCropId;
            return (
              <button
                key={crop.id}
                onClick={() => onSelectCrop(crop.id)}
                className={`text-left p-3 rounded-xl border transition-all active:scale-[0.97] ${
                  isSelected
                    ? 'bg-moss-900 text-white border-moss-950 shadow-sm ring-2 ring-emerald-500/40 dark:bg-moss-800 dark:border-moss-600'
                    : 'bg-moss-50/40 dark:bg-moss-950/20 hover:bg-moss-50 dark:hover:bg-moss-900/40 text-field-header dark:text-moss-200 border-field-border dark:border-field-darkBorder'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-semibold ${
                    isSelected
                      ? 'bg-moss-800 text-emerald-300 border border-moss-700'
                      : 'bg-white dark:bg-field-darkCard text-field-muted dark:text-moss-400 border border-field-border dark:border-field-darkBorder'
                  }`}>
                    {crop.category}
                  </span>
                  <span className={`text-[10px] font-mono tabular-nums ${isSelected ? 'text-moss-300' : 'text-field-muted dark:text-moss-400'}`}>
                    {crop.totalDurationDays} hari
                  </span>
                </div>
                <div className="font-bold text-sm leading-tight mt-1">
                  {crop.name}
                </div>
                <div className={`text-[11px] italic mt-0.5 truncate ${
                  isSelected ? 'text-moss-200' : 'text-field-muted dark:text-moss-400'
                }`}>
                  {crop.scientificName}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
