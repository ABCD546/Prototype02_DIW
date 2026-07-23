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
  pH?: number;
  tss?: number;
  tds?: number;
  dischargeFecal?: number; // MPN/100ml
  dischargeNitrogen?: number; // mg/L
  status: 'Compliant' | 'Violation';
  /** มีผลตรวจจริงที่อัปโหลดแล้ว; false = แสดงเฉพาะข้อมูลทะเบียน/พิกัด */
  hasMeasurementData?: boolean;
  noDataForSelectedPeriod?: boolean;
  inspectionCount?: number;
  isAnnualSummary?: boolean;
  testedParameters?: string[];
  inspectionTimestamp?: string;
  collectionPoint?: string;
}

export interface FactoryImportRecord {
  factoryId: string;
  name: string;
  industryType: string;
  lat: number | null;
  lon: number | null;
  timestamp: string;
  pH: number | null;
  bod: number | null;
  cod: number | null;
  tss: number | null;
  tds: number | null;
  operationId?: string;
  province?: string;
  collectionPoint?: string;
  extraParameters?: Record<string, number | null>;
  testedParameters?: string[];
}

export interface StationImportRecord {
  stationName: string;
  stationCode?: string;
  stationType?: 'automatic' | 'manual';
  lat: number | null;
  lon: number | null;
  timestamp: string;
  pH: number | null;
  do: number | null;
  ec: number | null;
  temp: number | null;
}

export interface Checkpoint {
  id: string;   // station name used as id, e.g. 'สองพี่น้อง'
  name: string; // display name of the station
  lat: number;
  lon: number;
  code?: string;
  stationType?: 'automatic' | 'manual' | 'historical' | 'uploaded';
  riverName?: string;
  province?: string;
  /** false means this entry is a location-only marker. */
  hasMeasurementData?: boolean;
}

// One row of historical data read from a station's CSV file.
// `values` holds whatever columns exist in that station's file
// (e.g. pH, DO, EC, Temp for some stations; BOD, COD, ... for others).
// Missing/blank cells in the source file are stored as null.
export interface CheckpointReading {
  timestamp: string; // raw date-time string from the file, e.g. "4/2/2023 9:00"
  values: Record<string, number | null>;
}
