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
  id: string;
  name: string;
  lat: number;
  lon: number;
  bod: number; // mg/L
  cod: number; // mg/L
  fecalColiform: number; // MPN/100ml
  nitrogen: number; // mg/L
  ec: number; // uS/cm
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
