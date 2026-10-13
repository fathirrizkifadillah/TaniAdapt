// ============================================================================
// TaniAdapt — Precision Agro-Workstation (TypeScript Driver)
// Mengintegrasikan Decision Engine, Fitur Temporal, Weather API, dan RAG Ilmiah
// ============================================================================

import { INDONESIAN_LOCATIONS, CROP_MODELS, LITERATURE_DATABASE, LiteratureExtraction16 } from './data';
import { fetchAgriculturalWeather, WeatherFetchResult } from './services';
import { runAgroDecisionEngine, resolveActiveGrowthStage, calculateVPD } from './engine';
import { CropId, AgriculturalLocation, CropEngineResult, RiskLevel, TemporalFeatures } from './types';

// ---------- TYPES & INTERFACES ----------
export type StressScenario = 'normal' | 'flood' | 'drought';
export type MetricType = 'hujan' | 'rh' | 'suhu' | 'vpd';

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
  cropId: 'cabai' as CropId,
  location: INDONESIAN_LOCATIONS[0],
  currentHST: 55,
  metric: 'hujan' as MetricType,
  stressMode: 'normal' as StressScenario,
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
  { id: 'cabai', label: 'Cabai Merah', scientific: 'Capsicum annuum L.' },
  { id: 'padi', label: 'Padi Sawah', scientific: 'Oryza sativa L.' },
  { id: 'bawang_merah', label: 'Bawang Merah', scientific: 'Allium ascalonicum' },
  { id: 'jagung', label: 'Jagung Hibrida', scientific: 'Zea mays L.' },
  { id: 'tomat', label: 'Tomat Sayur', scientific: 'Solanum lycopersicum' }
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
  const saved = localStorage.getItem('taniadapt_plots_v3');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore parsing error
    }
  }

  const defaults: PlotItem[] = [
    {
      id: 'plot-1',
      name: 'Lahan Pasirhuni',
      locationId: 'lembang',
      placeName: 'Lembang, Kab. Bandung Barat',
      cropId: 'cabai',
      plantDate: '2026-08-19',
      hst: 55,
      stageName: 'Pembungaan & Pembesaran Buah',
      risk: 'TINGGI',
      trail: [
        { dayLabel: 'HST 49', weather: 'Cerah Berawan', status: 'Sehat', note: 'Aplikasi KNO3 merah susulan' },
        { dayLabel: 'HST 50', weather: 'Berawan', status: 'Sehat', note: 'Tajuk tanaman tegap' },
        { dayLabel: 'HST 51', weather: 'Hujan Ringan', status: 'Sehat', note: 'Kuncup bunga serempak' },
        { dayLabel: 'HST 52', weather: 'Hujan Sedang', status: 'Waspada', note: 'Kelembapan tinggi & daun basah lama' },
        { dayLabel: 'HST 53', weather: 'Hujan Deras', status: 'Waspada', note: 'Parit bedengan mulai tergenang air' },
        { dayLabel: 'HST 54', weather: 'Hujan Deras', status: 'Risiko tinggi', note: 'Pengurasan parit & penyiangan' },
        { dayLabel: 'HST 55 (Hari Ini)', weather: 'Hujan Ringan', status: 'Risiko tinggi', note: 'Waspada spora antraknosa bunga' }
      ]
    },
    {
      id: 'plot-2',
      name: 'Petak Sekunder 4',
      locationId: 'sukamandi',
      placeName: 'Sukamandi, Kab. Subang',
      cropId: 'padi',
      plantDate: '2026-09-01',
      hst: 42,
      stageName: 'Anakan Aktif & Maksimum',
      risk: 'SEDANG',
      trail: [
        { dayLabel: 'HST 36', weather: 'Cerah', status: 'Sehat', note: 'Pengairan macak-macak' },
        { dayLabel: 'HST 37', weather: 'Cerah', status: 'Sehat', note: 'Anakan 18 batang per rumpun' },
        { dayLabel: 'HST 38', weather: 'Berawan', status: 'Sehat', note: 'Pertumbuhan normal' },
        { dayLabel: 'HST 39', weather: 'Hujan Ringan', status: 'Sehat', note: 'Genangan 3 cm optimal' },
        { dayLabel: 'HST 40', weather: 'Hujan Sedang', status: 'Waspada', note: 'Angin kencang dari timur' },
        { dayLabel: 'HST 41', weather: 'Hujan Ringan', status: 'Waspada', note: 'Potensi luka stomata akibat angin' },
        { dayLabel: 'HST 42 (Hari Ini)', weather: 'Berawan', status: 'Waspada', note: 'Pantau gejala hawar daun bakteri' }
      ]
    },
    {
      id: 'plot-3',
      name: 'Tegalan Wanasari',
      locationId: 'brebes',
      placeName: 'Brebes, Jawa Tengah',
      cropId: 'bawang_merah',
      plantDate: '2026-09-15',
      hst: 28,
      stageName: 'Vegetatif Lanjut / Pembentukan Umbi',
      risk: 'RENDAH',
      trail: [
        { dayLabel: 'HST 22', weather: 'Cerah Panas', status: 'Sehat', note: 'Penyiraman pagi hari rutin' },
        { dayLabel: 'HST 23', weather: 'Cerah', status: 'Sehat', note: 'Kondisi kering optimal' },
        { dayLabel: 'HST 24', weather: 'Cerah', status: 'Sehat', note: 'Pertumbuhan anakan daun baik' },
        { dayLabel: 'HST 25', weather: 'Berawan', status: 'Sehat', note: 'Suhu siang 32°C' },
        { dayLabel: 'HST 26', weather: 'Cerah', status: 'Sehat', note: 'Drainase bedengan lancar' },
        { dayLabel: 'HST 27', weather: 'Cerah', status: 'Sehat', note: 'Tajuk bersih dari embun tepung' },
        { dayLabel: 'HST 28 (Hari Ini)', weather: 'Cerah Berawan', status: 'Sehat', note: 'Optimal pembentukan umbi' }
      ]
    }
  ];

  localStorage.setItem('taniadapt_plots_v3', JSON.stringify(defaults));
  return defaults;
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
    localStorage.setItem('taniadapt_plots_v3', JSON.stringify(state.plots));
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

function renderLocationDropdown() {
  const select = $('#lokasi-select') as HTMLSelectElement;
  if (!select) return;

  select.innerHTML = INDONESIAN_LOCATIONS.map((loc) => {
    const sel = loc.id === state.location.id ? 'selected' : '';
    return `<option value="${loc.id}" ${sel}>${loc.name} (${loc.province}) — ${loc.elevationMeters}m dpl</option>`;
  }).join('');

  const modalSelect = $('#ll') as HTMLSelectElement;
  if (modalSelect) {
    modalSelect.innerHTML = select.innerHTML;
  }
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
          <span style="font-size: 11px; color: var(--muted); margin-top: 4px; font-family: 'IBM Plex Mono', monospace">Kategori: ${r.category} &bull; Rationale: ${r.rationale}</span>
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

  // Define weights based on weather & crop sensitivity
  const factors = [
    { name: 'Hari Hujan Berturut-turut', value: `${f.consecutiveRainyDays} hari`, weight: Math.min(100, f.consecutiveRainyDays * 20), level: f.consecutiveRainyDays >= 3 ? 'Kuat' : 'Sedang' },
    { name: 'Kelembapan Relatif Rolling (7d)', value: `${Math.round(f.rolling7dRH)}%`, weight: Math.min(100, Math.round(f.rolling7dRH)), level: f.rolling7dRH >= 85 ? 'Kuat' : 'Sedang' },
    { name: 'Defisit Tekanan Uap (VPD)', value: `${f.currentVPD.toFixed(2)} kPa`, weight: Math.min(100, Math.round((1 - Math.min(1, f.currentVPD / 1.5)) * 100)), level: f.currentVPD < 0.4 ? 'Kuat (Lembap)' : 'Normal' },
    { name: 'Kerentanan Fase Fenologi', value: state.engineResult?.stageName || 'Vegetatif', weight: state.engineResult?.stageVulnerability === 'KRITIS' ? 95 : state.engineResult?.stageVulnerability === 'TINGGI' ? 80 : 50, level: 'Tinggi' },
    { name: 'Akumulasi Hujan 7 Hari', value: `${Math.round(f.rolling7dRain)} mm`, weight: Math.min(100, Math.round(f.rolling7dRain * 1.2)), level: f.rolling7dRain > 60 ? 'Kuat' : 'Sedang' }
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
          ${m.sourceDoc ? `<span style="font-size: 10px; background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px; color: var(--dark-muted)">${m.sourceDoc}</span>` : ''}
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
    bindText('fieldLine', `${curPlot.name} &bull; ${curPlot.placeName}`);

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

function render() {
  renderNav();
  renderViews();
  renderLocationDropdown();
  renderCrops();
  renderGrowthStages();
  renderStressBar();

  if (state.view === 'ringkasan') {
    renderRiskCard();
    renderRecommendations();
    renderInfluentialFactors();
    renderWeatherSnapshot();
  } else if (state.view === 'cuaca') {
    renderWeatherView();
  } else if (state.view === 'tanya') {
    renderChat();
  } else if (state.view === 'lahan') {
    renderFields();
  }

  renderEvidenceModal();
  renderPrintModal();
}

// ---------- RAG EXPLANATION ASSISTANT ----------
function askQuestion(q: string) {
  let answer = '';
  let sourceDoc = '';

  const crop = CROP_MODELS[state.cropId];
  const res = state.engineResult;
  const f = state.features;
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

  state.thread.push({ me: true, text: q });
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
      state.fieldIndex = Number(fieldOpen.dataset.fieldOpen);
      const plot = state.plots[state.fieldIndex];
      if (plot) {
        state.cropId = plot.cropId;
        state.currentHST = plot.hst;
        const loc = INDONESIAN_LOCATIONS.find(l => l.id === plot.locationId);
        if (loc) state.location = loc;
      }
      state.view = 'ringkasan';
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

      const newPlot: PlotItem = {
        id: `plot-${Date.now()}`,
        name: nameInput.value.trim(),
        locationId: locSelect.value,
        placeName: INDONESIAN_LOCATIONS.find(l => l.id === locSelect.value)?.name || 'Indonesia',
        cropId: cropSelect.value as CropId,
        plantDate: dateInput.value || new Date().toISOString().split('T')[0],
        hst: 14,
        stageName: 'Vegetatif Awal',
        risk: 'RENDAH',
        trail: [
          { dayLabel: 'HST 1', weather: 'Cerah', status: 'Sehat', note: 'Hari tanam bibit' },
          { dayLabel: 'HST 7', weather: 'Cerah Berawan', status: 'Sehat', note: 'Penyulaman bibit mati' },
          { dayLabel: 'HST 14 (Hari Ini)', weather: 'Berawan', status: 'Sehat', note: 'Aplikasi pupuk dasar' }
        ]
      };

      state.plots.push(newPlot);
      state.fieldIndex = state.plots.length - 1;
      state.showForm = false;
      localStorage.setItem('taniadapt_plots_v3', JSON.stringify(state.plots));
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
        localStorage.setItem('taniadapt_plots_v3', JSON.stringify(state.plots));
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
    if (target.id === 'go-cuaca') {
      state.view = 'cuaca';
      render();
      return;
    }
    if (target.id === 'ask-why') {
      state.view = 'tanya';
      askQuestion('Kenapa ini direkomendasikan saat ini?');
      render();
      return;
    }
    if (target.id === 'send') {
      sendChat();
      return;
    }
  });

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

// ---------- INIT ENTRY POINT ----------
async function init() {
  state.plots = initDefaultPlots();
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
