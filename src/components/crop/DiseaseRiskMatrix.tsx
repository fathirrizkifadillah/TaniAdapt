import React from 'react';
import { DiseaseRiskAssessment } from '../../types/decision';
import { RiskBadge } from '../common/RiskBadge';
import { Bug, CheckCircle2, AlertTriangle, BookOpen, ArrowRight } from 'lucide-react';

interface DiseaseRiskMatrixProps {
  diseaseRisks: DiseaseRiskAssessment[];
  onOpenCitation: (citationId: string) => void;
}

export const DiseaseRiskMatrix: React.FC<DiseaseRiskMatrixProps> = ({
  diseaseRisks,
  onOpenCitation
}) => {
  return (
    <div className="bg-white dark:bg-field-darkCard border border-field-border dark:border-field-darkBorder rounded-2xl p-4 sm:p-5 shadow-tactile space-y-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-field-header dark:text-white font-display">
            Matriks Evaluasi Risiko Hama & Penyakit (HPT)
          </h2>
          <p className="text-xs text-field-muted dark:text-moss-300">
            Penilaian probabilitas infeksi berbasis mikroklimat harian dan lag riwayat cuaca lampau
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-field-muted dark:text-moss-300 font-mono bg-moss-50 dark:bg-moss-900/40 px-2.5 py-1 rounded-lg border border-moss-200 dark:border-moss-800 w-fit">
          <Bug className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{diseaseRisks.length} Patogen Terpantau</span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {diseaseRisks.map((d) => {
          return (
            <div
              key={d.diseaseId}
              className="group rounded-2xl border border-moss-200/70 dark:border-moss-800/70 bg-moss-900/5 dark:bg-white/5 p-1 ring-1 ring-moss-900/10 dark:ring-white/10"
            >
              <div className="rounded-xl bg-white dark:bg-field-darkCard p-3.5 shadow-sm flex flex-col justify-between h-full space-y-3">
                
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <h3 className="font-bold text-sm text-field-header dark:text-white leading-snug">
                        {d.diseaseName}
                      </h3>
                      <div className="text-[11px] italic font-mono text-field-muted dark:text-moss-400">
                        {d.pathogen}
                      </div>
                    </div>
                    <RiskBadge level={d.level} size="sm" />
                  </div>

                  {/* Score Bar with tabular number */}
                  <div className="my-2.5">
                    <div className="flex justify-between text-[11px] font-mono text-field-muted dark:text-moss-400 mb-1">
                      <span>Indeks Tekanan Inokulum Patogen</span>
                      <span className="font-bold text-field-header dark:text-white tabular-nums">{d.score} / 100</span>
                    </div>
                    <div className="w-full bg-field-border/60 dark:bg-field-darkBorder rounded-full h-2 overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          d.score >= 70
                            ? 'bg-rose-600'
                            : d.score >= 40
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${d.score}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-field-muted dark:text-moss-300 mb-2 leading-relaxed">
                    {d.reason}
                  </p>

                  {/* Trigger Factors List */}
                  {d.triggerFactors.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-field-muted dark:text-moss-400 font-bold mb-1">
                        Faktor Pemicu Terdeteksi:
                      </div>
                      <ul className="space-y-1">
                        {d.triggerFactors.map((f, i) => (
                          <li key={i} className="text-[11px] text-field-muted dark:text-moss-300 flex items-start gap-1.5 bg-moss-50/50 dark:bg-moss-950/30 p-1.5 rounded-lg border border-moss-200/50 dark:border-moss-800/50">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Footer Advice & Citation */}
                <div className="pt-2.5 border-t border-field-border/60 dark:border-field-darkBorder/60 flex items-center justify-between text-[11px]">
                  <div className="text-field-muted dark:text-moss-400 truncate max-w-[70%]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline mr-1" />
                    <span className="truncate">{d.preventiveAdvice}</span>
                  </div>
                  {d.literatureCitationId && (
                    <button
                      onClick={() => onOpenCitation(d.literatureCitationId!)}
                      className="text-moss-800 dark:text-emerald-400 font-mono font-semibold hover:underline flex items-center gap-0.5 shrink-0 transition-all active:scale-[0.97]"
                    >
                      <span>Sitasi</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
