import React from 'react';
import { Sprout, SunMedium, Moon, Printer, ShieldAlert, Radio, SlidersHorizontal, BookOpen } from 'lucide-react';
import { AgriculturalLocation } from '../../types/location';
import { INDONESIAN_LOCATIONS } from '../../data/indonesianLocations';

interface HeaderProps {
  selectedLocation: AgriculturalLocation;
  onSelectLocation: (loc: AgriculturalLocation) => void;
  isHighContrast: boolean;
  onToggleHighContrast: () => void;
  isDark: boolean;
  onToggleDark: () => void;
  isLiveApi: boolean;
  dataSourceLabel: string;
  onOpenAudit: () => void;
  onOpenSimulator: () => void;
  isSimulatorActive: boolean;
  onOpenEvidence: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedLocation,
  onSelectLocation,
  isHighContrast,
  onToggleHighContrast,
  isDark,
  onToggleDark,
  isLiveApi,
  dataSourceLabel,
  onOpenAudit,
  onOpenSimulator,
  isSimulatorActive,
  onOpenEvidence
}) => {
  return (
    <header className="sticky top-0 z-40 bg-moss-900 text-white border-b border-moss-800 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-moss-800/90 border border-moss-700 text-emerald-400 shadow-sm flex items-center justify-center shrink-0">
              <Sprout className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight font-display text-white">
                  TaniAdapt
                </span>
                <span className="text-[10px] font-mono uppercase bg-moss-800 px-2 py-0.5 rounded text-emerald-300 border border-moss-700">
                  Agro-DSS v1.0
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-moss-200">
                Decision-Support Pertanian Berbasis Bukti Ilmiah & Riwayat Cuaca Temporal
              </p>
            </div>
          </div>

          {/* Quick Location Picker & Controls */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            
            {/* Location Selector */}
            <div className="flex items-center bg-moss-950/80 border border-moss-700/80 rounded-xl px-2.5 py-1.5">
              <span className="text-xs text-moss-300 mr-2 font-mono hidden sm:inline">Lokasi:</span>
              <select
                aria-label="Pilih Lokasi Lahan Pertanian"
                value={selectedLocation.id}
                onChange={(e) => {
                  const loc = INDONESIAN_LOCATIONS.find(l => l.id === e.target.value);
                  if (loc) onSelectLocation(loc);
                }}
                className="bg-transparent text-xs text-emerald-200 font-semibold focus:outline-none cursor-pointer max-w-[160px] sm:max-w-none truncate"
              >
                {INDONESIAN_LOCATIONS.map((loc) => (
                  <option key={loc.id} value={loc.id} className="bg-moss-900 text-white">
                    {loc.name} ({loc.regency})
                  </option>
                ))}
              </select>
            </div>

            {/* Live API / Offline Indicator */}
            <div
              className={`flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1.5 rounded-xl border ${
                isLiveApi
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800'
              }`}
              title={dataSourceLabel}
            >
              <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
              <span className="hidden sm:inline">{isLiveApi ? 'Open-Meteo Live' : 'Kalibrasi Lahan'}</span>
            </div>

            {/* Evidence Repository Shortcut */}
            <button
              onClick={onOpenEvidence}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-moss-800 hover:bg-moss-700 text-moss-100 border border-moss-700 transition-all active:scale-[0.97]"
              title="Buka Repositori 16 Komponen Ekstraksi Jurnal"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden lg:inline">Bukti Literatur</span>
            </button>

            {/* What-If Simulator Button */}
            <button
              onClick={onOpenSimulator}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-all active:scale-[0.97] ${
                isSimulatorActive
                  ? 'bg-amber-600 text-white border-amber-500 ring-2 ring-amber-400/40'
                  : 'bg-moss-800 hover:bg-moss-700 text-moss-100 border-moss-700'
              }`}
              title="Buka Sandbox Simulasi Skenario Cuaca"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-300" />
              <span>Simulasi</span>
            </button>

            {/* Print Field Sheet Button */}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-moss-800 hover:bg-moss-700 text-moss-100 border border-moss-700 transition-all active:scale-[0.97]"
              title="Cetak Lembar Rekomendasi Lapangan"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cetak</span>
            </button>

            {/* High Contrast Sunlight Mode Toggle */}
            <button
              onClick={onToggleHighContrast}
              className={`px-2.5 py-1.5 rounded-xl text-xs border font-medium transition-all active:scale-[0.97] ${
                isHighContrast
                  ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                  : 'bg-moss-800 hover:bg-moss-700 text-moss-200 border-moss-700'
              }`}
              title="Mode Terik Lapangan: Kontras maksimal untuk layar HP di bawah sinar matahari langsung"
            >
              <SunMedium className="w-3.5 h-3.5 inline mr-1 text-amber-300" />
              <span className="hidden sm:inline">Mode Terik</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDark}
              className="p-1.5 sm:p-2 rounded-xl bg-moss-800 hover:bg-moss-700 text-moss-200 border border-moss-700 transition-all active:scale-[0.97]"
              title="Beralih Tema Terang / Gelap"
            >
              {isDark ? <SunMedium className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-slate-200" />}
            </button>

            {/* Anti-Slop Audit Button */}
            <button
              onClick={onOpenAudit}
              className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1.5 rounded-xl bg-emerald-950/80 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition-all active:scale-[0.97]"
              title="Periksa Kepatuhan Desain Anti-AI-Slop & Standar Agronomi"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Anti-Slop</span>
            </button>

            {/* Navigasi Cepat Antar Halaman */}
            <a
              href="index.html"
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-moss-800 hover:bg-moss-700 text-moss-100 border border-moss-700 transition-all active:scale-[0.97]"
              title="Kembali ke Beranda TaniAdapt"
            >
              <span>Beranda</span>
            </a>
            <a
              href="dashboard.html"
              className="hidden xl:flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-moss-800 hover:bg-moss-700 text-moss-100 border border-moss-700 transition-all active:scale-[0.97]"
              title="Buka Dashboard Standalone"
            >
              <span>Dashboard Standalone</span>
            </a>
          </div>

        </div>
      </div>
    </header>
  );
};
