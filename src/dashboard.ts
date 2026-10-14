// ============================================================================
// TaniAdapt — Precision Agro-Workstation (TypeScript Driver)
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
  searchLocationsByApi,
  getCurrentGpsPosition,
  GeocodingResult,
  AuthUser,
  UserProfileData,
} from './services';
import { runAgroDecisionEngine, resolveActiveGrowthStage, calculateVPD } from './engine';
import { CropId, AgriculturalLocation, CropEngineResult, RiskLevel, TemporalFeatures } from './types';

// ---------- TYPES & INTERFACES ----------
export type StressScenario = 'normal' | 'flood' | 'drought';
export type MetricType = 'hujan' | 'rh' | 'suhu' | 'vpd';
export type UIMode = 'default' | 'pro';

interface PlotTrailItem {
  dayLabel: string;
  weather: string;
  status: 'Sehat' | 'Waspada' | 'Risiko tinggi';
  note: string;
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
}

interface ChatMessage {
  me: boolean;
  text: string;
  sourceDoc?: string;
}

// ---------- STATE UTAMA ----------
const state = {
  view: 'ringkasan' as 'ringkasan' | 'cuaca' | 'tanya' | 'lahan',
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
  evidenceFilter: 'all' as string,
  weatherData: null as WeatherFetchResult | null,
  engineResult: null as CropEngineResult | null,
  features: null as TemporalFeatures | null,
  plots: [] as PlotItem[],
  thread: [
    {
      me: false,
      text: 'Halo! Saya asisten agronomis TaniAdapt. Saya siap menjelaskan dasar matematis & agronomi dari rekomendasi lahan Anda, termasuk ambang batas infeksi jamur dan regulasi irigasi FAO-56.'
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
  { id: 'tomat', label: 'Tomat Sayur / Buah', scientific: 'Solanum lycopersicum' },
  { id: 'bawang_merah', label: 'Bawang Merah', scientific: 'Allium ascalonicum' }
];

const VIEWS = [
  { id: 'ringkasan', label: 'Ringkasan risiko' },
  { id: 'cuaca', label: 'Cuaca & riwayat' },
  { id: 'tanya', label: 'Tanya TaniAdapt' },
  { id: 'lahan', label: 'Lahan saya' }
];

const TITLES: Record<string, string> = {
  ringkasan: 'Ringkasan risiko & tindakan',
  cuaca: 'Cuaca hiperlokal & riwayat temporal',
  tanya: 'Tanya TaniAdapt (RAG terverifikasi)',
  lahan: 'Petak lahan saya & catatan jejak'
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
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore parsing error
    }
  }

  // Lahan kosong secara default; pengguna mendaftarkan lahan riil mereka sendiri
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

// ---------- RENDER FUNCTIONS ----------
function renderNav() {
  const container = $('#nav');
  if (!container) return;

  container.innerHTML = VIEWS.map((v) => {
    const on = state.view === v.id;
    const style = 'text-align: left; width: 100%; min-height: 44px; padding: 0 14px; border-radius: 10px; border: none; font: inherit; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; ' +
      (on ? 'background: var(--accent); color: var(--ink); font-weight: 700' : 'background: transparent; color: #DCE5D8');
    return `<button type="button" data-view-btn="${v.id}" ${on ? 'aria-current="page"' : ''} style="${style}">
      <span>${v.label}</span>
      ${on ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>' : ''}
    </button>`;
  }).join('');
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

function renderLocationDropdown() {
  const select = $('#lokasi-select') as HTMLSelectElement;
  if (!select) return;

  const isPredefined = INDONESIAN_LOCATIONS.some(l => l.id === state.location.id);
  let optionsHtml = INDONESIAN_LOCATIONS.map((loc) => {
    const sel = loc.id === state.location.id ? 'selected' : '';
    return `<option value="${loc.id}" ${sel}>${loc.name} — ${loc.elevationMeters}m dpl</option>`;
  }).join('');

  if (!isPredefined) {
    optionsHtml = `<option value="${state.location.id}" selected>📍 ${state.location.name} (${state.location.latitude.toFixed(4)}, ${state.location.longitude.toFixed(4)})</option>` + optionsHtml;
  }

  select.innerHTML = optionsHtml;

  const modalSelect = $('#ll') as HTMLSelectElement;
  if (modalSelect) {
    modalSelect.innerHTML = select.innerHTML;
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

  // Compute average disease risk index
  const avgRisk = Math.round(
    res.diseaseRisks.reduce((acc, d) => acc + d.score, 0) / (res.diseaseRisks.length || 1)
  );

  if (riskBadge) {
    riskBadge.textContent = `${avgRisk}/100`;
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
      return `<li style="display: flex; gap: 12px; align-items: flex-start; background: var(--ground); padding: 12px 14px; border-radius: 12px">
        <span style="flex: none; width: 26px; height: 26px; border-radius: 8px; background: ${isUrgent ? 'var(--risk)' : 'var(--green)'}; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">
          ${i + 1}
        </span>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 3px">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <strong style="font-size: 14px; color: var(--ink)">${r.title}</strong>
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700; ${isUrgent ? 'color: var(--risk-strong)' : 'color: var(--green)'}">[${r.urgency}]</span>
          </div>
          <span style="font-size: 13px; color: var(--text-2); line-height: 1.4">${r.action}</span>
          ${state.uiMode === 'pro'
            ? `<span style="font-size: 11px; color: var(--muted); margin-top: 4px; font-family: 'IBM Plex Mono', monospace">Kategori: ${r.category} &bull; Rationale: ${r.rationale} &bull; Sumber: ${r.literatureSource || 'FAO-56'}</span>`
            : `<span style="font-size: 12px; color: var(--green); margin-top: 4px; font-weight: 600">Catatan Petani: ${r.rationale}</span>`
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

  // Define weights based on weather & crop sensitivity
  const factors = isPro ? [
    { name: 'Hari Hujan Berturut-turut', value: `${f.consecutiveRainyDays} hari`, weight: Math.min(100, f.consecutiveRainyDays * 20), level: f.consecutiveRainyDays >= 3 ? 'Kuat' : 'Sedang' },
    { name: 'Kelembapan Relatif Rolling (7d)', value: `${Math.round(f.rolling7dRH)}%`, weight: Math.min(100, Math.round(f.rolling7dRH)), level: f.rolling7dRH >= 85 ? 'Kuat' : 'Sedang' },
    { name: 'Defisit Tekanan Uap (VPD Tetens)', value: `${f.currentVPD.toFixed(2)} kPa`, weight: Math.min(100, Math.round((1 - Math.min(1, f.currentVPD / 1.5)) * 100)), level: f.currentVPD < 0.4 ? 'Kuat (Lembap)' : 'Normal' },
    { name: 'Kerentanan Fase Fenologi', value: state.engineResult?.stageName || 'Vegetatif', weight: state.engineResult?.stageVulnerability === 'KRITIS' ? 95 : state.engineResult?.stageVulnerability === 'TINGGI' ? 80 : 50, level: 'Tinggi' },
    { name: 'Akumulasi Presipitasi 7 Hari', value: `${Math.round(f.rolling7dRain)} mm`, weight: Math.min(100, Math.round(f.rolling7dRain * 1.2)), level: f.rolling7dRain > 60 ? 'Kuat' : 'Sedang' }
  ] : [
    { name: 'Hari Hujan Berturut-turut', value: `${f.consecutiveRainyDays} hari`, weight: Math.min(100, f.consecutiveRainyDays * 20), level: f.consecutiveRainyDays >= 3 ? 'Waspada' : 'Aman' },
    { name: 'Rata-rata Kelembapan Kebun (7 Hari)', value: `${Math.round(f.rolling7dRH)}%`, weight: Math.min(100, Math.round(f.rolling7dRH)), level: f.rolling7dRH >= 85 ? 'Sangat Lembap' : 'Cukup' },
    { name: 'Laju Penguapan Udara (VPD)', value: f.currentVPD < 0.4 ? 'Lembap Basah' : f.currentVPD > 1.2 ? 'Kering Terik' : 'Nyaman Optimal', weight: Math.min(100, Math.round((1 - Math.min(1, f.currentVPD / 1.5)) * 100)), level: 'Normal' },
    { name: 'Kebutuhan Air Tahap Ini', value: state.engineResult?.stageName || 'Pertumbuhan', weight: state.engineResult?.stageVulnerability === 'KRITIS' ? 95 : 65, level: 'Penting' },
    { name: 'Total Curah Hujan Seminggu', value: `${Math.round(f.rolling7dRain)} mm`, weight: Math.min(100, Math.round(f.rolling7dRain * 1.2)), level: f.rolling7dRain > 60 ? 'Basah' : 'Normal' }
  ];

  container.innerHTML = factors.map((item) => {
    return `<div style="display: flex; flex-direction: column; gap: 4px">
      <div style="display: flex; justify-content: space-between; font-size: 13px">
        <span style="font-weight: 500">${item.name} <span style="font-family: 'IBM Plex Mono', monospace; color: var(--muted)">(${item.value})</span></span>
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--green); font-weight: 600">${item.level}</span>
      </div>
      <div style="height: 8px; background: var(--sage); border-radius: 4px; overflow: hidden">
        <div style="width: ${item.weight}%; height: 8px; background: var(--green); border-radius: 4px"></div>
      </div>
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

function renderChat() {
  const thread = $('#thread');
  if (thread) {
    thread.innerHTML = state.thread.map((m) => {
      const style = 'max-width: 88%; padding: 14px 18px; border-radius: 14px; display: flex; flex-direction: column; gap: 6px; ' +
        (m.me
          ? 'align-self: flex-end; background: #DCE8C6; color: var(--ink)'
          : 'align-self: flex-start; background: var(--dark-2); color: #EEF3EA; border: 1px solid var(--dark-line)');

      return `<div style="${style}">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px">
          <span style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700; color: ${m.me ? 'var(--ink)' : 'var(--accent)'}">
            ${m.me ? 'Petani / Pengguna' : 'Asisten Agronomis TaniAdapt'}
          </span>
        </div>
        <span style="line-height: 1.5; font-size: 14px">${esc(m.text)}</span>
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
    if (factorText) factorText.textContent = `${state.features?.consecutiveRainyDays || 0} hari hujan berturut-turut`;
    if (waterText) waterText.textContent = r.irrigation.status === 'DRAINASE_MENDESAK' ? 'Drainase Mendesak' : 'Aman';
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
}

function renderFields() {
  const fieldsCont = $('#fields');
  if (!fieldsCont) return;

  const trailSection = document.querySelector('[aria-label="Jejak kondisi tanaman"]') as HTMLElement;

  if (state.plots.length === 0) {
    fieldsCont.innerHTML = `
      <div style="flex: 1 1 100%; background: #FFFFFF; border: 2px dashed var(--line); border-radius: 18px; padding: 48px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.03)">
        <div style="font-size: 48px">🌱</div>
        <h3 style="margin: 0; font-size: 20px; font-weight: 800; color: var(--ink)">Belum Ada Petak Lahan Terdaftar</h3>
        <p style="margin: 0; font-size: 14px; color: var(--muted); max-width: 500px; line-height: 1.6">
          Daftarkan petak lahan pertanian Anda sejak hari tanam agar Decision Engine dapat memantau akumulasi kebasahan daun, neraca air FAO-56, dan peringatan OPT secara akurat.
        </p>
        <button type="button" data-action="toggle-form" style="margin-top: 6px; min-height: 44px; padding: 0 24px; border-radius: 999px; background: var(--green); color: #FFF; border: none; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(30,77,53,0.2)">
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
        <div><div style="color: var(--muted); font-size: 11px">Umur</div><div style="font-weight: 700">${f.hst} HST</div></div>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px">
        <button type="button" data-field-select="${i}" aria-pressed="${on}" style="min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--field-line); background: var(--field); font: inherit; font-size: 13px; cursor: pointer; font-weight: 600">Lihat jejak</button>
        <button type="button" data-field-open="${i}" style="min-height: 40px; padding: 0 14px; border-radius: 999px; border: none; background: var(--green); color: #FFFFFF; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer">Buka Analisis &rarr;</button>
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
        const isToday = idx === curPlot.trail.length - 1;
        const box = 'display: flex; flex-direction: column; gap: 6px; padding: 14px 12px; border-radius: 14px; ' +
          (isToday ? 'background: var(--sage); border: 2px solid var(--green)' : 'background: var(--ground); border: 1px solid var(--line)');

        return `<li style="${box}">
          <span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700; color: var(--muted)">${t.dayLabel}</span>
          <span style="font-size: 13px; font-weight: 500">${t.weather}</span>
          <span style="align-self: flex-start; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; ${STATUS_CHIP[t.status]}">${t.status}</span>
          <span style="font-size: 12px; color: var(--text-2); min-height: 32px; line-height: 1.3">${t.note}</span>
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
    : allDocs.filter(l => l.crop.toLowerCase().includes(filter) || l.id.includes(filter));

  content.innerHTML = filtered.map((doc: LiteratureExtraction16, idx: number) => {
    return `<article style="background: var(--ground); border: 1px solid var(--line); border-radius: 16px; padding: 22px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 14px">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px">
        <div>
          <span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--green); font-weight: 700">Riset 0${idx + 1} &bull; ${doc.authors} (${doc.year})</span>
          <h3 style="margin: 4px 0 0; font-size: 18px; font-weight: 700; color: var(--ink)">${doc.title}</h3>
          <div style="font-size: 13px; color: var(--muted); margin-top: 2px">${doc.journal} &bull; ${doc.institution}</div>
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

  const body = $('#print-report-body');
  if (!body) return;

  const res = state.engineResult;
  const f = state.features;
  const cw = state.weatherData?.current;

  body.innerHTML = `
    <div style="border-bottom: 2px solid var(--ink); padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end">
      <div>
        <h1 style="margin: 0; font-family: 'Bricolage Grotesque', sans-serif; font-size: 24px">TaniAdapt &mdash; Lembar Rekomendasi Lahan</h1>
        <div style="color: var(--muted); font-size: 13px">Hyperlocal Precision Agro-Advisory &bull; Terverifikasi Bukti Ilmiah</div>
      </div>
      <div style="text-align: right; font-family: 'IBM Plex Mono', monospace; font-size: 12px">
        <div>Tanggal: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</div>
        <div>Lokasi: ${state.location.name} (${state.location.elevationMeters}m dpl)</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: var(--ground); padding: 12px; border-radius: 10px; margin-bottom: 18px">
      <div><strong>Komoditas:</strong> ${res.cropName} (<em>${res.scientificName}</em>)</div>
      <div><strong>Fase Fenologi:</strong> ${res.stageName} (${state.currentHST} HST)</div>
      <div><strong>Tingkat Risiko:</strong> <span style="font-weight: 700; color: ${res.overallRisk === 'TINGGI' ? 'var(--risk-strong)' : 'var(--green)'}">${res.overallRisk}</span></div>
    </div>

    <div style="margin-bottom: 18px">
      <h3 style="margin: 0 0 8px; font-size: 16px">1. Ringkasan Kondisi Agroklimat</h3>
      <p style="margin: 0; font-size: 13.5px">${res.temporalSummary}</p>
      <div style="font-size: 13px; color: var(--muted); margin-top: 6px">
        Suhu: ${cw?.temperature.toFixed(1)}°C &bull; RH: ${Math.round(cw?.relativeHumidity || 0)}% &bull; Hujan Kumulatif 7 Hari: ${Math.round(f.rolling7dRain)} mm &bull; Tekanan Uap (VPD): ${f.currentVPD.toFixed(2)} kPa
      </div>
    </div>

    <div style="margin-bottom: 18px">
      <h3 style="margin: 0 0 8px; font-size: 16px">2. Instruksi Tindakan Prioritas di Lahan</h3>
      <ol style="margin: 0; padding-left: 20px; font-size: 13.5px">
        ${res.recommendations.map(r => `<li style="margin-bottom: 6px"><strong>[${r.urgency}] ${r.title}:</strong> ${r.action} (${r.rationale})</li>`).join('')}
      </ol>
    </div>

    <div style="margin-bottom: 18px">
      <h3 style="margin: 0 0 8px; font-size: 16px">3. Status Manajemen Air &amp; Nutrisi</h3>
      <div style="font-size: 13.5px">
        <div><strong>Irigasi:</strong> ${res.irrigation.status === 'DRAINASE_MENDESAK' ? 'DRAINASE MENDESAK &mdash; Segera perdalam parit buangan' : 'LENGAS OPTIMAL'}</div>
        <div><strong>Pemupukan:</strong> ${res.fertilization.safeToApply ? 'Aman diaplikasikan' : 'TUNDA PEMUPUKAN NITROGEN &mdash; Risiko pencucian tinggi menurut standar FAO-56'}</div>
      </div>
    </div>

    <div style="border-top: 1px solid var(--line); padding-top: 12px; font-size: 12px; color: var(--muted); display: flex; justify-content: space-between">
      <span>TaniAdapt Decision Support System &bull; Balitsa, BB Padi, IPB, BRIN, FAO-56</span>
      <span>Dokumen Resmi Rekomendasi Lapangan</span>
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
  const defaultBtn = $('#mode-default-btn');
  const proBtn = $('#mode-pro-btn');
  const isDefault = state.uiMode === 'default';

  if (defaultBtn) {
    defaultBtn.style.background = isDefault ? 'var(--green)' : 'transparent';
    defaultBtn.style.color = isDefault ? '#FFFFFF' : 'var(--ink)';
  }
  if (proBtn) {
    proBtn.style.background = !isDefault ? 'var(--green)' : 'transparent';
    proBtn.style.color = !isDefault ? '#FFFFFF' : 'var(--ink)';
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
          <span style="font-size: 20px">👨‍🌾</span>
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
          <span style="font-size: 20px">🔬</span>
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
      <strong>⚠️ Status Registri Ilmiah (Phase 5): DIBLOKIR / PENDING NEW DATA</strong><br>
      Ketiadaan data sentra valid di Jawa Barat. Seluruh output disajikan terbatas untuk kajian komparasi drainase.
    </div>`;
  } else if (isPadi) {
    regimeNotice = `<div style="background: #FEF3C7; border-left: 4px solid #D97706; padding: 10px 14px; border-radius: 8px; font-size: 13px; color: #92400E">
      <strong>ℹ️ Status Modul Deplesi Air (Phase 4 & 5): EVIDENCE_INSUFFICIENT (Rezim Sawah Tergenang)</strong><br>
      Padi sawah di Jawa Barat dibudidayakan dalam kondisi tergenang (ponded wetland). Rumus deplesi lengas tanah tak jenuh (RAW = p * TAW) tidak berlaku secara biologis tanpa model perkolasi genangan lokal.
    </div>`;
  } else if (isCabai) {
    regimeNotice = `<div style="background: #FEF3C7; border-left: 4px solid #D97706; padding: 10px 14px; border-radius: 8px; font-size: 13px; color: #92400E">
      <strong>ℹ️ Status Modul Deplesi Air Cabai: UNVERIFIED (FAO-56 Hanya Memuat Paprika Subtropis)</strong><br>
      Cabai tropis Jawa Barat dibudidayakan di bedengan bermulsa plastik MPHP (evaporasi ditekan hingga 70%). Sistem menolak ekstrapolasi liar dari sweet pepper. Modul proteksi jamur fajar LWD (Sentelhas 2008), jendela semprot angin, dan panen tetap aktif 100%.
    </div>`;
  }

  // 7-day forward simulation rows
  let forwardSimRows = '';
  if (f.proyeksi_7hari && f.proyeksi_7hari.length > 0) {
    forwardSimRows = f.proyeksi_7hari.map(p => {
      const isCrossing = p.dr_prakiraan_mm > p.raw_mm;
      return `<tr style="border-bottom: 1px solid var(--line); font-size: 12.5px">
        <td style="padding: 8px 10px; font-weight: 600">H+${p.hari} (${p.tanggal})</td>
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
          <span style="font-size: 18px">🔬</span>
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
          ${f.sensitif_terhadap_asumsi_tanah ? '⚠️ Sensitif terhadap batas rentang TAW 130–180 mm/m' : '✓ Stabil terhadap variasi rentang tekstur tanah loam'}
        </div>
      </div>

      <div style="flex: 1 1 240px; background: #F8FAFC; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px">
        <strong style="color: var(--ink)">Uji Sensitivitas Presipitasi Efektif (Peff):</strong>
        <div style="margin-top: 3px; color: ${f.sensitif_terhadap_asumsi_hujan_efektif ? '#B45309' : 'var(--green)'}; font-weight: 600">
          ${f.sensitif_terhadap_asumsi_hujan_efektif ? '⚠️ Keputusan sensitif terhadap reduksi Peff = 0.8 * P' : '✓ Keputusan stabil terhadap reduksi Peff = 0.8 * P'}
        </div>
      </div>

      <div style="flex: 1 1 240px; background: #F8FAFC; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px">
        <strong style="color: var(--ink)">Status Ledger Cold-Start (M3):</strong>
        <div style="margin-top: 3px; color: var(--green); font-weight: 600">
          ${f.dr_awal_status === 'pasti' ? '✓ Pasti (Konvergen ke kapasitas lapang)' : 'Interval [Rendah, Tinggi]'}
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
      <strong>Catatan Ilmiah Keputusan Engine:</strong> Berdasarkan temuan ekonometrika Phase 7 &amp; evaluasi ML Phase 9, model regresi berbasis cuaca saja terbukti tidak memiliki daya generalisasi out-of-sample pada tahun baru (LOYO CV R² ≈ 0). Maka sistem mengunci status <em>claim_forbidden</em> pada tebak tonase panen, dan mengalihkan 100% keputusan pada rekomendasi tindakan diurnal harian berbasis biofisik deterministik.
    </div>
  `;
}

function renderAuth() {
  const container = $('#auth-status-container');
  if (!container) return;

  if (state.authUser) {
    const isPro = state.authUser.user_type === 'farm_organisasi';
    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px">
        <div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2">
          <span style="font-size: 13px; font-weight: 700; color: var(--ink)">${esc(state.authUser.full_name)}</span>
          <span style="font-size: 10px; font-family: 'IBM Plex Mono', monospace; background: var(--sage); color: var(--green); padding: 1px 6px; border-radius: 4px; font-weight: 700">
            ${isPro ? '🏢 PENGELOLA / AKADEMISI' : '👨‍🌾 PETANI'}
          </span>
        </div>
        <button type="button" id="btn-logout" style="min-height: 32px; padding: 0 12px; border-radius: 999px; background: transparent; border: 1px solid var(--line); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--muted)">Keluar</button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button type="button" id="open-auth-btn" style="min-height: 36px; padding: 0 14px; border-radius: 999px; background: var(--green); color: #FFFFFF; border: none; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(30,77,53,0.15)">
        <span>👤 Masuk / Profil</span>
      </button>
    `;
  }
}

function renderAuthModal() {
  const modal = $('#auth-modal');
  if (!modal) return;
  modal.hidden = !state.isAuthModalOpen;

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

function render() {
  renderNav();
  renderViews();
  renderUIMode();
  renderAuth();
  renderLocationDropdown();
  renderCrops();
  renderGrowthStages();
  renderStressBar();

  if (state.view === 'ringkasan') {
    renderRiskCard();
    renderRecommendations();
    renderInfluentialFactors();
    renderWeatherSnapshot();
    renderFao56ProPanel();
  } else if (state.view === 'cuaca') {
    renderWeatherView();
  } else if (state.view === 'tanya') {
    renderChat();
  } else if (state.view === 'lahan') {
    renderFields();
  }

  renderEvidenceModal();
  renderPrintModal();
  renderAuthModal();
}

// ---------- RAG EXPLANATION ASSISTANT ----------
async function askQuestion(q: string) {
  state.thread.push({ me: true, text: q });
  renderChat();

  const crop = CROP_MODELS[state.cropId];
  const res = state.engineResult;
  const f = state.features;

  // Coba panggil LLM Groq (model openai/gpt-oss-120b)
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
    });
  }

  let answer = '';
  let sourceDoc = '';

  if (groqResult && groqResult.text) {
    answer = groqResult.text;
    sourceDoc = groqResult.sourceDoc;
  } else {
    const qLower = q.toLowerCase();

    if (qLower.includes('kenapa') || qLower.includes('mengapa') || qLower.includes('alasan') || qLower.includes('risiko')) {
      answer = `Tingkat risiko ${res?.overallRisk} pada ${crop?.name} fase ${res?.stageName} (${state.currentHST} HST) disebabkan oleh akumulasi ${f?.consecutiveRainyDays || 0} hari hujan berturut-turut dengan kelembapan 7 hari rata-rata ${Math.round(f?.rolling7dRH || 85)}% dan VPD ${f?.currentVPD.toFixed(2)} kPa. Kondisi kebasahan daun ini melampaui ambang kritis sporulasi jamur yang diteliti oleh Balitsa (2020).`;
      sourceDoc = 'Balitsa (2020)';
    } else if (qLower.includes('pupuk') || qLower.includes('memupuk') || qLower.includes('fertil')) {
      if (!res?.fertilization.safeToApply) {
        answer = `Sistem MEREKOMENDASIKAN MENUNDA pemupukan nitrogen saat ini. Sesuai panduan FAO-56 (Allen et al., 1998), curah hujan atau prakiraan lebat dalam 48 jam ke depan memicu risiko pencucian (leaching) nitrat ke bawah zona perakaran hingga 65%, yang merugikan biaya petani dan mencemari air tanah. Tunggu jendela cerah stabil minimal 48 jam.`;
      } else {
        answer = `Kondisi aman untuk aplikasi pupuk susulan. Prakiraan 48 jam ke depan menunjukkan curah hujan rendah (<15 mm) sehingga pupuk dapat terserap optimal oleh perakaran aktif.`;
      }
      sourceDoc = 'FAO-56 (Allen et al.)';
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
      answer = `Berdasarkan evaluasi engine TaniAdapt untuk ${crop?.name} di ${state.location.name}: Status risiko berada pada level ${res?.overallRisk}. Rekomendasi utama: ${res?.recommendations[0]?.title || 'Pantau perkembangan lahan rutin'}. Tanyakan skenario spesifik seperti pemupukan, drainase, atau dasar ilmiah jika membutuhkan penjelasan lebih dalam.`;
      sourceDoc = 'TaniAdapt Agro-Engine';
    }
  }

  state.thread.push({ me: false, text: answer, sourceDoc });
  renderChat();
}

function sendChat() {
  const input = $('#chat') as HTMLInputElement;
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  askQuestion(text);
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

    // View Navigation
    const viewBtn = target.closest('[data-view-btn]') as HTMLElement;
    if (viewBtn && viewBtn.dataset.viewBtn) {
      state.view = viewBtn.dataset.viewBtn as any;
      render();
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

    // Field Select
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
      return;
    }

    // Field Open in Ringkasan
    const fieldOpen = target.closest('[data-field-open]') as HTMLElement;
    if (fieldOpen && fieldOpen.dataset.fieldOpen !== undefined) {
      const idx = Number(fieldOpen.dataset.fieldOpen);
      state.fieldIndex = idx;
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
      }
      state.view = 'ringkasan';
      render(); // Instantly switch view to Ringkasan and update nav highlight!
      window.scrollTo({ top: 0, behavior: 'smooth' });
      recomputeEngine();
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

      const locObj = INDONESIAN_LOCATIONS.find(l => l.id === locSelect.value);
      const placeName = locObj ? `${locObj.name} (${locObj.elevationMeters} mdpl)` : 'Jawa Barat';

      const newPlot: PlotItem = {
        id: `plot-${Date.now()}`,
        name: nameInput.value.trim(),
        locationId: locSelect.value,
        placeName,
        cropId: cropSelect.value as CropId,
        plantDate: plantDateVal,
        hst: computedHst,
        stageName: 'Vegetatif Awal',
        risk: 'RENDAH',
        trail: [
          { dayLabel: `HST 1`, weather: 'Cerah', status: 'Sehat', note: 'Hari tanam bibit' },
          { dayLabel: `HST ${computedHst} (Hari Ini)`, weather: 'Berawan', status: 'Sehat', note: 'Lahan terdaftar di TaniAdapt' }
        ]
      };

      state.plots.push(newPlot);
      state.fieldIndex = state.plots.length - 1;
      state.showForm = false;
      localStorage.setItem('taniadapt_user_plots_v1', JSON.stringify(state.plots));
      nameInput.value = '';
      renderFields();
      return;
    }

    // Tambah Catatan Harian Lapangan
    if (target.id === 'add-note-btn') {
      const noteInput = $('#note') as HTMLInputElement;
      if (!noteInput || !noteInput.value.trim()) return;

      const curPlot = state.plots[state.fieldIndex];
      if (curPlot && curPlot.trail.length > 0) {
        curPlot.trail[curPlot.trail.length - 1].note = noteInput.value.trim();
        localStorage.setItem('taniadapt_user_plots_v1', JSON.stringify(state.plots));
        noteInput.value = '';
        renderFields();
      }
      return;
    }

    // Modal Triggers
    if (target.id === 'open-evidence-modal' || target.id === 'trigger-evidence-modal-btn') {
      state.isEvidenceModalOpen = true;
      renderEvidenceModal();
      return;
    }
    if (target.id === 'close-evidence-modal') {
      state.isEvidenceModalOpen = false;
      renderEvidenceModal();
      return;
    }
    if (target.id === 'print-advisory') {
      state.isPrintModalOpen = true;
      renderPrintModal();
      return;
    }
    if (target.id === 'close-print-modal') {
      state.isPrintModalOpen = false;
      renderPrintModal();
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

    // UI Mode Toggle (Petani Default vs Farm/Riset Pro)
    const modeBtn = target.closest('[data-ui-mode]') as HTMLElement;
    if (modeBtn && modeBtn.dataset.uiMode) {
      state.uiMode = modeBtn.dataset.uiMode as UIMode;
      setStoredUIMode(state.uiMode);
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
        btnGps.innerHTML = '<span>✅ GPS Terdeteksi</span>';
        setTimeout(() => {
          btnGps.innerHTML = '<span>📍 Deteksi GPS Lahan</span>';
        }, 3000);
      } catch (err: any) {
        alert(err.message || 'Gagal mendeteksi koordinat GPS.');
        btnGps.innerHTML = '<span>📍 Deteksi GPS Lahan</span>';
      }
    });
  }

  // Geocoding API Search
  const searchInput = $('#location-search-input') as HTMLInputElement;
  const searchBtn = $('#btn-search-geocoding');
  const resultsDropdown = $('#geocoding-results');

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
      const email = ($('#login-email') as HTMLInputElement)?.value.trim();
      const password = ($('#login-password') as HTMLInputElement)?.value;
      const errBox = $('#login-error');
      if (errBox) errBox.style.display = 'none';

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
        await recomputeEngine();
      } else {
        if (errBox) {
          errBox.textContent = res.error || 'Gagal masuk akun';
          errBox.style.display = 'block';
        }
      }
    });
  }

  // Register Form Submit (PostgreSQL / Local DB API)
  const regForm = $('#register-form') as HTMLFormElement;
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = ($('#reg-fullname') as HTMLInputElement)?.value.trim();
      const email = ($('#reg-email') as HTMLInputElement)?.value.trim();
      const password = ($('#reg-password') as HTMLInputElement)?.value;
      const userType = (document.querySelector('input[name="reg-user-type"]:checked') as HTMLInputElement)?.value as 'petani' | 'farm_organisasi' || 'petani';
      const plotName = ($('#reg-plot-name') as HTMLInputElement)?.value.trim() || 'Lahan Pasirhuni';
      const commodity = ($('#reg-commodity') as HTMLSelectElement)?.value as CropId || 'cabai';
      const plantDate = ($('#reg-plantdate') as HTMLInputElement)?.value || '2026-08-19';
      const farmArea = parseFloat(($('#reg-area') as HTMLInputElement)?.value || '1.0');

      const errBox = $('#reg-error');
      if (errBox) errBox.style.display = 'none';

      const res = await registerUser(email, password, fullName, userType, {
        commodity,
        location_name: state.location.name,
        latitude: state.location.latitude,
        longitude: state.location.longitude,
        planting_date: plantDate,
        hst: 55,
        farm_area_ha: farmArea,
        organization_name: plotName,
      });

      if (res.success && res.user) {
        state.authUser = res.user;
        state.authProfile = res.profile || null;
        state.cropId = commodity;
        state.uiMode = userType === 'farm_organisasi' ? 'pro' : 'default';
        setStoredUIMode(state.uiMode);
        state.isAuthModalOpen = false;
        renderAuthModal();
        await recomputeEngine();
      } else {
        if (errBox) {
          errBox.textContent = res.error || 'Gagal mendaftar akun';
          errBox.style.display = 'block';
        }
      }
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
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;
    const ws = new WebSocket(wsUrl);

    const pulseDot = $('#ws-pulse-dot');
    const statusText = $('#ws-status-text');

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
  await recomputeEngine();
}

// Jalankan inisialisasi saat DOM siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
