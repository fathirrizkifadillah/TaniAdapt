import React, { useState } from 'react';
import { LITERATURE_DATABASE, LiteratureExtraction16 } from '../../data/literatureEvidence';
import {
  BookOpen,
  Filter,
  GraduationCap,
  Building2,
  Calendar,
  CheckCircle2,
  FlaskConical,
  ExternalLink,
  Cpu,
  BrainCircuit,
  Binary
} from 'lucide-react';

interface EvidenceRepositoryProps {
  onSelectCitation: (id: string) => void;
}

export const EvidenceRepository: React.FC<EvidenceRepositoryProps> = ({ onSelectCitation }) => {
  const [selectedCropFilter, setSelectedCropFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const citations = Object.values(LITERATURE_DATABASE);

  const filteredCitations = citations.filter((c) => {
    const matchCrop =
      selectedCropFilter === 'all' ||
      c.crop.toLowerCase().includes(selectedCropFilter.toLowerCase()) ||
      c.id.includes(selectedCropFilter);
    const matchSearch =
      searchQuery === '' ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.authors.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mainFinding.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.agriculturalProblem.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCrop && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* 1. Header Banner & Architecture Roles */}
      <div className="p-5 rounded-2xl border border-field-border dark:border-field-darkBorder bg-white dark:bg-field-darkCard shadow-tactile">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-moss-100 dark:bg-moss-900/60 border border-moss-300 dark:border-moss-700 flex items-center justify-center text-moss-800 dark:text-emerald-400 shrink-0">
              <FlaskConical className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-field-header dark:text-white font-display">
                Repositori Bukti Literatur & Validasi Empiris (16 Komponen Ekstraksi)
              </h2>
              <p className="text-xs text-field-muted dark:text-moss-300">
                Fondasi saintifik TaniAdapt: Evidence {'->'} Finding {'->'} Agricultural Interpretation {'->'} Model {'->'} Decision Logic
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-moss-100 dark:bg-moss-900 px-3 py-1 rounded-full text-moss-800 dark:text-emerald-300 font-semibold border border-moss-200 dark:border-moss-800">
              {citations.length} Studi Terverifikasi
            </span>
          </div>
        </div>

        {/* 4 Roles Architecture Grid (from docx #1 Section 9) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-field-border/60 dark:border-field-darkBorder/60 text-xs">
          <div className="p-3 rounded-xl bg-moss-50/50 dark:bg-moss-950/30 border border-field-border dark:border-field-darkBorder">
            <div className="flex items-center gap-2 text-moss-800 dark:text-emerald-400 font-bold mb-1">
              <Binary className="w-4 h-4" />
              <span>1. Statistik</span>
            </div>
            <p className="text-[11px] text-field-muted dark:text-moss-300 leading-relaxed">
              Menemukan hubungan nyata, korelasi lag temporal, dan pola kejadian penyakit. Bukan angka dekoratif.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-moss-50/50 dark:bg-moss-950/30 border border-field-border dark:border-field-darkBorder">
            <div className="flex items-center gap-2 text-moss-800 dark:text-emerald-400 font-bold mb-1">
              <Cpu className="w-4 h-4" />
              <span>2. Machine Learning</span>
            </div>
            <p className="text-[11px] text-field-muted dark:text-moss-300 leading-relaxed">
              Menangkap pola prediktif multivariat yang kompleks setelah data dan feature engineering siap.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-moss-50/50 dark:bg-moss-950/30 border border-field-border dark:border-field-darkBorder">
            <div className="flex items-center gap-2 text-moss-800 dark:text-emerald-400 font-bold mb-1">
              <FlaskConical className="w-4 h-4" />
              <span>3. Decision Engine</span>
            </div>
            <p className="text-[11px] text-field-muted dark:text-moss-300 leading-relaxed">
              Menerjemahkan skor risiko menjadi keputusan operasional spesifik (irigasi, pupuk, fungisida).
            </p>
          </div>

          <div className="p-3 rounded-xl bg-moss-50/50 dark:bg-moss-950/30 border border-field-border dark:border-field-darkBorder">
            <div className="flex items-center gap-2 text-moss-800 dark:text-emerald-400 font-bold mb-1">
              <BrainCircuit className="w-4 h-4" />
              <span>4. LLM & RAG</span>
            </div>
            <p className="text-[11px] text-field-muted dark:text-moss-300 leading-relaxed">
              Menjelaskan alasan keputusan kepada petani dan membantu simulasi skenario. Bukan penentu angka.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-mono text-field-muted dark:text-moss-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Komoditas:</span>
          </span>
          {[
            { id: 'all', label: 'Semua Komoditas' },
            { id: 'cabai', label: 'Cabai' },
            { id: 'padi', label: 'Padi Sawah' },
            { id: 'bawang', label: 'Bawang Merah' },
            { id: 'jagung', label: 'Jagung' },
            { id: 'tomat', label: 'Tomat' },
            { id: 'fao', label: 'Umum / Irigasi' }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setSelectedCropFilter(btn.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all active:scale-[0.97] ${
                selectedCropFilter === btn.id
                  ? 'bg-moss-800 text-white shadow-sm'
                  : 'bg-white dark:bg-field-darkCard text-field-muted dark:text-moss-300 border border-field-border dark:border-field-darkBorder hover:bg-moss-50 dark:hover:bg-moss-950/40'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Cari jurnal, temuan, patogen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-field-darkCard border border-field-border dark:border-field-darkBorder text-field-header dark:text-white placeholder-field-muted/70 focus:outline-none focus:border-moss-600"
          />
        </div>
      </div>

      {/* 3. Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredCitations.map((paper: LiteratureExtraction16) => (
          <div
            key={paper.id}
            className="p-4 rounded-2xl border border-field-border dark:border-field-darkBorder bg-white dark:bg-field-darkCard shadow-tactile flex flex-col justify-between hover:border-moss-400 dark:hover:border-moss-600 transition-all"
          >
            <div className="space-y-2.5">
              
              {/* Card Header & Badges */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase bg-moss-100 dark:bg-moss-900/80 text-moss-800 dark:text-emerald-300 px-2 py-0.5 rounded font-semibold border border-moss-200 dark:border-moss-800">
                    {paper.crop}
                  </span>
                  <div className="text-[11px] text-field-muted dark:text-moss-400 mt-1 flex items-center gap-1">
                    <span>{paper.location}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded font-bold">
                  {paper.strengthOfEvidence}
                </span>
              </div>

              {/* Title */}
              <h3 className="font-bold text-sm text-field-header dark:text-white leading-snug">
                {paper.title}
              </h3>

              {/* Authors & Year */}
              <div className="flex items-center gap-2 text-xs text-field-muted dark:text-moss-300">
                <GraduationCap className="w-3.5 h-3.5 shrink-0 text-moss-600 dark:text-moss-400" />
                <span>{paper.authors} ({paper.year})</span>
              </div>

              {/* Institution */}
              <div className="flex items-center gap-2 text-[11px] text-field-muted dark:text-moss-400">
                <Building2 className="w-3.5 h-3.5 shrink-0 text-moss-600 dark:text-moss-400" />
                <span>{paper.institution}</span>
              </div>

              {/* Finding Box */}
              <div className="p-3 rounded-xl bg-moss-50/60 dark:bg-moss-950/40 border border-moss-200/80 dark:border-moss-800/80 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-moss-900 dark:text-emerald-300 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Temuan Ilmiah Utama:</span>
                </div>
                <p className="text-field-header dark:text-white leading-relaxed text-[11.5px]">
                  {paper.mainFinding}
                </p>
              </div>

              {/* 16 Fields Highlight Strip */}
              <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-field-muted dark:text-moss-400 pt-1">
                <div>
                  <span className="text-field-header dark:text-white font-semibold">Lag Relevan: </span>
                  {paper.lagWeatherHistory}
                </div>
                <div>
                  <span className="text-field-header dark:text-white font-semibold">Fase Rentan: </span>
                  {paper.growthStage}
                </div>
                <div className="col-span-2">
                  <span className="text-field-header dark:text-white font-semibold">Ambang Engine: </span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{paper.applicableThreshold}</span>
                </div>
              </div>

            </div>

            {/* Action Bottom */}
            <div className="pt-3 mt-3 border-t border-field-border/60 dark:border-field-darkBorder/60 flex items-center justify-between">
              <span className="text-[10px] font-mono text-field-muted dark:text-moss-400">
                Metode: {paper.statisticalMLMethod}
              </span>
              <button
                onClick={() => onSelectCitation(paper.id)}
                className="text-xs font-semibold text-moss-800 dark:text-emerald-400 hover:underline flex items-center gap-1 transition-all active:scale-[0.97]"
              >
                <span>Lihat 16 Komponen Lengkap</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};
