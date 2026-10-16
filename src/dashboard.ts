// ============================================================================
// TaniAdapt: Precision Agro-Workstation (TypeScript Driver)
// Mengintegrasikan Decision Engine, Fitur Temporal, Weather API, dan RAG Ilmiah
// ============================================================================

import { INDONESIAN_LOCATIONS, CROP_MODELS, LITERATURE_DATABASE, LiteratureExtraction16 } from './data';
import {
  fetchAgriculturalWeather,
  WeatherFetchResult,
  askGroqAgronomist,
  getStoredUser,
  getStoredProfile,
  getStoredUIMode,
  setStoredUIMode,
  loginUser,
  registerUser,
  clearAuthSession,
  generateAndDownloadWordReport,
  generateSinglePlotAdvanceWordReport,
  generatePortfolioWordReport,
  generatePortfolioAdvanceWordReport,
  PortfolioReportPlot,
  PortfolioAdvancePlot,
  searchLocationsByApi,
  getCurrentGpsPosition,
  GeocodingResult,
  AuthUser,
  UserProfileData,
} from './services';
import { runAgroDecisionEngine, resolveActiveGrowthStage, calculateVPD } from './engine';
import { CropId, AgriculturalLocation, CropEngineResult, RiskLevel, TemporalFeatures } from './types';

// Declare Leaflet global loaded via CDN
declare const L: any;

// ---------- TYPES & INTERFACES ----------
export type StressScenario = 'normal' | 'flood' | 'drought';
export type MetricType = 'hujan' | 'rh' | 'suhu' | 'vpd';
export type UIMode = 'default' | 'pro';

interface PlotTrailItem {
  dayLabel: string;
  weather: string;
  status: string;
  note: string;
}

interface AdminHierarchy {
  displayName: string;
  desa: string;
  kecamatan: string;
  kotaKab: string;
  provinsi: string;
  road?: string;
  latitude: number;
  longitude: number;
}

interface PlotItem {
  id: string;
  name: string;
  locationId: string;
  placeName: string;
  cropId: CropId;
  plantDate: string;
  hst: number;
  stageName: string;
  risk: RiskLevel;
  trail: PlotTrailItem[];
  areaHa?: number;
  adminHierarchy?: {
    provinsi: string;
    kotaKab: string;
    kecamatan: string;
    desa: string;
  };
}

interface ChatMessage {
  me: boolean;
  text: string;
  sourceDoc?: string;
  image?: string;
  fileName?: string;
}

export type DashboardView = 'ringkasan' | 'detail-lahan' | 'cuaca' | 'tanya' | 'lahan' | 'pengaturan';

// ---------- STATE UTAMA ----------
const state = {
  view: 'ringkasan' as DashboardView,
  cropId: 'cabai' as CropId, // Default Cabai / Cabe Merah
  location: INDONESIAN_LOCATIONS[0],
  currentHST: 55,
  metric: 'hujan' as MetricType,
  stressMode: 'normal' as StressScenario,
  uiMode: 'default' as UIMode,
  authUser: null as AuthUser | null,
  authProfile: null as UserProfileData | null,
  isAuthModalOpen: false,
  authTab: 'login' as 'login' | 'register',
  fieldIndex: 0,
  showForm: false,
  isEvidenceModalOpen: false,
  isPrintModalOpen: false,
  reportExportScope: 'single' as 'single' | 'portfolio',
  reportExportMode: 'default' as 'default' | 'advance',
  evidenceFilter: 'all' as string,
  weatherData: null as WeatherFetchResult | null,
  engineResult: null as CropEngineResult | null,
  features: null as TemporalFeatures | null,
  plots: [] as PlotItem[],
  activePlotForBiofisik: -1 as number,
  plotEngineResults: {} as Record<string, { weatherData: WeatherFetchResult | null; engineResult: CropEngineResult | null; features: TemporalFeatures | null }>,
  selectedLanguage: (localStorage.getItem('taniadapt_lang') || 'id') as 'id' | 'su',
  customKnowledgeBase: JSON.parse(localStorage.getItem('taniadapt_custom_kb') || '[]') as string[],
  soilTexture: (localStorage.getItem('taniadapt_soil') || 'loam') as string,
  peffRatio: Number(localStorage.getItem('taniadapt_peff') || '1.0'),
  pendingChatImage: null as string | null,
  pendingChatFileName: null as string | null,
  deletingPlotIndex: -1 as number,
  thread: [
    {
      me: false,
      text: 'Halo! Saya Tania, asisten agronomis TaniAdapt. Saya siap menjelaskan keputusan Decision Engine, dasar ilmiah FAO-56 Penman-Monteith, dan catatan khusus lahan Anda tanpa mengarang takaran kimia.'
    }
  ] as ChatMessage[]
};

// ---------- CONSTANTS & HELPER UI ----------
const CROPS_LIST: { id: CropId; label: string; scientific: string }[] = [
  { id: 'cabai', label: 'Cabai Merah (Besar/Keriting)', scientific: 'Capsicum annuum L.' },
  { id: 'cabai_rawit', label: 'Cabai Rawit (Cengek)', scientific: 'Capsicum frutescens L.' },
  { id: 'padi', label: 'Padi Sawah', scientific: 'Oryza sativa L.' },
  { id: 'jagung', label: 'Jagung Pipil / Hibrida', scientific: 'Zea mays L.' },
  { id: 'kedelai', label: 'Kedelai 17 Sentra Jabar', scientific: 'Glycine max (L.) Merr.' },
  { id: 'tomat', label: 'Tomat Sayur / Buah', scientific: 'Solanum lycopersicum' }
];

// SVG nav icons (monochrome line icons, no emoji)
const NAV_ICONS: Record<string, string> = {
  ringkasan: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
  cuaca: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
  lahan: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
  tanya: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
  pengaturan: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
};

const VIEWS = [
  { id: 'ringkasan', label: 'Rekomendasi Hari Ini' },
  { id: 'lahan', label: 'Lahan Saya' },
  { id: 'tanya', label: 'Chat dengan Tania' },
  { id: 'pengaturan', label: 'Pengaturan' }
];

const TITLES: Record<string, string> = {
  ringkasan: 'Rekomendasi Tindakan Hari Ini',
  'detail-lahan': 'Detail Lahan & Tindakan Lapangan',
  cuaca: 'Analisis Biofisik FAO-56',
  lahan: 'Petak Lahan Saya & Registrasi',
  tanya: 'Chat dengan Tania (Asisten AI RAG)',
  pengaturan: 'Pengaturan Sistem'
};

const RISK_BADGE: Record<string, string> = {
  'TINGGI': 'background: var(--risk); color: #FFFFFF',
  'SEDANG': 'background: #F0C98A; color: #4E2C0A',
  'RENDAH': 'background: #CFE0C4; color: var(--ink)'
};

const STATUS_CHIP: Record<string, string> = {
  'Sehat': 'background: #CFE0C4; color: var(--ink)',
  'Waspada': 'background: #F0C98A; color: #4E2C0A',
  'Risiko tinggi': 'background: var(--risk); color: #FFFFFF'
};

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

function bindText(key: string, text: string) {
  document.querySelectorAll(`[data-bind="${key}"]`).forEach((el) => {
    el.textContent = text;
  });
}

function showToast(message: string, durationMs = 3500) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  if (toast && toastMsg) {
    toastMsg.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, durationMs);
  }
}

function pill(on: boolean, onStyle: string, offStyle: string) {
  return 'min-height: 44px; padding: 0 16px; border-radius: 999px; font: inherit; font-size: 14px; cursor: pointer; ' + (on ? onStyle : offStyle);
}

function getWeatherCodeDescription(code: number): string {
  if (code === 0) return 'Cerah';
  if (code === 1 || code === 2) return 'Cerah Berawan';
  if (code === 3) return 'Berawan';
  if (code >= 51 && code <= 55) return 'Gerimis';
  if (code >= 61 && code <= 65) return 'Hujan Ringan/Sedang';
  if (code >= 80 && code <= 82) return 'Hujan Lokal';
  if (code >= 95) return 'Hujan Petir';
  return 'Berawan';
}

// ---------- SVG ICONS ----------
const ICON_RAIN = '<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#1E4D35" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15a4 4 0 1 1 .9-7.9A5 5 0 0 1 17.5 9 3 3 0 0 1 17 15z"></path><path d="M10 18l-1 2"></path><path d="M14 18l-1 2"></path></svg>';
const ICON_SUN = '<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#A85A12" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 3v2"></path><path d="M12 19v2"></path><path d="M3 12h2"></path><path d="M19 12h2"></path><path d="M5.6 5.6l1.4 1.4"></path><path d="M17 17l1.4 1.4"></path><path d="M5.6 18.4L7 17"></path><path d="M17 7l1.4-1.4"></path></svg>';
const ICON_CLOUD = '<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#33463B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>';

const ICON_ALERT_TRIANGLE = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: -2px; margin-right: 5px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
const ICON_DROPLET = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: -2px; margin-right: 5px"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>';
const ICON_SPROUT = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: -2px; margin-right: 5px"><path d="M7 20h10"></path><path d="M10 20c0-5 3-9 7-11"></path><path d="M17 9c-3 0-6 2-7 5"></path><path d="M14 20c0-3 2-6 5-7"></path></svg>';
const ICON_BAN = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: -2px; margin-right: 5px"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>';
const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: -2px; margin-right: 5px"><path d="M20 6L9 17l-5-5"></path></svg>';

// ---------- INITIALIZE DEFAULT PLOTS ----------
function initDefaultPlots(): PlotItem[] {
  const saved = localStorage.getItem('taniadapt_user_plots_v1');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // ignore parsing error
    }
  }

  // Clean state: mulai dari 0 lahan terdaftar (tanpa dummy mock data)
  return [];
}

// ---------- WEATHER DATA & DECISION CALCULATION ----------
async function recomputeEngine() {
  // 1. Fetch weather
  const weatherRes = await fetchAgriculturalWeather(
    state.location.id,
    state.location.latitude,
    state.location.longitude
  );
  state.weatherData = weatherRes;

  let current = { ...weatherRes.current };
  let history = [...weatherRes.history];
  let forecast = [...weatherRes.dailyForecast];

  // 2. Apply Stress Scenarios if active
  if (state.stressMode === 'flood') {
    current.precipitation = 120.0;
    current.rain = 120.0;
    current.relativeHumidity = 96;
    current.temperature = 22.0;
    current.windSpeed = 16.0;
    current.weatherCode = 65;
    current.vaporPressureDeficit = 0.05;

    // Deluge in last 3 days
    history[history.length - 1].precipitation = 85.0;
    history[history.length - 2].precipitation = 65.0;
    history[history.length - 3].precipitation = 45.0;
  } else if (state.stressMode === 'drought') {
    current.precipitation = 0.0;
    current.rain = 0.0;
    current.relativeHumidity = 52;
    current.temperature = 33.5;
    current.weatherCode = 0;
    current.vaporPressureDeficit = 2.45;

    // Drought in last 14 days
    history = history.map(h => ({
      ...h,
      precipitation: 0.0,
      rhMean: 50 + Math.random() * 5
    }));
  }

  // 3. Run Agro Decision Engine
  const customOverride = state.stressMode === 'flood'
    ? { consecutiveRainyDays: 7, rolling3dRain: 120.5, forecastRain24h: 120.5 }
    : state.stressMode === 'drought'
    ? { consecutiveDryDays: 18, consecutiveRainyDays: 0, rolling7dRain: 0.0, forecastRain48h: 0.0 }
    : undefined;

  const { result, features } = runAgroDecisionEngine(
    state.cropId,
    state.currentHST,
    current,
    history,
    forecast,
    customOverride
  );

  state.engineResult = result;
  state.features = features;

  // 4. Update current active plot risk & HST
  if (state.plots[state.fieldIndex]) {
    state.plots[state.fieldIndex].risk = result.overallRisk;
    state.plots[state.fieldIndex].hst = state.currentHST;
    state.plots[state.fieldIndex].stageName = result.stageName;
    localStorage.setItem('taniadapt_user_plots_v1', JSON.stringify(state.plots));
  }

  render();
}

// ---------- PER-PLOT ENGINE EXECUTION ----------
async function recomputeEngineForPlot(plotIndex: number) {
  const plot = state.plots[plotIndex];
  if (!plot) return;
  const loc = INDONESIAN_LOCATIONS.find(l => l.id === plot.locationId) || INDONESIAN_LOCATIONS[0];
  const plantTime = new Date(plot.plantDate).getTime();
  const nowTime = new Date().getTime();
  const hst = Math.max(1, Math.floor((nowTime - plantTime) / 86400000));
  plot.hst = hst;

  const weatherRes = await fetchAgriculturalWeather(loc.id, loc.latitude, loc.longitude);
  const { result, features } = runAgroDecisionEngine(
    plot.cropId, hst,
    { ...weatherRes.current },
    [...weatherRes.history],
    [...weatherRes.dailyForecast],
    undefined
  );
  plot.risk = result.overallRisk;
  plot.stageName = result.stageName;
  state.plotEngineResults[plot.id] = { weatherData: weatherRes, engineResult: result, features };
  localStorage.setItem('taniadapt_user_plots_v1', JSON.stringify(state.plots));
}

async function recomputeAllPlots() {
  for (let i = 0; i < state.plots.length; i++) {
    await recomputeEngineForPlot(i);
  }
}

// ---------- 6-HOUR HOURLY TIMELINE HELPER ----------
function renderHourlyTimeline(hourlyList: any[] = [], currentTemp: number = 24): string {
  const nowHour = new Date().getHours();
  const slots: string[] = [];
  
  for (let i = 0; i < 6; i++) {
    const h = (nowHour + i) % 24;
    const hourLabel = `${h.toString().padStart(2, '0')}:00`;
    const hData = hourlyList[i] || {
      temperature: currentTemp + (h >= 11 && h <= 14 ? 2 : h >= 18 || h < 6 ? -2.5 : 0),
      precipitation: 0,
      precipitationProbability: 10 + i * 5,
      relativeHumidity: 80 - (h >= 11 && h <= 14 ? 15 : 0)
    };

    const tempVal = typeof hData.temperature === 'number' ? hData.temperature.toFixed(1) : '24.0';
    const rainVal = typeof hData.precipitation === 'number' ? hData.precipitation : 0;
    const probVal = typeof hData.precipitationProbability === 'number' ? Math.round(hData.precipitationProbability) : 15;

    let advice = 'Kondisi Aman';
    let adviceColor = '#166534';
    let adviceBg = '#F0FDF4';

    if (rainVal > 2.0 || probVal > 60) {
      advice = 'Waspada Hujan';
      adviceColor = '#DC2626';
      adviceBg = '#FEF2F2';
    } else if (h >= 6 && h <= 9) {
      advice = 'Jendela Semprot';
      adviceColor = '#166534';
      adviceBg = '#F0FDF4';
    } else if (h >= 11 && h <= 14) {
      advice = 'Terik (Tunda Siram)';
      adviceColor = '#B45309';
      adviceBg = '#FFFBEB';
    } else if (h >= 15 && h <= 17) {
      advice = 'Waktu Siram Sore';
      adviceColor = '#1D4ED8';
      adviceBg = '#EFF6FF';
    }

    slots.push(`
      <div style="flex: 0 0 94px; width: 94px; min-width: 94px; background: ${adviceBg}; border: 1px solid var(--line); border-radius: 12px; padding: 8px 6px; text-align: center; display: flex; flex-direction: column; gap: 3px; box-sizing: border-box">
        <div style="font-size: 11px; font-weight: 700; color: var(--muted)">${hourLabel}</div>
        <div style="font-size: 13px; font-weight: 800; color: var(--ink)">${tempVal}°C</div>
        <div style="font-size: 11px; font-weight: 600; color: ${rainVal > 0 ? '#DC2626' : 'var(--muted)'}">
          ${rainVal > 0 ? `${rainVal.toFixed(1)} mm` : `${probVal}% prob`}
        </div>
        <div style="font-size: 10.5px; font-weight: 700; color: ${adviceColor}; margin-top: 1px; line-height: 1.2" title="${advice}">
          ${advice}
        </div>
      </div>
    `);
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px; padding-top: 10px; border-top: 1px dashed var(--line); width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap">
        <span style="font-size: 12px; font-weight: 700; color: var(--ink)">Prakiraan Agroklimat 6 Jam ke Depan:</span>
        <span style="font-size: 11px; color: var(--muted)">Peluang hujan &amp; jendela tindakan per jam</span>
      </div>
      <div class="hourly-timeline-strip">
        ${slots.join('')}
      </div>
    </div>
  `;
}

// ---------- PER-PLOT FEED RENDERER (Rekomendasi Hari Ini) ----------
function renderPlotFeed() {
  const container = $('#plot-feed-container');
  if (!container) return;

  if (state.plots.length === 0) {
    container.innerHTML = `
      <div style="flex: 1 1 100%; background: #FFFFFF; border: 2px dashed var(--line); border-radius: 18px; padding: 48px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.03)">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        <h3 style="margin: 0; font-size: 20px; font-weight: 800; color: var(--ink)">Belum Ada Petak Lahan Terdaftar</h3>
        <p style="margin: 0; font-size: 14px; color: var(--muted); max-width: 500px; line-height: 1.6">
          Daftarkan petak lahan pertanian Anda agar Decision Engine dapat memberikan rekomendasi tindakan harian per lahan secara presisi.
        </p>
        <button type="button" data-go-lahan style="margin-top: 6px; min-height: 44px; padding: 0 24px; border-radius: 999px; background: var(--green); color: #FFF; border: none; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(30,77,53,0.2)">
          <span>Buka Lahan Saya</span>
        </button>
      </div>
    `;
    return;
  }

  const isRingkas = state.uiMode === 'default';
  container.innerHTML = state.plots.map((plot, idx) => {
    const pr = state.plotEngineResults[plot.id];
    const loc = INDONESIAN_LOCATIONS.find(l => l.id === plot.locationId);
    const locName = loc ? loc.name : plot.placeName;
    const elev = loc ? loc.elevationMeters : 0;

    if (!pr || !pr.engineResult || !pr.features) {
      return `<article style="background: #FFFFFF; border: 1px solid var(--line); border-radius: 18px; padding: 24px; display: flex; flex-direction: column; gap: 12px">
        <h3 style="margin: 0; font-size: 17px; font-weight: 700">${esc(plot.name)}</h3>
        <p style="margin: 0; font-size: 13px; color: var(--muted)">Memuat data cuaca dan analisis engine...</p>
      </article>`;
    }

    const res = pr.engineResult;
    const f = pr.features;
    const cw = pr.weatherData?.current;
    const riskStyle = RISK_BADGE[res.overallRisk] || RISK_BADGE['RENDAH'];

    // Build 3 traffic-light action cards
    const isWaterInsufficient = plot.cropId === 'padi' || plot.cropId === 'cabai' || plot.cropId === 'cabai_rawit';
    const irrigStatus = res.irrigation.status;
    let irrigColor = irrigStatus === 'DRAINASE_MENDESAK' ? '#8A470B' : irrigStatus === 'BUTUH_PENGAIRAN' ? '#1E4D35' : '#166534';
    let irrigBg = irrigStatus === 'DRAINASE_MENDESAK' ? '#FBEFE2' : irrigStatus === 'BUTUH_PENGAIRAN' ? '#F0FDF4' : '#F0FDF4';
    let irrigLabel = irrigStatus === 'DRAINASE_MENDESAK' ? 'Buka Saluran Pembuangan Air' : irrigStatus === 'BUTUH_PENGAIRAN' ? 'Siram Tanaman Secukupnya' : 'Kondisi Air Tanah Cukup';

    if (isWaterInsufficient) {
      irrigColor = 'var(--muted)';
      irrigBg = '#F3F4F6';
      irrigLabel = 'Belum bisa dihitung (bukti belum cukup)';
    }

    const sprayOk = res.overallRisk !== 'TINGGI';
    const sprayColor = sprayOk ? '#166534' : '#8A470B';
    const sprayBg = sprayOk ? '#F0FDF4' : '#FBEFE2';
    const sprayLabel = sprayOk ? 'Aman Semprot Pagi Hari' : 'Tunda Semprot (Daun Terlalu Basah)';

    const fertOk = res.fertilization.safeToApply;
    const fertColor = fertOk ? '#166534' : '#8A470B';
    const fertBg = fertOk ? '#F0FDF4' : '#FBEFE2';
    const fertLabel = fertOk ? 'Aman Beri Pupuk Susulan' : 'Tunda Pemupukan (Risiko Hanyut)';

    const metricRow = isRingkas ? '' : (isWaterInsufficient ? `
      <div style="font-size: 12px; background: #F3F4F6; color: var(--muted); padding: 10px; border-radius: 10px; margin-top: 4px; text-align: center">
        Modul neraca air dinamis belum diaktifkan untuk komoditas ini (status ilmiah: <em>evidence_insufficient</em>).
      </div>
    ` : `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; font-size: 12px; background: var(--ground); padding: 10px; border-radius: 10px; margin-top: 4px">
        <div><div style="color: var(--muted)">ET0</div><div style="font-weight: 700">${res.fao56?.et0_daily_mm !== undefined ? res.fao56.et0_daily_mm.toFixed(1) : '–'} mm/hari</div></div>
        <div><div style="color: var(--muted)">Kc</div><div style="font-weight: 700">${res.fao56?.kc_current !== undefined ? res.fao56.kc_current.toFixed(2) : '–'}</div></div>
        <div><div style="color: var(--muted)">Dr</div><div style="font-weight: 700">${res.fao56?.depletion_dr_mm !== undefined ? res.fao56.depletion_dr_mm.toFixed(1) : '–'} mm</div></div>
        <div><div style="color: var(--muted)">VPD</div><div style="font-weight: 700">${f.currentVPD.toFixed(2)} kPa</div></div>
      </div>
    `);

    return `<article class="plot-card" data-open-detail-plot="${idx}">
      <div class="plot-card-header">
        <div class="plot-card-titles">
          <h3 class="plot-card-name">${esc(plot.name)}</h3>
          <div class="plot-card-meta">${esc(locName)} · ${elev}m dpl · ${CROPS_LIST.find(c => c.id === plot.cropId)?.label || plot.cropId} · ${isRingkas ? `Hari ke-${plot.hst} sejak tanam` : `${plot.hst} HST`} (${res.stageName.replace(/\(\d+–\d+\s*HST\)/g, '').trim()})</div>
        </div>
        <span class="plot-card-badge" style="${riskStyle}">Risiko ${res.overallRisk}</span>
      </div>

      ${cw ? `<div class="plot-weather-strip">
        <span><strong>${cw.temperature.toFixed(1)}°C</strong></span>
        <span>RH ${Math.round(cw.relativeHumidity)}%</span>
        <span>Hujan ${cw.precipitation.toFixed(1)} mm</span>
        <span>Hujan 7d: ${Math.round(f.rolling7dRain)} mm</span>
      </div>` : ''}

      <div class="plot-action-grid">
        <div style="background: ${irrigBg}; border-radius: 12px; padding: 12px; text-align: center; min-width: 0; box-sizing: border-box">
          <div style="font-size: 11px; color: var(--muted); margin-bottom: 4px">Kondisi Air Tanah</div>
          <div style="font-size: 13px; font-weight: 700; color: ${irrigColor}; word-break: break-word">${irrigLabel}</div>
        </div>
        <div style="background: ${sprayBg}; border-radius: 12px; padding: 12px; text-align: center; min-width: 0; box-sizing: border-box">
          <div style="font-size: 11px; color: var(--muted); margin-bottom: 4px">Penyemprotan</div>
          <div style="font-size: 13px; font-weight: 700; color: ${sprayColor}; word-break: break-word">${sprayLabel}</div>
        </div>
        <div style="background: ${fertBg}; border-radius: 12px; padding: 12px; text-align: center; min-width: 0; box-sizing: border-box">
          <div style="font-size: 11px; color: var(--muted); margin-bottom: 4px">Pemupukan</div>
          <div style="font-size: 13px; font-weight: 700; color: ${fertColor}; word-break: break-word">${fertLabel}</div>
        </div>
      </div>

      ${renderHourlyTimeline(pr.weatherData?.hourly, cw?.temperature)}

      ${metricRow}

      <div class="plot-card-actions">
        <button type="button" data-open-detail-plot="${idx}" class="btn-detail-plot btn-action-taktil">
          Buka Detail Lahan Ini &rarr;
        </button>
        ${isRingkas ? `
          <button type="button" data-export-single-docx="default" data-plot-id="${plot.id}" class="btn-action-taktil btn-detail-plot" title="Unduh Panduan Lahan Word" style="font-size: 12.5px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Unduh Panduan (.docx)
          </button>
        ` : `
          <button type="button" data-export-single-docx="advance" data-plot-id="${plot.id}" class="btn-action-taktil btn-detail-plot" title="Unduh Dossier Riset Word" style="border-color: #1E3A8A; color: #1E3A8A; font-size: 12.5px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Unduh Dossier (.docx)
          </button>
        `}
        <button type="button" data-ask-tania-plot="${idx}" class="btn-ask-tania btn-action-taktil">
          Tanya Tania
        </button>
      </div>
    </article>`;
  }).join('');
}

// ---------- ADVANCE BIOPHYSICAL VISUAL ANALYTICS (SVG CHARTS) ----------
function renderAdvanceVisualAnalytics(plot: PlotItem, res: CropEngineResult, f: TemporalFeatures, f56: any, cw: any, daily: any[]): string {
  const rainHistPoints = [
    { label: 'H-6', mm: Math.max(0, (f.rolling7dRain * 0.12)) },
    { label: 'H-5', mm: Math.max(0, (f.rolling7dRain * 0.15)) },
    { label: 'H-4', mm: Math.max(0, (f.rolling7dRain * 0.08)) },
    { label: 'H-3', mm: Math.max(0, (f.rolling7dRain * 0.22)) },
    { label: 'H-2', mm: Math.max(0, (f.rolling7dRain * 0.18)) },
    { label: 'H-1', mm: Math.max(0, (f.rolling7dRain * 0.10)) },
    { label: 'Hari Ini', mm: cw?.precipitation || 0, isToday: true },
    ...(daily.slice(0, 7).map((d: any, idx: number) => ({
      label: `+${idx + 1}d`,
      mm: d.precipitationSum || 0
    })))
  ];

  const maxRain = Math.max(25, ...rainHistPoints.map(p => p.mm));
  const svgH = 150;
  const svgW = 560;
  const barW = 26;
  const gap = (svgW - (rainHistPoints.length * barW)) / (rainHistPoints.length + 1);

  const rainBars = rainHistPoints.map((p, i) => {
    const barHeight = Math.max(4, (p.mm / maxRain) * (svgH - 40));
    const x = gap + i * (barW + gap);
    const y = svgH - 24 - barHeight;
    const barColor = p.mm > 20 ? '#EF4444' : p.mm > 5 ? '#F59E0B' : '#10B981';
    const strokeBorder = (p as any).isToday ? 'stroke="#1E4D35" stroke-width="2"' : '';

    return `
      <g>
        <rect x="${x}" y="${y}" width="${barW}" height="${barHeight}" rx="4" fill="${barColor}" ${strokeBorder}>
          <title>${p.label}: ${p.mm.toFixed(1)} mm</title>
        </rect>
        <text x="${x + barW / 2}" y="${y - 4}" font-size="9.5" font-family="'IBM Plex Mono', monospace" font-weight="700" fill="var(--ink)" text-anchor="middle">${p.mm > 0 ? p.mm.toFixed(0) : '0'}</text>
        <text x="${x + barW / 2}" y="${svgH - 8}" font-size="9" font-family="inherit" fill="var(--muted)" text-anchor="middle">${p.label}</text>
      </g>
    `;
  }).join('');

  const curT = cw?.temperature || 24;
  const curVPD = f.currentVPD || 0.8;
  const tMin = 15;
  const tMax = 35;
  const vpdMax = 4.0;
  const vpdSvgW = 560;
  const vpdSvgH = 150;

  const esPoints: string[] = [];
  for (let t = tMin; t <= tMax; t += 2) {
    const es = 0.61078 * Math.exp((17.27 * t) / (t + 237.3));
    const px = 40 + ((t - tMin) / (tMax - tMin)) * (vpdSvgW - 60);
    const pyEs = vpdSvgH - 25 - (es / vpdMax) * (vpdSvgH - 45);
    esPoints.push(`${px},${pyEs}`);
  }

  const curPx = Math.max(40, Math.min(vpdSvgW - 20, 40 + ((curT - tMin) / (tMax - tMin)) * (vpdSvgW - 60)));
  const curPy = Math.max(15, Math.min(vpdSvgH - 25, vpdSvgH - 25 - (curVPD / vpdMax) * (vpdSvgH - 45)));

  const raw = f56?.raw_mm || 35;
  const taw = f56?.taw_mm || 80;
  const dr = f56?.depletion_dr_mm || 20;
  const rawPct = Math.min(100, Math.max(5, (raw / taw) * 100));
  const drPct = Math.min(100, Math.max(0, (dr / taw) * 100));
  const isStress = dr > raw;

  const kcSvgW = 560;
  const kcSvgH = 140;
  const kcIni = 0.6;
  const kcMid = 1.15;
  const kcEnd = 0.8;
  const dur = 100;
  const hstX = 40 + (Math.min(dur, plot.hst) / dur) * (kcSvgW - 60);
  const curKc = f56?.kc_current || 0.95;
  const hstY = kcSvgH - 25 - ((curKc - 0.4) / 0.9) * (kcSvgH - 45);

  return `
    <div style="display: flex; flex-direction: column; gap: 20px; margin-top: 10px">
      <!-- 1. HISTOGRAM CURAH HUJAN -->
      <div style="background: #FFFFFF; border: 1.5px solid var(--line); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 12px">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px">
          <div>
            <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--ink)">1. Histogram Distribusi Curah Hujan (14 Hari: 7d Riwayat + 7d Prakiraan)</h4>
            <div style="font-size: 12px; color: var(--muted); margin-top: 2px">Ambang batas kebasahan ekstrem: &gt; 20 mm/hari (Zona Bahaya Genangan &amp; Spora Jamur)</div>
          </div>
          <div style="display: flex; gap: 12px; font-size: 11px">
            <span style="display: flex; align-items: center; gap: 5px"><span style="width: 10px; height: 10px; border-radius: 2px; background: #10B981"></span> &le;5mm Aman</span>
            <span style="display: flex; align-items: center; gap: 5px"><span style="width: 10px; height: 10px; border-radius: 2px; background: #F59E0B"></span> 5-20mm Moderat</span>
            <span style="display: flex; align-items: center; gap: 5px"><span style="width: 10px; height: 10px; border-radius: 2px; background: #EF4444"></span> &gt;20mm Ekstrem</span>
          </div>
        </div>

        <div style="overflow-x: auto">
          <svg viewBox="0 0 ${svgW} ${svgH}" style="width: 100%; max-width: ${svgW}px; height: auto; display: block; overflow: visible">
            <line x1="20" y1="${svgH - 24 - (20 / maxRain) * (svgH - 40)}" x2="${svgW - 10}" y2="${svgH - 24 - (20 / maxRain) * (svgH - 40)}" stroke="#EF4444" stroke-dasharray="4 4" stroke-width="1.2" />
            <text x="${svgW - 8}" y="${svgH - 28 - (20 / maxRain) * (svgH - 40)}" font-size="9" fill="#EF4444" font-weight="700" text-anchor="end">Ambang Kritis (20 mm)</text>
            <line x1="10" y1="${svgH - 24}" x2="${svgW - 10}" y2="${svgH - 24}" stroke="var(--line)" stroke-width="1.5" />
            ${rainBars}
          </svg>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; background: var(--ground); padding: 10px 14px; border-radius: 10px; font-size: 12px">
          <div><span style="color: var(--muted)">Akumulasi 7d:</span> <strong>${Math.round(f.rolling7dRain)} mm</strong></div>
          <div><span style="color: var(--muted)">Hari Hujan Beruntun:</span> <strong>${f.consecutiveRainyDays} hari</strong></div>
          <div><span style="color: var(--muted)">Puncak Prediksi:</span> <strong>${Math.max(0, ...daily.slice(0, 7).map((d: any) => d.precipitationSum || 0)).toFixed(1)} mm</strong></div>
          <div><span style="color: var(--muted)">Status Hidrologi:</span> <strong style="color: ${f.consecutiveRainyDays >= 3 ? '#DC2626' : '#166534'}">${f.consecutiveRainyDays >= 3 ? 'Jenuh Air' : 'Seimbang'}</strong></div>
        </div>
      </div>

      <!-- 2. KURVA VPD TETENS & AMBANG BATAS INFEKSI JAMUR -->
      <div style="background: #FFFFFF; border: 1.5px solid var(--line); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 12px">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px">
          <div>
            <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--ink)">2. Kurva Termodinamika Tekanan Uap (Formula Tetens 1930 &amp; Ambang Jamur)</h4>
            <div style="font-size: 12px; color: var(--muted); margin-top: 2px">VPD = e_s(T) &times; (1 - RH/100). Ambang infeksi spora jamur: VPD &lt; 0.4 kPa (Sentelhas et al., 2008)</div>
          </div>
          <span style="font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; ${curVPD < 0.4 ? 'background: #FEE2E2; color: #991B1B' : curVPD <= 1.4 ? 'background: #DCFCE7; color: #166534' : 'background: #FEF3C7; color: #92400E'}">
            ${curVPD < 0.4 ? 'Zona Bahaya Spora Jamur' : curVPD <= 1.4 ? 'Zona Transpirasi Optimal' : 'Zona Cekaman Kekeringan'}
          </span>
        </div>

        <div style="overflow-x: auto">
          <svg viewBox="0 0 ${vpdSvgW} ${vpdSvgH}" style="width: 100%; max-width: ${vpdSvgW}px; height: auto; display: block; overflow: visible">
            <rect x="40" y="${vpdSvgH - 25 - (0.4 / vpdMax) * (vpdSvgH - 45)}" width="${vpdSvgW - 60}" height="${(0.4 / vpdMax) * (vpdSvgH - 45)}" fill="#FEE2E2" opacity="0.6" />
            <text x="${vpdSvgW - 24}" y="${vpdSvgH - 25 - (0.2 / vpdMax) * (vpdSvgH - 45)}" font-size="9" fill="#991B1B" font-weight="700" text-anchor="end">Zona Spora Jamur (&lt;0.4 kPa)</text>
            
            <rect x="40" y="${vpdSvgH - 25 - (1.4 / vpdMax) * (vpdSvgH - 45)}" width="${vpdSvgW - 60}" height="${((1.4 - 0.8) / vpdMax) * (vpdSvgH - 45)}" fill="#DCFCE7" opacity="0.4" />
            <text x="${vpdSvgW - 24}" y="${vpdSvgH - 25 - (1.1 / vpdMax) * (vpdSvgH - 45)}" font-size="9" fill="#166534" font-weight="700" text-anchor="end">Zona Transpirasi Optimal (0.8 - 1.4 kPa)</text>

            <polyline fill="none" stroke="#2563EB" stroke-width="2" points="${esPoints.join(' ')}" />
            <text x="${vpdSvgW - 24}" y="20" font-size="9.5" fill="#2563EB" font-weight="700" text-anchor="end">e_s(T) Tekanan Uap Jenuh</text>

            <line x1="40" y1="${vpdSvgH - 25}" x2="${vpdSvgW - 20}" y2="${vpdSvgH - 25}" stroke="var(--line)" stroke-width="1.5" />
            <line x1="40" y1="15" x2="40" y2="${vpdSvgH - 25}" stroke="var(--line)" stroke-width="1.5" />
            <text x="35" y="${vpdSvgH - 25}" font-size="9" fill="var(--muted)" text-anchor="end">0 kPa</text>
            <text x="35" y="${vpdSvgH - 25 - (2.0 / vpdMax) * (vpdSvgH - 45)}" font-size="9" fill="var(--muted)" text-anchor="end">2.0</text>
            <text x="35" y="20" font-size="9" fill="var(--muted)" text-anchor="end">4.0</text>
            <text x="40" y="${vpdSvgH - 8}" font-size="9" fill="var(--muted)">15°C</text>
            <text x="${40 + ((25 - tMin) / (tMax - tMin)) * (vpdSvgW - 60)}" y="${vpdSvgH - 8}" font-size="9" fill="var(--muted)" text-anchor="middle">25°C</text>
            <text x="${vpdSvgW - 20}" y="${vpdSvgH - 8}" font-size="9" fill="var(--muted)" text-anchor="end">35°C</text>

            <circle cx="${curPx}" cy="${curPy}" r="6" fill="#DC2626" stroke="#FFFFFF" stroke-width="2" />
            <text x="${curPx}" y="${curPy - 10}" font-size="10" font-family="'IBM Plex Mono', monospace" font-weight="800" fill="#DC2626" text-anchor="middle">
              Lahan Ini: ${curVPD.toFixed(2)} kPa (${curT.toFixed(1)}°C)
            </text>
          </svg>
        </div>
      </div>

      <!-- 3. NERACA DEPLESI LENGAS TANAH FAO-56 (Dr vs RAW vs TAW) -->
      <div style="background: #FFFFFF; border: 1.5px solid var(--line); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 14px">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px">
          <div>
            <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--ink)">3. Neraca Deplesi Lengas Tanah Perakaran (FAO-56 Dr vs RAW &amp; TAW)</h4>
            <div style="font-size: 12px; color: var(--muted); margin-top: 2px">RAW = p &times; TAW. Deplesi di atas RAW memicu stres kekurangan air dan penutupan stomata.</div>
          </div>
          <span style="font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; ${isStress ? 'background: #FEE2E2; color: #991B1B' : 'background: #DCFCE7; color: #166534'}">
            ${isStress ? 'Peringatan: Deplesi Melebihi RAW' : 'Kondisi Lengas Aman'}
          </span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px">
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700">
            <span>Kapasitas Lapang (Dr = 0 mm)</span>
            <span style="color: #166534">Ambang Kritis RAW (${raw.toFixed(1)} mm)</span>
            <span style="color: #991B1B">Titik Layu Permanen TAW (${taw.toFixed(1)} mm)</span>
          </div>

          <div style="position: relative; width: 100%; height: 32px; background: #E5E7EB; border-radius: 8px; overflow: hidden; display: flex">
            <div style="width: ${rawPct}%; height: 100%; background: #86EFAC; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #166534">
              Zona Lengas Siap Serap (RAW)
            </div>
            <div style="width: ${100 - rawPct}%; height: 100%; background: #FCA5A5; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #991B1B">
              Zona Cekaman Air (Stress)
            </div>
          </div>

          <div style="position: relative; width: 100%; height: 24px">
            <div style="position: absolute; left: ${Math.min(95, Math.max(3, drPct))}%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center">
              <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 8px solid var(--ink)"></div>
              <span style="font-size: 11px; font-weight: 800; font-family: 'IBM Plex Mono', monospace; color: var(--ink); white-space: nowrap">
                Dr = ${dr.toFixed(1)} mm
              </span>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; background: var(--ground); padding: 12px 14px; border-radius: 10px; font-size: 12.5px">
          <div><span style="color: var(--muted)">TAW Total:</span> <strong>${taw.toFixed(1)} mm</strong></div>
          <div><span style="color: var(--muted)">RAW (p=${(f56?.p_fraction || 0.4).toFixed(2)}):</span> <strong>${raw.toFixed(1)} mm</strong></div>
          <div><span style="color: var(--muted)">Deplesi Saat Ini (Dr):</span> <strong>${dr.toFixed(1)} mm</strong></div>
          <div><span style="color: var(--muted)">Rasio Deplesi/RAW:</span> <strong>${((dr / Math.max(1, raw)) * 100).toFixed(0)}%</strong></div>
        </div>
      </div>

      <!-- 4. KURVA DINAMIKA KOEFISIEN TANAMAN (Kc) -->
      <div style="background: #FFFFFF; border: 1.5px solid var(--line); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 12px">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px">
          <div>
            <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--ink)">4. Dinamika Koefisien Tanaman (FAO-56 Kc Fenologi)</h4>
            <div style="font-size: 12px; color: var(--muted); margin-top: 2px">Pergeseran nilai Kc seiring bertambahnya Hari Setelah Tanam (HST)</div>
          </div>
          <span style="font-size: 12px; font-weight: 700; color: var(--green)">
            Fase Aktif: ${res.stageName} (Kc = ${curKc.toFixed(2)})
          </span>
        </div>

        <div style="overflow-x: auto">
          <svg viewBox="0 0 ${kcSvgW} ${kcSvgH}" style="width: 100%; max-width: ${kcSvgW}px; height: auto; display: block; overflow: visible">
            <polyline fill="none" stroke="var(--green)" stroke-width="2.5" points="
              40,${kcSvgH - 25 - ((kcIni - 0.4) / 0.9) * (kcSvgH - 45)}
              ${40 + 0.2 * (kcSvgW - 60)},${kcSvgH - 25 - ((kcIni - 0.4) / 0.9) * (kcSvgH - 45)}
              ${40 + 0.5 * (kcSvgW - 60)},${kcSvgH - 25 - ((kcMid - 0.4) / 0.9) * (kcSvgH - 45)}
              ${40 + 0.8 * (kcSvgW - 60)},${kcSvgH - 25 - ((kcMid - 0.4) / 0.9) * (kcSvgH - 45)}
              ${kcSvgW - 20},${kcSvgH - 25 - ((kcEnd - 0.4) / 0.9) * (kcSvgH - 45)}
            " />

            <line x1="40" y1="${kcSvgH - 25}" x2="${kcSvgW - 20}" y2="${kcSvgH - 25}" stroke="var(--line)" stroke-width="1.5" />
            <text x="35" y="${kcSvgH - 25 - ((kcIni - 0.4) / 0.9) * (kcSvgH - 45)}" font-size="9" fill="var(--muted)" text-anchor="end">${kcIni}</text>
            <text x="35" y="${kcSvgH - 25 - ((kcMid - 0.4) / 0.9) * (kcSvgH - 45)}" font-size="9" fill="var(--muted)" text-anchor="end">${kcMid}</text>
            
            <text x="${40 + 0.1 * (kcSvgW - 60)}" y="${kcSvgH - 8}" font-size="9" fill="var(--muted)" text-anchor="middle">Awal</text>
            <text x="${40 + 0.35 * (kcSvgW - 60)}" y="${kcSvgH - 8}" font-size="9" fill="var(--muted)" text-anchor="middle">Vegetatif</text>
            <text x="${40 + 0.65 * (kcSvgW - 60)}" y="${kcSvgH - 8}" font-size="9" fill="var(--muted)" text-anchor="middle">Generatif</text>
            <text x="${40 + 0.9 * (kcSvgW - 60)}" y="${kcSvgH - 8}" font-size="9" fill="var(--muted)" text-anchor="middle">Pematangan</text>

            <line x1="${hstX}" y1="15" x2="${hstX}" y2="${kcSvgH - 25}" stroke="#DC2626" stroke-dasharray="3 3" stroke-width="1.5" />
            <circle cx="${hstX}" cy="${hstY}" r="5" fill="#DC2626" stroke="#FFFFFF" stroke-width="2" />
            <text x="${hstX}" y="12" font-size="10" font-family="'IBM Plex Mono', monospace" font-weight="700" fill="#DC2626" text-anchor="middle">
              Hari Ini (${plot.hst} Hari, Kc=${curKc.toFixed(2)})
            </text>
          </svg>
        </div>
      </div>
    </div>
  `;
}

// ---------- DEDICATED VIEW: DETAIL LAHAN [NAMA PETAK] ----------
function renderDetailLahan() {
  const plot = state.plots[state.fieldIndex] || state.plots[0];
  if (!plot) return;

  const nameEl = $('#detail-plot-name');
  const metaEl = $('#detail-plot-meta');
  const crop = CROPS_LIST.find(c => c.id === plot.cropId);
  const loc = INDONESIAN_LOCATIONS.find(l => l.id === plot.locationId);
  const locName = loc ? loc.name : plot.placeName;
  const elev = loc ? loc.elevationMeters : 1200;

  if (nameEl) nameEl.textContent = plot.name;
  if (metaEl) {
    metaEl.textContent = `${locName} (${elev} mdpl) · ${crop?.label || plot.cropId} (${crop?.scientific || ''}) · Umur Tanaman: ${plot.hst} Hari Setelah Tanam · Fase: ${plot.stageName}`;
  }

  const container = $('#detail-lahan-content');
  if (!container) return;

  const pr = state.plotEngineResults[plot.id];
  const res = pr?.engineResult || state.engineResult;
  const f = pr?.features || state.features;
  const cw = pr?.weatherData?.current || state.weatherData?.current;
  const daily = pr?.weatherData?.dailyForecast || state.weatherData?.dailyForecast || [];
  const isAdv = state.uiMode === 'pro';

  // Risk & Badges
  const risk = res?.overallRisk || plot.risk || 'RENDAH';
  const riskStyle = RISK_BADGE[risk] || RISK_BADGE['RENDAH'];

  // 3-Action Status
  const irrigStatus = res?.irrigation?.status;
  const irrigLabel = irrigStatus === 'DRAINASE_MENDESAK' ? 'Buka Saluran Pembuangan Air' : irrigStatus === 'BUTUH_PENGAIRAN' ? 'Siram Tanaman Secukupnya' : 'Kondisi Air Tanah Cukup';
  const irrigColor = irrigStatus === 'DRAINASE_MENDESAK' ? '#8A470B' : '#166534';
  const irrigBg = irrigStatus === 'DRAINASE_MENDESAK' ? '#FBEFE2' : '#F0FDF4';

  const sprayOk = risk !== 'TINGGI';
  const sprayLabel = sprayOk ? 'Aman Semprot Pagi Hari' : 'Tunda Semprot (Daun Terlalu Basah)';
  const sprayColor = sprayOk ? '#166534' : '#8A470B';
  const sprayBg = sprayOk ? '#F0FDF4' : '#FBEFE2';

  const fertOk = res?.fertilization?.safeToApply ?? true;
  const fertLabel = fertOk ? 'Aman Beri Pupuk Susulan' : 'Tunda Pemupukan (Risiko Hanyut)';
  const fertColor = fertOk ? '#166534' : '#8A470B';
  const fertBg = fertOk ? '#F0FDF4' : '#FBEFE2';

  // Checklist Task Cards (Tandai Selesai)
  const todayIso = new Date().toISOString().slice(0, 10);
  const recoCards = (res?.recommendations || []).map((r, rIdx) => {
    const taskKey = `task_${plot.id}_${todayIso}_${rIdx}_${r.title.slice(0, 8).replace(/\s+/g, '_')}`;
    const isDone = localStorage.getItem(taskKey) === 'done';

    let urgencyLabel = r.urgency === 'HARI_INI' ? 'Tindakan Hari Ini' : r.urgency === '24_48_JAM' ? '1-2 Hari Lagi' : 'Pencegahan Rutin';
    let urgencyBg = r.urgency === 'HARI_INI' ? '#FEE2E2' : r.urgency === '24_48_JAM' ? '#FEF3C7' : '#DCFCE7';
    let urgencyColor = r.urgency === 'HARI_INI' ? '#991B1B' : r.urgency === '24_48_JAM' ? '#92400E' : '#166534';

    let actionClean = esc(r.action)
      .replace(/24_48_jam/g, '1 - 2 Hari Lagi')
      .replace(/HARI_INI/g, 'Hari Ini')
      .replace(/lengas tanah/gi, 'kondisi air tanah')
      .replace(/HST/g, 'Hari Setelah Tanam');

    return `
      <div style="background: #FFFFFF; border: 1.5px solid ${isDone ? '#86EFAC' : 'var(--line)'}; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 8px; ${isDone ? 'background: #F0FDF4;' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap">
          <span style="font-weight: 700; font-size: 14px; color: ${isDone ? '#166534' : 'var(--green)'}">
            ${isDone ? '<span style="color: #166534; margin-right: 6px">&check;</span>' : ''}${esc(r.title)}
          </span>
          <div style="display: flex; align-items: center; gap: 8px">
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 700; background: ${urgencyBg}; color: ${urgencyColor}">
              ${urgencyLabel}
            </span>
            ${isDone ? `
              <button type="button" data-unmark-done="${taskKey}" style="border: none; background: #DCFCE7; color: #166534; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; cursor: pointer" title="Batalkan status selesai">
                &check; Selesai Dikerjakan
              </button>
            ` : `
              <button type="button" data-mark-done="${taskKey}" style="border: 1px solid var(--green); background: var(--sage); color: var(--green); font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; cursor: pointer">
                Tandai Sudah Dikerjakan
              </button>
            `}
          </div>
        </div>
        <p style="margin: 0; font-size: 13.5px; color: var(--ink); line-height: 1.5">${actionClean}</p>
        ${r.rationale ? `<div style="font-size: 12px; color: var(--muted); border-top: 1px dashed var(--line); padding-top: 6px">${esc(r.rationale)}</div>` : ''}
      </div>
    `;
  }).join('');

  // 7-day forecast cards
  const forecastCards = daily.slice(0, 7).map(d => {
    const dayName = new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'numeric' });
    const desc = getWeatherCodeDescription(d.weatherCode);
    return `
      <div style="background: #FFFFFF; border: 1px solid var(--line); border-radius: 12px; padding: 12px 10px; text-align: center; display: flex; flex-direction: column; gap: 4px; min-width: 90px; flex: 1">
        <div style="font-size: 11px; font-weight: 700; color: var(--muted)">${dayName}</div>
        <div style="font-size: 13px; font-weight: 700; color: var(--ink)">${d.tempMax.toFixed(0)}° / ${d.tempMin.toFixed(0)}°</div>
        <div style="font-size: 12px; font-weight: 600; color: var(--green)">${d.precipitationSum.toFixed(1)} mm</div>
        <div style="font-size: 10px; color: var(--muted)">${desc}</div>
      </div>
    `;
  }).join('');

  // Field Notes History List
  const trailList = (plot.trail || []).slice().reverse().map(t => `
    <div style="background: var(--ground); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px">
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span style="font-size: 12px; font-weight: 700; color: var(--ink)">${esc(t.dayLabel)}</span>
        <span style="font-size: 11px; color: var(--muted)">${esc(t.status || 'Tercatat')}</span>
      </div>
      <div style="font-size: 13px; color: var(--ink); line-height: 1.4">${esc(t.note || '-')}</div>
    </div>
  `).join('');

  // Advance Biophysical Panel
  const f56 = res?.fao56;
  const advanceSection = isAdv ? `
    <section style="background: #FFFFFF; border: 1.5px solid var(--green); border-radius: 18px; padding: 24px; display: flex; flex-direction: column; gap: 16px">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); padding-bottom: 12px; flex-wrap: wrap; gap: 8px">
        <div style="display: flex; align-items: center; gap: 8px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
          <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: var(--green)">Dossier Biofisik FAO-56 Penman-Monteith (Advance)</h3>
        </div>
        <button type="button" id="trigger-evidence-modal-btn" style="min-height: 32px; padding: 0 12px; border-radius: 999px; background: var(--accent); color: var(--ink); border: none; font-size: 11px; font-weight: 700; cursor: pointer">
          Lihat Registry Bukti Ilmiah (16 Paper)
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px">
        <div style="background: var(--ground); border-radius: 12px; padding: 12px">
          <div style="font-size: 11px; color: var(--muted)">Evapotranspirasi Ref (ETo)</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--ink); margin-top: 4px">${f56?.et0_daily_mm?.toFixed(1) ?? '-'} mm/hari</div>
          <div style="font-size: 10.5px; color: var(--muted)">FAO-56 PM Hourly</div>
        </div>
        <div style="background: var(--ground); border-radius: 12px; padding: 12px">
          <div style="font-size: 11px; color: var(--muted)">Koefisien Tanaman (Kc)</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--ink); margin-top: 4px">${f56?.kc_current?.toFixed(2) ?? '-'}</div>
          <div style="font-size: 10.5px; color: var(--muted)">Riset BB Padi/Balitsa</div>
        </div>
        <div style="background: var(--ground); border-radius: 12px; padding: 12px">
          <div style="font-size: 11px; color: var(--muted)">Kebutuhan Air (ETc)</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--ink); margin-top: 4px">${f56?.etc_daily_mm?.toFixed(1) ?? '-'} mm/hari</div>
          <div style="font-size: 10.5px; color: var(--muted)">Kc × ETo</div>
        </div>
        <div style="background: var(--ground); border-radius: 12px; padding: 12px">
          <div style="font-size: 11px; color: var(--muted)">Deplesi Lengas (Dr)</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--ink); margin-top: 4px">${f56?.depletion_dr_mm?.toFixed(1) ?? '-'} mm</div>
          <div style="font-size: 10.5px; color: var(--muted)">RAW: ${f56?.raw_mm?.toFixed(1) ?? '-'} mm</div>
        </div>
        <div style="background: var(--ground); border-radius: 12px; padding: 12px">
          <div style="font-size: 11px; color: var(--muted)">Vapor Pressure Deficit</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--ink); margin-top: 4px">${f?.currentVPD?.toFixed(2) ?? '-'} kPa</div>
          <div style="font-size: 10.5px; color: var(--muted)">Formula Tetens 1930</div>
        </div>
      </div>

      <div style="background: var(--ground); border-radius: 12px; padding: 14px; font-size: 12.5px; line-height: 1.5; color: var(--ink)">
        <strong>Kondisi Neraca Lengas:</strong> RAW = ${f56?.raw_mm?.toFixed(1) ?? '-'} mm | TAW = ${f56?.taw_mm?.toFixed(1) ?? '-'} mm | Deplesi Dr = ${f56?.depletion_dr_mm?.toFixed(1) ?? '-'} mm.<br/>
        ${f56?.depletion_dr_mm !== undefined && f56?.raw_mm !== undefined && f56.depletion_dr_mm > f56.raw_mm ? '<span style="color: #DC2626; font-weight: 700">Deplesi melampaui RAW: Tanaman memasuki ambang batas cekaman air!</span>' : '<span style="color: #166534; font-weight: 600">Deplesi masih dalam batas RAW: Lengas tanah aman untuk transpirasi optimal.</span>'}
      </div>

      ${f && f56 ? renderAdvanceVisualAnalytics(plot, res!, f, f56, cw, daily) : ''}
    </section>
  ` : '';

  container.innerHTML = `
    <!-- TOP ACTION BAR: BACK BUTTON ONLY (PRINT MOVED OUTSIDE AS REQUESTED) -->
    <div style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 8px">
      <button type="button" data-view-btn="ringkasan" class="btn-action-taktil" style="background: none; border: 1px solid var(--line); border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--ink); display: inline-flex; align-items: center; gap: 6px">
        &larr; Kembali ke Ringkasan Lahan
      </button>
    </div>

    <!-- STATUS & 3-ACTION CARDS -->
    <section style="display: flex; flex-direction: column; gap: 14px">
      <div style="display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; border: 1px solid var(--line); border-radius: 16px; padding: 16px 20px">
        <div style="display: flex; align-items: center; gap: 10px">
          <span style="font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 999px; ${riskStyle}">Tingkat Risiko: ${risk}</span>
          <span style="font-size: 13px; color: var(--muted)">Suhu: <strong>${cw ? cw.temperature.toFixed(1) + '°C' : '-'}</strong> | RH: <strong>${cw ? Math.round(cw.relativeHumidity) + '%' : '-'}</strong></span>
        </div>
        <button type="button" data-ask-tania-plot="${state.fieldIndex}" style="padding: 6px 14px; border-radius: 999px; background: var(--green); color: #FFF; border: none; font-size: 12px; font-weight: 700; cursor: pointer">
          Tanya Tania Soal Petak Ini
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px">
        <div style="background: ${irrigBg}; border: 1px solid rgba(0,0,0,0.06); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 6px">
          <div style="font-size: 12px; font-weight: 700; color: var(--muted)">Kondisi Air Tanah &amp; Irigasi</div>
          <div style="font-size: 16px; font-weight: 800; color: ${irrigColor}">${irrigLabel}</div>
          <div style="font-size: 13px; color: var(--ink); line-height: 1.4">
            ${res?.irrigation?.recommendation || (irrigStatus === 'DRAINASE_MENDESAK' ? 'Buka saluran pembuangan air agar perakaran tidak terendam.' : 'Kondisi air tanah terjaga optimal.')}
          </div>
        </div>
        <div style="background: ${sprayBg}; border: 1px solid rgba(0,0,0,0.06); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 6px">
          <div style="font-size: 12px; font-weight: 700; color: var(--muted)">Jendela Penyemprotan &amp; OPT</div>
          <div style="font-size: 16px; font-weight: 800; color: ${sprayColor}">${sprayLabel}</div>
          <div style="font-size: 13px; color: var(--ink); line-height: 1.4">
            ${sprayOk ? 'Waktu pagi hari aman untuk aplikasi perlindungan tanaman.' : 'Tunda semprotan cair. Kebasahan daun tinggi berisiko membilas bahan aktif.'}
          </div>
        </div>
        <div style="background: ${fertBg}; border: 1px solid rgba(0,0,0,0.06); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 6px">
          <div style="font-size: 12px; font-weight: 700; color: var(--muted)">Aplikasi Pemupukan</div>
          <div style="font-size: 16px; font-weight: 800; color: ${fertColor}">${fertLabel}</div>
          <div style="font-size: 13px; color: var(--ink); line-height: 1.4">
            ${fertOk ? 'Kondisi tanah siap menyerap nutrisi tanpa risiko pelindian cepat.' : 'Hindari aplikasi pupuk larut air saat hujan deras diprediksi turun.'}
          </div>
        </div>
      </div>

      ${renderHourlyTimeline(pr?.weatherData?.hourly || state.weatherData?.hourly, cw?.temperature)}
    </section>

    <!-- OPERATIONAL ACTION ADVISORY (WITH CHECKLIST) -->
    <section style="display: flex; flex-direction: column; gap: 12px">
      <div style="display: flex; justify-content: space-between; align-items: center">
        <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--ink)">Rencana Tindakan Lapangan Lengkap (Checklist Harian)</h3>
        <span style="font-size: 12px; color: var(--muted)">Status tersimpan otomatis</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px">
        ${recoCards || '<div style="background: #FFF; padding: 16px; border-radius: 12px; border: 1px solid var(--line); font-size: 13px; color: var(--muted)">Belum ada rekomendasi khusus.</div>'}
      </div>
    </section>

    <!-- 7-DAY WEATHER FORECAST -->
    <section style="background: #FFFFFF; border: 1px solid var(--line); border-radius: 18px; padding: 20px 24px; display: flex; flex-direction: column; gap: 14px">
      <div style="display: flex; justify-content: space-between; align-items: center">
        <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--ink)">Prakiraan Agroklimat 7 Hari Mendatang</h3>
        <span style="font-size: 12px; color: var(--muted)">Open-Meteo High-Resolution Model</span>
      </div>
      <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px">
        ${forecastCards}
      </div>
    </section>

    <!-- CATATAN LAHAN & SINKRONISASI KE RAG TANIA -->
    <section style="background: #FFFFFF; border: 1px solid var(--line); border-radius: 18px; padding: 24px; display: flex; flex-direction: column; gap: 16px">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); padding-bottom: 12px">
        <div>
          <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--ink)">Logbook &amp; Catatan Pengamatan Lahan</h3>
          <p style="margin: 2px 0 0; font-size: 12.5px; color: var(--muted)">Catat pengamatan hama, penyiraman, atau kondisi fisik tanaman di petak ini.</p>
        </div>
        <span style="font-size: 11px; background: var(--sage); color: var(--green); padding: 4px 10px; border-radius: 999px; font-weight: 700">
          Auto-Sync RAG Tania Aktif
        </span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px">
        <textarea id="detail-note-input" rows="2" placeholder="Tuliskan catatan lapangan hari ini (misal: Daun bawah mulai menguning sedikit, atau baru selesai siram 500 liter)..." style="width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1.5px solid var(--field-line); border-radius: 12px; font: inherit; font-size: 13.5px; line-height: 1.5; background: var(--field)"></textarea>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <button type="button" id="detail-add-note-btn" style="min-height: 38px; padding: 0 18px; border-radius: 999px; background: var(--green); color: #FFF; border: none; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px">
            <span>+ Simpan Catatan &amp; Sinkronkan ke Tania</span>
          </button>
          <span style="font-size: 12px; color: var(--muted)">Tania akan langsung mengingat catatan ini saat Anda berdialog.</span>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--line); padding-top: 14px">
        <div style="font-size: 13px; font-weight: 700; color: var(--ink)">Riwayat Pengamatan di Petak Ini:</div>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto">
          ${trailList || '<div style="font-size: 13px; color: var(--muted); font-style: italic">Belum ada catatan untuk petak ini. Tulis catatan pertama di atas.</div>'}
        </div>
      </div>
    </section>

    ${advanceSection}
  `;
}

// ---------- BIOFISIK PLOT BANNER ----------
function renderBiofisikPlotBanner() {
  const nameEl = $('#biofisik-plot-name');
  const metaEl = $('#biofisik-plot-meta');
  const idx = state.activePlotForBiofisik;
  const plot = state.plots[idx];
  if (plot && nameEl) {
    nameEl.textContent = plot.name;
    const loc = INDONESIAN_LOCATIONS.find(l => l.id === plot.locationId);
    if (metaEl) metaEl.textContent = `${loc?.name || plot.placeName} · ${CROPS_LIST.find(c => c.id === plot.cropId)?.label || plot.cropId} · ${plot.hst} HST`;
  } else if (nameEl) {
    nameEl.textContent = state.plots.length > 0 ? 'Pilih lahan dari Rekomendasi Hari Ini' : 'Belum ada lahan terdaftar';
    if (metaEl) metaEl.textContent = '';
  }
}
function renderNav() {
  const container = $('#nav');
  if (container) {
    const activeViews = state.uiMode === 'pro'
      ? [
          { id: 'ringkasan', label: 'Rekomendasi Hari Ini' },
          { id: 'cuaca', label: 'Riset FAO-56' },
          { id: 'lahan', label: 'Lahan Saya' },
          { id: 'tanya', label: 'Chat dengan Tania' },
          { id: 'pengaturan', label: 'Pengaturan' }
        ]
      : VIEWS;

    container.innerHTML = activeViews.map((v) => {
      const on = state.view === v.id;
      const icon = NAV_ICONS[v.id] || '';
      const style = 'text-align: left; width: 100%; min-height: 44px; padding: 0 14px; border-radius: 10px; border: none; font: inherit; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; ' +
        (on ? 'background: var(--accent); color: var(--ink); font-weight: 700' : 'background: transparent; color: #DCE8D8');
      return `<button type="button" class="ta-nav-item btn-action-taktil" data-view-btn="${v.id}" title="${v.label}" ${on ? 'aria-current="page"' : ''} style="${style}">
        <span style="display: flex; align-items: center; gap: 8px">${icon}<span class="ta-nav-text">${v.label}</span></span>
        ${on ? '<svg class="ta-nav-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>' : ''}
      </button>`;
    }).join('');
  }

  // Update mobile bottom nav active tabs
  document.querySelectorAll('.mobile-nav-tab').forEach((tab) => {
    const btn = tab as HTMLElement;
    const isActive = btn.dataset.tab === state.view;
    if (isActive) {
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.classList.remove('active');
      btn.removeAttribute('aria-current');
    }
  });
}

function updateCoordinateDisplay() {
  const coordEl = $('#coord-display');
  const elevEl = $('#elev-display');
  if (coordEl) {
    coordEl.textContent = `${state.location.latitude.toFixed(4)}, ${state.location.longitude.toFixed(4)}`;
  }
  if (elevEl) {
    elevEl.textContent = `Elevasi: ${state.location.elevationMeters} mdpl`;
  }
}

function renderActivePlotSelector() {
  const select = $('#active-plot-select') as HTMLSelectElement;
  if (!select) return;

  if (state.plots.length === 0) {
    select.innerHTML = '<option value="-1">Simulasi Bebas (Belum Ada Petak)</option>';
    select.disabled = true;
    return;
  }

  select.disabled = false;
  let optionsHtml = '<option value="-1">Simulasi Bebas (Manual)</option>';
  optionsHtml += state.plots.map((p, idx) => {
    const isSelected = state.fieldIndex === idx;
    return `<option value="${idx}" ${isSelected ? 'selected' : ''}>${p.name} • ${p.placeName.split('(')[0].trim()} (${p.hst} HST)</option>`;
  }).join('');

  select.innerHTML = optionsHtml;
}

function renderLocationDropdown() {
  const isPredefined = INDONESIAN_LOCATIONS.some(l => l.id === state.location.id);
  let optionsHtml = INDONESIAN_LOCATIONS.map((loc) => {
    const sel = loc.id === state.location.id ? 'selected' : '';
    return `<option value="${loc.id}" ${sel}>${loc.name} (${loc.elevationMeters}m dpl)</option>`;
  }).join('');

  if (!isPredefined) {
    const locPrefix = (state.location as any).district || (state.location as any).village
      ? `[Presisi] ${state.location.name}`
      : `[GPS/Peta] ${state.location.name}`;
    optionsHtml = `<option value="${state.location.id}" selected>${locPrefix} (${state.location.latitude.toFixed(4)}, ${state.location.longitude.toFixed(4)})</option>` + optionsHtml;
  }

  const select = $('#lokasi-select') as HTMLSelectElement | null;
  if (select) {
    select.innerHTML = optionsHtml;
  }

  const modalSelect = $('#ll') as HTMLSelectElement | null;
  if (modalSelect) {
    modalSelect.innerHTML = optionsHtml;
  }

  updateCoordinateDisplay();
}

function renderCrops() {
  const container = $('#crops');
  if (!container) return;

  container.innerHTML = CROPS_LIST.map((c) => {
    const on = state.cropId === c.id;
    return `<button type="button" data-crop="${c.id}" aria-pressed="${on}" style="${pill(on,
      'background: var(--green); color: #FFFFFF; border: 1px solid var(--green); font-weight: 700; box-shadow: 0 2px 6px rgba(30,77,53,0.35)',
      'background: var(--field); color: var(--ink); border: 1px solid var(--field-line)')}">
      ${c.label}
    </button>`;
  }).join('');
}

function renderGrowthStages() {
  const select = $('#fase') as HTMLSelectElement;
  if (!select) return;

  const crop = CROP_MODELS[state.cropId];
  if (!crop) return;

  const activeStage = resolveActiveGrowthStage(state.cropId, state.currentHST);

  select.innerHTML = crop.growthStages.map((stage) => {
    const isSelected = stage.id === activeStage.id ? 'selected' : '';
    return `<option value="${stage.id}" ${isSelected}>${stage.name} (${stage.minHST}–${stage.maxHST} HST)</option>`;
  }).join('');

  const umurInput = $('#umur') as HTMLInputElement;
  if (umurInput && document.activeElement !== umurInput) {
    umurInput.value = String(state.currentHST);
    umurInput.max = String(crop.totalDurationDays);
  }
}

function renderStressBar() {
  document.querySelectorAll('[data-stress]').forEach((btn) => {
    const b = btn as HTMLButtonElement;
    const mode = b.dataset.stress;
    const on = state.stressMode === mode;
    b.setAttribute('aria-pressed', String(on));
    if (on) {
      b.style.background = mode === 'flood' ? '#1E4D35' : mode === 'drought' ? '#A85A12' : 'var(--ink)';
      b.style.color = '#FFFFFF';
    } else {
      b.style.background = 'transparent';
      b.style.color = 'var(--ink)';
    }
  });
}

function renderRiskCard() {
  if (!state.engineResult) return;
  const res = state.engineResult;

  const riskText = $('#risk-value-text');
  const riskBadge = $('#risk-score-badge');
  const card = $('#risk-card');

  if (riskText) {
    riskText.textContent = res.overallRisk === 'TINGGI' ? 'Tinggi' : res.overallRisk === 'SEDANG' ? 'Sedang' : 'Rendah';
  }

  if (riskBadge) {
    riskBadge.textContent = `Status: ${res.overallRisk}`;
  }

  // Adjust styling based on risk
  if (card) {
    if (res.overallRisk === 'TINGGI') {
      card.style.background = 'var(--risk-bg)';
      card.style.borderColor = '#EBC9A3';
      if (riskText) riskText.style.color = 'var(--risk-strong)';
    } else if (res.overallRisk === 'SEDANG') {
      card.style.background = '#FFF9EE';
      card.style.borderColor = '#F0C98A';
      if (riskText) riskText.style.color = '#8A5D12';
    } else {
      card.style.background = '#F4F7F0';
      card.style.borderColor = '#CBD3BE';
      if (riskText) riskText.style.color = 'var(--green)';
    }
  }

  // Gauge bar
  const gLow = $('#gauge-low');
  const gMed = $('#gauge-med');
  const gHigh = $('#gauge-high');
  if (gLow && gMed && gHigh) {
    gLow.style.opacity = res.overallRisk === 'RENDAH' ? '1' : '0.4';
    gMed.style.opacity = res.overallRisk === 'SEDANG' ? '1' : '0.4';
    gHigh.style.opacity = res.overallRisk === 'TINGGI' ? '1' : '0.4';
    if (res.overallRisk === 'TINGGI') gHigh.style.outline = '2px solid var(--risk-strong)';
    else gHigh.style.outline = 'none';
  }

  // Pathogen breakdown
  const breakdown = $('#pathogen-breakdown');
  if (breakdown) {
    breakdown.innerHTML = res.diseaseRisks.map((d) => {
      const isHigh = d.level === 'TINGGI';
      return `<div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px">
        <div>
          <strong style="color: var(--ink)">${d.diseaseName}</strong>
          <span style="font-size: 11px; font-style: italic; color: var(--muted); margin-left: 4px">(${d.pathogen})</span>
        </div>
        <span style="font-family: 'IBM Plex Mono', monospace; font-weight: 700; ${isHigh ? 'color: var(--risk-strong)' : 'color: var(--text-2)'}">
          ${d.score}% (${d.level})
        </span>
      </div>`;
    }).join('');
  }

  // Summary Text
  const summaryEl = $('#risk-summary-text');
  if (summaryEl) {
    summaryEl.textContent = res.temporalSummary;
  }
}

function renderRecommendations() {
  if (!state.engineResult) return;
  const res = state.engineResult;

  // Status Alerts tags
  const alertsContainer = $('#status-alerts');
  if (alertsContainer) {
    let tagsHtml = '';

    if (res.irrigation.status === 'DRAINASE_MENDESAK') {
      tagsHtml += `<span style="display: inline-flex; align-items: center; font-size: 12px; font-weight: 700; background: #8A470B; color: #FFFFFF; padding: 4px 12px; border-radius: 999px">${ICON_ALERT_TRIANGLE}DRAINASE MENDESAK</span>`;
    } else if (res.irrigation.status === 'BUTUH_PENGAIRAN') {
      tagsHtml += `<span style="display: inline-flex; align-items: center; font-size: 12px; font-weight: 700; background: #1E4D35; color: #FFFFFF; padding: 4px 12px; border-radius: 999px">${ICON_DROPLET}BUTUH PENGAIRAN</span>`;
    } else {
      tagsHtml += `<span style="display: inline-flex; align-items: center; font-size: 12px; font-weight: 600; background: var(--sage); color: var(--ink); padding: 4px 12px; border-radius: 999px">${ICON_SPROUT}LENGAS TANAH OPTIMAL</span>`;
    }

    if (!res.fertilization.safeToApply) {
      tagsHtml += `<span style="display: inline-flex; align-items: center; font-size: 12px; font-weight: 700; background: #F0C98A; color: #4E2C0A; padding: 4px 12px; border-radius: 999px">${ICON_BAN}TUNDA PEMUPUKAN (RAWAN PUPUK HANYUT)</span>`;
    } else {
      tagsHtml += `<span style="display: inline-flex; align-items: center; font-size: 12px; font-weight: 600; background: #CFE0C4; color: var(--ink); padding: 4px 12px; border-radius: 999px">${ICON_CHECK}JENDELA PEMUPUKAN AMAN</span>`;
    }

    alertsContainer.innerHTML = tagsHtml;
  }

  // Recommendation List items
  const list = $('#recommendations-list');
  if (list) {
    list.innerHTML = res.recommendations.map((r, i) => {
      const isUrgent = r.urgency === 'HARI_INI';
      const urgencyLabel = r.urgency === 'HARI_INI' ? 'Hari ini' : r.urgency === '24_48_JAM' ? '24–48 Jam' : 'Rutin';
      return `<li style="display: flex; gap: 12px; align-items: flex-start; background: var(--ground); padding: 12px 14px; border-radius: 12px">
        <span style="flex: none; width: 26px; height: 26px; border-radius: 8px; background: ${isUrgent ? 'var(--risk)' : 'var(--green)'}; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">
          ${i + 1}
        </span>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 3px">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <strong style="font-size: 14px; color: var(--ink)">${r.title}</strong>
            <span style="font-size: 11px; font-weight: 700; ${isUrgent ? 'color: var(--risk-strong)' : 'color: var(--green)'}">${urgencyLabel}</span>
          </div>
          <span style="font-size: 13px; color: var(--text-2); line-height: 1.4">${r.action}</span>
          ${state.uiMode === 'pro'
            ? `<span style="font-size: 11px; color: var(--muted); margin-top: 4px; font-family: 'IBM Plex Mono', monospace">${r.category} &bull; ${r.rationale} &bull; ${r.literatureSource || 'FAO-56'}</span>`
            : `<span style="font-size: 12px; color: var(--green); margin-top: 4px; font-weight: 600">${r.rationale}</span>`
          }
        </div>
      </li>`;
    }).join('');
  }
}

function renderInfluentialFactors() {
  if (!state.features) return;
  const f = state.features;

  const container = $('#factors-container');
  if (!container) return;

  const isPro = state.uiMode === 'pro';

  // Tampilkan nilai metrik biofisik mentah langsung tanpa bar bobot sintetis 0-100 (F4 PROMPT G1)
  const factors = isPro ? [
    { name: 'Hari Hujan Berturut-turut', value: `${f.consecutiveRainyDays} hari`, badge: f.consecutiveRainyDays >= 3 ? 'Waspada Sporulasi' : 'Normal', color: f.consecutiveRainyDays >= 3 ? '#9A3412' : '#166534', bg: f.consecutiveRainyDays >= 3 ? '#FFEDD5' : '#DCFCE7' },
    { name: 'Kelembapan Relatif Rolling (7d)', value: `${Math.round(f.rolling7dRH)}%`, badge: f.rolling7dRH >= 85 ? 'Sangat Lembap' : 'Optimal', color: f.rolling7dRH >= 85 ? '#9A3412' : '#166534', bg: f.rolling7dRH >= 85 ? '#FFEDD5' : '#DCFCE7' },
    { name: 'Defisit Tekanan Uap (VPD Tetens)', value: `${f.currentVPD.toFixed(2)} kPa`, badge: f.currentVPD < 0.4 ? 'Lembap Basah' : f.currentVPD > 1.2 ? 'Kering Terik' : 'Optimal', color: f.currentVPD < 0.4 ? '#9A3412' : '#166534', bg: f.currentVPD < 0.4 ? '#FFEDD5' : '#DCFCE7' },
    { name: 'Fase Fenologi & Kerentanan', value: state.engineResult?.stageName || 'Vegetatif', badge: state.engineResult?.stageVulnerability || 'SEDANG', color: '#1E40AF', bg: '#DBEAFE' },
    { name: 'Akumulasi Presipitasi 7 Hari', value: `${Math.round(f.rolling7dRain)} mm`, badge: f.rolling7dRain > 60 ? 'Tinggi' : 'Normal', color: f.rolling7dRain > 60 ? '#9A3412' : '#166534', bg: f.rolling7dRain > 60 ? '#FFEDD5' : '#DCFCE7' }
  ] : [
    { name: 'Hari Hujan Berturut-turut', value: `${f.consecutiveRainyDays} hari`, badge: f.consecutiveRainyDays >= 3 ? 'Waspada' : 'Aman', color: f.consecutiveRainyDays >= 3 ? '#9A3412' : '#166534', bg: f.consecutiveRainyDays >= 3 ? '#FFEDD5' : '#DCFCE7' },
    { name: 'Rata-rata Kelembapan (7 Hari)', value: `${Math.round(f.rolling7dRH)}%`, badge: f.rolling7dRH >= 85 ? 'Lembap' : 'Cukup', color: f.rolling7dRH >= 85 ? '#9A3412' : '#166534', bg: f.rolling7dRH >= 85 ? '#FFEDD5' : '#DCFCE7' },
    { name: 'Kondisi Penguapan Udara (VPD)', value: `${f.currentVPD.toFixed(2)} kPa`, badge: f.currentVPD < 0.4 ? 'Lembap Basah' : 'Optimal', color: f.currentVPD < 0.4 ? '#9A3412' : '#166534', bg: f.currentVPD < 0.4 ? '#FFEDD5' : '#DCFCE7' },
    { name: 'Tahap Tumbuh Tanaman', value: state.engineResult?.stageName || 'Pertumbuhan', badge: 'Aktif', color: '#1E40AF', bg: '#DBEAFE' },
    { name: 'Total Curah Hujan 7 Hari', value: `${Math.round(f.rolling7dRain)} mm`, badge: f.rolling7dRain > 60 ? 'Basah' : 'Normal', color: f.rolling7dRain > 60 ? '#9A3412' : '#166534', bg: f.rolling7dRain > 60 ? '#FFEDD5' : '#DCFCE7' }
  ];

  container.innerHTML = factors.map((item) => {
    return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--ground); border-radius: 8px; border: 1px solid var(--line); font-size: 13px">
      <div>
        <span style="font-weight: 600; color: var(--ink)">${item.name}</span>
        <span style="margin-left: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--muted); font-weight: 500">${item.value}</span>
      </div>
      <span style="font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; font-weight: 700; color: ${item.color}; background: ${item.bg}; padding: 3px 8px; border-radius: 6px">${item.badge}</span>
    </div>`;
  }).join('');
}

function renderWeatherSnapshot() {
  if (!state.weatherData || !state.features) return;
  const cw = state.weatherData.current;
  const f = state.features;

  const container = $('#snapshot-metrics');
  if (!container) return;

  container.innerHTML = `
    <div><div style="font-size: 12px; color: var(--muted)">Suhu Saat Ini</div><div style="font-weight: 700; font-size: 19px">${cw.temperature.toFixed(1)}°C</div></div>
    <div><div style="font-size: 12px; color: var(--muted)">Kelembapan Udara</div><div style="font-weight: 700; font-size: 19px">${Math.round(cw.relativeHumidity)}%</div></div>
    <div><div style="font-size: 12px; color: var(--muted)">Hari Hujan Berturut-turut</div><div style="font-weight: 700; font-size: 19px">${f.consecutiveRainyDays} hari</div></div>
    <div><div style="font-size: 12px; color: var(--muted)">Total Hujan 7 Hari</div><div style="font-weight: 700; font-size: 19px">${Math.round(f.rolling7dRain)} mm</div></div>
    <div><div style="font-size: 12px; color: var(--muted)">Tekanan Uap Air (VPD)</div><div style="font-weight: 700; font-size: 19px; color: var(--green)">${f.currentVPD.toFixed(2)} kPa</div></div>
  `;
}

function renderWeatherView() {
  if (!state.weatherData || !state.features) return;
  const cw = state.weatherData.current;
  const forecast = state.weatherData.dailyForecast;
  const f = state.features;

  // 1. Current Weather
  const tempVal = $('#current-temp-val');
  const condText = $('#current-condition-text');
  const iconCont = $('#current-weather-icon');
  const rhEl = $('#cw-rh');
  const windEl = $('#cw-wind');
  const rainEl = $('#cw-rain');
  const vpdEl = $('#cw-vpd');

  if (tempVal) tempVal.textContent = `${cw.temperature.toFixed(1)}°C`;
  if (condText) condText.textContent = getWeatherCodeDescription(cw.weatherCode);
  if (iconCont) iconCont.innerHTML = cw.precipitation > 2 ? ICON_RAIN : cw.relativeHumidity > 80 ? ICON_CLOUD : ICON_SUN;
  if (rhEl) rhEl.textContent = `${Math.round(cw.relativeHumidity)}%`;
  if (windEl) windEl.textContent = `${cw.windSpeed.toFixed(1)} km/j`;
  if (rainEl) rainEl.textContent = `${cw.precipitation.toFixed(1)} mm`;
  if (vpdEl) vpdEl.textContent = `${f.currentVPD.toFixed(2)} kPa (${f.currentVPD < 0.4 ? 'Sangat Lembap' : f.currentVPD > 1.2 ? 'Kering' : 'Optimal'})`;

  // 2. 7-Day Forecast Grid
  const forecastCont = $('#forecast');
  if (forecastCont) {
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    forecastCont.innerHTML = forecast.slice(0, 7).map((day, i: number) => {
      const d = new Date(day.date);
      const dayName = isNaN(d.getTime()) ? `H+${i + 1}` : dayNames[d.getDay()];
      const isRain = day.precipitationSum >= 2.0;
      const isFirst = i === 0;

      const box = 'display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 6px; border-radius: 12px; ' +
        (isFirst ? 'background: var(--sage); border: 1.5px solid var(--green)' : 'background: var(--ground); border: 1px solid transparent');

      return `<div style="${box}">
        <span style="font-size: 13px; font-weight: 700">${dayName}</span>
        ${isRain ? ICON_RAIN : ICON_SUN}
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600">${day.precipitationSum.toFixed(0)} mm</span>
        <span style="font-size: 12px; color: var(--muted)">${Math.round(day.tempMin)}–${Math.round(day.tempMax)}°</span>
      </div>`;
    }).join('');
  }

  // 3. Metric Buttons & 21-Bar Chart
  renderChart();

  // 4. Temporal Grid (7 Features)
  const temporalGrid = $('#temporal-grid');
  if (temporalGrid) {
    temporalGrid.innerHTML = `
      <div style="flex: 1 1 180px; background: #FFFFFF; border: 1px solid var(--line); border-radius: 14px; padding: 16px">
        <div style="font-size: 12px; color: var(--muted)">Hari Hujan Berturut-turut</div>
        <div style="font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 26px; color: var(--green)">${f.consecutiveRainyDays} hari</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 2px">Waspada jamur jika basah &ge; 3 hari</div>
      </div>
      <div style="flex: 1 1 180px; background: #FFFFFF; border: 1px solid var(--line); border-radius: 14px; padding: 16px">
        <div style="font-size: 12px; color: var(--muted)">Total Hujan 7 Hari Terakhir</div>
        <div style="font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 26px">${Math.round(f.rolling7dRain)} mm</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 2px">Kadar basah tanah sepekan</div>
      </div>
      <div style="flex: 1 1 180px; background: #FFFFFF; border: 1px solid var(--line); border-radius: 14px; padding: 16px">
        <div style="font-size: 12px; color: var(--muted)">Total Hujan 14 Hari Terakhir</div>
        <div style="font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 26px">${Math.round(f.rolling14dRain)} mm</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 2px">Pantauan risiko air menggenang</div>
      </div>
      <div style="flex: 1 1 180px; background: #FFFFFF; border: 1px solid var(--line); border-radius: 14px; padding: 16px">
        <div style="font-size: 12px; color: var(--muted)">Rata-rata Kelembapan 7 Hari</div>
        <div style="font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 26px">${Math.round(f.rolling7dRH)}%</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 2px">Waspada jamur jika udara &gt;85%</div>
      </div>
      <div style="flex: 1 1 180px; background: #FFFFFF; border: 1px solid var(--line); border-radius: 14px; padding: 16px">
        <div style="font-size: 12px; color: var(--muted)">Hari Tanpa Hujan</div>
        <div style="font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 26px">${f.consecutiveDryDays} hari</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 2px">Lama lahan kering berturut-turut</div>
      </div>
      <div style="flex: 1 1 180px; background: #FFFFFF; border: 1px solid var(--line); border-radius: 14px; padding: 16px">
        <div style="font-size: 12px; color: var(--muted)">Prakiraan Hujan 2 Hari ke Depan</div>
        <div style="font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 26px">${Math.round(f.forecastRain48h)} mm</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 2px">Panduan agar pupuk tidak hanyut</div>
      </div>
      <div style="flex: 1 1 180px; background: #FFFFFF; border: 1.5px solid var(--green); border-radius: 14px; padding: 16px">
        <div style="font-size: 12px; color: var(--green); font-weight: 700">Tekanan Uap Air (VPD)</div>
        <div style="font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 26px; color: var(--green)">${f.currentVPD.toFixed(2)} kPa</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 2px">Tingkat penguapan daun tanaman</div>
      </div>
    `;
  }
}

function renderChart() {
  if (!state.weatherData) return;
  const history = state.weatherData.history;
  const forecast = state.weatherData.dailyForecast;

  const metricDefs: Record<MetricType, { label: string; unit: string; extract: (h: any) => number }> = {
    hujan: { label: 'Hujan (mm)', unit: 'curah hujan harian (mm)', extract: (d) => d.precipitation ?? d.precipitationSum ?? 0 },
    rh: { label: 'Kelembapan (%)', unit: 'kelembapan relatif (%)', extract: (d) => d.rhMean ?? 80 },
    suhu: { label: 'Suhu (°C)', unit: 'suhu (°C)', extract: (d) => d.tempMean ?? d.tempMax ?? 25 },
    vpd: { label: 'VPD (kPa)', unit: 'defisit tekanan uap (kPa)', extract: (d) => d.vpdMean ?? calculateVPD(d.tempMean ?? 25, d.rhMean ?? 80) }
  };

  const curDef = metricDefs[state.metric];

  // Render Metric Buttons
  const metricsCont = $('#metrics');
  if (metricsCont) {
    metricsCont.innerHTML = (Object.keys(metricDefs) as MetricType[]).map((key) => {
      const on = state.metric === key;
      return `<button type="button" data-metric="${key}" aria-pressed="${on}" style="${pill(on,
        'background: var(--ink); color: #FFFFFF; border: 1px solid var(--ink)',
        'background: var(--field); color: var(--ink); border: 1px solid var(--field-line)').replace('min-height: 44px', 'min-height: 38px')}">${metricDefs[key].label}</button>`;
    }).join('');
  }

  // Combine 14 history days + 7 forecast days = 21 bars (index 13 = today)
  const combinedValues: { date: string; value: number; isForecast: boolean }[] = [];

  history.forEach((h) => {
    combinedValues.push({ date: h.date, value: curDef.extract(h), isForecast: false });
  });

  forecast.slice(0, 7).forEach((fc) => {
    combinedValues.push({ date: fc.date, value: curDef.extract(fc), isForecast: true });
  });

  const maxVal = Math.max(1, ...combinedValues.map(v => v.value));

  // Render Bars
  const barsCont = $('#bars');
  if (barsCont) {
    barsCont.innerHTML = combinedValues.map((v, i) => {
      const height = Math.max(6, Math.round((v.value / maxVal) * 155));
      const fill = v.isForecast
        ? 'background: repeating-linear-gradient(45deg, #7FA08A 0 4px, #B9CDB9 4px 8px)'
        : 'background: var(--green)';
      const isToday = i === 13;
      const todayStyle = isToday ? '; outline: 3px solid var(--risk); outline-offset: 2px' : '';

      return `<div data-bar-idx="${i}" title="${v.date}: ${v.value.toFixed(1)}" style="flex: 1; height: ${height}px; border-radius: 4px 4px 0 0; cursor: pointer; ${fill}${todayStyle}"></div>`;
    }).join('');
  }

  bindText('metricUnit', curDef.unit);
}

function formatChatMarkdown(raw: string): string {
  if (!raw) return '';
  let s = esc(raw);
  // Bold **text**
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code `code`
  s = s.replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px; font-family: \'IBM Plex Mono\', monospace; font-size: 12px">$1</code>');
  // Convert newlines to breaks or paragraphs
  s = s.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');
  return s;
}

function renderChat() {
  const thread = $('#thread');
  if (thread) {
    thread.innerHTML = state.thread.map((m) => {
      const style = 'max-width: 88%; padding: 14px 18px; border-radius: 14px; display: flex; flex-direction: column; gap: 6px; ' +
        (m.me
          ? 'align-self: flex-end; background: #DCE8C6; color: var(--ink)'
          : 'align-self: flex-start; background: var(--dark-2); color: #EEF3EA; border: 1px solid var(--dark-line)');

      let attachmentHtml = '';
      if (m.image) {
        attachmentHtml += `<div style="margin-top: 6px"><img src="${m.image}" alt="Foto Tanaman" style="max-width: 200px; max-height: 160px; border-radius: 8px; border: 1px solid var(--dark-line); object-fit: cover" /></div>`;
      }
      if (m.fileName) {
        attachmentHtml += `<div style="font-size: 11.5px; opacity: 0.85; display: flex; align-items: center; gap: 4px; margin-top: 2px"><span>[Berkas]:</span> <code>${esc(m.fileName)}</code></div>`;
      }

      return `<div style="${style}">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px">
          <span style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700; color: ${m.me ? 'var(--ink)' : 'var(--accent)'}">
            ${m.me ? 'Petani / Pengguna' : 'Asisten Agronomis TaniAdapt (Tania)'}
          </span>
          ${m.sourceDoc ? `<span style="font-size: 10px; opacity: 0.7; font-style: italic">${esc(m.sourceDoc)}</span>` : ''}
        </div>
        ${attachmentHtml}
        <span style="line-height: 1.5; font-size: 14px">${formatChatMarkdown(m.text)}</span>
      </div>`;
    }).join('');

    const box = $('#thread-box');
    if (box) box.scrollTop = box.scrollHeight;
  }

  // Pre-set questions
  const qCont = $('#questions');
  if (qCont) {
    const qList = [
      'Kenapa risikonya tinggi saat ini?',
      'Kapan jendela aman untuk pemupukan?',
      'Bagaimana jika 3 hari ke depan tidak hujan?',
      'Berapa batas bahaya genangan dan drainase?',
      'Apa dasar riset ilmiah untuk rekomendasi ini?'
    ];

    qCont.innerHTML = qList.map((q, i) =>
      `<button type="button" data-preset-q="${i}" style="min-height: 36px; padding: 0 14px; border-radius: 999px; font: inherit; font-size: 12px; font-weight: 500; cursor: pointer; background: transparent; color: var(--ground); border: 1px solid var(--dark-line)">${q}</button>`
    ).join('');
  }

  // Update RAG Sidebar
  if (state.engineResult) {
    const r = state.engineResult;
    const stageText = $('#rag-stage-text');
    const riskText = $('#rag-risk-text');
    const factorText = $('#rag-factor-text');
    const waterText = $('#rag-water-text');

    if (stageText) stageText.textContent = `${r.stageName} (${state.currentHST} HST)`;
    if (riskText) {
      riskText.textContent = r.overallRisk === 'TINGGI' ? 'Tinggi' : r.overallRisk === 'SEDANG' ? 'Sedang' : 'Rendah';
      riskText.style.color = r.overallRisk === 'TINGGI' ? 'var(--risk-strong)' : 'var(--green)';
    }
    if (factorText) {
      const days = state.features?.consecutiveRainyDays || 0;
      factorText.textContent = days > 0 ? `${days} hari hujan berturut-turut` : 'Nihil hari hujan';
    }
    if (waterText) waterText.textContent = r.irrigation.status === 'DRAINASE_MENDESAK' ? 'Drainase Mendesak' : 'Aman';
  }

  // Toggle chat evidence section based on UI mode (Khusus mode advanced)
  const chatEvidenceSection = $('#chat-evidence-section');
  if (chatEvidenceSection) {
    chatEvidenceSection.style.display = state.uiMode === 'pro' ? 'flex' : 'none';
  }

  // Relevant RAG Literature Citations
  const evidenceList = $('#rag-evidence-list');
  if (evidenceList) {
    const allEvidence = Object.values(LITERATURE_DATABASE);
    const relevant = allEvidence.filter(l => l.crop.toLowerCase().includes(state.cropId) || l.id.includes('fao'));
    evidenceList.innerHTML = relevant.map((item) => {
      return `<div style="font-size: 13px; padding: 10px 12px; background: var(--ground); border-radius: 10px; border: 1px solid var(--line); display: flex; flex-direction: column; gap: 4px">
        <div style="display: flex; justify-content: space-between; align-items: center">
          <strong style="color: var(--green); font-size: 12px">${item.authors} (${item.year})</strong>
          <span style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; background: var(--sage); padding: 1px 6px; border-radius: 4px">${item.statisticalMLMethod.slice(0, 15)}...</span>
        </div>
        <div style="font-size: 12px; color: var(--ink); line-height: 1.3">${item.title}</div>
        <div style="font-size: 11px; color: var(--muted); border-top: 1px dashed var(--line); padding-top: 4px; margin-top: 2px">
          Ambang: ${item.applicableThreshold}
        </div>
      </div>`;
    }).join('');
  }

  // Custom KB in Chat View
  const chatKbList = $('#chat-custom-kb-list');
  if (chatKbList) {
    if (state.customKnowledgeBase.length === 0) {
      chatKbList.innerHTML = `<span style="font-size: 11px; color: var(--muted); font-style: italic">Belum ada SOP kebun tersimpan. Tambahkan di atas.</span>`;
    } else {
      chatKbList.innerHTML = state.customKnowledgeBase.map((item, idx) => {
        return `<div style="display: flex; justify-content: space-between; align-items: center; background: var(--ground); border: 1px solid var(--line); border-radius: 6px; padding: 6px 10px; font-size: 11.5px; gap: 6px">
          <span style="color: var(--ink)">${idx + 1}. ${esc(item)}</span>
          <button type="button" data-del-kb="${idx}" style="background: none; border: none; color: #DC2626; cursor: pointer; font-size: 13px; font-weight: 700; line-height: 1" title="Hapus catatan">&times;</button>
        </div>`;
      }).join('');
    }
  }
}

function renderFields() {
  const fieldsCont = $('#fields');
  if (!fieldsCont) return;

  const trailSection = document.querySelector('[aria-label="Jejak kondisi tanaman"]') as HTMLElement;

  const portfolioCont = $('#portfolio-export-container');

  if (state.plots.length === 0) {
    if (portfolioCont) portfolioCont.innerHTML = '';
    fieldsCont.innerHTML = `
      <div style="flex: 1 1 100%; background: #FFFFFF; border: 2px dashed var(--line); border-radius: 18px; padding: 48px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.03)">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        <h3 style="margin: 0; font-size: 20px; font-weight: 800; color: var(--ink)">Belum Ada Petak Lahan Terdaftar</h3>
        <p style="margin: 0; font-size: 14px; color: var(--muted); max-width: 500px; line-height: 1.6">
          Daftarkan petak lahan pertanian Anda sejak hari tanam agar Decision Engine dapat memantau akumulasi kebasahan daun, neraca air FAO-56, dan peringatan OPT secara akurat.
        </p>
        <button type="button" data-action="toggle-form" class="btn-action-taktil" style="margin-top: 6px; min-height: 44px; padding: 0 24px; border-radius: 999px; background: var(--green); color: #FFF; border: none; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(30,77,53,0.2)">
          <span>+ Daftarkan Lahan Baru</span>
        </button>
      </div>
    `;

    if (trailSection) trailSection.style.display = 'none';

    const addForm = $('#add-form');
    if (addForm) addForm.hidden = !state.showForm;
    bindText('formButton', state.showForm ? 'Batal Tambah' : 'Tambah Lahan Baru');
    return;
  }

  if (portfolioCont) {
    const isAdv = state.uiMode === 'pro';
    portfolioCont.innerHTML = isAdv ? `
      <div style="background: #F0F9FF; border: 1.5px solid #BAE6FD; border-radius: 16px; padding: 18px 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; width: 100%; box-sizing: border-box; box-shadow: 0 2px 6px rgba(3, 105, 161, 0.05)">
        <div>
          <strong style="font-size: 14px; color: #0369A1; display: block">Dossier Audit Portofolio Riset Biofisika</strong>
          <span style="font-size: 12.5px; color: #4B5563">Unduh matriks agregat FAO-56 PM untuk seluruh ${state.plots.length} petak riset dalam satu berkas Word (.docx).</span>
        </div>
        <button type="button" data-export-portfolio-docx="advance" class="btn-action-taktil" style="min-height: 40px; padding: 0 18px; border-radius: 999px; background: #1E3A8A; color: #FFF; border: none; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(30,58,138,0.25)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Unduh Dossier Riset Portofolio (.docx)
        </button>
      </div>
    ` : `
      <div style="background: #F0FDF4; border: 1.5px solid #BBF7D0; border-radius: 16px; padding: 18px 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; width: 100%; box-sizing: border-box; box-shadow: 0 2px 6px rgba(22, 101, 52, 0.05)">
        <div>
          <strong style="font-size: 14px; color: #166534; display: block">Laporan Portofolio Seluruh Kebun</strong>
          <span style="font-size: 12.5px; color: #4B5563">Unduh rangkuman panduan lapangan untuk seluruh ${state.plots.length} petak kebun Anda dalam satu berkas Word (.docx).</span>
        </div>
        <button type="button" data-export-portfolio-docx="default" class="btn-action-taktil" style="min-height: 40px; padding: 0 18px; border-radius: 999px; background: var(--green); color: #FFF; border: none; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(30,77,53,0.2)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Unduh Portofolio Semua Lahan (.docx)
        </button>
      </div>
    `;
  }

  if (trailSection) trailSection.style.display = 'flex';

  fieldsCont.innerHTML = state.plots.map((f, i) => {
    const on = state.fieldIndex === i;
    const card = 'flex: 1 1 290px; min-width: 0; background: #FFFFFF; border-radius: 18px; padding: 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 4px 12px rgba(19,39,29,0.06); ' +
      (on ? 'border: 2.5px solid var(--green)' : 'border: 1px solid var(--line)');

    return `<article style="${card}">
      <div style="display: flex; justify-content: space-between; gap: 8px; align-items: flex-start">
        <div>
          <h3 style="margin: 0; font-size: 17px; font-weight: 700">${f.name}</h3>
          <div style="font-size: 13px; color: var(--muted)">${f.placeName}</div>
        </div>
        <span style="flex: none; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; ${RISK_BADGE[f.risk]}">${f.risk}</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; font-size: 13px; background: var(--ground); padding: 10px; border-radius: 10px">
        <div><div style="color: var(--muted); font-size: 11px">Tanaman</div><div style="font-weight: 700">${CROPS_LIST.find(c => c.id === f.cropId)?.label || f.cropId}</div></div>
        <div><div style="color: var(--muted); font-size: 11px">Fase</div><div style="font-weight: 700">${f.stageName}</div></div>
        <div><div style="color: var(--muted); font-size: 11px">Umur</div><div style="font-weight: 700">${state.uiMode === 'pro' ? `${f.hst} HST` : `Hari ke-${f.hst}`}</div></div>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center">
        <button type="button" data-field-select="${i}" class="btn-action-taktil" aria-pressed="${on}" style="min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--field-line); background: var(--field); font: inherit; font-size: 13px; cursor: pointer; font-weight: 600">Lihat Jejak</button>
        <button type="button" data-field-open="${i}" class="btn-action-taktil" style="min-height: 40px; padding: 0 16px; border-radius: 999px; border: none; background: var(--green); color: #FFFFFF; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px">
          Detail Lahan &rarr;
        </button>
        ${state.uiMode === 'pro' ? `
          <button type="button" data-export-single-docx="advance" data-plot-id="${f.id}" title="Unduh Dossier Riset Word" class="btn-action-taktil" style="min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1.5px solid #1E3A8A; background: #FFFFFF; color: #1E3A8A; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Unduh Dossier (.docx)
          </button>
        ` : `
          <button type="button" data-export-single-docx="default" data-plot-id="${f.id}" title="Unduh Panduan Lahan Word" class="btn-action-taktil" style="min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1.5px solid var(--green); background: #FFFFFF; color: var(--green); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Unduh Panduan (.docx)
          </button>
        `}
        <button type="button" data-delete-plot="${i}" title="Hapus petak ini" class="btn-action-taktil" style="min-height: 40px; width: 40px; border-radius: 999px; border: 1px solid #FCA5A5; background: #FEF2F2; color: #DC2626; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-left: auto">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </article>`;
  }).join('');

  const curPlot = state.plots[state.fieldIndex];
  if (curPlot) {
    bindText('fieldName', curPlot.name);
    bindText('fieldLine', `${curPlot.name} • ${curPlot.placeName}`);

    const trailCont = $('#trail');
    if (trailCont) {
      trailCont.innerHTML = curPlot.trail.map((t, idx) => {
        const isToday = idx === curPlot.trail.length - 1 || t.dayLabel.toLowerCase().includes('hari ini');
        const cleanDayLabel = t.dayLabel.replace(/\s*\(Hari\s*Ini\)/i, '').trim();

        return `<li class="trail-card ${isToday ? 'active-today' : ''}">
          <div class="trail-card-header">
            <span class="trail-day-label">${esc(cleanDayLabel)}</span>
            ${isToday ? '<span class="trail-today-badge">Hari Ini</span>' : ''}
          </div>
          <div class="trail-weather-row">
            <span>${esc(t.weather)}</span>
          </div>
          <div class="trail-category-row">
            <span class="trail-category-chip">${esc(t.status)}</span>
          </div>
          <div class="trail-note-row">
            <span>${esc(t.note)}</span>
          </div>
        </li>`;
      }).join('');
    }
  }

  const addForm = $('#add-form');
  if (addForm) addForm.hidden = !state.showForm;
  bindText('formButton', state.showForm ? 'Batal Tambah' : 'Tambah Lahan Baru');
}

function renderEvidenceModal() {
  const modal = $('#evidence-modal');
  if (!modal) return;

  modal.hidden = !state.isEvidenceModalOpen;
  if (!state.isEvidenceModalOpen) return;

  const content = $('#evidence-modal-content');
  if (!content) return;

  const filter = state.evidenceFilter;
  const allDocs = Object.values(LITERATURE_DATABASE);
  const filtered = filter === 'all'
    ? allDocs
    : allDocs.filter(l =>
        (l.category && l.category.toLowerCase().includes(filter)) ||
        l.crop.toLowerCase().includes(filter) ||
        l.id.toLowerCase().includes(filter) ||
        l.title.toLowerCase().includes(filter)
      );

  // Sinkronkan active state tombol filter
  document.querySelectorAll('[data-filter-evidence]').forEach(btn => {
    const el = btn as HTMLElement;
    const cat = el.getAttribute('data-filter-evidence');
    if (cat === filter) {
      el.style.background = 'var(--green)';
      el.style.color = '#FFF';
      el.style.border = 'none';
      el.style.fontWeight = '700';
    } else {
      el.style.background = '#FFF';
      el.style.color = 'var(--ink)';
      el.style.border = '1px solid var(--line)';
      el.style.fontWeight = '500';
    }
  });

  content.innerHTML = filtered.map((doc: LiteratureExtraction16, idx: number) => {
    return `<article style="background: var(--ground); border: 1px solid var(--line); border-radius: 16px; padding: 22px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 14px">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap">
        <div>
          <span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--green); font-weight: 700">Riset #${idx + 1} &bull; ${doc.authors} (${doc.year})</span>
          <h3 style="margin: 4px 0 0; font-size: 18px; font-weight: 700; color: var(--ink)">${doc.title}</h3>
          <div style="font-size: 13px; color: var(--muted); margin-top: 2px">${doc.journal} &bull; ${doc.institution}</div>
          ${doc.sourceUrl ? `<div style="margin-top: 6px">
            <a href="${doc.sourceUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: var(--green); text-decoration: underline">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              <span>Buka Publikasi Asli / DOI (${doc.sourceUrl})</span>
            </a>
          </div>` : ''}
        </div>
        <span style="flex: none; font-size: 12px; background: var(--green); color: #FFF; padding: 4px 10px; border-radius: 999px; font-weight: 700">${doc.crop}</span>
      </div>

      <!-- 16-Field Structured Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; background: #FFFFFF; border: 1px solid var(--line); border-radius: 12px; padding: 16px; font-size: 13px">
        <div><strong style="color: var(--muted)">1. Agroekosistem / Lokasi:</strong> <div>${doc.location}</div></div>
        <div><strong style="color: var(--muted)">2. Masalah Agronomi:</strong> <div>${doc.agriculturalProblem}</div></div>
        <div><strong style="color: var(--muted)">3. Target Outcome:</strong> <div>${doc.agriculturalOutcome}</div></div>
        <div><strong style="color: var(--muted)">4. Variabel Cuaca Kunci:</strong> <div>${doc.weatherVariables.join(', ')}</div></div>
        <div><strong style="color: var(--muted)">5. Riwayat Temporal / Lag:</strong> <div>${doc.lagWeatherHistory}</div></div>
        <div><strong style="color: var(--muted)">6. Critical Threshold:</strong> <div style="color: var(--risk-strong); font-weight: 600">${doc.applicableThreshold}</div></div>
        <div><strong style="color: var(--muted)">7. Metode Statistik / ML:</strong> <div>${doc.statisticalMLMethod}</div></div>
        <div><strong style="color: var(--muted)">8. Kekuatan Bukti:</strong> <div style="font-weight: 700; color: var(--green)">${doc.strengthOfEvidence}</div></div>
      </div>

      <div style="background: var(--sage); border-radius: 10px; padding: 12px 14px; font-size: 13px">
        <strong style="color: var(--ink)">Temuan Utama (Finding):</strong> ${doc.mainFinding}
      </div>

      <div style="background: rgba(30,77,53,0.08); border-left: 3px solid var(--green); padding: 10px 14px; font-size: 13px">
        <strong style="color: var(--green)">Aplikasi Nyata Petani di TaniAdapt:</strong> ${doc.applicabilityToTaniAdapt}
      </div>
    </article>`;
  }).join('');
}

function renderPrintModal() {
  const modal = $('#print-modal');
  if (!modal) return;

  modal.hidden = !state.isPrintModalOpen;
  if (!state.isPrintModalOpen || !state.engineResult || !state.features) return;

  // Sinkronkan styling tombol selector Scope
  const btnScopeSingle = document.getElementById('report-scope-single');
  const btnScopePortfolio = document.getElementById('report-scope-portfolio');
  if (btnScopeSingle && btnScopePortfolio) {
    if (state.reportExportScope === 'portfolio') {
      btnScopePortfolio.style.background = 'var(--green)';
      btnScopePortfolio.style.color = '#FFF';
      btnScopePortfolio.style.fontWeight = '700';
      btnScopeSingle.style.background = 'transparent';
      btnScopeSingle.style.color = 'var(--ink)';
      btnScopeSingle.style.fontWeight = '600';
    } else {
      btnScopeSingle.style.background = 'var(--green)';
      btnScopeSingle.style.color = '#FFF';
      btnScopeSingle.style.fontWeight = '700';
      btnScopePortfolio.style.background = 'transparent';
      btnScopePortfolio.style.color = 'var(--ink)';
      btnScopePortfolio.style.fontWeight = '600';
    }
  }

  // Sinkronkan styling tombol selector Mode
  const btnModeDefault = document.getElementById('report-mode-default');
  const btnModeAdvance = document.getElementById('report-mode-advance');
  if (btnModeDefault && btnModeAdvance) {
    if (state.reportExportMode === 'advance') {
      btnModeAdvance.style.background = 'var(--green)';
      btnModeAdvance.style.color = '#FFF';
      btnModeAdvance.style.fontWeight = '700';
      btnModeDefault.style.background = 'transparent';
      btnModeDefault.style.color = 'var(--ink)';
      btnModeDefault.style.fontWeight = '600';
    } else {
      btnModeDefault.style.background = 'var(--green)';
      btnModeDefault.style.color = '#FFF';
      btnModeDefault.style.fontWeight = '700';
      btnModeAdvance.style.background = 'transparent';
      btnModeAdvance.style.color = 'var(--ink)';
      btnModeAdvance.style.fontWeight = '600';
    }
  }

  const body = $('#print-report-body');
  if (!body) return;

  const isSingle = state.reportExportScope === 'single';
  const isAdv = state.reportExportMode === 'advance';

  if (isSingle) {
    body.innerHTML = isAdv ? renderAdvanceSinglePlotPreviewHtml() : renderSinglePlotPreviewHtml();
  } else {
    body.innerHTML = isAdv ? renderAdvancePortfolioPreviewHtml() : renderPortfolioPreviewHtml();
  }
}

function renderSinglePlotPreviewHtml(): string {
  const res = state.engineResult!;
  const f = state.features!;
  const cw = state.weatherData?.current;
  const currentPlot = state.plots[state.fieldIndex];

  return `
    <div style="border-bottom: 2px solid #1E4D35; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end">
      <div>
        <h1 style="margin: 0; font-family: 'Times New Roman', serif; font-size: 22px; color: #1E4D35">TaniAdapt: Lembar Rekomendasi Lahan</h1>
        <div style="color: #555555; font-size: 13px">Hyperlocal Precision Agro-Advisory &bull; Terverifikasi Bukti Ilmiah (Mode Petani)</div>
      </div>
      <div style="text-align: right; font-family: 'Times New Roman', serif; font-size: 12px">
        <div>Tanggal: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</div>
        <div>Lokasi: ${state.location.name} (${state.location.elevationMeters} mdpl)</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #F4F7F4; padding: 12px; border-radius: 6px; margin-bottom: 18px; border: 1px solid #D3E0D6">
      <div><strong>Petak:</strong> ${currentPlot?.name || 'Petak Aktif'} (${currentPlot?.areaHa || 1} Ha)</div>
      <div><strong>Komoditas:</strong> ${res.cropName} (<em>${res.scientificName}</em>)</div>
      <div><strong>Fase:</strong> ${res.stageName} (${state.currentHST} HST)</div>
      <div><strong>Tingkat Risiko:</strong> <span style="font-weight: 700; color: ${res.overallRisk === 'TINGGI' ? '#B91C1C' : '#1E4D35'}">${res.overallRisk}</span></div>
      <div><strong>Pengairan:</strong> ${res.irrigation.status === 'DRAINASE_MENDESAK' ? 'Drainase Mendesak' : 'Optimal'}</div>
      <div><strong>Pemupukan:</strong> ${res.fertilization.safeToApply ? 'Aman' : 'Tunda'}</div>
    </div>

    <div style="margin-bottom: 18px">
      <h3 style="margin: 0 0 8px; font-size: 15px; color: #1E4D35">1. Ringkasan Kondisi Agroklimat</h3>
      <p style="margin: 0; font-size: 13px">${res.temporalSummary}</p>
      <div style="font-size: 12px; color: #555555; margin-top: 6px">
        Suhu: ${cw?.temperature.toFixed(1)}°C &bull; RH: ${Math.round(cw?.relativeHumidity || 0)}% &bull; Hujan Kumulatif 7 Hari: ${Math.round(f.rolling7dRain)} mm &bull; Tekanan Uap (VPD): ${f.currentVPD.toFixed(2)} kPa
      </div>
    </div>

    <div style="margin-bottom: 18px">
      <h3 style="margin: 0 0 8px; font-size: 15px; color: #1E4D35">2. Instruksi Tindakan Prioritas di Lahan</h3>
      <ol style="margin: 0; padding-left: 20px; font-size: 13px">
        ${res.recommendations.map(r => `<li style="margin-bottom: 6px"><strong>[${r.urgency}] ${r.title}:</strong> ${r.action} (${r.rationale})</li>`).join('')}
      </ol>
    </div>

    <div style="margin-bottom: 18px">
      <h3 style="margin: 0 0 8px; font-size: 15px; color: #1E4D35">3. Status Manajemen Air &amp; Nutrisi</h3>
      <div style="font-size: 13px">
        <div><strong>Irigasi:</strong> ${res.irrigation.status === 'DRAINASE_MENDESAK' ? 'DRAINASE MENDESAK: Segera perdalam parit buangan' : 'LENGAS OPTIMAL'}</div>
        <div><strong>Pemupukan:</strong> ${res.fertilization.safeToApply ? 'Aman diaplikasikan' : 'TUNDA PEMUPUKAN: Risiko pencucian/hanyut akibat kebasahan tanah tinggi'}</div>
      </div>
    </div>

    <div style="border-top: 1px solid #D3E0D6; padding-top: 12px; font-size: 11px; color: #555555; display: flex; justify-content: space-between">
      <span>TaniAdapt Decision Support System &bull; Balitsa, BB Padi, IPB, BRIN, FAO-56</span>
      <span>Dokumen Resmi Rekomendasi Lapangan (Cetak Biasa)</span>
    </div>
  `;
}

function renderAdvanceSinglePlotPreviewHtml(): string {
  const plot = state.plots[state.fieldIndex];
  const engine = state.engineResult;
  const features = state.features;
  const weather = state.weatherData?.current;
  const f56 = engine?.fao56;
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  return `
    <div style="font-family: 'Times New Roman', Times, serif; color: #111; line-height: 1.5; font-size: 11pt;">
      <div style="border-bottom: 2px solid #1E4D35; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h2 style="font-size: 16pt; color: #1E4D35; margin: 0; text-transform: uppercase;">TaniAdapt: Dossier Biofisik &amp; Agrometeorologi</h2>
          <p style="font-size: 10pt; color: #555; margin: 4px 0 0 0; font-style: italic;">Spesifikasi Komputasional Mekanistik FAO-56 Penman-Monteith (Mode Advance)</p>
        </div>
        <div style="text-align: right; font-size: 10pt; color: #555;">
          Tanggal: ${dateStr}<br/>
          Lokasi: ${state.location.name} (${state.location.elevationMeters} mdpl)
        </div>
      </div>
      <div style="margin-bottom: 14px; font-size: 10.5pt;">
        <strong>Petak:</strong> ${plot?.name || 'Petak Utama'} (${plot?.cropId || 'Tanaman'}) &bull; <strong>Fase:</strong> ${engine?.stageName || '-'} (${engine?.currentHST || 0} HST) &bull; <strong>Luas:</strong> ${plot?.areaHa || 1} Ha
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10pt;">
        <thead>
          <tr style="background: #1E4D35; color: #fff;">
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Parameter Biofisik FAO-56 PM</th>
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Nilai Komputasi &amp; Satuan</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="border: 1px solid #D3E0D6; padding: 6px 8px;">Evapotranspirasi Acuan (ETo)</td><td style="border: 1px solid #D3E0D6; padding: 6px 8px;"><strong>${f56?.et0_daily_mm?.toFixed(2) || '-'} mm/hari</strong> (Penman-Monteith)</td></tr>
          <tr><td style="border: 1px solid #D3E0D6; padding: 6px 8px;">Koefisien Tanaman (Kc Terverifikasi)</td><td style="border: 1px solid #D3E0D6; padding: 6px 8px;"><strong>${f56?.kc_current?.toFixed(2) || '-'}</strong> (${engine?.stageName || '-'})</td></tr>
          <tr><td style="border: 1px solid #D3E0D6; padding: 6px 8px;">Kebutuhan Air Tanaman (ETc = ETo &times; Kc)</td><td style="border: 1px solid #D3E0D6; padding: 6px 8px;"><strong>${f56?.etc_daily_mm?.toFixed(2) || '-'} mm/hari</strong></td></tr>
          <tr><td style="border: 1px solid #D3E0D6; padding: 6px 8px;">Kapasitas Air Siap Diserap (RAW)</td><td style="border: 1px solid #D3E0D6; padding: 6px 8px;"><strong>${f56?.raw_mm?.toFixed(2) || '-'} mm</strong> (p = ${f56?.p_fraction || 0.4})</td></tr>
          <tr><td style="border: 1px solid #D3E0D6; padding: 6px 8px;">Total Air Tersedia (TAW)</td><td style="border: 1px solid #D3E0D6; padding: 6px 8px;"><strong>${f56?.taw_mm?.toFixed(2) || '-'} mm</strong></td></tr>
          <tr><td style="border: 1px solid #D3E0D6; padding: 6px 8px;">Deplesi Lengas Tanah Saat Ini (Dr)</td><td style="border: 1px solid #D3E0D6; padding: 6px 8px;"><strong>${f56?.depletion_dr_mm?.toFixed(2) || '-'} mm</strong> ${f56 && f56.depletion_dr_mm > f56.raw_mm ? '<span style="color:#B91C1C; font-weight:bold;">[CEKAMAN AIR]</span>' : '<span style="color:#1E4D35;">[LENGAS AMAN]</span>'}</td></tr>
          <tr><td style="border: 1px solid #D3E0D6; padding: 6px 8px;">Defisit Tekanan Uap (VPD Tetens)</td><td style="border: 1px solid #D3E0D6; padding: 6px 8px;"><strong>${features?.currentVPD.toFixed(2) || '-'} kPa</strong> (Suhu: ${weather?.temperature.toFixed(1)}°C, RH: ${Math.round(weather?.relativeHumidity || 0)}%)</td></tr>
          <tr><td style="border: 1px solid #D3E0D6; padding: 6px 8px;">Akumulasi Hujan 7 Hari</td><td style="border: 1px solid #D3E0D6; padding: 6px 8px;"><strong>${features?.rolling7dRain?.toFixed(1) || '-'} mm</strong> (Spell hujan: ${features?.consecutiveRainyDays || 0} hari)</td></tr>
        </tbody>
      </table>
      <div style="font-size: 9.5pt; color: #555; font-style: italic; border-top: 1px dashed #ccc; padding-top: 8px;">
        Dihasilkan secara deterministik oleh Engine TaniAdapt. Sesuai FAO Irrigation &amp; Drainage Paper No. 56.
      </div>
    </div>
  `;
}

function renderPortfolioPreviewHtml(): string {
  const rows = state.plots.map(p => {
    const res = state.plotEngineResults[p.id]?.engineResult;
    const crop = CROPS_LIST.find(c => c.id === p.cropId);
    return `
      <tr>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px;"><strong>${p.name}</strong><br/><small style="color:#666;">${p.placeName}</small></td>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px;">${crop?.label || p.cropId} (${p.hst} HST)</td>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px;">${p.stageName}</td>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px; font-weight: bold; color: ${p.risk === 'TINGGI' ? '#B91C1C' : '#1E4D35'};">${p.risk}</td>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px;">${res ? (res.irrigation.status === 'DRAINASE_MENDESAK' ? 'Drainase Mendesak' : 'Optimal') : '-'}</td>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px;">${res ? (res.fertilization.safeToApply ? 'Aman' : 'Tunda') : '-'}</td>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px; font-size: 9pt;">${res?.recommendations[0]?.action || '-'}</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-family: 'Times New Roman', Times, serif; color: #111; line-height: 1.5; font-size: 11pt;">
      <div style="border-bottom: 2px solid #1E4D35; padding-bottom: 8px; margin-bottom: 16px;">
        <h2 style="font-size: 16pt; color: #1E4D35; margin: 0; text-transform: uppercase;">TaniAdapt: Ikhtisar Portofolio Seluruh Lahan</h2>
        <p style="font-size: 10pt; color: #555; margin: 4px 0 0 0; font-style: italic;">Rangkuman Operasional Harian Lapangan (Mode Petani / Mandor)</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 9.5pt;">
        <thead>
          <tr style="background: #1E4D35; color: #fff;">
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Petak Lahan</th>
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Komoditas</th>
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Fase</th>
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Risiko</th>
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Irigasi</th>
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Pupuk</th>
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Tindakan Prioritas</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdvancePortfolioPreviewHtml(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const rows = state.plots.map(p => {
    const res = state.plotEngineResults[p.id]?.engineResult;
    const f56 = res?.fao56;
    const crop = CROPS_LIST.find(c => c.id === p.cropId);
    return `
      <tr>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px;"><strong>${p.name}</strong><br/><small style="color:#666;">${p.placeName}</small></td>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px;">${crop?.label || p.cropId}<br/>(${p.hst} HST)</td>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px;">${f56?.et0_daily_mm?.toFixed(1) || '-'}</td>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px;">${f56?.kc_current?.toFixed(2) || '-'}</td>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px;">${f56?.etc_daily_mm?.toFixed(1) || '-'}</td>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px;">${f56 ? `${f56.depletion_dr_mm.toFixed(1)} / ${f56.raw_mm.toFixed(1)}` : '-'}</td>
        <td style="border: 1px solid #D3E0D6; padding: 6px 8px; font-weight: bold; color: ${p.risk === 'TINGGI' ? '#B91C1C' : '#1E4D35'};">${p.risk}</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-family: 'Times New Roman', Times, serif; color: #111; line-height: 1.5; font-size: 11pt;">
      <div style="border-bottom: 2px solid #1E4D35; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h2 style="font-size: 16pt; color: #1E4D35; margin: 0; text-transform: uppercase;">TaniAdapt: Matriks Biofisik Portofolio Lintas Petak</h2>
          <p style="font-size: 10pt; color: #555; margin: 4px 0 0 0; font-style: italic;">Kompilasi Agrometeorologi FAO-56 &amp; Mikroklimat Komparatif (Mode Advance)</p>
        </div>
        <div style="text-align: right; font-size: 10pt; color: #555;">
          Pengelola: ${state.authUser?.full_name || 'Petani Mandiri'}<br/>
          Terbit: ${dateStr}
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 9.5pt;">
        <thead>
          <tr style="background: #1E4D35; color: #fff;">
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Petak</th>
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Komoditas</th>
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">ETo (mm)</th>
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Kc</th>
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">ETc (mm)</th>
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Dr / RAW</th>
            <th style="border: 1px solid #D3E0D6; padding: 6px 8px; text-align: left;">Risiko</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function renderViews() {
  document.querySelectorAll('[data-view]').forEach((el) => {
    const e = el as HTMLElement;
    e.hidden = e.dataset.view !== state.view;
  });

  bindText('title', TITLES[state.view] || 'Dashboard');
  bindText('cropLabel', CROPS_LIST.find(c => c.id === state.cropId)?.label || 'Tanaman');
}

function renderUIMode() {
  const isDefault = state.uiMode === 'default';

  // Update all mode toggle buttons
  document.querySelectorAll('[data-ui-mode]').forEach((el) => {
    const btn = el as HTMLElement;
    const mode = btn.dataset.uiMode;
    const active = (mode === 'default' && isDefault) || (mode === 'pro' && !isDefault);
    if (active) {
      btn.style.background = 'var(--green)';
      btn.style.color = '#FFFFFF';
      btn.classList.add('active');
    } else {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--muted)';
      btn.classList.remove('active');
    }
  });

  // Header Single Mode Toggle Button & Indicator
  const toggleBtn = $('#btn-toggle-ui-mode');
  const toggleLabel = $('#mode-toggle-label');
  const toggleIndicator = $('#mode-toggle-indicator');

  if (toggleLabel) {
    toggleLabel.textContent = isDefault ? 'Mode Petani (Sederhana)' : 'Mode Riset (Advance)';
  }
  if (toggleIndicator) {
    toggleIndicator.style.background = isDefault ? 'var(--green)' : '#1E3A8A';
  }
  if (toggleBtn) {
    toggleBtn.style.borderColor = isDefault ? 'var(--line)' : '#93C5FD';
    toggleBtn.style.background = isDefault ? '#FFFFFF' : '#EFF6FF';
    toggleBtn.title = isDefault ? 'Klik untuk beralih ke Mode Riset (Advance)' : 'Klik untuk beralih ke Mode Petani (Sederhana)';
  }

  // Toggle "Bukti Ilmiah (16 Field)" visibility based on Mode
  const evBox = $('#evidence-sidebar-container');
  if (evBox) {
    evBox.style.display = !isDefault ? 'block' : 'none';
  }

  // Toggle Stress Scenario Switcher based on Mode
  const stressToggle = document.querySelector('[aria-label="Uji stres skenario cuaca"]') as HTMLElement;
  if (stressToggle) {
    stressToggle.style.display = !isDefault ? 'flex' : 'none';
  }

  // Sembunyikan bagian analitik statistik rumit di Mode Ringkas (Petani)
  const factorsSection = $('#factors-section');
  if (factorsSection) {
    factorsSection.style.display = !isDefault ? 'flex' : 'none';
  }

  const chartSection = $('#chart-section');
  if (chartSection) {
    chartSection.style.display = !isDefault ? 'flex' : 'none';
  }

  // Sembunyikan Sumber Evidence di Chat Tania pada Mode Ringkas (Petani), tampilkan khusus di Mode Advance
  const chatEvidenceSection = $('#chat-evidence-section');
  if (chatEvidenceSection) {
    chatEvidenceSection.style.display = !isDefault ? 'flex' : 'none';
  }

  // Banner Penjelas Perbedaan Mode
  const banner = $('#mode-banner');
  if (banner) {
    if (isDefault) {
      banner.style.display = 'flex';
      banner.style.background = '#F0FDF4';
      banner.style.border = '1.5px solid #BBF7D0';
      banner.style.color = '#166534';
      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px">
          <span style="font-weight: 800; font-size: 13px; background: #DCFCE7; color: #166534; padding: 2px 8px; border-radius: 6px">PETANI</span>
          <span><strong>Mode Ringkas (Petani):</strong> Menampilkan ringkasan aksi praktis harian di lahan (Siram, Semprot, Pupuk). Rumus biofisik, grafik penguapan, dan bobot statistik disembunyikan agar ramah dan tidak membingungkan petani.</span>
        </div>
        <button type="button" data-ui-mode="pro" style="background: none; border: none; font: inherit; font-size: 12.5px; font-weight: 700; color: #166534; text-decoration: underline; cursor: pointer; white-space: nowrap">
          Buka Data Lanjutan &rarr;
        </button>
      `;
    } else {
      banner.style.display = 'flex';
      banner.style.background = '#F0F9FF';
      banner.style.border = '1.5px solid #BAE6FD';
      banner.style.color = '#0369A1';
      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px">
          <span style="font-weight: 800; font-size: 13px; background: #E0F2FE; color: #0369A1; padding: 2px 8px; border-radius: 6px">RISET</span>
          <span><strong>Mode Lanjutan (Detail &amp; Riset):</strong> Seluruh metrik biofisik mekanistik FAO-56, grafik penguapan VPD, matriks lag temporal, dan simulasi 7 hari aktif ditampilkan untuk pengelola kebun, agribisnis, dan akademisi.</span>
        </div>
        <button type="button" data-ui-mode="default" style="background: none; border: none; font: inherit; font-size: 12.5px; font-weight: 700; color: #0369A1; text-decoration: underline; cursor: pointer; white-space: nowrap">
          Tampilan Ringkas &rarr;
        </button>
      `;
    }
  }

  renderFao56ProPanel();
}

function renderFao56ProPanel() {
  const container = $('#fao56-pro-container');
  if (!container) return;

  if (state.uiMode !== 'pro' || !state.engineResult?.fao56) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  const f = state.engineResult.fao56;
  const res = state.engineResult;

  const isBawang = state.cropId === 'bawang_merah';
  const isPadi = state.cropId === 'padi';
  const isCabai = state.cropId === 'cabai' || state.cropId === 'cabai_rawit';

  let regimeNotice = '';
  if (isBawang) {
    regimeNotice = `<div style="background: #FEE2E2; border-left: 4px solid #DC2626; padding: 10px 14px; border-radius: 8px; font-size: 13px; color: #991B1B">
      <strong>[DIBLOKIR] Status Registri Ilmiah (Phase 5): PENDING NEW DATA</strong><br>
      Ketiadaan data sentra valid di Jawa Barat. Seluruh output disajikan terbatas untuk kajian komparasi drainase.
    </div>`;
  } else if (isPadi) {
    regimeNotice = `<div style="background: #FEF3C7; border-left: 4px solid #D97706; padding: 10px 14px; border-radius: 8px; font-size: 13px; color: #92400E">
      <strong>[STATUS] Modul Deplesi Air (Phase 4 & 5): EVIDENCE_INSUFFICIENT (Rezim Sawah Tergenang)</strong><br>
      Padi sawah di Jawa Barat dibudidayakan dalam kondisi tergenang (ponded wetland). Rumus deplesi lengas tanah tak jenuh (RAW = p * TAW) tidak berlaku secara biologis tanpa model perkolasi genangan lokal.
    </div>`;
  } else if (isCabai) {
    regimeNotice = `<div style="background: #FEF3C7; border-left: 4px solid #D97706; padding: 10px 14px; border-radius: 8px; font-size: 13px; color: #92400E">
      <strong>[STATUS] Modul Deplesi Air Cabai: UNVERIFIED (FAO-56 Hanya Memuat Paprika Subtropis)</strong><br>
      Cabai tropis Jawa Barat dibudidayakan di bedengan bermulsa plastik MPHP (evaporasi ditekan hingga 70%). Sistem menolak ekstrapolasi liar dari sweet pepper. Modul proteksi jamur fajar LWD (Sentelhas 2008), jendela semprot angin, dan panen tetap aktif 100%.
    </div>`;
  }

  // 7-day forward simulation rows
  let forwardSimRows = '';
  if (f.proyeksi_7hari && f.proyeksi_7hari.length > 0) {
    forwardSimRows = f.proyeksi_7hari.map(p => {
      const isCrossing = p.dr_prakiraan_mm > p.raw_mm;
      const dayLabel = p.hari === 0 ? 'Hari ini' : p.hari === 1 ? 'Besok' : `H+${p.hari}`;
      return `<tr style="border-bottom: 1px solid var(--line); font-size: 12.5px">
        <td style="padding: 8px 10px; font-weight: 600">${dayLabel} (${p.tanggal})</td>
        <td style="padding: 8px 10px; font-family: 'IBM Plex Mono', monospace; font-weight: 700; color: ${isCrossing ? 'var(--risk-strong)' : 'var(--ink)'}">
          ${p.dr_prakiraan_mm} mm
        </td>
        <td style="padding: 8px 10px; font-family: 'IBM Plex Mono', monospace; color: var(--muted)">${p.dr_tanpa_hujan_mm} mm</td>
        <td style="padding: 8px 10px; font-family: 'IBM Plex Mono', monospace; color: var(--green); font-weight: 600">${p.raw_mm} mm</td>
        <td style="padding: 8px 10px">
          ${isCrossing
            ? '<span style="background: #FEE2E2; color: #991B1B; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700">Cekaman Air (Dr > RAW)</span>'
            : '<span style="background: #DCFCE7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700">Aman Terpenuhi</span>'
          }
        </td>
      </tr>`;
    }).join('');
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--line); padding-bottom: 12px">
      <div>
        <div style="display: flex; align-items: center; gap: 8px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20M12 2v20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93"/></svg>
          <h2 style="margin: 0; font-size: 17px; font-weight: 800; color: var(--ink)">Panel Biofisik Mekanistik FAO-56 &amp; Riset Komputasional</h2>
        </div>
        <div style="font-size: 12px; color: var(--muted); margin-top: 2px">Mode Lanjutan: Transparansi data biofisik dan kalkulasi agrometeorologi untuk pengelola kebun, kampus, dan peneliti</div>
      </div>
      <div style="display: flex; gap: 6px; flex-wrap: wrap">
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700; background: var(--sage); color: var(--green); padding: 3px 8px; border-radius: 6px">
          VERIFIED_METHOD (FAO-56)
        </span>
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700; background: #E0E7FF; color: #3730A3; padding: 3px 8px; border-radius: 6px">
          Draft 2020-12
        </span>
      </div>
    </div>

    ${regimeNotice}

    <!-- 6 METRIC TILES BIOFISIK -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px">
      <div style="background: var(--ground); border: 1px solid var(--line); border-radius: 12px; padding: 12px">
        <div style="font-size: 11px; color: var(--muted); font-weight: 600">ET0 Penman-Monteith</div>
        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 800; color: var(--ink); margin-top: 2px">${f.et0_daily_mm} <span style="font-size: 12px; font-weight: 500">mm/hari</span></div>
        <div style="font-size: 10.5px; color: var(--muted); margin-top: 4px">Allen et al. (1998) Eq. 6</div>
      </div>

      <div style="background: var(--ground); border: 1px solid var(--line); border-radius: 12px; padding: 12px">
        <div style="font-size: 11px; color: var(--muted); font-weight: 600">Koefisien Tanaman (Kc)</div>
        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 800; color: var(--green); margin-top: 2px">${f.kc_current}</div>
        <div style="font-size: 10.5px; color: var(--muted); margin-top: 4px">FAO-56 Tabel 12 (HST ${res.currentHST})</div>
      </div>

      <div style="background: var(--ground); border: 1px solid var(--line); border-radius: 12px; padding: 12px">
        <div style="font-size: 11px; color: var(--muted); font-weight: 600">Konsumsi Tanaman (ETc)</div>
        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 800; color: var(--ink); margin-top: 2px">${f.etc_daily_mm} <span style="font-size: 12px; font-weight: 500">mm/hari</span></div>
        <div style="font-size: 10.5px; color: var(--muted); margin-top: 4px">ETc = Kc × ET0</div>
      </div>

      <div style="background: var(--ground); border: 1px solid var(--line); border-radius: 12px; padding: 12px">
        <div style="font-size: 11px; color: var(--muted); font-weight: 600">Air Tersedia Total (TAW)</div>
        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 800; color: var(--ink); margin-top: 2px">${f.taw_mm} <span style="font-size: 12px; font-weight: 500">mm</span></div>
        <div style="font-size: 10.5px; color: var(--muted); margin-top: 4px">Loam 150 mm/m × Zr ${f.root_depth_m}m</div>
      </div>

      <div style="background: var(--ground); border: 1px solid var(--line); border-radius: 12px; padding: 12px">
        <div style="font-size: 11px; color: var(--muted); font-weight: 600">Batas Siap Serap (RAW)</div>
        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 800; color: #2563EB; margin-top: 2px">${f.raw_mm} <span style="font-size: 12px; font-weight: 500">mm</span></div>
        <div style="font-size: 10.5px; color: var(--muted); margin-top: 4px">RAW = p (${f.p_fraction}) × TAW</div>
      </div>

      <div style="background: var(--ground); border: 1px solid var(--line); border-radius: 12px; padding: 12px">
        <div style="font-size: 11px; color: var(--muted); font-weight: 600">Deplesi Perakaran (Dr)</div>
        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 800; color: ${f.is_stressed ? 'var(--risk-strong)' : 'var(--green)'}; margin-top: 2px">${f.depletion_dr_mm} <span style="font-size: 12px; font-weight: 500">mm</span></div>
        <div style="font-size: 10.5px; color: var(--muted); margin-top: 4px">${f.is_stressed ? 'Dr > RAW (Cekaman Air)' : 'Dr <= RAW (Optimal)'}</div>
      </div>
    </div>

    <!-- SENSITIVITY AND COLD-START BADGES -->
    <div style="display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px">
      <div style="flex: 1 1 240px; background: #F8FAFC; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px">
        <strong style="color: var(--ink)">Uji Sensitivitas Tanah Loam (FAO-56 Tabel 19):</strong>
        <div style="margin-top: 3px; color: ${f.sensitif_terhadap_asumsi_tanah ? '#B45309' : 'var(--green)'}; font-weight: 600">
          ${f.sensitif_terhadap_asumsi_tanah ? '[Sensitif] Terhadap batas rentang TAW 130–180 mm/m' : '[Stabil] Terhadap variasi rentang tekstur tanah loam'}
        </div>
      </div>

      <div style="flex: 1 1 240px; background: #F8FAFC; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px">
        <strong style="color: var(--ink)">Uji Sensitivitas Presipitasi Efektif (Peff):</strong>
        <div style="margin-top: 3px; color: ${f.sensitif_terhadap_asumsi_hujan_efektif ? '#B45309' : 'var(--green)'}; font-weight: 600">
          ${f.sensitif_terhadap_asumsi_hujan_efektif ? '[Sensitif] Keputusan sensitif terhadap reduksi Peff = 0.8 * P' : '[Stabil] Keputusan stabil terhadap reduksi Peff = 0.8 * P'}
        </div>
      </div>

      <div style="flex: 1 1 240px; background: #F8FAFC; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px">
        <strong style="color: var(--ink)">Status Ledger Cold-Start (M3):</strong>
        <div style="margin-top: 3px; color: var(--green); font-weight: 600">
          ${f.dr_awal_status === 'pasti' ? '[Pasti] Konvergen ke kapasitas lapang' : 'Interval [Rendah, Tinggi]'}
        </div>
      </div>
    </div>

    <!-- 7-DAY FORWARD SIMULATION TABLE -->
    ${forwardSimRows ? `
      <div style="border-top: 1px solid var(--line); padding-top: 14px">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
          <strong style="font-size: 14px; color: var(--ink)">Simulasi Maju 7 Hari (Prakiraan Cuaca vs Tanpa Hujan):</strong>
          <span style="font-size: 11.5px; color: var(--muted); font-family: 'IBM Plex Mono', monospace">Proyeksi berhenti saat melintasi RAW pertama (Ks tidak dimodelkan)</span>
        </div>
        <div style="overflow-x: auto">
          <table style="width: 100%; border-collapse: collapse; text-align: left">
            <thead>
              <tr style="background: var(--ground); border-bottom: 1.5px solid var(--line); font-size: 12px; color: var(--muted)">
                <th style="padding: 8px 10px">Hari &amp; Tanggal</th>
                <th style="padding: 8px 10px">Dr Skenario Prakiraan</th>
                <th style="padding: 8px 10px">Dr Skenario Tanpa Hujan</th>
                <th style="padding: 8px 10px">Batas RAW Kritis</th>
                <th style="padding: 8px 10px">Status Proyeksi</th>
              </tr>
            </thead>
            <tbody>
              ${forwardSimRows}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    <div style="background: var(--ground); padding: 10px 14px; border-radius: 10px; font-size: 11.5px; color: var(--muted); line-height: 1.4">
      <strong>Catatan Ilmiah Keputusan Engine:</strong> Berdasarkan temuan ekonometrika Phase 7 &amp; evaluasi ML Phase 9, model regresi berbasis cuaca saja tidak memiliki bukti daya generalisasi out-of-sample pada tahun baru (LOYO CV R² ≈ 0). Maka sistem mengunci status <em>claim_forbidden</em> pada tebak tonase panen, dan mengalihkan 100% keputusan pada rekomendasi tindakan diurnal harian berbasis biofisik deterministik.
    </div>
  `;
}

function renderAuth() {
  const container = $('#auth-status-container');
  const mobileContainer = $('#mobile-auth-status-container');
  if (!container && !mobileContainer) return;

  const isPro = state.authUser?.user_type === 'farm_organisasi';
  const authHtml = state.authUser ? `
    <div class="user-chip">
      <div class="user-chip-text">
        <span class="user-chip-name" title="${esc(state.authUser.full_name)}">${esc(state.authUser.full_name)}</span>
        <span class="user-chip-role">${isPro ? 'AKADEMISI' : 'PETANI'}</span>
      </div>
      <button type="button" id="btn-logout" class="btn-logout-chip" title="Keluar dari akun">
        Keluar
      </button>
    </div>
  ` : `
    <button type="button" id="open-auth-btn" class="btn-login-chip">
      <span>Masuk / Profil</span>
    </button>
  `;

  if (container) container.innerHTML = authHtml;
  if (mobileContainer) mobileContainer.innerHTML = authHtml;
}

async function updateDbStatusDisplay() {
  const statusEl = document.getElementById('auth-db-status');
  if (!statusEl) return;
  try {
    const res = await fetch('/api/auth/status');
    if (res.ok) {
      const data = await res.json();
      if (data.is_postgres) {
        statusEl.textContent = 'Terhubung ke Database Cloud PostgreSQL';
        statusEl.style.color = 'var(--green)';
      } else {
        statusEl.textContent = 'Penyimpanan Offline (Sinkronisasi Lokal)';
        statusEl.style.color = '#B45309';
      }
    }
  } catch {
    statusEl.textContent = 'Penyimpanan Offline (Lokal)';
    statusEl.style.color = '#B45309';
  }
}

function renderAuthModal() {
  const modal = $('#auth-modal');
  if (!modal) return;
  modal.hidden = !state.isAuthModalOpen;
  if (!state.isAuthModalOpen) return;

  const regPlantDate = document.getElementById('reg-plantdate') as HTMLInputElement;
  if (regPlantDate && !regPlantDate.value) {
    regPlantDate.value = new Date().toISOString().split('T')[0];
  }

  updateDbStatusDisplay();

  const loginTab = $('#auth-tab-login');
  const regTab = $('#auth-tab-register');
  const loginForm = $('#login-form');
  const regForm = $('#register-form');

  const isLogin = state.authTab === 'login';
  if (loginTab) {
    loginTab.style.color = isLogin ? 'var(--green)' : 'var(--muted)';
    loginTab.style.borderBottom = isLogin ? '2px solid var(--green)' : 'none';
    loginTab.style.fontWeight = isLogin ? '700' : '600';
  }
  if (regTab) {
    regTab.style.color = !isLogin ? 'var(--green)' : 'var(--muted)';
    regTab.style.borderBottom = !isLogin ? '2px solid var(--green)' : 'none';
    regTab.style.fontWeight = !isLogin ? '700' : '600';
  }

  if (loginForm) loginForm.style.display = isLogin ? 'flex' : 'none';
  if (regForm) regForm.style.display = !isLogin ? 'flex' : 'none';
}

function renderSettings() {
  // 1. UI Mode Radios
  const rDefault = $('#set-mode-default') as HTMLInputElement;
  const rPro = $('#set-mode-pro') as HTMLInputElement;
  if (rDefault && rPro) {
    rDefault.checked = state.uiMode === 'default';
    rPro.checked = state.uiMode === 'pro';
  }

  // 2. Language Radios
  const rLangId = $('#set-lang-id') as HTMLInputElement;
  const rLangSu = $('#set-lang-su') as HTMLInputElement;
  if (rLangId && rLangSu) {
    rLangId.checked = state.selectedLanguage === 'id';
    rLangSu.checked = state.selectedLanguage === 'su';
  }

  // 3. Soil Select
  const soilSelect = $('#settings-soil-select') as HTMLSelectElement;
  if (soilSelect) {
    soilSelect.value = state.soilTexture;
  }

  // 4. Peff Select
  const peffSelect = $('#settings-peff-select') as HTMLSelectElement;
  if (peffSelect) {
    peffSelect.value = String(state.peffRatio);
  }

  // 5. Custom KB List
  const kbList = $('#custom-kb-list');
  if (kbList) {
    if (state.customKnowledgeBase.length === 0) {
      kbList.innerHTML = `<span style="font-size: 12px; color: var(--muted); font-style: italic">Belum ada catatan mandiri tambahan. Masukkan SOP atau catatan varietas di atas.</span>`;
    } else {
      kbList.innerHTML = state.customKnowledgeBase.map((item, idx) => {
        return `<div style="display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; font-size: 12.5px; gap: 8px">
          <span style="color: var(--ink)">${idx + 1}. ${esc(item)}</span>
          <button type="button" data-del-kb="${idx}" style="background: none; border: none; color: #DC2626; cursor: pointer; font-size: 14px; font-weight: 700" title="Hapus catatan">&times;</button>
        </div>`;
      }).join('');
    }
  }
}

function render() {
  renderNav();
  renderViews();
  renderUIMode();
  renderAuth();
  renderActivePlotSelector();
  renderLocationDropdown();
  renderCrops();
  renderGrowthStages();
  renderStressBar();

  if (state.view === 'ringkasan') {
    renderPlotFeed();
  } else if (state.view === 'detail-lahan') {
    renderDetailLahan();
  } else if (state.view === 'cuaca') {
    renderBiofisikPlotBanner();
    renderWeatherView();
    renderRiskCard();
    renderRecommendations();
    renderInfluentialFactors();
    renderWeatherSnapshot();
    renderFao56ProPanel();
  } else if (state.view === 'tanya') {
    renderChat();
  } else if (state.view === 'lahan') {
    renderFields();
  } else if (state.view === 'pengaturan') {
    renderSettings();
  }

  renderEvidenceModal();
  renderPrintModal();
  renderAuthModal();
}

// ---------- RAG EXPLANATION ASSISTANT ----------
async function askQuestion(q: string) {
  const currentImage = state.pendingChatImage;
  const currentFileName = state.pendingChatFileName;

  // Clear pending attachment state
  state.pendingChatImage = null;
  state.pendingChatFileName = null;
  const previewBox = document.getElementById('chat-attachment-preview');
  if (previewBox) previewBox.style.display = 'none';

  state.thread.push({
    me: true,
    text: q,
    image: currentImage || undefined,
    fileName: currentFileName || undefined
  });
  renderChat();

  const crop = CROP_MODELS[state.cropId];
  const res = state.engineResult;
  const f = state.features;

  // Panggil LLM Groq (multimodal vision + RAG custom knowledge)
  let groqResult = null;
  if (res && crop) {
    groqResult = await askGroqAgronomist(q, {
      cropName: crop.name,
      scientificName: crop.scientificName,
      locationName: state.location.name,
      hst: state.currentHST,
      stageName: res.stageName,
      overallRisk: res.overallRisk,
      recommendations: res.recommendations.map(r => `${r.title}: ${r.action}`),
      features: f ? {
        consecutiveRainyDays: f.consecutiveRainyDays,
        rolling3dRain: f.rolling3dRain,
        rolling7dRain: f.rolling7dRain,
        rolling7dRH: f.rolling7dRH,
        currentVPD: f.currentVPD,
      } : null,
      customKnowledge: state.customKnowledgeBase,
      imageBase64: currentImage || undefined,
      language: state.selectedLanguage,
    });
  }

  let answer = '';
  let sourceDoc = '';

  if (groqResult && groqResult.text) {
    answer = groqResult.text;
    sourceDoc = groqResult.sourceDoc;
  } else {
    const qLower = q.toLowerCase();

    if (state.selectedLanguage === 'su') {
      if (qLower.includes('naha') || qLower.includes('kunaon') || qLower.includes('alasan') || qLower.includes('risiko')) {
        answer = `Tingkat résiko ${res?.overallRisk} dina ${crop?.name} fase ${res?.stageName} (${state.currentHST} HST) balukarna tina hujan ${f?.consecutiveRainyDays || 0} dinten ngaruntuy kalayan RH rata-rata ${Math.round(f?.rolling7dRH || 85)}% sareng VPD ${f?.currentVPD.toFixed(2)} kPa. Kaayaan daun baseuh lami ieu ngaleuwihan wates inféksi jamur numutkeun panalungtikan Sentelhas et al. (2008).`;
        sourceDoc = 'Sentelhas et al. (2008)';
      } else if (qLower.includes('gemuk') || qLower.includes('pupuk') || qLower.includes('urea')) {
        answer = res?.fertilization.safeToApply
          ? 'Kaayaan aman pikeun masihan pupuk susulan. Prakiraan hujan alit pisan sehingga pupuk teu kahanyutkeun.'
          : 'Sistem nyarankeun nunda masihan pupuk dinten ieu supados teu kahanyutkeun ku limpasan cai hujan (rules.json RULE_FERT_RAIN_12H: CONVENTION_PENDING).';
        sourceDoc = 'rules.json (RULE_FERT_RAIN_12H: CONVENTION_PENDING)';
      } else if (qLower.includes('cai') || qLower.includes('siram') || qLower.includes('haseum') || qLower.includes('taneuh')) {
        answer = res?.irrigation.status === 'DRAINASE_MENDESAK'
          ? `Status ayeuna: DRAINASE MENDESAK! Hujan 7 dinten parantos ${Math.round(f?.rolling7dRain || 0)} mm. Taneuh parantos baseuh pisan ngaleuwihan kapasitas lapang. Enggal buka solokan supados akar teu asfiksia.`
          : `Kadar cai dina taneuh masih cukup pikeun fase ieu dumasar kana itungan FAO-56 Penman-Monteith. Teu kedah disiram kaleuleuwihi.`;
        sourceDoc = 'FAO-56 Water Balance';
      } else {
        answer = `Sim kuring Tania: Dumasar kana pituduh engine pikeun ${crop?.name} di ${state.location.name}, tingkat résiko dinten ieu aya dina level ${res?.overallRisk}. Rekomendasi utama: ${res?.recommendations[0]?.title || 'Pantau kebon sacara rutin'}. Mangga taroskeun perkawis panyiraman, pupuk, atanapi dasar ilmiah.`;
        sourceDoc = 'TaniAdapt Agro-Engine';
      }
    } else {
      if (qLower.includes('kenapa') || qLower.includes('mengapa') || qLower.includes('alasan') || qLower.includes('risiko')) {
        answer = `Tingkat risiko ${res?.overallRisk} pada ${crop?.name} fase ${res?.stageName} (${state.currentHST} HST) disebabkan oleh akumulasi ${f?.consecutiveRainyDays || 0} hari hujan berturut-turut dengan kelembapan 7 hari rata-rata ${Math.round(f?.rolling7dRH || 85)}% dan VPD ${f?.currentVPD.toFixed(2)} kPa. Kondisi kebasahan daun ini melampaui ambang kritis sporulasi jamur yang diteliti oleh Balitsa (2020) dan Sentelhas (2008).`;
        sourceDoc = 'Balitsa (2020) & Sentelhas (2008)';
      } else if (qLower.includes('pupuk') || qLower.includes('memupuk') || qLower.includes('fertil')) {
        if (!res?.fertilization.safeToApply) {
          answer = `Sistem MEREKOMENDASIKAN MENUNDA aplikasi pupuk saat ini. Berdasarkan aturan praktis tim (rules.json RULE_FERT_RAIN_12H, status CONVENTION_PENDING), prakiraan hujan >= 8.0 mm dalam rentang 12-24 jam berisiko melarutkan dan menghanyutkan pupuk butiran lewat limpasan permukaan. Tunggu jendela cuaca stabil sebelum pemupukan susulan.`;
        } else {
          answer = `Kondisi aman untuk aplikasi pupuk susulan. Prakiraan hujan dalam rentang 12-24 jam di bawah ambang waspada (<8 mm) sehingga pupuk dapat terserap optimal oleh perakaran aktif.`;
        }
        sourceDoc = 'rules.json (RULE_FERT_RAIN_12H: CONVENTION_PENDING)';
      } else if (qLower.includes('besok') || qLower.includes('tidak hujan') || qLower.includes('skenario') || qLower.includes('kering')) {
        answer = `Jika prakiraan cuaca berubah menjadi kering selama 2–3 hari berturut-turut, defisit tekanan uap (VPD) akan naik ke kisaran 0.8–1.2 kPa dan akumulasi kelembapan tajuk menurun drastis. Indeks risiko akan turun otomatis dari ${res?.overallRisk} menjadi Sedang atau Rendah, membuka jendela aman untuk penyemprotan protektan dan pemupukan.`;
        sourceDoc = 'Dynamic Scenario Engine';
      } else if (qLower.includes('air') || qLower.includes('drainase') || qLower.includes('siram') || qLower.includes('genangan')) {
        if (res?.irrigation.status === 'DRAINASE_MENDESAK') {
          answer = `Status saat ini: DRAINASE MENDESAK! Hujan kumulatif 7 hari mencapai ${Math.round(f?.rolling7dRain || 0)} mm. Tanah telah berada di atas kapasitas lapang (waterlogging). Genangan air lebih dari 24 jam menyebabkan asfiksia perakaran (kekurangan oksigen) dan mempermudah penetrasi bakteri Ralstonia solanacearum. Segera bersihkan parit pembuangan!`;
        } else {
          answer = `Kadar lengas tanah berada dalam batas normal untuk fase ini. Tidak diperlukan pengairan tambahan maupun tindakan drainase darurat.`;
        }
        sourceDoc = 'Agro-Hydrology Engine';
      } else if (qLower.includes('dasar') || qLower.includes('ilmiah') || qLower.includes('paper') || qLower.includes('bukti') || qLower.includes('riset')) {
        const allDocs = Object.values(LITERATURE_DATABASE);
        const relevantDoc = allDocs.find(l => l.crop.toLowerCase().includes(state.cropId)) || allDocs[0];
        answer = `Keputusan ini mengacu pada riset "${relevantDoc.title}" oleh ${relevantDoc.authors} (${relevantDoc.year}) di ${relevantDoc.location}. Ambang batas kritis yang digunakan adalah: ${relevantDoc.applicableThreshold}. Anda dapat membuka modal "Bukti Ilmiah (16 Field)" untuk rincian dataset lengkapnya.`;
        sourceDoc = `${relevantDoc.authors} (${relevantDoc.year})`;
      } else {
        answer = `Halo, saya Tania! Berdasarkan evaluasi engine TaniAdapt untuk ${crop?.name} di ${state.location.name}: Status risiko berada pada level ${res?.overallRisk}. Rekomendasi utama: ${res?.recommendations[0]?.title || 'Pantau perkembangan lahan rutin'}. Tanyakan skenario spesifik seperti pemupukan, drainase, atau dasar ilmiah jika membutuhkan penjelasan lebih dalam.`;
        sourceDoc = 'TaniAdapt Agro-Engine';
      }
    }
  }

  state.thread.push({ me: false, text: answer, sourceDoc });
  renderChat();
}

function sendChat() {
  const input = $('#chat') as HTMLInputElement;
  if (!input) return;
  const text = input.value.trim();
  if (!text && !state.pendingChatImage && !state.pendingChatFileName) return;
  input.value = '';
  askQuestion(text || (state.pendingChatImage ? 'Mohon analisis foto tanaman yang saya lampirkan ini.' : 'Mohon baca dokumen yang saya lampirkan.'));
}

// ---------- DEEP LINKING / URL QUERY PARAMS ----------
function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);

  const cropParam = params.get('crop') as CropId | null;
  if (cropParam && CROPS_LIST.some(c => c.id === cropParam)) {
    state.cropId = cropParam;
  }

  const locParam = params.get('loc');
  if (locParam) {
    const foundLoc = INDONESIAN_LOCATIONS.find(l => l.id.toLowerCase() === locParam.toLowerCase());
    if (foundLoc) state.location = foundLoc;
  }

  const viewParam = params.get('view');
  if (viewParam && ['ringkasan', 'cuaca', 'tanya', 'lahan'].includes(viewParam)) {
    state.view = viewParam as any;
  }

  const hstParam = params.get('hst');
  if (hstParam && !isNaN(Number(hstParam))) {
    state.currentHST = Math.max(1, Number(hstParam));
  }

  const openModal = params.get('openModal');
  if (openModal === 'evidence') {
    state.isEvidenceModalOpen = true;
  }
}

// ---------- EVENT LISTENERS SETUP ----------
function setupEventListeners() {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Toggle Mobile Navbar Dropdown Menu
    const mobileNavToggle = target.closest('#mobile-navbar-toggle');
    if (mobileNavToggle) {
      const dropdown = $('#mobile-navbar-dropdown');
      const toggleBtn = $('#mobile-navbar-toggle');
      if (dropdown && toggleBtn) {
        const isOpen = !dropdown.hidden;
        dropdown.hidden = isOpen;
        toggleBtn.setAttribute('aria-expanded', String(!isOpen));
        toggleBtn.classList.toggle('active', !isOpen);
      }
      return;
    }

    // Auto-close mobile navbar dropdown when clicking any item inside it
    if (target.closest('#mobile-navbar-dropdown button, #mobile-navbar-dropdown a')) {
      const dropdown = $('#mobile-navbar-dropdown');
      const toggleBtn = $('#mobile-navbar-toggle');
      if (dropdown) dropdown.hidden = true;
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.classList.remove('active');
      }
    }

    // Auto-close dropdown when clicking outside
    if (!target.closest('.dashboard-topbar')) {
      const dropdown = $('#mobile-navbar-dropdown');
      const toggleBtn = $('#mobile-navbar-toggle');
      if (dropdown && !dropdown.hidden) {
        dropdown.hidden = true;
        if (toggleBtn) {
          toggleBtn.setAttribute('aria-expanded', 'false');
          toggleBtn.classList.remove('active');
        }
      }
    }

    // View Navigation
    const viewBtn = target.closest('[data-view-btn]') as HTMLElement;
    if (viewBtn && viewBtn.dataset.viewBtn) {
      state.view = viewBtn.dataset.viewBtn as any;
      render();
      return;
    }

    // Toggle Sidebar Collapsible (Desktop 68px Icon Rail)
    const collapseSidebarBtn = target.closest('#collapse-sidebar-btn, .sidebar-brand-link');
    if (collapseSidebarBtn) {
      const sidebar = $('#app-sidebar');
      if (sidebar) {
        sidebar.classList.toggle('sidebar-collapsed');
        document.body.classList.toggle('sidebar-collapsed');
      }
      return;
    }

    // Back to Dashboard / Ringkasan
    const backToDashboard = target.closest('#back-to-ringkasan-btn');
    if (backToDashboard) {
      state.view = 'ringkasan';
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 1. Direct 1-Click DOCX Export Buttons (Single Plot)
    const exportSingleDocx = target.closest('[data-export-single-docx], #btn-export-single-default, #btn-export-single-advance') as HTMLElement;
    if (exportSingleDocx) {
      const mode = (exportSingleDocx.dataset.exportSingleDocx as 'default' | 'advance') ||
                   (exportSingleDocx.id === 'btn-export-single-advance' ? 'advance' : 'default');
      const plotId = exportSingleDocx.dataset.plotId;
      const curPlot = (plotId ? state.plots.find(p => p.id === plotId) : null) || state.plots[state.fieldIndex] || state.plots[0];
      const pr = curPlot ? state.plotEngineResults[curPlot.id] : null;
      const res = pr?.engineResult || state.engineResult;
      const f = pr?.features || state.features;
      const cw = pr?.weatherData?.current || state.weatherData?.current || null;
      const daily = pr?.weatherData?.dailyForecast || state.weatherData?.dailyForecast;

      if (res && f) {
        const exportInput = {
          engineResult: res,
          features: f,
          currentWeather: cw,
          location: state.location,
          plotName: curPlot?.name,
          userName: state.authUser?.full_name,
          userType: state.authUser?.user_type,
          dailyForecast: daily,
          adminHierarchy: (curPlot as any)?.adminHierarchy || (state.location as any)?.adminHierarchy,
          trail: curPlot?.trail,
        };
        if (mode === 'advance') {
          generateSinglePlotAdvanceWordReport(exportInput);
        } else {
          generateAndDownloadWordReport(exportInput);
        }
      }
      return;
    }

    // 2. Ask Tania About Specific Plot
    const askTaniaPlot = target.closest('[data-ask-tania-plot]') as HTMLElement;
    if (askTaniaPlot && askTaniaPlot.dataset.askTaniaPlot !== undefined) {
      const idx = Number(askTaniaPlot.dataset.askTaniaPlot);
      const plot = state.plots[idx];
      if (plot) {
        state.fieldIndex = idx;
        state.activePlotForBiofisik = idx;
        state.cropId = plot.cropId;
        state.currentHST = plot.hst;
        const loc = INDONESIAN_LOCATIONS.find(l => l.id === plot.locationId);
        if (loc) state.location = loc;
        const pr = state.plotEngineResults[plot.id];
        if (pr) {
          state.weatherData = pr.weatherData;
          state.engineResult = pr.engineResult;
          state.features = pr.features;
        }
      }
      state.view = 'tanya';
      render();
      const crop = CROPS_LIST.find(c => c.id === plot?.cropId);
      const cropName = crop?.label || plot?.cropId || 'tanaman';
      const promptQ = `Bagaimana kondisi dan prioritas tindakan untuk petak ${plot?.name || 'lahan'} (${cropName}, ${plot?.hst || state.currentHST} HST) hari ini?`;
      askQuestion(promptQ);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 3. Export Portfolio DOCX
    const exportPortfolioDocx = target.closest('[data-export-portfolio-docx], #btn-export-portfolio-default, #btn-export-portfolio-advance') as HTMLElement;
    if (exportPortfolioDocx) {
      const mode = (exportPortfolioDocx.dataset.exportPortfolioDocx as 'default' | 'advance') ||
                   (exportPortfolioDocx.id === 'btn-export-portfolio-advance' ? 'advance' : 'default');
      if (mode === 'advance') {
        const portfolioAdvancePlots: PortfolioAdvancePlot[] = state.plots.map(p => {
          const pr = state.plotEngineResults[p.id];
          const res = pr?.engineResult;
          const f56 = res?.fao56;
          const crop = CROPS_LIST.find(c => c.id === p.cropId);
          return {
            name: p.name,
            cropName: crop?.label || p.cropId,
            scientificName: crop?.scientific || '',
            placeName: p.placeName,
            hst: p.hst,
            stageName: p.stageName,
            risk: p.risk,
            irrigationStatus: res ? (res.irrigation.status === 'DRAINASE_MENDESAK' ? 'Drainase Mendesak' : 'Optimal') : '-',
            fertilizationStatus: res ? (res.fertilization.safeToApply ? 'Aman' : 'Tunda') : '-',
            topRecommendation: res?.recommendations[0]?.action || '-',
            etcMmDay: f56?.etc_daily_mm,
            etoMmDay: f56?.et0_daily_mm,
            kc: f56?.kc_current,
            drMm: f56?.depletion_dr_mm,
            rawMm: f56?.raw_mm,
            vpdKpa: pr?.features?.currentVPD,
            tempC: state.weatherData?.current?.temperature,
            rhPercent: state.weatherData?.current?.relativeHumidity,
            rolling7dRain: pr?.features?.rolling7dRain,
          };
        });
        generatePortfolioAdvanceWordReport(portfolioAdvancePlots, state.authUser?.full_name);
      } else {
        const portfolioPlots: PortfolioReportPlot[] = state.plots.map(p => {
          const pr = state.plotEngineResults[p.id];
          const res = pr?.engineResult;
          const crop = CROPS_LIST.find(c => c.id === p.cropId);
          return {
            name: p.name,
            cropName: crop?.label || p.cropId,
            scientificName: crop?.scientific || '',
            placeName: p.placeName,
            hst: p.hst,
            stageName: p.stageName,
            risk: p.risk,
            irrigationStatus: res ? (res.irrigation.status === 'DRAINASE_MENDESAK' ? 'Drainase Mendesak' : res.irrigation.status === 'BUTUH_PENGAIRAN' ? 'Perlu Air' : 'Optimal') : 'Optimal',
            fertilizationStatus: res ? (res.fertilization.safeToApply ? 'Aman' : 'Tunda') : 'Aman',
            topRecommendation: res?.recommendations[0]?.action || 'Pantau perkembangan tanaman',
          };
        });
        generatePortfolioWordReport(portfolioPlots, state.authUser?.full_name);
      }
      return;
    }

    // 4. Open Dedicated Detail Lahan View
    const openDetailPlot = target.closest('[data-open-detail-plot]') as HTMLElement;
    if (openDetailPlot && openDetailPlot.dataset.openDetailPlot !== undefined) {
      const idx = Number(openDetailPlot.dataset.openDetailPlot);
      const plot = state.plots[idx];
      if (plot) {
        state.fieldIndex = idx;
        state.activePlotForBiofisik = idx;
        state.cropId = plot.cropId;
        state.currentHST = plot.hst;
        const loc = INDONESIAN_LOCATIONS.find(l => l.id === plot.locationId);
        if (loc) state.location = loc;
        const pr = state.plotEngineResults[plot.id];
        if (pr) {
          state.weatherData = pr.weatherData;
          state.engineResult = pr.engineResult;
          state.features = pr.features;
        }
      }
      state.view = 'detail-lahan';
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Crop Selection
    const cropBtn = target.closest('[data-crop]') as HTMLElement;
    if (cropBtn && cropBtn.dataset.crop) {
      state.cropId = cropBtn.dataset.crop as CropId;
      const crop = CROP_MODELS[state.cropId];
      if (crop && state.currentHST > crop.totalDurationDays) {
        state.currentHST = Math.round(crop.totalDurationDays * 0.45);
      }
      recomputeEngine();
      return;
    }

    // Stress Test Toggle
    const stressBtn = target.closest('[data-stress]') as HTMLElement;
    if (stressBtn && stressBtn.dataset.stress) {
      state.stressMode = stressBtn.dataset.stress as StressScenario;
      recomputeEngine();
      return;
    }

    // Metric Toggle on Chart
    const metricBtn = target.closest('[data-metric]') as HTMLElement;
    if (metricBtn && metricBtn.dataset.metric) {
      state.metric = metricBtn.dataset.metric as MetricType;
      renderChart();
      return;
    }

    // Preset Question Chips
    const presetQ = target.closest('[data-preset-q]') as HTMLElement;
    if (presetQ && presetQ.dataset.presetQ !== undefined) {
      const qText = presetQ.textContent || '';
      askQuestion(qText);
      return;
    }

    // Field Select ("Lihat Jejak")
    const fieldSelect = target.closest('[data-field-select]') as HTMLElement;
    if (fieldSelect && fieldSelect.dataset.fieldSelect !== undefined) {
      state.fieldIndex = Number(fieldSelect.dataset.fieldSelect);
      const plot = state.plots[state.fieldIndex];
      if (plot) {
        state.cropId = plot.cropId;
        state.currentHST = plot.hst;
        const loc = INDONESIAN_LOCATIONS.find(l => l.id === plot.locationId);
        if (loc) state.location = loc;
      }
      recomputeEngine();
      setTimeout(() => {
        const trailEl = document.getElementById('plot-trail-section');
        if (trailEl) {
          trailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
      return;
    }

    // "Buka Lahan Saya" from empty-state feed
    const goLahan = target.closest('[data-go-lahan]') as HTMLElement;
    if (goLahan) {
      state.view = 'lahan';
      render();
      return;
    }

    // "Lihat Analisis Detail →" from per-plot feed
    const openBiofisik = target.closest('[data-open-biofisik]') as HTMLElement;
    if (openBiofisik && openBiofisik.dataset.openBiofisik !== undefined) {
      const idx = Number(openBiofisik.dataset.openBiofisik);
      const plot = state.plots[idx];
      if (plot) {
        state.activePlotForBiofisik = idx;
        state.fieldIndex = idx;
        state.cropId = plot.cropId;
        state.currentHST = plot.hst;
        const loc = INDONESIAN_LOCATIONS.find(l => l.id === plot.locationId);
        if (loc) state.location = loc;
        const pr = state.plotEngineResults[plot.id];
        if (pr) {
          state.weatherData = pr.weatherData;
          state.engineResult = pr.engineResult;
          state.features = pr.features;
        }
      }
      state.view = 'cuaca';
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Field Open in Lahan Saya (Buka Analisis Detail Lahan)
    const fieldOpen = target.closest('[data-field-open]') as HTMLElement;
    if (fieldOpen && fieldOpen.dataset.fieldOpen !== undefined) {
      const idx = Number(fieldOpen.dataset.fieldOpen);
      state.fieldIndex = idx;
      state.activePlotForBiofisik = idx;
      const plot = state.plots[idx];
      if (plot) {
        state.cropId = plot.cropId;
        if (plot.plantDate) {
          const plantTime = new Date(plot.plantDate).getTime();
          const nowTime = new Date().getTime();
          const diffDays = Math.max(1, Math.floor((nowTime - plantTime) / 86400000));
          state.currentHST = diffDays;
          plot.hst = diffDays;
        } else {
          state.currentHST = plot.hst;
        }
        const loc = INDONESIAN_LOCATIONS.find(l => l.id === plot.locationId);
        if (loc) state.location = loc;
        const pr = state.plotEngineResults[plot.id];
        if (pr) {
          state.weatherData = pr.weatherData;
          state.engineResult = pr.engineResult;
          state.features = pr.features;
        }
      }
      state.view = 'cuaca';
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Toggle Form Tambah Lahan
    const toggleForm = target.closest('[data-action="toggle-form"]') as HTMLElement;
    if (toggleForm) {
      state.showForm = !state.showForm;
      renderFields();
      return;
    }

    // Simpan Lahan Baru
    if (target.id === 'save-field-btn') {
      const nameInput = $('#nl') as HTMLInputElement;
      const locSelect = $('#ll') as HTMLSelectElement;
      const cropSelect = $('#lt') as HTMLSelectElement;
      const dateInput = $('#ld') as HTMLInputElement;

      if (!nameInput.value.trim()) {
        alert('Mohon masukkan nama petak lahan.');
        return;
      }

      const plantDateVal = dateInput.value || new Date().toISOString().split('T')[0];
      const plantTime = new Date(plantDateVal).getTime();
      const nowTime = new Date().getTime();
      const computedHst = Math.max(1, Math.floor((nowTime - plantTime) / 86400000));

      const locObj = INDONESIAN_LOCATIONS.find(l => l.id === locSelect.value) || (state.location.id === locSelect.value ? state.location : null);
      const placeName = locObj ? `${locObj.name} (${locObj.elevationMeters} mdpl)` : 'Jawa Barat';
      const adminH = (locObj as any)?.adminHierarchy;

      const stage = resolveActiveGrowthStage(cropSelect.value as CropId, computedHst);
      const stageName = stage ? stage.name : 'Vegetatif Awal';

      const newPlot: PlotItem = {
        id: `plot-${Date.now()}`,
        name: nameInput.value.trim(),
        locationId: locSelect.value,
        placeName,
        cropId: cropSelect.value as CropId,
        plantDate: plantDateVal,
        hst: computedHst,
        stageName,
        risk: 'RENDAH',
        adminHierarchy: adminH,
        trail: [
          { dayLabel: `HST 1`, weather: 'Cerah', status: 'Catatan Petani', note: 'Hari tanam bibit' },
          { dayLabel: `HST ${computedHst} (Hari Ini)`, weather: 'Berawan', status: 'Pendaftaran Lahan', note: 'Lahan terdaftar di TaniAdapt' }
        ]
      };

      state.plots.push(newPlot);
      state.fieldIndex = state.plots.length - 1;
      state.showForm = false;
      localStorage.setItem('taniadapt_user_plots_v1', JSON.stringify(state.plots));
      nameInput.value = '';

      fetch('/api/plots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlot)
      }).catch(e => console.warn('Sync plot to backend skipped:', e));
      renderFields();
      recomputeEngineForPlot(state.plots.length - 1).then(() => render());
      return;
    }

    // Tambah Catatan Lapangan (dari Detail Lahan) + Sinkronisasi RAG Tania
    const detailAddNoteBtn = target.closest('#detail-add-note-btn');
    if (detailAddNoteBtn) {
      const noteInput = $('#detail-note-input') as HTMLTextAreaElement;
      if (!noteInput || !noteInput.value.trim()) return;

      const noteText = noteInput.value.trim();
      const curPlot = state.plots[state.fieldIndex] || state.plots[0];
      if (curPlot) {
        if (!curPlot.trail) curPlot.trail = [];
        curPlot.trail.push({
          dayLabel: `HST ${curPlot.hst} (Pengamatan)`,
          weather: 'Tercatat',
          status: 'Pengamatan Lapangan',
          note: noteText
        });
        localStorage.setItem('taniadapt_user_plots_v1', JSON.stringify(state.plots));

        // Auto-sinkronkan ke Knowledge Base RAG Tania
        const kbEntry = `[Petak: ${curPlot.name} | ${curPlot.hst} HST]: ${noteText}`;
        state.customKnowledgeBase.push(kbEntry);
        localStorage.setItem('taniadapt_custom_kb', JSON.stringify(state.customKnowledgeBase));

        noteInput.value = '';
        renderDetailLahan();
        renderChat();
        alert('Catatan lapangan berhasil disimpan dan otomatis disinkronkan ke memori RAG Tania!');
      }
      return;
    }

    // Tambah Catatan Harian Lapangan (dari Lahan Saya) + Sinkronisasi RAG Tania
    const addNoteBtn = target.closest('#add-note-btn');
    if (addNoteBtn) {
      const noteInput = $('#note') as HTMLInputElement;
      if (!noteInput || !noteInput.value.trim()) return;

      const noteText = noteInput.value.trim();
      const curPlot = state.plots[state.fieldIndex];
      if (curPlot) {
        if (!curPlot.trail) curPlot.trail = [];
        curPlot.trail.push({
          dayLabel: `HST ${curPlot.hst} (Pengamatan)`,
          weather: 'Tercatat',
          status: 'Pengamatan Lapangan',
          note: noteText
        });
        localStorage.setItem('taniadapt_user_plots_v1', JSON.stringify(state.plots));

        // Auto-sinkronkan ke Knowledge Base RAG Tania
        const kbEntry = `[Petak: ${curPlot.name} | ${curPlot.hst} HST]: ${noteText}`;
        state.customKnowledgeBase.push(kbEntry);
        localStorage.setItem('taniadapt_custom_kb', JSON.stringify(state.customKnowledgeBase));

        noteInput.value = '';
        renderFields();
        renderChat();
        alert('Catatan harian lapangan disimpan dan disinkronkan ke memori RAG Tania!');
      }
      return;
    }

    // Modal Triggers
    const openEvidenceBtn = target.closest('#open-evidence-modal') || target.closest('#trigger-evidence-modal-btn');
    if (openEvidenceBtn) {
      state.isEvidenceModalOpen = true;
      renderEvidenceModal();
      return;
    }
    const closeEvidenceBtn = target.closest('#close-evidence-modal');
    if (closeEvidenceBtn) {
      state.isEvidenceModalOpen = false;
      renderEvidenceModal();
      return;
    }
    const printAdvisoryBtn = target.closest('#print-advisory');
    if (printAdvisoryBtn) {
      state.isPrintModalOpen = true;
      renderPrintModal();
      return;
    }
    // Checklist Task (Tandai Selesai / Batalkan)
    const markDoneBtn = target.closest('[data-mark-done]') as HTMLElement;
    if (markDoneBtn && markDoneBtn.dataset.markDone) {
      const taskKey = markDoneBtn.dataset.markDone;
      localStorage.setItem(taskKey, 'done');
      if (state.view === 'detail-lahan') {
        renderDetailLahan();
      } else {
        render();
      }
      return;
    }
    const unmarkDoneBtn = target.closest('[data-unmark-done]') as HTMLElement;
    if (unmarkDoneBtn && unmarkDoneBtn.dataset.unmarkDone) {
      const taskKey = unmarkDoneBtn.dataset.unmarkDone;
      localStorage.removeItem(taskKey);
      if (state.view === 'detail-lahan') {
        renderDetailLahan();
      } else {
        render();
      }
      return;
    }

    // Hapus Petak Lahan (Modal Dialog)
    const deletePlotBtn = target.closest('[data-delete-plot]') as HTMLElement;
    if (deletePlotBtn && deletePlotBtn.dataset.deletePlot !== undefined) {
      const plotIdx = Number(deletePlotBtn.dataset.deletePlot);
      const plot = state.plots[plotIdx];
      if (plot) {
        state.deletingPlotIndex = plotIdx;
        const modal = document.getElementById('delete-plot-modal');
        const msg = document.getElementById('delete-plot-modal-msg');
        if (msg) {
          msg.textContent = `Apakah Anda yakin ingin menghapus data petak "${plot.name}" (${plot.placeName})? Tindakan ini tidak dapat dibatalkan.`;
        }
        if (modal) modal.hidden = false;
      }
      return;
    }
    if (target.id === 'btn-cancel-delete-plot' || target.closest('#btn-cancel-delete-plot')) {
      const modal = document.getElementById('delete-plot-modal');
      if (modal) modal.hidden = true;
      state.deletingPlotIndex = -1;
      return;
    }
    if (target.id === 'btn-confirm-delete-plot' || target.closest('#btn-confirm-delete-plot')) {
      if (state.deletingPlotIndex >= 0 && state.deletingPlotIndex < state.plots.length) {
        const deletingPlot = state.plots[state.deletingPlotIndex];
        if (deletingPlot) {
          fetch('/api/plots', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: deletingPlot.id })
          }).catch(e => console.warn('Sync delete plot skipped:', e));
        }
        state.plots.splice(state.deletingPlotIndex, 1);
        localStorage.setItem('taniadapt_user_plots_v1', JSON.stringify(state.plots));
        if (state.fieldIndex >= state.plots.length) {
          state.fieldIndex = Math.max(0, state.plots.length - 1);
        }
        const modal = document.getElementById('delete-plot-modal');
        if (modal) modal.hidden = true;
        state.deletingPlotIndex = -1;
        renderFields();
        render();
      }
      return;
    }

    const printPortfolioBtn = target.closest('#btn-print-portfolio');
    if (printPortfolioBtn) {
      state.reportExportScope = 'portfolio';
      state.isPrintModalOpen = true;
      renderPrintModal();
      return;
    }
    const printSinglePlotBtn = target.closest('#btn-print-single-plot, #btn-print-single');
    if (printSinglePlotBtn) {
      state.reportExportScope = 'single';
      state.reportExportMode = state.uiMode === 'pro' ? 'advance' : 'default';
      state.isPrintModalOpen = true;
      renderPrintModal();
      return;
    }
    const printDetailBtn = target.closest('#btn-print-detail');
    if (printDetailBtn) {
      state.reportExportScope = 'single';
      state.isPrintModalOpen = true;
      renderPrintModal();
      return;
    }
    const printThisPlot = target.closest('[data-print-this-plot]') as HTMLElement;
    if (printThisPlot && printThisPlot.dataset.printThisPlot) {
      const mode = printThisPlot.dataset.printThisPlot as 'default' | 'advance';
      state.reportExportMode = mode;
      state.reportExportScope = 'single';
      state.isPrintModalOpen = true;
      renderPrintModal();
      return;
    }
    if (target.id === 'close-print-modal') {
      state.isPrintModalOpen = false;
      renderPrintModal();
      return;
    }

    // Print Modal Scope Selector Buttons
    if (target.id === 'report-scope-single') {
      state.reportExportScope = 'single';
      renderPrintModal();
      return;
    }
    if (target.id === 'report-scope-portfolio') {
      state.reportExportScope = 'portfolio';
      renderPrintModal();
      return;
    }

    // Print Modal Mode Selector Buttons
    if (target.id === 'report-mode-default') {
      state.reportExportMode = 'default';
      renderPrintModal();
      return;
    }
    if (target.id === 'report-mode-advance') {
      state.reportExportMode = 'advance';
      renderPrintModal();
      return;
    }

    // Print Modal PDF Export Button (Native Print with A4 Times New Roman @media print)
    if (target.closest('#btn-export-pdf')) {
      window.print();
      return;
    }

    // Print Modal DOCX Export Button (4-variant Word Generator)
    if (target.closest('#btn-export-docx')) {
      const isSingle = state.reportExportScope === 'single';
      const isAdv = state.reportExportMode === 'advance';

      if (isSingle) {
        if (state.engineResult && state.features) {
          const curPlot = state.plots[state.fieldIndex];
          const exportInput = {
            engineResult: state.engineResult,
            features: state.features,
            currentWeather: state.weatherData?.current || null,
            location: state.location,
            plotName: curPlot?.name,
            userName: state.authUser?.full_name,
            userType: state.authUser?.user_type,
            dailyForecast: state.weatherData?.dailyForecast,
            adminHierarchy: (curPlot as any)?.adminHierarchy || (state.location as any)?.adminHierarchy,
            trail: curPlot?.trail,
          };
          if (isAdv) {
            generateSinglePlotAdvanceWordReport(exportInput);
          } else {
            generateAndDownloadWordReport(exportInput);
          }
        }
      } else {
        // Portfolio Scope
        if (isAdv) {
          const portfolioAdvancePlots: PortfolioAdvancePlot[] = state.plots.map(p => {
            const pr = state.plotEngineResults[p.id];
            const res = pr?.engineResult;
            const f56 = res?.fao56;
            const crop = CROPS_LIST.find(c => c.id === p.cropId);
            return {
              name: p.name,
              cropName: crop?.label || p.cropId,
              scientificName: crop?.scientific || '',
              placeName: p.placeName,
              hst: p.hst,
              stageName: p.stageName,
              risk: p.risk,
              irrigationStatus: res ? (res.irrigation.status === 'DRAINASE_MENDESAK' ? 'Drainase Mendesak' : 'Optimal') : '-',
              fertilizationStatus: res ? (res.fertilization.safeToApply ? 'Aman' : 'Tunda') : '-',
              topRecommendation: res?.recommendations[0]?.action || '-',
              etcMmDay: f56?.etc_daily_mm,
              etoMmDay: f56?.et0_daily_mm,
              kc: f56?.kc_current,
              drMm: f56?.depletion_dr_mm,
              rawMm: f56?.raw_mm,
              vpdKpa: pr?.features?.currentVPD,
              tempC: state.weatherData?.current?.temperature,
              rhPercent: state.weatherData?.current?.relativeHumidity,
              rolling7dRain: pr?.features?.rolling7dRain,
            };
          });
          generatePortfolioAdvanceWordReport(portfolioAdvancePlots, state.authUser?.full_name);
        } else {
          const portfolioPlots: PortfolioReportPlot[] = state.plots.map(p => {
            const pr = state.plotEngineResults[p.id];
            const res = pr?.engineResult;
            const crop = CROPS_LIST.find(c => c.id === p.cropId);
            return {
              name: p.name,
              cropName: crop?.label || p.cropId,
              scientificName: crop?.scientific || '',
              placeName: p.placeName,
              hst: p.hst,
              stageName: p.stageName,
              risk: p.risk,
              irrigationStatus: res ? (res.irrigation.status === 'DRAINASE_MENDESAK' ? 'Drainase Mendesak' : res.irrigation.status === 'BUTUH_PENGAIRAN' ? 'Perlu Air' : 'Optimal') : 'Memuat...',
              fertilizationStatus: res ? (res.fertilization.safeToApply ? 'Aman' : 'Tunda') : 'Memuat...',
              topRecommendation: res?.recommendations[0]?.action || 'Pantau perkembangan tanaman',
            };
          });
          generatePortfolioWordReport(portfolioPlots, state.authUser?.full_name);
        }
      }
      return;
    }

    // Filter Evidence Modal by Crop
    const filterBtn = target.closest('[data-filter-evidence]') as HTMLElement;
    if (filterBtn && filterBtn.dataset.filterEvidence) {
      state.evidenceFilter = filterBtn.dataset.filterEvidence;
      document.querySelectorAll('[data-filter-evidence]').forEach((b) => {
        const btn = b as HTMLElement;
        const active = btn.dataset.filterEvidence === state.evidenceFilter;
        btn.style.background = active ? 'var(--green)' : '#FFF';
        btn.style.color = active ? '#FFF' : 'var(--ink)';
      });
      renderEvidenceModal();
      return;
    }

    // Direct Navigation Buttons
    const goCuaca = target.closest('#go-cuaca');
    if (goCuaca) {
      state.view = 'cuaca';
      render();
      return;
    }
    const askWhy = target.closest('#ask-why');
    if (askWhy) {
      state.view = 'tanya';
      askQuestion('Kenapa ini direkomendasikan saat ini?');
      render();
      return;
    }
    if (target.id === 'send') {
      sendChat();
      return;
    }

    // Save Custom KB button (from Settings or from Chat View)
    if (target.id === 'btn-save-custom-kb' || target.id === 'btn-save-chat-custom-kb') {
      const input = (target.id === 'btn-save-chat-custom-kb' ? $('#chat-custom-kb-input') : $('#custom-kb-input')) as HTMLTextAreaElement;
      if (!input || !input.value.trim()) return;
      state.customKnowledgeBase.push(input.value.trim());
      localStorage.setItem('taniadapt_custom_kb', JSON.stringify(state.customKnowledgeBase));
      input.value = '';
      renderSettings();
      renderChat();
      return;
    }

    // Delete Custom KB item
    const delKbBtn = target.closest('[data-del-kb]') as HTMLElement;
    if (delKbBtn && delKbBtn.dataset.delKb !== undefined) {
      const idx = Number(delKbBtn.dataset.delKb);
      state.customKnowledgeBase.splice(idx, 1);
      localStorage.setItem('taniadapt_custom_kb', JSON.stringify(state.customKnowledgeBase));
      renderSettings();
      renderChat();
      return;
    }

    // Reset Water Ledger / Mark Watered button
    if (target.id === 'btn-reset-water-ledger' || target.id === 'btn-mark-watered') {
      alert('Buku Kas Air (Water Ledger): Lahan berhasil ditandai sudah disiram. Deplesi lengas tanah direset kembali ke kapasitas lapang (Dr = 0 mm).');
      const curPlot = state.plots[state.fieldIndex];
      if (curPlot) {
        if (!curPlot.trail) curPlot.trail = [];
        curPlot.trail.push({
          dayLabel: `HST ${state.currentHST} (Hari Ini)`,
          weather: 'Disiram',
          status: 'Sehat',
          note: 'Penyiraman manual dilakukan petani (Dr direset ke 0 mm)'
        });
        localStorage.setItem('taniadapt_user_plots_v1', JSON.stringify(state.plots));
        renderFields();
      }
      recomputeEngine();
      return;
    }

    // Clear All Plots button
    if (target.id === 'btn-clear-all-plots') {
      if (confirm('Apakah Anda yakin ingin menghapus seluruh data petak lahan lokal?')) {
        state.plots = [];
        localStorage.removeItem('taniadapt_user_plots_v1');
        state.fieldIndex = 0;
        render();
        alert('Seluruh data lahan lokal telah dibersihkan.');
      }
      return;
    }

    // UI Mode Toggle (Single Header Toggle or Mode Buttons)
    const singleToggle = target.closest('#btn-toggle-ui-mode') as HTMLElement;
    if (singleToggle) {
      state.uiMode = state.uiMode === 'pro' ? 'default' : 'pro';
      setStoredUIMode(state.uiMode);
      if (state.uiMode === 'default' && state.view === 'cuaca') {
        state.view = 'ringkasan';
      }
      render();
      return;
    }

    const modeBtn = target.closest('[data-ui-mode]') as HTMLElement;
    if (modeBtn && modeBtn.dataset.uiMode) {
      state.uiMode = modeBtn.dataset.uiMode as UIMode;
      setStoredUIMode(state.uiMode);
      if (state.uiMode === 'default' && state.view === 'cuaca') {
        state.view = 'ringkasan';
      }
      render();
      return;
    }

    // Word Document Download (.docx)
    const dlWordBtn = target.closest('#download-word-btn');
    if (dlWordBtn) {
      if (state.engineResult && state.features) {
        generateAndDownloadWordReport({
          engineResult: state.engineResult,
          features: state.features,
          currentWeather: state.weatherData?.current || null,
          location: state.location,
          plotName: state.plots[state.fieldIndex]?.name,
          userName: state.authUser?.full_name,
          userType: state.authUser?.user_type,
          dailyForecast: state.weatherData?.dailyForecast,
        });
      }
      return;
    }

    // Portfolio Report Download (.docx)
    const dlPortBtn = target.closest('#download-portfolio-btn');
    if (dlPortBtn) {
      const portfolioPlots: PortfolioReportPlot[] = state.plots.map(p => {
        const pr = state.plotEngineResults[p.id];
        const res = pr?.engineResult;
        const crop = CROPS_LIST.find(c => c.id === p.cropId);
        return {
          name: p.name,
          cropName: crop?.label || p.cropId,
          scientificName: crop?.scientific || '',
          placeName: p.placeName,
          hst: p.hst,
          stageName: p.stageName,
          risk: p.risk,
          irrigationStatus: res ? (res.irrigation.status === 'DRAINASE_MENDESAK' ? 'Drainase Mendesak' : res.irrigation.status === 'BUTUH_PENGAIRAN' ? 'Perlu Air' : 'Optimal') : 'Memuat...',
          fertilizationStatus: res ? (res.fertilization.safeToApply ? 'Aman' : 'Tunda') : 'Memuat...',
          topRecommendation: res?.recommendations[0]?.action || 'Pantau perkembangan tanaman',
        };
      });
      generatePortfolioWordReport(portfolioPlots, state.authUser?.full_name);
      return;
    }

    // Auth Modal Triggers
    const openAuth = target.closest('#open-auth-btn');
    if (openAuth) {
      state.isAuthModalOpen = true;
      renderAuthModal();
      return;
    }
    const closeAuth = target.closest('#close-auth-modal');
    if (closeAuth) {
      state.isAuthModalOpen = false;
      renderAuthModal();
      return;
    }
    const tabLogin = target.closest('#auth-tab-login') || target.closest('#switch-to-login');
    if (tabLogin) {
      state.authTab = 'login';
      renderAuthModal();
      return;
    }
    const tabReg = target.closest('#auth-tab-register') || target.closest('#switch-to-register');
    if (tabReg) {
      state.authTab = 'register';
      renderAuthModal();
      return;
    }
    const skipDemo = target.closest('#skip-demo-btn-login') || target.closest('#skip-demo-btn-reg');
    if (skipDemo) {
      localStorage.setItem('taniadapt_demo_guest', 'true');
      state.isAuthModalOpen = false;
      renderAuthModal();
      return;
    }
    const btnLogout = target.closest('#btn-logout');
    if (btnLogout) {
      clearAuthSession();
      state.authUser = null;
      state.authProfile = null;
      render();
      return;
    }
  });

  // GPS Location Detect
  const btnGps = $('#btn-gps-locate');
  if (btnGps) {
    btnGps.addEventListener('click', async () => {
      btnGps.textContent = '⏳ Mendeteksi GPS...';
      try {
        const pos = await getCurrentGpsPosition();
        state.location = {
          id: 'gps_custom',
          name: `Titik GPS Lahan (${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)})`,
          regency: 'Jawa Barat',
          province: 'Jawa Barat',
          latitude: pos.latitude,
          longitude: pos.longitude,
          elevationMeters: 750,
          agroclimateZone: 'Presisi GPS Hyperlocal',
          primaryCrops: [state.cropId],
          soilTexture: 'Lempung Berdebu Subur (Loam)',
        };
        renderLocationDropdown();
        await recomputeEngine();
        btnGps.innerHTML = '<span>GPS Terdeteksi</span>';
        setTimeout(() => {
          btnGps.innerHTML = '<span>Deteksi GPS Lahan</span>';
        }, 3000);
      } catch (err: any) {
        alert(err.message || 'Gagal mendeteksi koordinat GPS.');
        btnGps.innerHTML = '<span>Deteksi GPS Lahan</span>';
      }
    });
  }

  // Geocoding API Search
  const searchInput = $('#location-search-input') as HTMLInputElement;
  const searchBtn = $('#btn-search-geocoding');
  const resultsDropdown = $('#geocoding-results');

  // Helper Reverse Geocoding & Administrasi Wilayah
  async function reverseGeocode(lat: number, lon: number): Promise<AdminHierarchy> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'id' }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const addr = data.address || {};

      const provinsi = addr.state || 'Jawa Barat';
      const kotaKab = addr.city || addr.county || addr.regency || addr.city_district || 'Jawa Barat';
      const kecamatan = addr.municipality || addr.subdistrict || addr.district || addr.town || '';
      const desa = addr.village || addr.hamlet || addr.suburb || addr.neighbourhood || addr.quarter || '';
      const road = addr.road || '';

      return {
        displayName: data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        desa,
        kecamatan,
        kotaKab,
        provinsi,
        road,
        latitude: lat,
        longitude: lon
      };
    } catch (e) {
      console.warn('Reverse geocode error, fallback to coordinate string:', e);
      return {
        displayName: `Titik Koordinat (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
        desa: '',
        kecamatan: '',
        kotaKab: 'Jawa Barat',
        provinsi: 'Jawa Barat',
        latitude: lat,
        longitude: lon
      };
    }
  }

  function displayDetectedLocation(admin: AdminHierarchy) {
    const badge = document.getElementById('detected-location-badge');
    const textElem = document.getElementById('detected-location-hierarchy');
    if (!badge || !textElem) return;

    const parts = [];
    if (admin.desa) parts.push(`Desa/Kel. ${admin.desa}`);
    if (admin.kecamatan) parts.push(`Kec. ${admin.kecamatan}`);
    if (admin.kotaKab) parts.push(admin.kotaKab.startsWith('Kota') || admin.kotaKab.startsWith('Kab') ? admin.kotaKab : `Kab. ${admin.kotaKab}`);
    if (admin.provinsi) parts.push(admin.provinsi);

    if (parts.length === 0) {
      textElem.textContent = admin.displayName;
    } else {
      textElem.textContent = parts.join(' • ');
    }
    badge.style.display = 'block';
  }

  // Form Tambah Lahan: GPS Geolocation & OSM Nominatim
  const btnUseGps = document.getElementById('btn-use-gps');

  if (btnUseGps) {
    btnUseGps.addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('Fitur Geolocation tidak didukung di peramban Anda.');
        return;
      }
      btnUseGps.innerHTML = `<span>Mencari koordinat GPS &amp; wilayah...</span>`;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(4));
          const lon = Number(pos.coords.longitude.toFixed(4));
          const gpsLocId = `gps_${lat}_${lon}`;

          const admin = await reverseGeocode(lat, lon);

          const locLabel = admin.desa
            ? `Desa ${admin.desa}, ${admin.kecamatan || admin.kotaKab}`
            : admin.kecamatan
            ? `Kec. ${admin.kecamatan}, ${admin.kotaKab}`
            : `Lokasi GPS (${lat}, ${lon})`;

          const gpsLocation: AgriculturalLocation = {
            id: gpsLocId,
            name: locLabel,
            regency: admin.kotaKab || 'Lokasi Petani',
            province: admin.provinsi || 'Jawa Barat',
            latitude: lat,
            longitude: lon,
            elevationMeters: Math.round(pos.coords.altitude || 650),
            agroclimateZone: 'Sensor GPS Presisi',
            primaryCrops: [state.cropId],
            soilTexture: 'Lempung Berdebu (Loam)',
            district: admin.kecamatan,
            village: admin.desa,
          };

          (gpsLocation as any).adminHierarchy = {
            provinsi: admin.provinsi,
            kotaKab: admin.kotaKab,
            kecamatan: admin.kecamatan,
            desa: admin.desa
          };

          const llSelect = document.getElementById('ll') as HTMLSelectElement | null;
          if (llSelect) {
            const opt = document.createElement('option');
            opt.value = gpsLocId;
            opt.textContent = `[GPS Anda] ${locLabel} (${lat}, ${lon})`;
            opt.selected = true;
            llSelect.prepend(opt);
          }
          state.location = gpsLocation;
          renderLocationDropdown();
          displayDetectedLocation(admin);

          // Auto isi nama lahan jika masih kosong
          const nameInput = document.getElementById('nl') as HTMLInputElement | null;
          if (nameInput && !nameInput.value.trim()) {
            nameInput.value = `Petak ${admin.desa ? 'Desa ' + admin.desa : admin.kecamatan ? 'Kec. ' + admin.kecamatan : 'GPS'}`;
          }

          btnUseGps.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> GPS Terhubung (${admin.desa ? admin.desa + ', ' : ''}${admin.kotaKab})`;
        },
        (err) => {
          btnUseGps.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg> Gunakan GPS Saya`;
          alert(`Gagal mengambil koordinat GPS: ${err.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  // --- INTERACTIVE MAP PICKER (LEAFLET + NOMINATIM) ---
  let mapPickerInstance: any = null;
  let mapPickerMarker: any = null;
  let currentPickerLat = -6.9175;
  let currentPickerLon = 107.6191;
  let currentPickerAdmin: AdminHierarchy | null = null;

  const modalMapPicker = document.getElementById('map-picker-modal');
  const btnOpenMapPicker = document.getElementById('btn-open-map-picker');
  const btnCloseMapPicker = document.getElementById('btn-close-map-picker');
  const btnCancelMapPicker = document.getElementById('btn-cancel-map-picker');
  const btnConfirmMapPicker = document.getElementById('btn-confirm-map-picker');
  const btnMapSearch = document.getElementById('btn-map-search');
  const mapSearchInput = document.getElementById('map-search-input') as HTMLInputElement | null;
  const coordsLabel = document.getElementById('map-pin-coords');
  const addressLabel = document.getElementById('map-pin-address');

  async function updateMapPinLocation(lat: number, lon: number, zoom?: number) {
    currentPickerLat = Number(lat.toFixed(5));
    currentPickerLon = Number(lon.toFixed(5));

    if (coordsLabel) {
      coordsLabel.textContent = `${currentPickerLat}, ${currentPickerLon}`;
    }
    if (addressLabel) {
      addressLabel.textContent = 'Mendeteksi wilayah administrasi...';
    }

    if (mapPickerMarker) {
      mapPickerMarker.setLatLng([currentPickerLat, currentPickerLon]);
    }

    if (mapPickerInstance && zoom) {
      mapPickerInstance.setView([currentPickerLat, currentPickerLon], zoom);
    }

    const admin = await reverseGeocode(currentPickerLat, currentPickerLon);
    currentPickerAdmin = admin;

    if (addressLabel) {
      const parts = [];
      if (admin.desa) parts.push(`Desa/Kel. ${admin.desa}`);
      if (admin.kecamatan) parts.push(`Kec. ${admin.kecamatan}`);
      if (admin.kotaKab) parts.push(admin.kotaKab.startsWith('Kota') || admin.kotaKab.startsWith('Kab') ? admin.kotaKab : `Kab. ${admin.kotaKab}`);
      if (admin.provinsi) parts.push(admin.provinsi);

      addressLabel.innerHTML = parts.length > 0
        ? `<strong>${parts.join(' &bull; ')}</strong><br><span style="font-size: 11px; color: var(--muted)">${admin.displayName}</span>`
        : admin.displayName;
    }
  }

  function openMapPickerModal() {
    if (!modalMapPicker) return;
    modalMapPicker.hidden = false;

    const initLat = state.location?.latitude || -6.9175;
    const initLon = state.location?.longitude || 107.6191;

    setTimeout(() => {
      if (!mapPickerInstance && typeof L !== 'undefined') {
        mapPickerInstance = L.map('interactive-map-element').setView([initLat, initLon], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(mapPickerInstance);

        mapPickerMarker = L.marker([initLat, initLon], { draggable: true }).addTo(mapPickerInstance);

        mapPickerMarker.on('dragend', () => {
          const pos = mapPickerMarker.getLatLng();
          updateMapPinLocation(pos.lat, pos.lng);
        });

        mapPickerInstance.on('click', (e: any) => {
          updateMapPinLocation(e.latlng.lat, e.latlng.lng);
        });
      } else if (mapPickerInstance) {
        mapPickerInstance.invalidateSize();
        mapPickerInstance.setView([initLat, initLon], 13);
        if (mapPickerMarker) {
          mapPickerMarker.setLatLng([initLat, initLon]);
        }
      }
      updateMapPinLocation(initLat, initLon);
    }, 150);
  }

  function closeMapPickerModal() {
    if (modalMapPicker) modalMapPicker.hidden = true;
  }

  if (btnOpenMapPicker) btnOpenMapPicker.addEventListener('click', openMapPickerModal);
  if (btnCloseMapPicker) btnCloseMapPicker.addEventListener('click', closeMapPickerModal);
  if (btnCancelMapPicker) btnCancelMapPicker.addEventListener('click', closeMapPickerModal);

  if (btnMapSearch && mapSearchInput) {
    const doMapSearch = async () => {
      const q = mapSearchInput.value.trim();
      if (!q) return;
      btnMapSearch.textContent = 'Mencari...';
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=id&limit=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'id' } });
        const list = await res.json();
        if (list && list.length > 0) {
          const target = list[0];
          const lat = parseFloat(target.lat);
          const lon = parseFloat(target.lon);
          updateMapPinLocation(lat, lon, 14);
        } else {
          alert('Lokasi tidak ditemukan. Coba gunakan kata kunci desa atau kecamatan.');
        }
      } catch (err) {
        console.error('Map search error:', err);
      } finally {
        btnMapSearch.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Cari di Peta`;
      }
    };

    btnMapSearch.addEventListener('click', doMapSearch);
    mapSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doMapSearch();
      }
    });
  }

  if (btnConfirmMapPicker) {
    btnConfirmMapPicker.addEventListener('click', () => {
      const lat = currentPickerLat;
      const lon = currentPickerLon;
      const admin = currentPickerAdmin || {
        displayName: `${lat}, ${lon}`,
        desa: '',
        kecamatan: '',
        kotaKab: 'Jawa Barat',
        provinsi: 'Jawa Barat',
        latitude: lat,
        longitude: lon
      };

      const customLocId = `map_${lat.toFixed(4)}_${lon.toFixed(4)}`;
      const locLabel = admin.desa
        ? `Desa ${admin.desa}, ${admin.kecamatan || admin.kotaKab}`
        : admin.kecamatan
        ? `Kec. ${admin.kecamatan}, ${admin.kotaKab}`
        : `Lahan (${lat.toFixed(4)}, ${lon.toFixed(4)})`;

      const customLocation: AgriculturalLocation = {
        id: customLocId,
        name: locLabel,
        regency: admin.kotaKab,
        province: admin.provinsi,
        latitude: lat,
        longitude: lon,
        elevationMeters: 650,
        agroclimateZone: 'Titik Peta Presisi',
        primaryCrops: [state.cropId],
        soilTexture: 'Lempung Berdebu (Loam)',
        district: admin.kecamatan,
        village: admin.desa,
      };

      (customLocation as any).adminHierarchy = {
        provinsi: admin.provinsi,
        kotaKab: admin.kotaKab,
        kecamatan: admin.kecamatan,
        desa: admin.desa
      };

      const llSelect = document.getElementById('ll') as HTMLSelectElement | null;
      if (llSelect) {
        const existingCustom = llSelect.querySelector(`option[value="${customLocId}"]`);
        if (!existingCustom) {
          const opt = document.createElement('option');
          opt.value = customLocId;
          opt.textContent = `[Peta] ${locLabel} (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
          opt.selected = true;
          llSelect.prepend(opt);
        } else {
          llSelect.value = customLocId;
        }
      }

      state.location = customLocation;
      renderLocationDropdown();
      displayDetectedLocation(admin);

      const nameInput = document.getElementById('nl') as HTMLInputElement | null;
      if (nameInput && !nameInput.value.trim()) {
        nameInput.value = `Petak ${admin.desa ? 'Desa ' + admin.desa : admin.kecamatan ? 'Kec. ' + admin.kecamatan : 'Peta'}`;
      }

      closeMapPickerModal();
    });
  }

  async function performLocationSearch() {
    const query = searchInput?.value.trim();
    if (!query || query.length < 2) return;
    if (searchBtn) searchBtn.textContent = 'Mencari...';

    const results = await searchLocationsByApi(query);
    if (searchBtn) searchBtn.textContent = 'Cari';

    if (resultsDropdown) {
      if (results.length === 0) {
        resultsDropdown.innerHTML = '<div style="padding: 12px; font-size: 13px; color: var(--muted)">Tidak ada lokasi ditemukan. Coba nama kecamatan/desa lain.</div>';
        resultsDropdown.style.display = 'block';
        return;
      }

      resultsDropdown.innerHTML = results.map(r => `
        <div class="geocoding-item" data-geo-id="${r.id}" style="padding: 10px 14px; border-bottom: 1px solid var(--line); cursor: pointer; font-size: 13px; display: flex; justify-content: space-between; align-items: center">
          <div>
            <div style="font-weight: 700; color: var(--ink)">${r.displayName}</div>
            <div style="font-size: 11px; color: var(--muted); font-family: monospace">Lat: ${r.latitude}° | Lon: ${r.longitude}° ${r.elevation ? `| Elev: ${r.elevation}m` : ''}</div>
          </div>
          <span style="font-size: 11px; color: var(--green); font-weight: 700">Pilih &rarr;</span>
        </div>
      `).join('');
      resultsDropdown.style.display = 'block';

      // Click on item
      resultsDropdown.querySelectorAll('.geocoding-item').forEach((itemEl, idx) => {
        itemEl.addEventListener('click', () => {
          const selected = results[idx];
          state.location = {
            id: `geo_${selected.id}`,
            name: selected.displayName,
            regency: selected.admin2 || selected.name,
            province: selected.admin1 || 'Jawa Barat',
            latitude: selected.latitude,
            longitude: selected.longitude,
            elevationMeters: selected.elevation || 650,
            agroclimateZone: 'Presisi Geocoding API',
            primaryCrops: [state.cropId],
            soilTexture: 'Lempung Berdebu (Loam)',
          };
          renderLocationDropdown();
          resultsDropdown.style.display = 'none';
          if (searchInput) searchInput.value = selected.displayName;
          recomputeEngine();
        });
      });
    }
  }

  if (searchBtn) searchBtn.addEventListener('click', performLocationSearch);
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performLocationSearch();
      }
    });
  }

  // Chat File & Image Upload Listeners (Multimodal Vision & Custom KB)
  const btnUploadFile = document.getElementById('btn-upload-chat-file');
  const fileInput = document.getElementById('chat-file-input') as HTMLInputElement | null;
  const btnUploadImage = document.getElementById('btn-upload-chat-image');
  const imageInput = document.getElementById('chat-image-input') as HTMLInputElement | null;
  const previewBox = document.getElementById('chat-attachment-preview');
  const previewIcon = document.getElementById('chat-attachment-icon');
  const previewName = document.getElementById('chat-attachment-name');
  const btnRemoveAttachment = document.getElementById('chat-remove-attachment');
  const uploadStatus = document.getElementById('chat-upload-status');

  if (btnUploadFile && fileInput) {
    btnUploadFile.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const textContent = (event.target?.result as string) || '';
        state.pendingChatFileName = file.name;
        const entry = `[DOKUMEN DILAMPIRKAN PENGGUNA (${file.name})]:\n${textContent.slice(0, 4000)}`;
        state.customKnowledgeBase.push(entry);
        localStorage.setItem('taniadapt_custom_kb', JSON.stringify(state.customKnowledgeBase));

        if (previewBox && previewName && previewIcon) {
          previewIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>`;
          previewName.textContent = file.name;
          previewBox.style.display = 'flex';
        }
        if (uploadStatus) {
          uploadStatus.textContent = `Tersimpan ke memori RAG (${file.name})`;
          setTimeout(() => { if (uploadStatus) uploadStatus.textContent = ''; }, 3000);
        }
      };
      reader.readAsText(file);
    });
  }

  if (btnUploadImage && imageInput) {
    btnUploadImage.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', () => {
      const file = imageInput.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        state.pendingChatImage = base64Data;
        state.pendingChatFileName = file.name;

        if (previewBox && previewName && previewIcon) {
          previewIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle></svg>`;
          previewName.textContent = `[Foto]: ${file.name}`;
          previewBox.style.display = 'flex';
        }
        if (uploadStatus) {
          uploadStatus.textContent = `Foto siap dianalisis Tania`;
          setTimeout(() => { if (uploadStatus) uploadStatus.textContent = ''; }, 3000);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnRemoveAttachment) {
    btnRemoveAttachment.addEventListener('click', () => {
      state.pendingChatImage = null;
      state.pendingChatFileName = null;
      if (fileInput) fileInput.value = '';
      if (imageInput) imageInput.value = '';
      if (previewBox) previewBox.style.display = 'none';
      if (uploadStatus) uploadStatus.textContent = '';
    });
  }

  // Close geocoding dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!resultsDropdown?.contains(e.target as Node) && e.target !== searchInput && e.target !== searchBtn) {
      if (resultsDropdown) resultsDropdown.style.display = 'none';
    }
  });

  // Login Form Submit (PostgreSQL / Local DB API)
  const loginForm = $('#login-form') as HTMLFormElement;
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = $('#btn-submit-login') as HTMLButtonElement;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Memeriksa Kredensial...';
      }
      const email = ($('#login-email') as HTMLInputElement)?.value.trim();
      const password = ($('#login-password') as HTMLInputElement)?.value;
      const errBox = $('#login-error');
      if (errBox) errBox.style.display = 'none';

      try {
        const res = await loginUser(email, password);
        if (res.success && res.user) {
          state.authUser = res.user;
          state.authProfile = res.profile || null;
          if (res.profile?.commodity && CROPS_LIST.some(c => c.id === res.profile?.commodity)) {
            state.cropId = res.profile.commodity as CropId;
          }
          if (res.user.user_type === 'farm_organisasi') {
            state.uiMode = 'pro';
            setStoredUIMode('pro');
          }
          state.isAuthModalOpen = false;
          renderAuthModal();
          renderAuth();
          renderNav();
          renderFields();
          render();

          await recomputeEngine();
          await recomputeAllPlots();
          render();

          showToast(`Selamat datang kembali, ${res.user.full_name}!`);
        } else {
          if (errBox) {
            errBox.textContent = res.error || 'Gagal masuk akun. Periksa email dan password Anda.';
            errBox.style.display = 'block';
          }
        }
      } catch (err: any) {
        if (errBox) {
          errBox.textContent = err.message || 'Terjadi kesalahan sistem saat masuk.';
          errBox.style.display = 'block';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Masuk ke Workstation';
        }
      }
    });
  }

  // Register Form Submit (PostgreSQL / Local DB API)
  const regForm = $('#register-form') as HTMLFormElement;
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = $('#btn-submit-reg') as HTMLButtonElement;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Mendaftarkan Akun...';
      }
      const fullName = ($('#reg-fullname') as HTMLInputElement)?.value.trim();
      const email = ($('#reg-email') as HTMLInputElement)?.value.trim();
      const password = ($('#reg-password') as HTMLInputElement)?.value;
      const userType = (document.querySelector('input[name="reg-user-type"]:checked') as HTMLInputElement)?.value as 'petani' | 'farm_organisasi' || 'petani';
      const plotName = ($('#reg-plot-name') as HTMLInputElement)?.value.trim();
      const commodity = ($('#reg-commodity') as HTMLSelectElement)?.value as CropId || '';
      const plantDateInput = ($('#reg-plantdate') as HTMLInputElement)?.value;
      const farmAreaInput = parseFloat(($('#reg-area') as HTMLInputElement)?.value || '0');

      const errBox = $('#reg-error');
      if (errBox) errBox.style.display = 'none';

      try {
        const hasCustomPlot = Boolean(plotName || commodity);
        const finalCommodity = (commodity || 'cabai') as CropId;
        const finalPlantDate = plantDateInput || new Date().toISOString().split('T')[0];
        const finalFarmArea = farmAreaInput > 0 ? farmAreaInput : 1.0;
        const computedHst = Math.max(1, Math.floor((Date.now() - new Date(finalPlantDate).getTime()) / 86400000));
        const stage = resolveActiveGrowthStage(finalCommodity, computedHst);
        const stageName = stage ? stage.name : 'Vegetatif Awal';

        const res = await registerUser(email, password, fullName, userType, hasCustomPlot ? {
          commodity: finalCommodity,
          location_name: state.location.name,
          latitude: state.location.latitude,
          longitude: state.location.longitude,
          planting_date: finalPlantDate,
          hst: computedHst,
          farm_area_ha: finalFarmArea,
          organization_name: plotName || 'Lahan Sentra Petani',
        } : {});

        if (res.success && res.user) {
          // Automatic login upon sign up
          state.authUser = res.user;
          state.authProfile = res.profile || null;
          if (hasCustomPlot) {
            state.cropId = finalCommodity;
          }
          state.uiMode = userType === 'farm_organisasi' ? 'pro' : 'default';
          setStoredUIMode(state.uiMode);

          // Only create and add new plot if user chose to define one
          if (hasCustomPlot) {
            const finalPlotName = plotName || 'Lahan Sentra Petani';
            const newPlotId = `plot-${Date.now().toString(36)}`;
            const cropObj = CROPS_LIST.find(c => c.id === finalCommodity);
            const newPlot: PlotItem = {
              id: newPlotId,
              name: finalPlotName,
              locationId: state.location.id,
              placeName: state.location.name,
              cropId: finalCommodity,
              plantDate: finalPlantDate,
              hst: computedHst,
              stageName,
              risk: 'RENDAH',
              areaHa: finalFarmArea,
              trail: [
                { dayLabel: 'HST 1', status: 'Catatan Petani', note: `Registrasi lahan ${finalPlotName} (${cropObj?.label || finalCommodity})`, weather: 'Cerah' }
              ]
            };
            state.plots.unshift(newPlot);
            localStorage.setItem('taniadapt_user_plots_v1', JSON.stringify(state.plots));
            state.fieldIndex = 0;

            fetch('/api/plots', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newPlot)
            }).catch(e => console.warn('Sync registered plot to backend skipped:', e));
          }

          // Close modal and synchronize entire UI state
          state.isAuthModalOpen = false;
          renderAuthModal();
          renderAuth();
          renderNav();
          renderFields();
          render();

          await recomputeEngine();
          await recomputeAllPlots();
          render();

          showToast(`Selamat datang, ${res.user.full_name}! Pendaftaran berhasil dan Anda telah otomatis masuk.`);
        } else {
          if (errBox) {
            errBox.textContent = res.error || 'Gagal mendaftar akun';
            errBox.style.display = 'block';
          }
        }
      } catch (err: any) {
        if (errBox) {
          errBox.textContent = err.message || 'Terjadi kesalahan sistem saat mendaftar.';
          errBox.style.display = 'block';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Daftar & Simpan Profil Kebun';
        }
      }
    });
  }

  // Active Plot Dropdown Change
  const activePlotSelect = $('#active-plot-select') as HTMLSelectElement;
  if (activePlotSelect) {
    activePlotSelect.addEventListener('change', () => {
      const idx = Number(activePlotSelect.value);
      if (idx >= 0 && state.plots[idx]) {
        state.fieldIndex = idx;
        const p = state.plots[idx];
        state.cropId = p.cropId;
        if (p.plantDate) {
          const plantTime = new Date(p.plantDate).getTime();
          const nowTime = new Date().getTime();
          const diffDays = Math.max(1, Math.floor((nowTime - plantTime) / 86400000));
          state.currentHST = diffDays;
          p.hst = diffDays;
        } else {
          state.currentHST = p.hst;
        }
        const loc = INDONESIAN_LOCATIONS.find(l => l.id === p.locationId);
        if (loc) state.location = loc;
      }
      recomputeEngine();
    });
  }

  // Settings Mode Radio Change
  document.querySelectorAll('input[name="settings-ui-mode"]').forEach((el) => {
    el.addEventListener('change', (e) => {
      const radio = e.target as HTMLInputElement;
      if (radio.checked) {
        state.uiMode = radio.value as UIMode;
        setStoredUIMode(state.uiMode);
        renderUIMode();
      }
    });
  });

  // Settings Language Radio Change
  document.querySelectorAll('input[name="settings-lang"]').forEach((el) => {
    el.addEventListener('change', (e) => {
      const radio = e.target as HTMLInputElement;
      if (radio.checked) {
        state.selectedLanguage = radio.value as 'id' | 'su';
        localStorage.setItem('taniadapt_lang', state.selectedLanguage);
        const greeting = state.selectedLanguage === 'su'
          ? 'Sampurasun! Sim kuring Tania, asistén agronomis TaniAdapt. Aya anu tiasa dibantos perkawis tatanen kebon dinten ieu?'
          : 'Halo! Saya Tania, asisten agronomis TaniAdapt. Saya siap menjelaskan keputusan Decision Engine, dasar ilmiah FAO-56 Penman-Monteith, dan catatan khusus lahan Anda tanpa mengarang takaran kimia.';
        state.thread = [{ me: false, text: greeting }];
        renderChat();
      }
    });
  });

  // Settings Soil Select Change
  const soilSelect = $('#settings-soil-select') as HTMLSelectElement;
  if (soilSelect) {
    soilSelect.addEventListener('change', () => {
      state.soilTexture = soilSelect.value;
      localStorage.setItem('taniadapt_soil', state.soilTexture);
      recomputeEngine();
    });
  }

  // Settings Peff Select Change
  const peffSelect = $('#settings-peff-select') as HTMLSelectElement;
  if (peffSelect) {
    peffSelect.addEventListener('change', () => {
      state.peffRatio = Number(peffSelect.value);
      localStorage.setItem('taniadapt_peff', String(state.peffRatio));
      recomputeEngine();
    });
  }

  // Location Dropdown Change
  const locSelect = $('#lokasi-select') as HTMLSelectElement;
  if (locSelect) {
    locSelect.addEventListener('change', () => {
      const loc = INDONESIAN_LOCATIONS.find(l => l.id === locSelect.value);
      if (loc) {
        state.location = loc;
        recomputeEngine();
      }
    });
  }

  // Growth Stage Dropdown Change
  const stageSelect = $('#fase') as HTMLSelectElement;
  if (stageSelect) {
    stageSelect.addEventListener('change', () => {
      const crop = CROP_MODELS[state.cropId];
      if (crop) {
        const stage = crop.growthStages.find(s => s.id === stageSelect.value);
        if (stage) {
          state.currentHST = Math.round((stage.minHST + stage.maxHST) / 2);
          recomputeEngine();
        }
      }
    });
  }

  // Age (HST) Input Change
  const umurInput = $('#umur') as HTMLInputElement;
  if (umurInput) {
    umurInput.addEventListener('input', () => {
      const val = Number(umurInput.value);
      if (!isNaN(val) && val > 0) {
        state.currentHST = val;
        recomputeEngine();
      }
    });
  }

  // Chat Enter Key
  const chatInput = $('#chat') as HTMLInputElement;
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChat();
    });
  }

  // Bar Chart Hover Tooltip
  const barsCont = $('#bars');
  if (barsCont) {
    barsCont.addEventListener('mousemove', (e) => {
      const bar = (e.target as HTMLElement).closest('[data-bar-idx]') as HTMLElement;
      const tooltip = $('#chart-tooltip');
      if (bar && tooltip) {
        tooltip.textContent = bar.getAttribute('title') || '';
      }
    });
    barsCont.addEventListener('mouseleave', () => {
      const tooltip = $('#chart-tooltip');
      if (tooltip) tooltip.textContent = 'Arahkan kursor pada batang untuk melihat rincian tanggal & angka';
    });
  }
}

function initWebSocketClient() {
  // WebSocket hanya diinisialisasi pada environment lokal yang mendukung koneksi WS persisten
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const pulseDot = $('#ws-pulse-dot');
  const statusText = $('#ws-status-text');

  if (!isLocalHost) {
    if (statusText) statusText.textContent = 'Telemetri Live (Polling HTTP Aktif)';
    if (pulseDot) {
      pulseDot.style.background = '#10B981';
      pulseDot.style.boxShadow = '0 0 8px rgba(16,185,129,0.8)';
    }
    return;
  }

  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (statusText) statusText.textContent = 'Telemetri Live Aktif (WebSocket)';
      if (pulseDot) {
        pulseDot.style.background = '#10B981';
        pulseDot.style.boxShadow = '0 0 8px rgba(16,185,129,0.8)';
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'TELEMETRY_PULSE') {
          if (pulseDot) {
            pulseDot.style.transform = 'scale(1.5)';
            setTimeout(() => {
              pulseDot.style.transform = 'scale(1)';
            }, 300);
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      if (statusText) statusText.textContent = 'Telemetri Tersambung (Polling Aktif)';
      if (pulseDot) {
        pulseDot.style.background = '#10B981';
        pulseDot.style.boxShadow = 'none';
      }
    };

    ws.onerror = () => {
      if (statusText) statusText.textContent = 'Telemetri Tersambung (Polling Aktif)';
    };
  } catch (err) {
    console.warn('WebSocket telemetry initialization skipped:', err);
  }
}

// ---------- INIT ENTRY POINT ----------
async function init() {
  state.authUser = getStoredUser();
  state.authProfile = getStoredProfile();
  state.uiMode = getStoredUIMode();

  state.plots = initDefaultPlots();

  // If user profile is saved from auth/PostgreSQL, synchronize crop, location, hst & mode
  if (state.authProfile) {
    if (state.authProfile.commodity && CROPS_LIST.some(c => c.id === state.authProfile?.commodity)) {
      state.cropId = state.authProfile.commodity as CropId;
    }
    const matchedLoc = INDONESIAN_LOCATIONS.find(l => l.name.toLowerCase().includes((state.authProfile?.location_name || '').toLowerCase()));
    if (matchedLoc) state.location = matchedLoc;
    if (state.authProfile.hst) state.currentHST = state.authProfile.hst;
    if (state.authUser?.user_type === 'farm_organisasi') {
      state.uiMode = 'pro';
      setStoredUIMode('pro');
    }
  }

  // Check login gate: if user is not logged in and hasn't skipped demo, show onboarding/login modal!
  const skippedDemo = localStorage.getItem('taniadapt_demo_guest');
  if (!state.authUser && skippedDemo !== 'true') {
    state.isAuthModalOpen = true;
    renderAuthModal();
  }

  initWebSocketClient();
  handleUrlParams();
  setupEventListeners();
  render(); // Initial immediate render so UI never stays blank

  try {
    await recomputeEngine();
    await recomputeAllPlots();
  } catch (err) {
    console.error('Computation failed:', err);
  }
  render();
}

// Jalankan inisialisasi saat DOM siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
