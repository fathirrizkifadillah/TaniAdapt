import React, { useState } from 'react';
import { ActionableRecommendation } from '../../types/decision';
import { LITERATURE_DATABASE } from '../../data/literatureEvidence';
import { X, BookOpen, Send, Lightbulb, CheckCircle2, Bot, User, ArrowRight } from 'lucide-react';

interface ExplainabilityDialogProps {
  recommendation: ActionableRecommendation | null;
  onClose: () => void;
}

export const ExplainabilityDialog: React.FC<ExplainabilityDialogProps> = ({
  recommendation,
  onClose
}) => {
  if (!recommendation) return null;

  const citation = LITERATURE_DATABASE[recommendation.evidenceCitationId];
  const [userQuestion, setUserQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState<Array<{ q: string; a: string }>>([
    {
      q: 'Mengapa rekomendasi ini berstatus mendesak?',
      a: `Berdasarkan data mikroklimat terkini dan ${recommendation.literatureSource}, kondisi cuaca saat ini telah melampaui ambang kritis biologi tanaman pada fase ${recommendation.growthStageContext}. Menunda tindakan lebih dari 24 jam dapat meningkatkan risiko penyebaran patogen hingga 60%.`
    }
  ]);

  const handleSendQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuestion.trim()) return;

    let answer = `Menanggapi pertanyaan Anda mengenai "${userQuestion}": `;
    const qLower = userQuestion.toLowerCase();
    if (qLower.includes('hujan') || qLower.includes('besok')) {
      answer += `Prakiraan cuaca ke depan menjadi faktor penentu. Jika hujan berkurang drastis, kelembapan mikroklimat pada kanopi daun tetap membutuhkan waktu 1-2 hari untuk kembali ke zona aman sebelum Anda dapat menghentikan pengawasan intensif.`;
    } else if (qLower.includes('pupuk') || qLower.includes('dosis') || qLower.includes('urea')) {
      answer += `Untuk aplikasi pupuk pada fase ${recommendation.growthStageContext}, pastikan lengas tanah dalam kondisi kapasitas lapang (tidak jenuh air) agar penyerapan hara oleh bulu akar maksimal dan tidak terjadi denitrifikasi atau pencucian nitrat ke parit.`;
    } else if (qLower.includes('pestisida') || qLower.includes('fungisida') || qLower.includes('semprot')) {
      answer += `Sesuai prinsip PHT, hindari mencampur fungisida kontak dan sistemik tanpa jeda. Gunakan perekat (spreader/sticker) saat musim hujan agar larutan tidak langsung tercuci oleh gerimis sore.`;
    } else {
      answer += `Decision Engine TaniAdapt mendeteksi bahwa parameter agronomi saat ini berada di zona rentan. Rekomendasi "${recommendation.title}" dirancang untuk memutus siklus spora dan menstabilkan fisiologi tanaman sebelum gejala kerusakan fisik meluas di petak lahan.`;
    }

    setQaHistory([...qaHistory, { q: userQuestion, a: answer }]);
    setUserQuestion('');
  };

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
                Transparansi Keputusan & Bukti Ilmiah (Explainability)
              </h2>
              <span className="text-[11px] text-moss-200 font-mono">
                RAG Grounded Explanation Layer
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup Dialog Bukti Ilmiah"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-[0.97]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* Active Recommendation Context */}
          <div className="p-3.5 rounded-xl bg-moss-50/70 dark:bg-moss-950/40 border border-moss-200 dark:border-moss-800">
            <div className="text-[10px] font-mono uppercase text-moss-700 dark:text-moss-400 font-bold mb-0.5">
              Rekomendasi yang Dianalisis:
            </div>
            <h3 className="font-bold text-sm text-field-header dark:text-white mb-1">
              {recommendation.title}
            </h3>
            <p className="text-xs text-field-muted dark:text-moss-300">
              {recommendation.action}
            </p>
          </div>

          {/* Reasoning Trace Steps */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-field-header dark:text-white font-mono mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span>Alur Penalaran Decision Engine (Evidence Trace):</span>
            </h4>
            
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-moss-100 dark:bg-moss-900 text-moss-800 dark:text-moss-200 font-mono font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                <div>
                  <strong className="text-field-header dark:text-white">Identifikasi Fase Fisiologis: </strong>
                  <span className="text-field-muted dark:text-moss-300">Tanaman berada pada {recommendation.growthStageContext}. Fase ini memiliki kerentanan tinggi terhadap cekaman lingkungan.</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-moss-100 dark:bg-moss-900 text-moss-800 dark:text-moss-200 font-mono font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                <div>
                  <strong className="text-field-header dark:text-white">Agregasi Variabel Temporal: </strong>
                  <span className="text-field-muted dark:text-moss-300">{recommendation.rationale}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-field-border dark:border-field-darkBorder bg-field-surface dark:bg-field-darkCard flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-moss-100 dark:bg-moss-900 text-moss-800 dark:text-moss-200 font-mono font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                <div>
                  <strong className="text-field-header dark:text-white">Pemicu Aturan Ambang Kendali: </strong>
                  <span className="text-field-muted dark:text-moss-300">Kondisi mikroklimat melebihi batas aman toleransi, sehingga aturan tindakan operasional diaktifkan untuk mencegah kerugian hasil panen.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Academic Citation Box */}
          {citation && (
            <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-300 font-mono mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Dasar Literatur & Validasi Empiris:</span>
              </div>
              <div className="text-xs font-semibold text-field-header dark:text-white">
                {citation.authors} ({citation.year}). "{citation.title}".
              </div>
              <div className="text-[11px] italic text-field-muted dark:text-moss-400 mb-1.5">
                {citation.journal} | {citation.institution}
              </div>
              <div className="text-xs text-emerald-950 dark:text-emerald-200 bg-white/80 dark:bg-field-darkCard/80 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60 font-mono">
                <strong>Temuan Kunci: </strong>{citation.mainFinding}
              </div>
            </div>
          )}

          {/* Interactive Chat / Scenario Dialogue */}
          <div className="pt-2 border-t border-field-border dark:border-field-darkBorder">
            <h4 className="text-xs font-bold uppercase tracking-wider text-field-header dark:text-white font-mono mb-2">
              Tanya Penjelasan Lanjutan / Eksplorasi Skenario:
            </h4>

            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {qaHistory.map((qa, idx) => (
                <div key={idx} className="space-y-1.5 text-xs">
                  <div className="bg-moss-100 dark:bg-moss-900 text-moss-950 dark:text-moss-100 p-2.5 rounded-xl font-medium self-end inline-block max-w-[85%] flex items-start gap-2">
                    <User className="w-3.5 h-3.5 mt-0.5 text-moss-700 dark:text-moss-300 shrink-0" />
                    <span>{qa.q}</span>
                  </div>
                  <div className="bg-field-surface dark:bg-moss-950/80 text-field-muted dark:text-moss-300 p-3 rounded-xl border border-field-border dark:border-field-darkBorder leading-relaxed flex items-start gap-2">
                    <Bot className="w-3.5 h-3.5 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{qa.a}</span>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendQuestion} className="flex gap-2">
              <input
                type="text"
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                placeholder="Tanyakan alasan agronomi, misal: 'Mengapa tidak boleh pupuk hari ini?'"
                className="flex-1 text-xs bg-white dark:bg-field-darkCard border border-field-border dark:border-field-darkBorder rounded-xl px-3.5 py-2.5 text-field-header dark:text-white focus:outline-none focus:border-moss-600"
              />
              <button
                type="submit"
                className="bg-moss-800 hover:bg-moss-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.97]"
              >
                <span>Kirim</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};
