import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricTileProps {
  label: string;
  value: string | number;
  unit: string;
  subtext?: string;
  icon: LucideIcon;
  status?: 'normal' | 'alert' | 'warning';
}

export const MetricTile: React.FC<MetricTileProps> = ({
  label,
  value,
  unit,
  subtext,
  icon: Icon,
  status = 'normal'
}) => {
  const statusBorder = {
    normal: 'border-field-border dark:border-field-darkBorder',
    warning: 'border-amber-400 dark:border-amber-700 bg-amber-50/20',
    alert: 'border-rose-400 dark:border-rose-700 bg-rose-50/20'
  }[status];

  return (
    <div
      className={`rounded-lg p-3.5 bg-white dark:bg-field-darkCard border ${statusBorder} shadow-tactile transition-colors`}
    >
      <div className="flex items-center justify-between text-field-muted dark:text-moss-300 text-xs font-medium uppercase tracking-wider mb-1.5">
        <span>{label}</span>
        <Icon className="w-4 h-4 opacity-75" />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold font-mono tracking-tight text-field-header dark:text-white">
          {value}
        </span>
        <span className="text-xs font-semibold text-field-muted dark:text-moss-400">
          {unit}
        </span>
      </div>
      {subtext && (
        <div className="mt-1 text-[11px] text-field-muted dark:text-moss-300/80 font-mono truncate">
          {subtext}
        </div>
      )}
    </div>
  );
};
