/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Factory {
  id: string;
  name: string;
  industryType: string;
  lat: number;
  lon: number;
  allowedQ: number; // m3/day
  actualQ: number;  // m3/day
  dischargeBOD: number; // mg/L
  dischargeCOD: number; // mg/L
  dischargeEC: number;  // uS/cm
  dischargeFecal?: number; // MPN/100ml
  dischargeNitrogen?: number; // mg/L
  status: 'Compliant' | 'Violation';
}

export interface Checkpoint {
  id: string;   // station name used as id, e.g. 'สองพี่น้อง'
  name: string; // display name of the station
  lat: number;
  lon: number;
}

// One row of historical data read from a station's CSV file.
// `values` holds whatever columns exist in that station's file
// (e.g. pH, DO, EC, Temp for some stations; BOD, COD, ... for others).
// Missing/blank cells in the source file are stored as null.
export interface CheckpointReading {
  timestamp: string; // raw date-time string from the file, e.g. "4/2/2023 9:00"
  values: Record<string, number | null>;
}

export interface Scenario {
  id: number;
  name: string;
  description: string;
  riverFlowRate: number; // Q_river in m3/day
  riverBOD: number;  // Upstream BOD mg/L
  riverCOD: number;  // Upstream COD mg/L
  riverFecal: number; // Upstream Fecal Coliform
  riverNitrogen: number; // Upstream Nitrogen
  riverEC: number; // Upstream Electrical Conductivity uS/cm
  systemJudgment: string;
  defenseStatus: string;
  alertLevel: 'safe' | 'warning' | 'critical';
  factoriesOverride: Record<string, Partial<Factory>>;
  timestamp?: string;
  dateLabel?: string;
}

export interface SimulationResult {
  mixedBOD: number;
  mixedCOD: number;
  mixedEC: number;
  mixedFecal: number;
  mixedNitrogen: number;
  diagnostic: string;
  isIndustryToBlame: boolean;
  violatedFactories: string[];
}

export interface FactoryRisk {
  factoryId: string;
  name: string;
  riskScore: number;
  substances: string[];
  isViolating: boolean;
}

export interface AllowedDischarge {
  factoryId: string;
  name: string;
  distanceToCheckpointKm: number;
  currentBOD: number;
  currentCOD: number;
  maxAllowedBOD: number; // mg/L ที่โรงงานนี้ "ปล่อยได้สูงสุด" โดยจุดตรวจยังไม่เกิน DIW_STANDARDS.RIVER_BOD_MAX
  maxAllowedCOD: number; // mg/L ที่โรงงานนี้ "ปล่อยได้สูงสุด" โดยจุดตรวจยังไม่เกิน DIW_STANDARDS.RIVER_COD_MAX
  isOverBOD: boolean;
  isOverCOD: boolean;
}

export interface SourceAttribution {
  factoryProb: number;
  residentialProb: number;
  agricultureProb: number;
  dominantSource: 'factories' | 'residential' | 'agriculture' | 'normal';
  factoriesRisk: FactoryRisk[];
}
