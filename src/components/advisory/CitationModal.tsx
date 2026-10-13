import React from 'react';
import { LITERATURE_DATABASE } from '../../data/literatureEvidence';
import { X, BookOpen, GraduationCap, Building2, CheckCircle2, FlaskConical, MapPin, Calendar, Clock, AlertCircle } from 'lucide-react';

interface CitationModalProps {
  citationId: string | null;
  onClose: () => void;
}

export const CitationModal: React.FC<CitationModalProps> = ({ citationId, onClose }) => {
  if (!citationId) return null;
  const citation = LITERATURE_DATABASE[citationId];
  if (!citation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm no-print">
      <div className="bg-white dark:bg-field-darkCard border border-field-border dark:border-field-darkBorder rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-field-border dark:border-field-darkBorder bg-moss-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <BookOpen className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h2 className="font-bold text-sm leading-tight font-display text-white">
                Detail Bukti Ilmiah & 16 Komponen Ekstraksi
              </h2>
              <span className="text-[11px] text-moss-200 font-mono">
                Literature Extraction Framework (Docx Appendix Standard)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup Detail Bukti Ilmiah"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-[0.97]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* Paper Title & Meta */}
          <div className="p-3.5 rounded-xl border border-moss-200 dark:border-moss-800 bg-moss-50/50 dark:bg-moss-950/30">
            <div className="text-[10px] font-mono uppercase text-field-muted dark:text-moss-400 font-semibold mb-1">
              Judul Karya Ilmiah:
            </div>
            <h3 className="font-bold text-sm text-field-header dark:text-white leading-snug">
              {citation.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-2 mt-2 border-t border-moss-200/60 dark:border-moss-800/60">
              <div className="flex items-center gap-1.5 text-field-muted dark:text-moss-300">
                <GraduationCap className="w-3.5 h-3.5 text-moss-600 dark:text-moss-400 shrink-0" />
                <span>{citation.authors} ({citation.year})</span>
              </div>
              <div className="flex items-center gap-1.5 text-field-muted dark:text-moss-300">
                <Building2 className="w-3.5 h-3.5 text-moss-600 dark:text-moss-400 shrink-0" />
                <span>{citation.institution}</span>
              </div>
            </div>
            <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 italic pt-1">
              Publikasi: {citation.journal}
            </div>
          </div>

          {/* Key Findings Box */}
          <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-300 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Temuan Kunci Peneliti (Main Finding):</span>
            </div>
            <p className="text-field-header dark:text-white leading-relaxed">
              {citation.mainFinding}
            </p>
            <div className="mt-2.5 pt-2 border-t border-emerald-200 dark:border-emerald-900/60 text-[11px] font-mono text-emerald-950 dark:text-emerald-200">
              <strong>Ambang Batas Engine: </strong>{citation.applicableThreshold}
            </div>
          </div>

          {/* 16 Extraction Fields Grid */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-field-header dark:text-white font-mono mb-2 flex items-center gap-1.5">
              <FlaskConical className="w-4 h-4 text-moss-600 dark:text-moss-400" />
              <span>16 Komponen Ekstraksi Metodologis:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase">1. Komoditas (Crop)</div>
                <div className="font-semibold text-field-header dark:text-white mt-0.5">{citation.crop}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>2. Lokasi Geografis</span>
                </div>
                <div className="font-semibold text-field-header dark:text-white mt-0.5">{citation.location}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase">3. Luaran Pertanian (Outcome)</div>
                <div className="font-semibold text-field-header dark:text-white mt-0.5">{citation.agriculturalOutcome}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase">4. Masalah Agronomi</div>
                <div className="font-semibold text-field-header dark:text-white mt-0.5">{citation.agriculturalProblem}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard sm:col-span-2">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase">5. Variabel Cuaca Kunci</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {citation.weatherVariables.map((v, i) => (
                    <span key={i} className="text-[10px] font-mono bg-moss-100 dark:bg-moss-900 text-moss-900 dark:text-moss-100 px-2 py-0.5 rounded border border-moss-300 dark:border-moss-700">
                      {v}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>6. Resolusi Temporal</span>
                </div>
                <div className="font-semibold text-field-header dark:text-white mt-0.5">{citation.temporalResolution}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>7. Panjang Lag / Weather History</span>
                </div>
                <div className="font-semibold text-field-header dark:text-white mt-0.5">{citation.lagWeatherHistory}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase">8. Fase Pertumbuhan Rentan</div>
                <div className="font-semibold text-field-header dark:text-white mt-0.5">{citation.growthStage}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase">9. Sumber Data Riset</div>
                <div className="font-semibold text-field-header dark:text-white mt-0.5">{citation.dataSource}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase">10. Metode Statistik / ML</div>
                <div className="font-semibold text-field-header dark:text-white mt-0.5">{citation.statisticalMLMethod}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase">11. Kekuatan Bukti</div>
                <div className="font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">{citation.strengthOfEvidence}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase">12. Perilaku Efek (Linear / Non-linear)</div>
                <div className="font-semibold text-field-header dark:text-white mt-0.5">{citation.linearNonlinearBehavior}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase">13. Kelayakan Implementasi</div>
                <div className="font-semibold text-field-header dark:text-white mt-0.5">{citation.feasibility}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard sm:col-span-2">
                <div className="text-[10px] font-mono text-field-muted dark:text-moss-400 uppercase flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-3 h-3" />
                  <span>14. Keterbatasan Studi (Limitation)</span>
                </div>
                <div className="text-field-header dark:text-white mt-0.5">{citation.limitation}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-moss-300 dark:border-moss-700 bg-moss-50/60 dark:bg-moss-950/40 sm:col-span-2">
                <div className="text-[10px] font-mono text-moss-800 dark:text-moss-300 uppercase font-semibold">
                  15 & 16. Penerapan Langsung pada TaniAdapt
                </div>
                <div className="text-field-header dark:text-white mt-0.5">{citation.applicabilityToTaniAdapt}</div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 bg-moss-50 dark:bg-moss-950/40 border-t border-field-border dark:border-field-darkBorder flex justify-end">
          <button
            onClick={onClose}
            className="bg-moss-800 hover:bg-moss-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-[0.97]"
          >
            Tutup Dialog
          </button>
        </div>

      </div>
    </div>
  );
};
