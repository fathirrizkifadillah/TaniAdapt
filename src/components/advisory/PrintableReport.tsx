import React from 'react';
import { AgriculturalLocation } from '../../types/location';
import { CropEngineResult } from '../../types/decision';
import { CurrentWeather, DailyForecast, TemporalFeatures } from '../../types/weather';

interface PrintableReportProps {
  location: AgriculturalLocation;
  cropResult: CropEngineResult;
  currentWeather: CurrentWeather;
  features: TemporalFeatures;
  forecast: DailyForecast[];
}

export const PrintableReport: React.FC<PrintableReportProps> = ({
  location,
  cropResult,
  currentWeather,
  features,
  forecast
}) => {
  const currentDateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="hidden print:block p-8 bg-white text-black font-sans max-w-4xl mx-auto">
      {/* Official Header */}
      <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">
            TaniAdapt - Lembar Instruksi Operasional Lahan
          </h1>
          <p className="text-xs font-semibold text-gray-700">
            Sistem Pendukung Keputusan Pertanian Presisi Hiperlokal Berbasis Bukti Ilmiah
          </p>
        </div>
        <div className="text-right text-xs font-mono">
          <div>Tanggal: <strong>{currentDateStr}</strong></div>
          <div>Zona Iklim: <strong>{location.agroclimateZone}</strong></div>
        </div>
      </div>

      {/* Farm Block Info */}
      <div className="grid grid-cols-2 gap-4 p-3 border border-black mb-4 text-xs font-mono">
        <div>
          <div>Lokasi Petak: <strong>{location.name}, Kab. {location.regency} ({location.province})</strong></div>
          <div>Koordinat: <strong>{location.latitude}, {location.longitude} (Elevasi {location.elevationMeters} mdpl)</strong></div>
          <div>Jenis Tanah: <strong>{location.soilTexture}</strong></div>
        </div>
        <div>
          <div>Komoditas: <strong>{cropResult.cropName} ({cropResult.scientificName})</strong></div>
          <div>Umur Tanaman: <strong>{cropResult.currentHST} HST ({cropResult.stageName})</strong></div>
          <div>Status Risiko Keseluruhan: <strong className="uppercase underline">{cropResult.overallRisk}</strong></div>
        </div>
      </div>

      {/* Microclimate Table */}
      <div className="mb-4">
        <h2 className="text-xs font-black uppercase tracking-wider mb-1">
          1. Parameter Mikroklimat & Lag Temporal
        </h2>
        <table className="w-full text-xs border-collapse border border-black text-left">
          <tbody>
            <tr className="border-b border-black">
              <td className="p-1.5 border-r border-black font-semibold">Suhu Udara Terkini:</td>
              <td className="p-1.5 border-r border-black font-mono">{currentWeather.temperature}°C (Rerata 7 Hari: {features.rolling7dTemp}°C)</td>
              <td className="p-1.5 border-r border-black font-semibold">Kelembapan Udara (RH):</td>
              <td className="p-1.5 font-mono">{currentWeather.relativeHumidity}% (Rerata 7 Hari: {features.rolling7dRH}%)</td>
            </tr>
            <tr className="border-b border-black">
              <td className="p-1.5 border-r border-black font-semibold">VPD (Tetens):</td>
              <td className="p-1.5 border-r border-black font-mono">{features.currentVPD} kPa</td>
              <td className="p-1.5 border-r border-black font-semibold">Akumulasi Hujan 3 Hari:</td>
              <td className="p-1.5 font-mono">{features.rolling3dRain} mm (Lag 1 Hari: {features.lag1Rain} mm)</td>
            </tr>
            <tr>
              <td className="p-1.5 border-r border-black font-semibold">Hari Hujan Berturut:</td>
              <td className="p-1.5 border-r border-black font-mono">{features.consecutiveRainyDays} Hari</td>
              <td className="p-1.5 border-r border-black font-semibold">Prakiraan Hujan 24 Jam:</td>
              <td className="p-1.5 font-mono">{features.forecastRain24h} mm (Peluang: {forecast[0]?.precipitationProbability || 0}%)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Operational Actions Table */}
      <div className="mb-4">
        <h2 className="text-xs font-black uppercase tracking-wider mb-1">
          2. Instruksi Tindakan Lapangan Mendesak (Actionable Advisory)
        </h2>
        <table className="w-full text-xs border-collapse border border-black text-left">
          <thead>
            <tr className="bg-gray-100 border-b border-black">
              <th className="p-1.5 border-r border-black w-24">Urgensi</th>
              <th className="p-1.5 border-r border-black">Kategori</th>
              <th className="p-1.5 border-r border-black">Instruksi Tindakan Kerja</th>
              <th className="p-1.5">Alasan Ilmiah / Jurnal</th>
            </tr>
          </thead>
          <tbody>
            {cropResult.recommendations.map((rec, i) => (
              <tr key={i} className="border-b border-black">
                <td className="p-1.5 border-r border-black font-bold uppercase">{rec.urgency.replace(/_/g, ' ')}</td>
                <td className="p-1.5 border-r border-black font-semibold">{rec.category.replace(/_/g, ' ')}</td>
                <td className="p-1.5 border-r border-black font-bold">{rec.action}</td>
                <td className="p-1.5 text-[11px]">{rec.rationale} ({rec.literatureSource})</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Core Decisions: Water & Fertilizer */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
        <div className="p-2.5 border border-black">
          <div className="font-black uppercase mb-1">Status Tata Kelola Air:</div>
          <div>Status: <strong>{cropResult.irrigation.status.replace(/_/g, ' ')}</strong></div>
          <div>Instruksi: {cropResult.irrigation.recommendation}</div>
          <div className="text-[11px] text-gray-700 mt-1">Alasan: {cropResult.irrigation.rationale}</div>
        </div>
        <div className="p-2.5 border border-black">
          <div className="font-black uppercase mb-1">Status Aplikasi Pupuk:</div>
          <div>Status: <strong>{cropResult.fertilization.status.replace(/_/g, ' ')}</strong></div>
          <div>Instruksi: {cropResult.fertilization.reason}</div>
          <div className="text-[11px] text-gray-700 mt-1">Hara Prioritas: {cropResult.fertilization.recommendedNutrient}</div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="grid grid-cols-2 gap-8 pt-8 mt-4 text-xs font-mono">
        <div className="text-center">
          <div className="mb-12">Disiapkan Oleh Sistem:</div>
          <div className="font-bold">Engine Agro-DSS TaniAdapt</div>
          <div>ID Sesi: {Math.random().toString(36).substring(7).toUpperCase()}</div>
        </div>
        <div className="text-center">
          <div className="mb-12">Mandor / Pengelola Lahan Kebun:</div>
          <div className="border-b border-black w-48 mx-auto mb-1"></div>
          <div>(Nama Terang & Tanda Tangan)</div>
        </div>
      </div>
    </div>
  );
};
