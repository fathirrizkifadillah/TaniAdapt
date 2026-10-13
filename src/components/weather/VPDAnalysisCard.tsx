import React from 'react';
import { Activity, Info } from 'lucide-react';

interface VPDAnalysisCardProps {
  vpd: number;
  temperature: number;
  rh: number;
}

export const VPDAnalysisCard: React.FC<VPDAnalysisCardProps> = ({ vpd, temperature, rh }) => {
  // Rentang VPD Agronomi:
  // < 0.4 kPa: Terlalu lembap, transpirasi macet, risiko spora jamur tinggi
  // 0.4 - 0.8 kPa: Rendah / Sejuk (Bibit / Vegetatif awal)
  // 0.8 - 1.4 kPa: Optimal fotosintesis & transpirasi tanaman hortikultura
  // 1.4 - 1.8 kPa: Tinggi (Mulai transpirasi cepat, butuh suplai air cukup)
  // > 1.8 kPa: Sangat tinggi / Cekaman terik (Stomata menutup, daun rawan layu)

  let zoneText = 'Optimal Transpirasi';
  let zoneColor = 'text-emerald-700 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
  let zoneDescription = 'Stomata terbuka normal, translokasi kalsium dan unsur hara dari akar ke daun berjalan lancar.';

  if (vpd < 0.5) {
    zoneText = 'Zona Lembap Jenuh (Bahaya Jamur)';
    zoneColor = 'text-blue-800 bg-blue-50 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    zoneDescription = 'Udara terlalu basah sehingga tanaman sulit menguapkan air. Spora jamur dan bakteri sangat mudah menempel dan berkecambah.';
  } else if (vpd > 1.6) {
    zoneText = 'Zona Evaporasi Agresif (Cekaman Air)';
    zoneColor = 'text-amber-800 bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    zoneDescription = 'Udara sangat kering dan panas. Tanaman menutup stomata untuk mencegah kehilangan air, menghentikan fotosintesis sementara.';
  }

  // Posisi persentase slider (rentang 0 s/d 2.5 kPa)
  const percentPos = Math.min(100, Math.max(0, (vpd / 2.5) * 100));

  return (
    <div className="bg-white dark:bg-field-darkCard border border-field-border dark:border-field-darkBorder rounded-xl p-4 shadow-tactile">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-moss-600 dark:text-moss-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-field-header dark:text-white font-display">
            Vapor Pressure Deficit (VPD Lahan)
          </h2>
        </div>
        <span className={`text-[11px] font-mono px-2 py-0.5 rounded border font-semibold ${zoneColor}`}>
          {zoneText}
        </span>
      </div>

      <p className="text-xs text-field-muted dark:text-moss-300 mb-3">
        Tekanan penguapan air dari stomata daun ke atmosfer dihitung dari suhu ({temperature}°C) dan kelembapan ({rh}% RH) menggunakan persamaan Tetens.
      </p>

      {/* Visual VPD Gauge Bar */}
      <div className="relative mb-3 pt-4">
        {/* Pointer nilai saat ini */}
        <div
          className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-300"
          style={{ left: `${percentPos}%` }}
        >
          <span className="font-mono text-[11px] font-bold bg-moss-900 text-white dark:bg-white dark:text-moss-950 px-1.5 py-0.2 rounded shadow">
            {vpd} kPa
          </span>
          <div className="w-1.5 h-1.5 bg-moss-900 dark:bg-white rotate-45 -mt-0.5"></div>
        </div>

        {/* Color Gradient Track */}
        <div className="h-3 w-full rounded-full flex overflow-hidden border border-field-border dark:border-field-darkBorder">
          <div className="w-[20%] bg-blue-300 dark:bg-blue-800" title="< 0.5 kPa Lembap Jenuh" />
          <div className="w-[45%] bg-emerald-400 dark:bg-emerald-600" title="0.5 - 1.6 kPa Zona Optimal" />
          <div className="w-[35%] bg-amber-400 dark:bg-amber-600" title="> 1.6 kPa Kering Terik" />
        </div>

        <div className="flex justify-between text-[10px] font-mono text-field-muted dark:text-moss-400 mt-1">
          <span>0.0 kPa (Jenuh)</span>
          <span className="text-emerald-700 dark:text-emerald-300 font-bold">0.8 - 1.4 kPa (Optimal)</span>
          <span>2.5 kPa (Kering Terik)</span>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-moss-50/60 dark:bg-moss-950/30 p-2.5 rounded border border-moss-200/60 dark:border-moss-800/60 text-xs">
        <Info className="w-4 h-4 text-moss-600 dark:text-moss-400 shrink-0 mt-0.5" />
        <span className="text-field-muted dark:text-moss-300">
          <strong className="text-field-header dark:text-white">Interpretasi Agronomi: </strong>
          {zoneDescription}
        </span>
      </div>
    </div>
  );
};
