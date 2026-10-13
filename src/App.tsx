import { useState, useEffect, useMemo } from 'react';
import { INDONESIAN_LOCATIONS, CROP_MODELS } from './data';
import { AgriculturalLocation, CropId, ActionableRecommendation, TemporalFeatures } from './types';
import { fetchAgriculturalWeather, WeatherFetchResult } from './services';
import { runAgroDecisionEngine, resolveActiveGrowthStage } from './engine';

// Components
import {
  Header,
  RiskBadge,
  CropSelector,
  PhenologyTracker,
  DiseaseRiskMatrix,
  MicroclimateOverview,
  TemporalLagChart,
  VPDAnalysisCard,
  RecommendationCard,
  ExplainabilityDialog,
  CitationModal,
  ScenarioSandbox,
  WorstCaseStressTestBar,
  StressMode,
  AntiSlopBadge,
  PrintableReport,
  EvidenceRepository,
  YieldImpactCalculator
} from './components';

import {
  ShieldAlert,
  Droplets,
  Sprout,
  Activity,
  SlidersHorizontal,
  CloudSun,
  ClipboardList,
  BookOpen,
  Info
} from 'lucide-react';

export function App() {
  // 1. Lokasi & Komoditas
  const [selectedLocation, setSelectedLocation] = useState<AgriculturalLocation>(INDONESIAN_LOCATIONS[0]);
  const [selectedCropId, setSelectedCropId] = useState<CropId>('cabai');
  const [currentHST, setCurrentHST] = useState<number>(55); // Default fase berbunga cabai

  // 2. Tampilan UI / Aksesibilitas
  const [isHighContrast, setIsHighContrast] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'decision' | 'weather' | 'diseases' | 'evidence'>('decision');

  // 3. Modals
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [activeExplainRec, setActiveExplainRec] = useState<ActionableRecommendation | null>(null);
  const [isSandboxOpen, setIsSandboxOpen] = useState<boolean>(false);
  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);

  // 4. State Cuaca & Data Layer
  const [weatherData, setWeatherData] = useState<WeatherFetchResult | null>(null);
  const [loadingWeather, setLoadingWeather] = useState<boolean>(true);

  // 5. Stress Testing Mode (break-ui skill)
  const [stressMode, setStressMode] = useState<StressMode>('NORMAL');

  // 6. Scenario Simulation Overrides
  const [scenarioOverrides, setScenarioOverrides] = useState<{
    tempOverride?: number;
    rhOverride?: number;
    hstOverride?: number;
    consecutiveRainyOverride?: number;
    consecutiveDryOverride?: number;
    rolling3dRainOverride?: number;
    forecast24hOverride?: number;
  }>({});

  // Handler for Stress Test Mode change
  const handleStressModeChange = (mode: StressMode) => {
    setStressMode(mode);
    if (mode === 'NORMAL') {
      setScenarioOverrides({});
    } else if (mode === 'WORST_FLOOD') {
      setScenarioOverrides({
        tempOverride: 18.5,
        rhOverride: 98,
        consecutiveRainyOverride: 7,
        consecutiveDryOverride: 0,
        rolling3dRainOverride: 85.0,
        forecast24hOverride: 120.5,
        hstOverride: 60
      });
    } else if (mode === 'WORST_DROUGHT') {
      setScenarioOverrides({
        tempOverride: 36.8,
        rhOverride: 38,
        consecutiveRainyOverride: 0,
        consecutiveDryOverride: 18,
        rolling3dRainOverride: 0.0,
        forecast24hOverride: 0.0,
        hstOverride: 50
      });
    } else if (mode === 'CUSTOM') {
      setIsSandboxOpen(true);
    }
  };

  const isSimulatorActive = Object.keys(scenarioOverrides).length > 0;

  // Toggle Dark Mode & High Contrast class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (isHighContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
  }, [isDark, isHighContrast]);

  // Fetch weather saat lokasi berganti
  useEffect(() => {
    let isMounted = true;
    setLoadingWeather(true);

    fetchAgriculturalWeather(
      selectedLocation.id,
      selectedLocation.latitude,
      selectedLocation.longitude
    ).then((result) => {
      if (isMounted) {
        setWeatherData(result);
        setLoadingWeather(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedLocation]);

  // Sesuaikan crop saat lokasi diganti (jika crop saat ini tidak relevan dengan lokasi)
  const handleSelectLocation = (loc: AgriculturalLocation) => {
    setSelectedLocation(loc);
    if (!loc.primaryCrops.includes(selectedCropId)) {
      setSelectedCropId(loc.primaryCrops[0]);
    }
  };

  // Model Tanaman & Fase Aktif
  const activeCrop = CROP_MODELS[selectedCropId];
  const effectiveHST = scenarioOverrides.hstOverride ?? currentHST;
  const activeStage = useMemo(() => {
    return resolveActiveGrowthStage(selectedCropId, effectiveHST);
  }, [selectedCropId, effectiveHST]);

  // Eksekusi Decision Engine
  const engineOutput = useMemo(() => {
    if (!weatherData) return null;

    // Apply simulation overrides jika ada
    const effectiveCurrent = { ...weatherData.current };
    if (scenarioOverrides.tempOverride !== undefined) {
      effectiveCurrent.temperature = scenarioOverrides.tempOverride;
    }
    if (scenarioOverrides.rhOverride !== undefined) {
      effectiveCurrent.relativeHumidity = scenarioOverrides.rhOverride;
    }

    const featureOverrides: Partial<TemporalFeatures> = {};
    if (scenarioOverrides.consecutiveRainyOverride !== undefined) {
      featureOverrides.consecutiveRainyDays = scenarioOverrides.consecutiveRainyOverride;
    }
    if (scenarioOverrides.consecutiveDryOverride !== undefined) {
      featureOverrides.consecutiveDryDays = scenarioOverrides.consecutiveDryOverride;
    }
    if (scenarioOverrides.rolling3dRainOverride !== undefined) {
      featureOverrides.rolling3dRain = scenarioOverrides.rolling3dRainOverride;
    }
    if (scenarioOverrides.forecast24hOverride !== undefined) {
      featureOverrides.forecastRain24h = scenarioOverrides.forecast24hOverride;
    }

    return runAgroDecisionEngine(
      selectedCropId,
      effectiveHST,
      effectiveCurrent,
      weatherData.history,
      weatherData.dailyForecast,
      featureOverrides
    );
  }, [weatherData, selectedCropId, effectiveHST, scenarioOverrides]);

  return (
    <div className="min-h-screen flex flex-col bg-field-bg text-field-text font-sans antialiased transition-colors">
      
      {/* 1. Header Global */}
      <Header
        selectedLocation={selectedLocation}
        onSelectLocation={handleSelectLocation}
        isHighContrast={isHighContrast}
        onToggleHighContrast={() => setIsHighContrast(!isHighContrast)}
        isDark={isDark}
        onToggleDark={() => setIsDark(!isDark)}
        isLiveApi={weatherData?.isLiveApi ?? false}
        dataSourceLabel={weatherData?.dataSourceLabel ?? 'Memuat...'}
        onOpenAudit={() => setIsAuditOpen(true)}
        onOpenSimulator={() => setIsSandboxOpen(true)}
        isSimulatorActive={isSimulatorActive}
        onOpenEvidence={() => setActiveTab('evidence')}
      />

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 space-y-4 no-print">
        
        {/* Adversarial Worst-Case Stress Test Controller (break-ui skill) */}
        <WorstCaseStressTestBar
          currentMode={stressMode}
          onChangeMode={handleStressModeChange}
          onOpenCustomModal={() => setIsSandboxOpen(true)}
        />

        {/* Simulator Active Alert Banner */}
        {isSimulatorActive && stressMode !== 'NORMAL' && (
          <div className="bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
              <SlidersHorizontal className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Mode Simulasi / Stress-Test Aktif:</strong> Parameter cuaca sedang diubah untuk analisis keandalan sistem ({stressMode.replace('_', ' ')}).
              </span>
            </div>
            <button
              onClick={() => handleStressModeChange('NORMAL')}
              className="text-xs font-mono font-bold bg-amber-800 text-white px-3 py-1.5 rounded-xl hover:bg-amber-900 transition-all active:scale-[0.97] self-start sm:self-auto"
            >
              Kembalikan ke Cuaca Asli
            </button>
          </div>
        )}

        {/* Top Section: Crop Selector */}
        <CropSelector
          selectedCropId={selectedCropId}
          onSelectCrop={(id) => {
            setSelectedCropId(id);
            const model = CROP_MODELS[id];
            setCurrentHST(Math.round(model.totalDurationDays * 0.45));
          }}
        />

        {/* Phenology & HST Slider */}
        <PhenologyTracker
          crop={activeCrop}
          currentHST={effectiveHST}
          activeStage={activeStage}
          onChangeHST={(hst) => {
            if (scenarioOverrides.hstOverride !== undefined) {
              setScenarioOverrides({ ...scenarioOverrides, hstOverride: hst });
            } else {
              setCurrentHST(hst);
            }
          }}
        />

        {/* Tab Navigation with 4 Dedicated Views */}
        <div className="flex border-b border-field-border dark:border-field-darkBorder overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('decision')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 active:scale-[0.97] ${
              activeTab === 'decision'
                ? 'border-moss-700 text-moss-800 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-field-muted hover:text-field-header dark:text-moss-400 dark:hover:text-white'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Pusat Keputusan & Tindakan</span>
            {engineOutput && (
              <span className="ml-1">
                <RiskBadge level={engineOutput.result.overallRisk} size="sm" showIcon={false} />
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('weather')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 active:scale-[0.97] ${
              activeTab === 'weather'
                ? 'border-moss-700 text-moss-800 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-field-muted hover:text-field-header dark:text-moss-400 dark:hover:text-white'
            }`}
          >
            <CloudSun className="w-4 h-4" />
            <span>Mikroklimat & Analisis Temporal (Lag)</span>
          </button>

          <button
            onClick={() => setActiveTab('diseases')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 active:scale-[0.97] ${
              activeTab === 'diseases'
                ? 'border-moss-700 text-moss-800 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-field-muted hover:text-field-header dark:text-moss-400 dark:hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Matriks HPT ({engineOutput?.result.diseaseRisks.length || 0} Patogen)</span>
          </button>

          <button
            onClick={() => setActiveTab('evidence')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 active:scale-[0.97] ${
              activeTab === 'evidence'
                ? 'border-moss-700 text-moss-800 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-field-muted hover:text-field-header dark:text-moss-400 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Repositori Bukti Literatur (16 Komponen)</span>
          </button>
        </div>

        {/* Loading Spinner */}
        {loadingWeather && !weatherData && (
          <div className="p-12 text-center text-field-muted dark:text-moss-300 font-mono text-xs">
            Mengambil data mikroklimat satelit & riwayat temporal...
          </div>
        )}

        {/* TAB 1: PUSAT KEPUTUSAN & TINDAKAN LAPANGAN */}
        {activeTab === 'decision' && engineOutput && weatherData && (
          <div className="space-y-4">
            
            {/* Quick Status Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* Overall Risk Card */}
              <div className="p-4 rounded-2xl border border-field-border dark:border-field-darkBorder bg-white dark:bg-field-darkCard shadow-tactile flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-mono uppercase text-field-muted dark:text-moss-400">
                    Status Risiko Keseluruhan
                  </div>
                  <div className="font-bold text-base text-field-header dark:text-white mt-0.5">
                    {activeCrop.name} ({effectiveHST} HST)
                  </div>
                  <div className="text-xs text-field-muted dark:text-moss-300 mt-1">
                    {engineOutput.result.stageName}
                  </div>
                </div>
                <RiskBadge level={engineOutput.result.overallRisk} size="lg" />
              </div>

              {/* Water & Irrigation Status Card */}
              <div className="p-4 rounded-2xl border border-field-border dark:border-field-darkBorder bg-white dark:bg-field-darkCard shadow-tactile">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[11px] font-mono uppercase text-field-muted dark:text-moss-400 flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-sky-600" />
                    <span>Status Tata Kelola Air</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                    engineOutput.result.irrigation.status === 'DRAINASE_MENDESAK'
                      ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200'
                      : engineOutput.result.irrigation.status === 'BUTUH_PENGAIRAN'
                      ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200'
                  }`}>
                    {engineOutput.result.irrigation.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-field-header dark:text-white font-medium leading-relaxed">
                  {engineOutput.result.irrigation.recommendation}
                </p>
                <div className="text-[11px] text-field-muted dark:text-moss-400 mt-1">
                  {engineOutput.result.irrigation.rationale}
                </div>
              </div>

              {/* Fertilization Safe Window Card */}
              <div className="p-4 rounded-2xl border border-field-border dark:border-field-darkBorder bg-white dark:bg-field-darkCard shadow-tactile">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[11px] font-mono uppercase text-field-muted dark:text-moss-400 flex items-center gap-1.5">
                    <Sprout className="w-3.5 h-3.5 text-amber-600" />
                    <span>Jendela Aplikasi Pupuk</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                    engineOutput.result.fertilization.safeToApply
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200'
                      : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200'
                  }`}>
                    {engineOutput.result.fertilization.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-field-header dark:text-white font-medium leading-relaxed">
                  {engineOutput.result.fertilization.reason}
                </p>
                <div className="text-[11px] text-field-muted dark:text-moss-400 mt-1 font-mono">
                  Hara Prioritas: {engineOutput.result.fertilization.recommendedNutrient}
                </div>
              </div>

            </div>

            {/* List of Actionable Recommendations */}
            <div className="bg-white dark:bg-field-darkCard border border-field-border dark:border-field-darkBorder rounded-2xl p-4 sm:p-5 shadow-tactile space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-field-header dark:text-white font-display">
                    Instruksi Operasional Lahan (Actionable Agro-Advisory)
                  </h2>
                  <p className="text-xs text-field-muted dark:text-moss-300">
                    Instruksi presisi yang dapat langsung dieksekusi pemilik lahan atau pekerja kebun
                  </p>
                </div>
                <div className="text-xs font-mono text-field-muted dark:text-moss-300">
                  {engineOutput.result.recommendations.length} Rekomendasi Terpicu
                </div>
              </div>

              {engineOutput.result.recommendations.length === 0 ? (
                <div className="p-8 text-center text-field-muted dark:text-moss-300 bg-moss-50/40 dark:bg-moss-950/20 rounded-xl border border-dashed border-field-border dark:border-field-darkBorder text-xs">
                  Tidak ada anomali atau ancaman kritis terdeteksi saat ini. Lanjutkan pemeliharaan rutin.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {engineOutput.result.recommendations.map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      recommendation={rec}
                      onOpenCitation={(id) => setActiveCitationId(id)}
                      onOpenReasoning={(r) => setActiveExplainRec(r)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Financial & Yield Economic Benefit Calculator */}
            <YieldImpactCalculator
              crop={activeCrop}
              overallRisk={engineOutput.result.overallRisk}
              irrigationStatus={engineOutput.result.irrigation.status}
              isFertilizationDelayed={!engineOutput.result.fertilization.safeToApply}
            />

            {/* Microclimate Overview Snapshot */}
            <MicroclimateOverview
              current={weatherData.current}
              features={engineOutput.features}
              dataSourceLabel={weatherData.dataSourceLabel}
            />

          </div>
        )}

        {/* TAB 2: MIKROKLIMAT & ANALISIS TEMPORAL (LAG) */}
        {activeTab === 'weather' && engineOutput && weatherData && (
          <div className="space-y-4">
            <MicroclimateOverview
              current={weatherData.current}
              features={engineOutput.features}
              dataSourceLabel={weatherData.dataSourceLabel}
            />

            <TemporalLagChart
              history={weatherData.history}
              forecast={weatherData.dailyForecast}
              isDark={isDark}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <VPDAnalysisCard
                vpd={engineOutput.features.currentVPD}
                temperature={weatherData.current.temperature}
                rh={weatherData.current.relativeHumidity}
              />

              {/* Temporal Lag Breakdown Card */}
              <div className="bg-white dark:bg-field-darkCard border border-field-border dark:border-field-darkBorder rounded-2xl p-4 sm:p-5 shadow-tactile text-xs">
                <h3 className="text-sm font-bold uppercase tracking-wider text-field-header dark:text-white mb-2 font-display">
                  Variabel Lag yang Mempengaruhi Keputusan
                </h3>
                <p className="text-xs text-field-muted dark:text-moss-300 mb-3">
                  Hubungan cuaca terhadap penyakit pertanian tidak instan. Infeksi jamur membutuhkan jendela waktu spora basah.
                </p>

                <div className="space-y-2 font-mono">
                  <div className="flex justify-between p-2.5 rounded-xl bg-moss-50/50 dark:bg-moss-950/30 border border-field-border dark:border-field-darkBorder">
                    <span>Lag 1 Hari (Kemarin):</span>
                    <strong className="text-field-header dark:text-white tabular-nums">{engineOutput.features.lag1Rain} mm</strong>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-xl bg-moss-50/50 dark:bg-moss-950/30 border border-field-border dark:border-field-darkBorder">
                    <span>Akumulasi 3 Hari Terakhir:</span>
                    <strong className="text-field-header dark:text-white tabular-nums">{engineOutput.features.rolling3dRain} mm</strong>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-xl bg-moss-50/50 dark:bg-moss-950/30 border border-field-border dark:border-field-darkBorder">
                    <span>Hari Hujan Berturut (&gt;= 5mm):</span>
                    <strong className="text-field-header dark:text-white tabular-nums">{engineOutput.features.consecutiveRainyDays} hari</strong>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-xl bg-moss-50/50 dark:bg-moss-950/30 border border-field-border dark:border-field-darkBorder">
                    <span>Hari Kering Berturut (&lt; 1mm):</span>
                    <strong className="text-field-header dark:text-white tabular-nums">{engineOutput.features.consecutiveDryDays} hari</strong>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-xl bg-moss-50/50 dark:bg-moss-950/30 border border-field-border dark:border-field-darkBorder">
                    <span>Rerata Kelembapan 7 Hari:</span>
                    <strong className="text-field-header dark:text-white tabular-nums">{engineOutput.features.rolling7dRH}% RH</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MATRIKS HPT & PENYAKIT */}
        {activeTab === 'diseases' && engineOutput && (
          <div className="space-y-4">
            <DiseaseRiskMatrix
              diseaseRisks={engineOutput.result.diseaseRisks}
              onOpenCitation={(id) => setActiveCitationId(id)}
            />

            {/* Agronomic Disease Prevention Guidelines */}
            <div className="p-4 sm:p-5 rounded-2xl border border-field-border dark:border-field-darkBorder bg-white dark:bg-field-darkCard shadow-tactile text-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-field-header dark:text-white text-sm font-display">
                <ShieldAlert className="w-4 h-4 text-emerald-600" />
                <span>Prinsip Pengelolaan HPT Terpadu (PHT) TaniAdapt</span>
              </div>
              <p className="text-field-muted dark:text-moss-300 leading-relaxed">
                Sistem tidak menganjurkan penyemprotan pestisida/fungisida secara kalender buta. Rekomendasi penyemprotan hanya dipicu ketika parameter mikroklimat (suhu, RH, consecutive rain) berpotensi melipatgandakan inokulum patogen.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-field-border/60 dark:border-field-darkBorder/60 font-mono text-[11px]">
                <div className="p-2.5 rounded-xl bg-moss-50/50 dark:bg-moss-950/30 border border-field-border/60 dark:border-field-darkBorder/60">
                  <strong>Fungisida Protektif: </strong>Gunakan saat peringatan dini sebelum hujan turun (Mancozeb/Propineb).
                </div>
                <div className="p-2.5 rounded-xl bg-moss-50/50 dark:bg-moss-950/30 border border-field-border/60 dark:border-field-darkBorder/60">
                  <strong>Fungisida Kuratif: </strong>Gunakan hanya jika bercak lesi aktif telah ditemukan (Azoksistrobin/Difenokonazol).
                </div>
                <div className="p-2.5 rounded-xl bg-moss-50/50 dark:bg-moss-950/30 border border-field-border/60 dark:border-field-darkBorder/60">
                  <strong>Sanitasi Petak: </strong>Buah atau daun bergejala wajib dimusnahkan di luar lahan pertanian.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REPOSITORI BUKTI LITERATUR (16 KOMPONEN EKSTRAKSI) */}
        {activeTab === 'evidence' && (
          <EvidenceRepository
            onSelectCitation={(id) => setActiveCitationId(id)}
          />
        )}

      </main>

      {/* 3. Footer */}
      <footer className="mt-8 border-t border-field-border dark:border-field-darkBorder bg-white dark:bg-field-darkCard py-4 px-4 sm:px-6 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-field-muted dark:text-moss-400">
          <div>
            TaniAdapt (c) 2026 | Hyperlocal Precision Agro-Advisory System
          </div>
          <div className="flex items-center gap-3">
            <span>Evidence-First Agro-DSS</span>
            <span>•</span>
            <span>5 Crop Engines</span>
            <span>•</span>
            <button
              onClick={() => setIsAuditOpen(true)}
              className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
            >
              Anti-Slop Verified
            </button>
          </div>
        </div>
      </footer>

      {/* 4. Modals */}
      <CitationModal
        citationId={activeCitationId}
        onClose={() => setActiveCitationId(null)}
      />

      <ExplainabilityDialog
        recommendation={activeExplainRec}
        onClose={() => setActiveExplainRec(null)}
      />

      {engineOutput && (
        <ScenarioSandbox
          isOpen={isSandboxOpen}
          onClose={() => setIsSandboxOpen(false)}
          features={engineOutput.features}
          temperature={weatherData?.current.temperature ?? 25}
          rh={weatherData?.current.relativeHumidity ?? 80}
          currentHST={effectiveHST}
          maxHST={activeCrop.totalDurationDays}
          onUpdateScenario={(params) => {
            setScenarioOverrides({ ...scenarioOverrides, ...params });
            setStressMode('CUSTOM');
          }}
          onResetScenario={() => handleStressModeChange('NORMAL')}
        />
      )}

      <AntiSlopBadge
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
      />

      {/* 5. Printable Report Sheet (Only rendered when printing) */}
      {engineOutput && weatherData && (
        <PrintableReport
          location={selectedLocation}
          cropResult={engineOutput.result}
          currentWeather={weatherData.current}
          features={engineOutput.features}
          forecast={weatherData.dailyForecast}
        />
      )}

    </div>
  );
}

export default App;
