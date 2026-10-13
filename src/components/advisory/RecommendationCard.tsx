import React from 'react';
import { ActionableRecommendation } from '../../types/decision';
import { RiskBadge } from '../common/RiskBadge';
import {
  ShieldAlert,
  Droplets,
  Sprout,
  Clock,
  BookOpen,
  ArrowRight
} from 'lucide-react';

interface RecommendationCardProps {
  recommendation: ActionableRecommendation;
  onOpenCitation: (citationId: string) => void;
  onOpenReasoning: (rec: ActionableRecommendation) => void;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onOpenCitation,
  onOpenReasoning
}) => {
  const getCategoryIcon = () => {
    switch (recommendation.category) {
      case 'PROTEKSI_PENYAKIT':
        return <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'PENGATURAN_IRIGASI':
        return <Droplets className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
      case 'APLIKASI_PUPUK':
        return <Sprout className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <Clock className="w-4 h-4 text-moss-600 dark:text-moss-400" />;
    }
  };

  const urgencyBadge = {
    HARI_INI: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800 font-bold',
    '24_48_JAM': 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800 font-semibold',
    PREVENTIF_RUTIN: 'bg-moss-100 text-moss-900 border-moss-300 dark:bg-moss-950/60 dark:text-moss-200 dark:border-moss-800'
  }[recommendation.urgency];

  const urgencyLabel = {
    HARI_INI: 'Tindakan Hari Ini',
    '24_48_JAM': 'Jendela 24-48 Jam',
    PREVENTIF_RUTIN: 'Rutin Terjadwal'
  }[recommendation.urgency];

  return (
    <div className="group rounded-2xl border border-moss-200/80 dark:border-moss-800/80 bg-moss-900/5 dark:bg-white/5 p-1 ring-1 ring-moss-900/10 dark:ring-white/10 transition-all">
      <div className="rounded-xl bg-white dark:bg-field-darkCard p-4 shadow-tactile flex flex-col justify-between h-full space-y-3">
        
        {/* Top Header */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-moss-50 dark:bg-moss-900/40 border border-moss-200/60 dark:border-moss-800">
                {getCategoryIcon()}
              </div>
              <div>
                <h3 className="font-bold text-sm text-field-header dark:text-white leading-tight">
                  {recommendation.title}
                </h3>
                <span className="text-[11px] font-mono text-field-muted dark:text-moss-400">
                  Konteks: {recommendation.growthStageContext}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border ${urgencyBadge}`}>
                <Clock className="w-3 h-3 inline mr-1" />
                {urgencyLabel}
              </span>
              <RiskBadge level={recommendation.riskLevel} size="sm" />
            </div>
          </div>

          {/* Practical Action Directive */}
          <div className="bg-moss-50/60 dark:bg-moss-950/40 p-3 rounded-xl border border-moss-200/60 dark:border-moss-800/60 mb-2.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-moss-800 dark:text-moss-300 font-bold mb-1">
              Instruksi Operasional Lapangan:
            </div>
            <p className="text-xs font-semibold text-field-header dark:text-white leading-relaxed">
              {recommendation.action}
            </p>
          </div>

          {/* Agronomic Rationale */}
          <div className="text-xs text-field-muted dark:text-moss-300 leading-relaxed">
            <strong className="text-field-header dark:text-white font-medium">Alasan Agronomi: </strong>
            {recommendation.rationale}
          </div>
        </div>

        {/* Bottom Metadata & Button-in-Button CTA */}
        <div className="pt-2.5 border-t border-field-border/60 dark:border-field-darkBorder/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-field-muted dark:text-moss-400 text-[11px] truncate max-w-[200px] sm:max-w-xs">
            <BookOpen className="w-3.5 h-3.5 text-moss-600 dark:text-moss-400 shrink-0" />
            <span className="truncate">{recommendation.literatureSource}</span>
          </div>

          <div className="flex items-center gap-2">
            {recommendation.evidenceCitationId && (
              <button
                onClick={() => onOpenCitation(recommendation.evidenceCitationId)}
                className="text-[11px] font-mono bg-moss-100 dark:bg-moss-900 text-moss-800 dark:text-moss-200 px-2.5 py-1 rounded-lg border border-moss-300 dark:border-moss-700 hover:bg-moss-200 dark:hover:bg-moss-800 transition-all active:scale-[0.97]"
              >
                Lihat Bukti
              </button>
            )}

            {/* Button-in-Button CTA Architecture */}
            <button
              onClick={() => onOpenReasoning(recommendation)}
              className="group/btn text-xs font-semibold bg-moss-800 hover:bg-moss-700 text-white pl-3 pr-1.5 py-1 rounded-full inline-flex items-center gap-1.5 transition-all active:scale-[0.97] shadow-sm"
            >
              <span>Tanya Alasan</span>
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover/btn:translate-x-0.5">
                <ArrowRight className="w-3 h-3 text-white" />
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
