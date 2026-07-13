/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckpointReading } from './types';

// Station id (matches Checkpoint.id in data.ts) -> file-name code used when
// the Excel workbook was converted to JSON (see /public/data/checkpoints/).
export const STATION_FILE_CODE: Record<string, string> = {
  'หันคา': 'hk',
  'สามชุก': 'sc',
  'สุพรรณบุรี': 'spb',
  'สองพี่น้อง': 'spn',
  'บางเลน': 'bl',
  'นครชัยศรี': 'ncs',
  'กระทุ่มแบน': 'ktb',
};

export interface CheckpointIndex {
  stations: Record<string, { name: string; years: number[] }>;
}

let indexCache: CheckpointIndex | null = null;
const yearFileCache: Map<string, CheckpointReading[]> = new Map();

/**
 * Loads /public/data/checkpoints/index.json once and caches it.
 * Tells us which years of data exist for each station.
 */
export async function loadCheckpointIndex(): Promise<CheckpointIndex> {
  if (indexCache) return indexCache;
  const res = await fetch('/data/checkpoints/index.json');
  if (!res.ok) throw new Error(`Failed to load checkpoint index: ${res.status}`);
  indexCache = await res.json();
  return indexCache!;
}

/**
 * Loads one station's one-year file, e.g. spn_2023.json.
 * Cached in memory so switching between dates within the same
 * station+year doesn't re-fetch.
 */
export async function loadCheckpointYear(
  stationId: string,
  year: number
): Promise<CheckpointReading[]> {
  const code = STATION_FILE_CODE[stationId];
  if (!code) throw new Error(`Unknown checkpoint station id: ${stationId}`);

  const cacheKey = `${code}_${year}`;
  const cached = yearFileCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(`/data/checkpoints/${cacheKey}.json`);
  if (!res.ok) {
    throw new Error(`No data file for ${stationId} ${year} (${cacheKey}.json, ${res.status})`);
  }
  const raw: { t: string; pH: number | null; DO: number | null; EC: number | null; Temp: number | null }[] =
    await res.json();

  const readings: CheckpointReading[] = raw.map(r => ({
    timestamp: r.t,
    values: { pH: r.pH, DO: r.DO, EC: r.EC, Temp: r.Temp },
  }));

  yearFileCache.set(cacheKey, readings);
  return readings;
}

/**
 * Finds the reading closest to the requested date-time (readings are at
 * ~30-minute intervals but have occasional gaps, so we pick the nearest
 * timestamp rather than requiring an exact match).
 */
export function findClosestReading(
  readings: CheckpointReading[],
  targetIso: string
): CheckpointReading | null {
  if (readings.length === 0) return null;
  const target = new Date(targetIso).getTime();
  let best = readings[0];
  let bestDiff = Math.abs(new Date(best.timestamp).getTime() - target);

  for (const r of readings) {
    const diff = Math.abs(new Date(r.timestamp).getTime() - target);
    if (diff < bestDiff) {
      best = r;
      bestDiff = diff;
    }
  }
  return best;
}

/**
 * Convenience wrapper: given a station id and a target date-time, loads the
 * correct year file (if not already cached) and returns the closest reading.
 */
export async function getCheckpointReadingAt(
  stationId: string,
  targetIso: string
): Promise<CheckpointReading | null> {
  const year = new Date(targetIso).getFullYear();
  const readings = await loadCheckpointYear(stationId, year);
  return findClosestReading(readings, targetIso);
}

// ─────────────────────────────────────────────────────────────────────────
// Water-quality evaluation against real Tha Chin river standards.
//
// EC is treated differently per zone: the lower river (นครชัยศรี, กระทุ่มแบน)
// has natural seawater intrusion, so a high EC there does not by itself mean
// pollution — DO is the more reliable indicator in that stretch. The upper
// freshwater stations don't have that excuse, so a high EC there is checked.
// ─────────────────────────────────────────────────────────────────────────
const BRACKISH_ZONE_STATIONS = new Set<string>(['นครชัยศรี', 'กระทุ่มแบน']);

export interface CheckpointEvaluation {
  isViolating: boolean;
  reasons: string[];
}

export function evaluateCheckpointReading(
  stationId: string,
  reading: CheckpointReading | null | undefined
): CheckpointEvaluation {
  if (!reading) return { isViolating: false, reasons: [] };
  const { pH, DO, EC, Temp } = reading.values;
  const reasons: string[] = [];

  if (DO !== null && DO !== undefined && DO < 2.0) {
    reasons.push(`DO ต่ำวิกฤต (${DO} มก./ลิตร ต่ำกว่าเกณฑ์ 2.0)`);
  }
  if (pH !== null && pH !== undefined && (pH < 6.5 || pH > 8.5)) {
    reasons.push(`pH ผิดปกติ (${pH}, เกณฑ์ 6.5-8.5)`);
  }
  if (Temp !== null && Temp !== undefined && Temp > 35) {
    reasons.push(`อุณหภูมิสูงผิดปกติ (${Temp}°C)`);
  }
  if (
    EC !== null && EC !== undefined &&
    !BRACKISH_ZONE_STATIONS.has(stationId) &&
    EC > 1500
  ) {
    reasons.push(`EC สูงผิดปกติสำหรับโซนน้ำจืด (${EC} µS/cm, เกณฑ์ปกติ 200-800)`);
  }

  return { isViolating: reasons.length > 0, reasons };
}
