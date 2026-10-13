import React from 'react';
import { RiskLevel } from '../../types/decision';
import { ShieldCheck, AlertCircle, AlertTriangle } from 'lucide-react';

interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, size = 'md', showIcon = true }) => {
  const config = {
    RENDAH: {
      label: 'Risiko Rendah',
      icon: ShieldCheck,
      classes: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    },
    SEDANG: {
      label: 'Waspada / Sedang',
      icon: AlertTriangle,
      classes: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800'
    },
    TINGGI: {
      label: 'Bahaya / Kritis',
      icon: AlertCircle,
      classes: 'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800'
    }
  }[level];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs font-semibold px-2.5 py-1 gap-1.5',
    lg: 'text-sm font-bold px-3 py-1.5 gap-2'
  }[size];

  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center rounded border font-mono tracking-wide ${sizeClasses} ${config.classes}`}
    >
      {showIcon && <IconComponent className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />}
      <span>{config.label}</span>
    </span>
  );
};
