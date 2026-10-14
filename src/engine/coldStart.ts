/**
 * Pure TypeScript Cold-Start Water Ledger Module for TaniAdapt.
 * Reconstructs root zone soil water depletion (Dr) from an event log
 * and historical daily weather series from planting date up to today.
 *
 * Implements two initial trajectories (Dr0 = 0 and Dr0 = TAW).
 * - If they converge (e.g. rain/irrigation >= depletion -> Dr = 0), state is 'pasti'.
 * - If they do not converge, state is 'interval' [rendah, tinggi].
 */

import { SupportedCrop } from './kc';
import { calculateTawRaw, updateDailyDepletion } from './waterBalance';

export interface WeatherDayHistory {
  date: string;
  dap: number;
  etc_mm: number;
  precip_mm: number;
}

export interface FarmingEventLog {
  date: string;
  type: 'irrigation' | 'fertilization';
  depth_mm?: number | null;
}

export interface ColdStartResult {
  crop: SupportedCrop;
  dr_awal_status: 'pasti' | 'interval';
  dr_final_mm: number | null;
  dr_interval_mm: [number, number] | null;
  konvergen_pada: string | null;
  assumed_saturation_events: string[];
}

export function reconstructColdStartDr(
  crop: SupportedCrop,
  weatherHistory: WeatherDayHistory[],
  eventLogs: FarmingEventLog[],
  soilTawMmPerM: number = 150.0
): ColdStartResult {
  if (crop === 'padi' || crop === 'cabai' || crop === 'cabai_rawit' || crop === 'bawang_merah') {
    return {
      crop,
      dr_awal_status: 'interval',
      dr_final_mm: null,
      dr_interval_mm: [0.0, 100.0],
      konvergen_pada: null,
      assumed_saturation_events: [],
    };
  }

  const baseTaw = calculateTawRaw(crop, 30, soilTawMmPerM).taw_mm;

  let drLow = 0.0;
  let drHigh = baseTaw;
  let konvergenPada: string | null = null;
  const assumedSatEvents: string[] = [];

  const eventsByDate = new Map<string, FarmingEventLog[]>();
  for (const ev of eventLogs) {
    const list = eventsByDate.get(ev.date) || [];
    list.push(ev);
    eventsByDate.set(ev.date, list);
  }

  for (const day of weatherHistory) {
    const tawRaw = calculateTawRaw(crop, day.dap, soilTawMmPerM);

    drLow = updateDailyDepletion(drLow, day.etc_mm, day.precip_mm, tawRaw.taw_mm);
    drHigh = updateDailyDepletion(drHigh, day.etc_mm, day.precip_mm, tawRaw.taw_mm);

    const dayEvents = eventsByDate.get(day.date);
    if (dayEvents) {
      for (const ev of dayEvents) {
        if (ev.type === 'irrigation') {
          if (ev.depth_mm === null || ev.depth_mm === undefined) {
            drLow = 0.0;
            drHigh = 0.0;
            assumedSatEvents.push(day.date);
          } else {
            drLow = Math.max(0.0, drLow - ev.depth_mm);
            drHigh = Math.max(0.0, drHigh - ev.depth_mm);
          }
        }
      }
    }

    if (Math.abs(drLow - drHigh) < 0.01) {
      if (konvergenPada === null) {
        konvergenPada = day.date;
      }
    }
  }

  const isConverged = Math.abs(drLow - drHigh) < 0.01;

  return {
    crop,
    dr_awal_status: isConverged ? 'pasti' : 'interval',
    dr_final_mm: isConverged ? Number(drLow.toFixed(2)) : null,
    dr_interval_mm: isConverged
      ? null
      : [Number(drLow.toFixed(2)), Number(drHigh.toFixed(2))],
    konvergen_pada: konvergenPada,
    assumed_saturation_events: assumedSatEvents,
  };
}
