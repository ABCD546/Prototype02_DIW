/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Factory, Checkpoint, CheckpointReading, FactoryImportRecord, StationImportRecord } from './types';
import { HISTORICAL_STATIONS, DIW_STANDARDS } from './appData';
import { ADDITIONAL_STATION_LOCATIONS } from './stationLocations';
import { getCheckpointReadingAt, loadCheckpointIndex, loadCheckpointYear, STATION_FILE_CODE } from './checkpointData';
import InteractiveMap from './components/InteractiveMap';
import CheckpointTrendChart from './components/CheckpointTrendChart';
import FactoryTrendChart from './components/FactoryTrendChart';
import StationProfileChart from './components/StationProfileChart';
import FactoryDataUpload from './components/FactoryDataUpload';
import {
  ShieldCheck, 
  Table, 
  Calendar,
  LineChart,
  GitCompareArrows,
} from 'lucide-react';

const BASE_STATIONS: Checkpoint[] = HISTORICAL_STATIONS.map((station) => ({
  ...station,
  stationType: station.stationType ?? 'historical',
  hasMeasurementData: true,
}));
const BASE_STATION_CODES = new Set(BASE_STATIONS.map((station) => station.code).filter(Boolean));
const REGISTERED_STATIONS: Checkpoint[] = [
  ...BASE_STATIONS,
  ...ADDITIONAL_STATION_LOCATIONS.filter((station) => !station.code || !BASE_STATION_CODES.has(station.code)),
];
const stationKey = (value?: string) => String(value ?? '').trim().toLocaleLowerCase('th').replace(/^สถานี\s*/, '').replace(/[\s._-]+/g, '');
const resolveRegisteredStation = (record: StationImportRecord) => {
  const codeKey = stationKey(record.stationCode);
  const nameKey = stationKey(record.stationName);
  const codeMatches = codeKey ? REGISTERED_STATIONS.filter((station) => stationKey(station.code) === codeKey) : [];
  if (codeMatches.length === 1) return codeMatches[0];
  if (codeMatches.length > 1) {
    const namedCodeMatch = codeMatches.find((station) => stationKey(station.name) === nameKey);
    if (namedCodeMatch) return namedCodeMatch;
  }
  return REGISTERED_STATIONS.find((station) =>
    stationKey(station.id) === nameKey
    || stationKey(station.code) === nameKey
    || stationKey(station.name) === nameKey
  );
};

export default function App() {
  const [factories] = useState<Factory[]>([]);
  const [factoryHistory, setFactoryHistory] = useState<FactoryImportRecord[]>(() => {
    try {
      localStorage.removeItem('diw_factory_history');
      return JSON.parse(localStorage.getItem('diw_factory_history_ereport_v1') || '[]');
    }
    catch { return []; }
  });
  const [stationHistory, setStationHistory] = useState<StationImportRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem('diw_station_history') || '[]'); }
    catch { return []; }
  });
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(null);
  const [selectedRiverName, setSelectedRiverName] = useState<string>('__all__');
  const [factoryDateTime, setFactoryDateTime] = useState<string>('2026-07-22T00:00');

  // Checkpoint (CP) historical data: date-time picker + loaded readings per station
  const [checkpointDateTime, setCheckpointDateTime] = useState<string>('2023-06-15T09:00');
  const [checkpointReadings, setCheckpointReadings] = useState<Record<string, CheckpointReading | null>>({});
  const [loadingCheckpoints, setLoadingCheckpoints] = useState<boolean>(false);
  const [loadingLatestDate, setLoadingLatestDate] = useState<boolean>(false);
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [trendChartStationId, setTrendChartStationId] = useState<string | null>(null);
  const [factoryTrendId, setFactoryTrendId] = useState<string | null>(null);
  const [showProfileChart, setShowProfileChart] = useState<boolean>(false);

  // Load historical checkpoint readings (pH/DO/EC/Temp) for every station
  // whenever the selected date-time changes.
  useEffect(() => {
    let cancelled = false;
    setLoadingCheckpoints(true);
    setCheckpointError(null);
    const isoTarget = checkpointDateTime.length === 16 ? `${checkpointDateTime}:00` : checkpointDateTime;

    Promise.all(
      HISTORICAL_STATIONS.map(async (cp) => {
        try {
          const reading = await getCheckpointReadingAt(cp.id, isoTarget);
          return [cp.id, reading] as const;
        } catch (err) {
          console.error(`Failed to load checkpoint reading for ${cp.id}:`, err);
          return [cp.id, null] as const;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, CheckpointReading | null> = {};
      let anyMissing = false;
      for (const [id, reading] of results) {
        map[id] = reading;
        if (!reading) anyMissing = true;
      }
      setCheckpointReadings(map);
      if (anyMissing) setCheckpointError('บางสถานีไม่มีข้อมูลในช่วงวันที่/เวลาที่เลือก (นอกช่วงข้อมูลที่มี)');
      setLoadingCheckpoints(false);
    });

    return () => { cancelled = true; };
  }, [checkpointDateTime]);

  const handleJumpToLatestCheckpointData = async () => {
    setLoadingLatestDate(true);
    setCheckpointError(null);
    try {
      const index = await loadCheckpointIndex();
      const stationYears = HISTORICAL_STATIONS.map((cp) => {
        const code = STATION_FILE_CODE[cp.id];
        return new Set(index.stations[code]?.years ?? []);
      });
      const commonYears = [...stationYears[0]].filter((year) =>
        stationYears.every((years) => years.has(year))
      );
      const latestCommonYear = Math.max(...commonYears);
      if (!Number.isFinite(latestCommonYear)) throw new Error('ไม่พบปีข้อมูลที่ทุกสถานีมีร่วมกัน');

      const readingsByStation = await Promise.all(
        HISTORICAL_STATIONS.map((cp) => loadCheckpointYear(cp.id, latestCommonYear))
      );
      const latestTimestamps = readingsByStation.map((readings) =>
        readings.reduce((latest, reading) => reading.timestamp > latest ? reading.timestamp : latest, '')
      );
      // Use the earliest of each station's latest timestamp so every station
      // still has data available at the selected dashboard time.
      const latestSharedTimestamp = latestTimestamps.reduce((earliest, timestamp) =>
        !earliest || timestamp < earliest ? timestamp : earliest, ''
      );
      if (!latestSharedTimestamp) throw new Error('ไม่พบเวลาบันทึกล่าสุด');
      setCheckpointDateTime(latestSharedTimestamp.slice(0, 16));
    } catch (error) {
      console.error('Failed to find latest shared checkpoint data:', error);
      setCheckpointError('ไม่สามารถค้นหาข้อมูลล่าสุดที่ทุกสถานีมีร่วมกันได้');
    } finally {
      setLoadingLatestDate(false);
    }
  };

  // Checkpoints are now a static list of real monitoring stations — their
  // water-quality values come from historical CSV/Excel readings (loaded
  // above), not from a factory mass-balance simulation.
  const checkpoints = useMemo(() => {
    const map = new Map(REGISTERED_STATIONS.map((station) => [station.id, station]));
    stationHistory.forEach((record) => {
      const registered = resolveRegisteredStation(record);
      if (registered) {
        map.set(registered.id, { ...registered, hasMeasurementData: true });
      } else if (record.lat !== null && record.lon !== null) {
        map.set(record.stationName, { id: record.stationName, name: record.stationName, lat: record.lat, lon: record.lon, code: record.stationCode, stationType: 'uploaded', hasMeasurementData: true });
      }
    });
    return [...map.values()];
  }, [stationHistory]);
  useEffect(() => {
    localStorage.setItem('diw_factory_history_ereport_v1', JSON.stringify(factoryHistory));
  }, [factoryHistory]);
  useEffect(() => {
    localStorage.setItem('diw_station_history', JSON.stringify(stationHistory));
  }, [stationHistory]);

  const displayCheckpointReadings = useMemo(() => {
    const result = { ...checkpointReadings };
    const targetTime = new Date(checkpointDateTime).getTime();
    const grouped = new Map<string, StationImportRecord[]>();
    stationHistory.forEach((record) => {
      const stationId = resolveRegisteredStation(record)?.id ?? record.stationName;
      if (!grouped.has(stationId)) grouped.set(stationId, []);
      grouped.get(stationId)!.push(record);
    });
    grouped.forEach((records, stationName) => {
      const closest = records.reduce((best, record) => Math.abs(new Date(record.timestamp).getTime() - targetTime) < Math.abs(new Date(best.timestamp).getTime() - targetTime) ? record : best);
      result[stationName] = { timestamp: closest.timestamp, values: { pH: closest.pH, DO: closest.do, EC: closest.ec, Temp: closest.temp } };
    });
    return result;
  }, [checkpointReadings, stationHistory, checkpointDateTime]);

  const displayFactories = useMemo(() => {
    const selectedMonth = factoryDateTime.slice(0, 7);
    const selectedYear = factoryDateTime.slice(0, 4);
    const isAnnualSummary = factoryDateTime.slice(5, 7) === '00';
    const grouped = new Map<string, FactoryImportRecord[]>();
    factoryHistory.filter((record) => isAnnualSummary
      ? record.timestamp.slice(0, 4) === selectedYear
      : record.timestamp.slice(0, 7) === selectedMonth
    ).forEach((record) => {
      if (!grouped.has(record.factoryId)) grouped.set(record.factoryId, []);
      grouped.get(record.factoryId)!.push(record);
    });
    const closestRecord = (records: FactoryImportRecord[]) => records.reduce((latest, record) => record.timestamp > latest.timestamp ? record : latest);
    const annualRecord = (records: FactoryImportRecord[]): FactoryImportRecord => {
      const latest = closestRecord(records);
      const average = (key: 'pH' | 'bod' | 'cod' | 'tss' | 'tds') => {
        const values = records.map((record) => record[key]).filter((value): value is number => value !== null);
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      };
      return { ...latest, pH: average('pH'), bod: average('bod'), cod: average('cod'), tss: average('tss'), tds: average('tds') };
    };
    const toFactory = (record: FactoryImportRecord, base?: Factory): Factory => {
      const isTextile = record.industryType.includes('สิ่งทอ') || record.industryType.includes('ฟอกย้อม');
      const codMax = isTextile ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX;
      const hasMeasurementData = [record.pH, record.bod, record.cod, record.tss, record.tds].some((value) => value !== null);
      return {
        ...(base ?? {} as Factory), id: record.factoryId, name: record.name, industryType: record.industryType,
        lat: record.lat ?? base?.lat ?? 0, lon: record.lon ?? base?.lon ?? 0, allowedQ: base?.allowedQ ?? 0, actualQ: base?.actualQ ?? 0,
        dischargeBOD: record.bod ?? 0, dischargeCOD: record.cod ?? 0, dischargeEC: record.tds ?? 0,
        pH: record.pH ?? undefined, tss: record.tss ?? undefined, tds: record.tds ?? undefined,
        status: (record.bod ?? 0) > DIW_STANDARDS.FACTORY_BOD_MAX || (record.cod ?? 0) > codMax ? 'Violation' : 'Compliant',
        hasMeasurementData,
        testedParameters: record.testedParameters,
        inspectionTimestamp: record.timestamp,
        collectionPoint: record.collectionPoint,
      };
    };
    const result = factories.map((factory) => {
      const records = grouped.get(factory.id);
      if (!records?.length) return factory;
      const summary = toFactory(isAnnualSummary ? annualRecord(records) : closestRecord(records), factory);
      summary.inspectionCount = records.length;
      summary.isAnnualSummary = isAnnualSummary;
      if (isAnnualSummary) {
        summary.status = records.some((record) => {
          const codMax = record.industryType.includes('สิ่งทอ') || record.industryType.includes('ฟอกย้อม')
            ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX;
          return (record.bod ?? 0) > DIW_STANDARDS.FACTORY_BOD_MAX || (record.cod ?? 0) > codMax;
        }) ? 'Violation' : 'Compliant';
      }
      return summary;
    });
    const existingIds = new Set(result.map((factory) => factory.id));
    grouped.forEach((records, id) => {
      const record = isAnnualSummary ? annualRecord(records) : closestRecord(records);
      if (!existingIds.has(id) && records.length && record.lat != null && record.lon != null) {
        const factory = toFactory(record);
        factory.inspectionCount = records.length;
        factory.isAnnualSummary = isAnnualSummary;
        if (isAnnualSummary) {
          factory.status = records.some((item) => {
            const codMax = item.industryType.includes('สิ่งทอ') || item.industryType.includes('ฟอกย้อม')
              ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX;
            return (item.bod ?? 0) > DIW_STANDARDS.FACTORY_BOD_MAX || (item.cod ?? 0) > codMax;
          }) ? 'Violation' : 'Compliant';
        }
        result.push(factory);
      }
    });
    if (selectedFactoryId && !result.some((factory) => factory.id === selectedFactoryId)) {
      const history = factoryHistory.filter((record) => record.factoryId === selectedFactoryId);
      if (history.length) {
        const latest = closestRecord(history);
        if (latest.lat != null && latest.lon != null) {
          result.push({ ...toFactory(latest), hasMeasurementData: false, status: 'Compliant' });
        }
      }
    }
    return result;
  }, [factories, factoryHistory, factoryDateTime, selectedFactoryId]);

  const factoryYearOptions = useMemo(() => {
    const historyYears = [...new Set(factoryHistory.map((record) => Number(record.timestamp.slice(0, 4))))].filter(Number.isFinite).sort((a, b) => a - b);
    return historyYears.map((year) => ({
      value: String(year),
      label: `ปี ${year + 543}`,
    }));
  }, [factoryHistory]);

  const factoryRoundOptions = useMemo(() => {
    const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const selectedYear = factoryDateTime.slice(0, 4);
    const availableMonths = new Set(
      factoryHistory
        .filter((record) => record.timestamp.slice(0, 4) === selectedYear)
        .map((record) => record.timestamp.slice(5, 7))
    );
    if (availableMonths.size === 0) return [];
    return [
      { value: '00', label: 'ภาพรวมทั้งปี' },
      ...monthNames
        .map((monthName, index) => {
          const month = String(index + 1).padStart(2, '0');
          return { value: month, label: `ครั้งที่ ${index + 1} (${monthName})` };
        })
        .filter((option) => availableMonths.has(option.value)),
    ];
  }, [factoryHistory, factoryDateTime]);

  useEffect(() => {
    const selectedYear = factoryDateTime.slice(0, 4);
    const selectedRound = factoryDateTime.slice(5, 7);
    if (factoryYearOptions.length > 0 && !factoryYearOptions.some((option) => option.value === selectedYear)) {
      const latestYear = factoryYearOptions[factoryYearOptions.length - 1].value;
      setFactoryDateTime(`${latestYear}-00-01T00:00`);
    } else if (factoryRoundOptions.length > 0 && !factoryRoundOptions.some((option) => option.value === selectedRound)) {
      setFactoryDateTime(`${selectedYear}-00-01T00:00`);
    }
  }, [factoryYearOptions, factoryRoundOptions, factoryDateTime]);

  const factoriesWithHistory = useMemo(() => {
    const ids = new Set(factoryHistory.map((record) => record.factoryId));
    return displayFactories.filter((factory) => ids.has(factory.id));
  }, [factoryHistory, displayFactories]);

  const selectedFactoryInspectionOptions = useMemo(() => {
    if (!selectedFactoryId) return [];
    const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const byMonth = new Map<string, FactoryImportRecord[]>();
    factoryHistory.filter((record) => record.factoryId === selectedFactoryId).forEach((record) => {
      const month = record.timestamp.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(record);
    });
    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, records]) => {
      const [year, monthNumber] = month.split('-').map(Number);
      const dates = [...new Set(records.map((record) => {
        const date = new Date(record.timestamp);
        return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear() + 543}`;
      }))];
      return {
        value: `${month}-01T00:00`,
        label: `ปี ${year + 543} · ครั้งที่ ${monthNumber} (${monthNames[monthNumber - 1]}) · ตรวจ ${dates.join(', ')}`,
      };
    });
  }, [factoryHistory, selectedFactoryId]);

  const riverKey = (value?: string) => String(value ?? '')
    .trim()
    .replace(/^แม่น้ำ/, '')
    .replace(/^ลำน้ำ/, '')
    .replace(/ตอน(บน|กลาง|ล่าง).*$/, '')
    .replace(/\s+/g, '');
  const visibleRiverCheckpoints = useMemo(() => {
    if (selectedRiverName === '__all__') return [...checkpoints].sort((a, b) => b.lat - a.lat);
    const selectedKey = riverKey(selectedRiverName);
    return checkpoints
      .filter((checkpoint) => {
        const checkpointKey = riverKey(checkpoint.riverName);
        return checkpointKey && (checkpointKey.includes(selectedKey) || selectedKey.includes(checkpointKey));
      })
      .sort((a, b) => b.lat - a.lat);
  }, [checkpoints, selectedRiverName]);

  const handleImportFactoryData = (records: FactoryImportRecord[]) => {
    setFactoryHistory((previous) => {
      const merged = new Map(previous.map((record) => [`${record.factoryId}|${record.timestamp}`, record]));
      records.forEach((record) => merged.set(`${record.factoryId}|${record.timestamp}`, record));
      return [...merged.values()];
    });
    const latest = records.reduce((value, record) => record.timestamp > value ? record.timestamp : value, '');
    if (latest) {
      const value = `${latest.slice(0, 7)}-01T00:00`;
      setFactoryDateTime(value);
      setCheckpointDateTime(value);
    }
    if (records[0]) setSelectedFactoryId(records[0].factoryId);
  };
  const handleJumpToLatestFactoryData = () => {
    const latest = factoryHistory.reduce((value, record) => record.timestamp > value ? record.timestamp : value, '');
    if (latest) {
      const value = `${latest.slice(0, 7)}-01T00:00`;
      setFactoryDateTime(value);
      setCheckpointDateTime(value);
    }
  };
  const handleFactoryDateTimeChange = (value: string) => {
    setFactoryDateTime(value);
    if (value.slice(5, 7) !== '00') setCheckpointDateTime(value);
  };
  const handleFactoryYearChange = (year: string) => {
    const currentRound = factoryDateTime.slice(5, 7);
    const round = factoryRoundOptions.some((option) => option.value === currentRound) ? currentRound : '00';
    handleFactoryDateTimeChange(`${year}-${round}-01T00:00`);
  };
  const handleFactoryRoundChange = (round: string) => {
    handleFactoryDateTimeChange(`${factoryDateTime.slice(0, 4)}-${round}-01T00:00`);
  };
  const handleClearFactoryData = () => {
    setFactoryHistory([]);
    const factoryIdToClear = selectedFactoryId;
    setSelectedFactoryId(null);
    setSelectedEntityId((current) => current === factoryIdToClear ? null : current);
    localStorage.removeItem('diw_factory_history_ereport_v1');
  };
  const handleImportStationData = (records: StationImportRecord[]) => {
    setStationHistory((previous) => {
      const merged = new Map(previous.map((record) => [`${record.stationName}|${record.timestamp}`, record]));
      records.forEach((record) => {
        const registered = resolveRegisteredStation(record);
        const normalizedRecord = registered
          ? { ...record, stationName: registered.id, stationCode: registered.code, lat: registered.lat, lon: registered.lon }
          : record;
        merged.set(`${normalizedRecord.stationName}|${normalizedRecord.timestamp}`, normalizedRecord);
      });
      return [...merged.values()];
    });
  };

  // Handle entity clicks (Highlights in overlay details)
  const handleSelectEntity = (id: string, type: 'factory' | 'checkpoint') => {
    setSelectedEntityId(id);
    if (type === 'factory') {
      setSelectedFactoryId(id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col antialiased">
      
      {/* 1. Modern Thai Government DIW Styled Header Banner - Professional Polish Theme */}
      <header className="bg-[#1e293b] border-b border-slate-705 border-slate-700 text-white shadow-sm relative overflow-hidden">
        {/* Subtle radial glow background overlay */}
        <div className="absolute inset-0 bg-radial-gradient from-blue-500/10 via-transparent to-transparent opacity-60 pointer-events-none" />
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-5 font-black select-none text-9xl font-mono uppercase tracking-widest pointer-events-none">
          DIW
        </div>

        <div className="max-w-7xl mx-auto px-6 py-4.5 relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm text-white shadow-md border border-blue-500/40 shrink-0">
              กรอ.
            </div>
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="bg-blue-500/20 text-blue-300 font-extrabold text-[9px] tracking-wider uppercase px-2 py-0.5 rounded border border-blue-500/30">
                  กรมโรงงานอุตสาหกรรม ประเทศไทย
                </span>
                <span className="text-[10px] text-slate-400 font-mono tracking-wide">THA CHIN PILOT BASIN</span>
              </div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-white mt-0.5 font-sans">
                ระบบปกป้องและเฝ้าระวังควบคุมมลพิษทางน้ำภาคอุตสาหกรรม (กรอ. ลุ่มน้ำท่าจีน)
              </h1>
              <p className="text-xs text-slate-400 leading-snug max-w-2xl mt-0.5 font-medium">
                ระบบสนับสนุนการตัดสินใจทางวิทยาศาสตร์ด้วยการจำลองและระบุสารปนเปื้อน เพื่อเป็นหลักฐานปกป้องโรงงานอุตสาหกรรมผู้ปฏิบัติตามกฎหมายอย่างเที่ยงธรรม
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 text-xs w-full sm:w-auto items-center shrink-0">
            {/* Quick status indicators aligned with Professional Polish template */}
            <span className="bg-green-500/20 text-green-400 px-3 py-1.5 rounded border border-green-500/30 font-mono uppercase tracking-wider text-[10px] text-center w-full sm:w-auto font-bold">
              ระบบออนไลน์: ตรวจค่าตามเวลาจริง
            </span>
            <span className="text-slate-400 font-mono text-[11px] shrink-0 font-bold">
              2569 THA CHIN ZONE
            </span>
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6 space-y-6">
        
        {/* 4. Full-Width Spatial Map + Controls Below */}
        <div className="flex flex-col gap-6">
          <FactoryDataUpload
            onImportFactory={handleImportFactoryData}
            onImportStation={handleImportStationData}
            onClearFactoryData={handleClearFactoryData}
            factoryRecordCount={factoryHistory.length}
          />
          {/* Spatial Google Map Area: Full Width */}
          <div className="w-full">
            <InteractiveMap 
              factories={displayFactories}
              checkpoints={checkpoints}
              checkpointReadings={displayCheckpointReadings}
              checkpointDateTime={checkpointDateTime}
              onCheckpointDateTimeChange={setCheckpointDateTime}
              factoryDateTime={factoryDateTime}
              onFactoryDateTimeChange={handleFactoryDateTimeChange}
              factoryYearOptions={factoryYearOptions}
              factoryRoundOptions={factoryRoundOptions}
              selectedFactoryInspectionOptions={selectedFactoryInspectionOptions}
              onJumpToLatestFactoryData={handleJumpToLatestFactoryData}
              hasFactoryHistory={factoryHistory.length > 0}
              onJumpToLatestData={handleJumpToLatestCheckpointData}
              loadingLatestDate={loadingLatestDate}
              selectedId={selectedEntityId}
              onSelectEntity={handleSelectEntity}
              onRiverSelectionChange={setSelectedRiverName}
            />
          </div>

          {/* Sidebar Control Panel: Full Width below the map */}
        </div>

        {/* 6. Raw Data Transparency Grids with conditional highlights */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 select-none">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Table className="w-4.5 h-4.5 text-slate-500" />
                ตารางแสดงเมทริกซ์ความโปร่งใสของข้อมูลพารามิเตอร์เชิงคุณภาพ
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ประวัติผลข้อมูลผลวัดทางเคมี-ฟิสิกส์ที่เป็นทางการวิเคราะห์ เปรียบเทียบกับขีดควบคุมความหนาแน่นมลพิษสูงสุดตามเกณฑ์เป้าหมายมาตรฐาน
              </p>
            </div>
            <div className="flex gap-2 text-[10px] items-center text-slate-500">
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-100 text-rose-700 font-bold rounded-lg leading-none">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> เกินพิกัดเกณฑ์คุมปกติ
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold rounded-lg leading-none">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> เป็นไปตามเกณฑ์ปกติอย่างสมบูรณ์
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Factories Data Table */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  🏭 ข้อมูลตรวจวัดโรงงาน
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    โรงงาน:
                    <select
                      value={selectedFactoryId ?? ''}
                      onChange={(event) => {
                        const id = event.target.value;
                        setSelectedFactoryId(id || null);
                        if (id) handleSelectEntity(id, 'factory');
                      }}
                      disabled={factoriesWithHistory.length === 0}
                      className="max-w-[240px] bg-white border border-slate-300 rounded px-2 py-1 text-xs disabled:text-slate-400"
                    >
                      <option value="">เลือกโรงงาน</option>
                      {factoriesWithHistory.map((factory) => <option key={factory.id} value={factory.id}>{factory.id} · {factory.name}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    ปี:
                    <select
                      value={factoryDateTime.slice(0, 4)}
                      onChange={(event) => handleFactoryYearChange(event.target.value)}
                      disabled={factoryYearOptions.length === 0}
                      className="bg-white border border-slate-300 rounded px-2 py-1 text-xs disabled:text-slate-400"
                    >
                      {factoryYearOptions.length === 0
                        ? <option value="">ยังไม่มีข้อมูล</option>
                        : factoryYearOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    ครั้ง:
                    <select
                      value={factoryDateTime.slice(5, 7)}
                      onChange={(event) => handleFactoryRoundChange(event.target.value)}
                      disabled={factoryRoundOptions.length === 0}
                      className="bg-white border border-slate-300 rounded px-2 py-1 text-xs disabled:text-slate-400"
                    >
                      {factoryRoundOptions.length === 0
                        ? <option value="">ยังไม่มีข้อมูล</option>
                        : factoryRoundOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={handleJumpToLatestFactoryData}
                    disabled={factoryHistory.length === 0}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Calendar className="w-3.5 h-3.5" />ข้อมูลล่าสุด
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[300px] border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="p-3">รหัสโรงงาน</th>
                      <th className="p-3">ชื่อสถานประกอบการ</th>
                      <th className="p-3">ประเภทอุตสาหกรรมดำเนินการ</th>
                      <th className="p-3">พิกัดดาวเทียม (Y, X)</th>
                      <th className="p-3 text-right">pH</th>
                      <th className="p-3 text-right">ค่า BOD น้ำทิ้งปัจจุบัน (มก./ลิตร)</th>
                      <th className="p-3 text-right">ค่า COD น้ำทิ้งปัจจุบัน (มก./ลิตร)</th>
                      <th className="p-3 text-right">TSS</th>
                      <th className="p-3 text-right">TDS</th>
                      <th className="p-3 text-center">สถานะตามกฎหมาย</th>
                      <th className="p-3 text-center">กราฟ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {displayFactories.map((factory) => {
                      const isTextile = factory.industryType.includes('สิ่งทอ') || factory.industryType.includes('ฟอกย้อม');
                      const codMax = isTextile ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX;
                      const hasData = factory.hasMeasurementData === true;
                      const isBODViolating = hasData && factory.dischargeBOD > DIW_STANDARDS.FACTORY_BOD_MAX;
                      const isCODViolating = hasData && factory.dischargeCOD > codMax;
                      const hasViolation = hasData && factory.status === 'Violation';
                      const formatFactoryValue = (value: number | undefined) =>
                        value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(2);

                      return (
                        <tr
                          key={factory.id} 
                          onClick={() => handleSelectEntity(factory.id, 'factory')}
                          className={`hover:bg-slate-50 transition-colors ${
                            selectedFactoryId === factory.id
                              ? 'bg-blue-100 ring-2 ring-inset ring-blue-500 cursor-pointer'
                              : hasViolation
                                ? 'bg-rose-500/5 cursor-pointer'
                                : 'cursor-pointer'
                          }`}
                        >
                          <td className="p-3 font-mono font-bold text-slate-900">{factory.id}</td>
                          <td className="p-3">{factory.name}</td>
                          <td className="p-3 text-slate-500">{factory.industryType}</td>
                          <td className="p-3 font-mono text-slate-500">{factory.lat.toFixed(4)}°, {factory.lon.toFixed(4)}°</td>
                          <td className="p-3 text-right font-mono">{hasData ? formatFactoryValue(factory.pH) : '—'}</td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            isBODViolating ? 'text-rose-600 bg-rose-500/10' : 'text-slate-900'
                          }`}>
                            {hasData ? formatFactoryValue(factory.dischargeBOD) : '—'}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            isCODViolating ? 'text-rose-600 bg-rose-500/10' : 'text-slate-900'
                          }`}>
                            {hasData ? formatFactoryValue(factory.dischargeCOD) : '—'}
                          </td>
                          <td className="p-3 text-right font-mono">{hasData ? formatFactoryValue(factory.tss) : '—'}</td>
                          <td className="p-3 text-right font-mono">{hasData ? formatFactoryValue(factory.tds) : '—'}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider ${
                              !hasData ? 'bg-slate-100 text-slate-600 border border-slate-200' : hasViolation
                                ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {!hasData ? 'ยังไม่มีข้อมูล' : hasViolation ? 'ฝ่าฝืนเกณฑ์' : 'ผ่านพารามิเตอร์ปกติ'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedFactoryId(factory.id);
                                setFactoryTrendId(factory.id);
                              }}
                              disabled={!factoryHistory.some((record) => record.factoryId === factory.id)}
                              title="ดูกราฟข้อมูลย้อนหลังเฉพาะโรงงานนี้"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <LineChart className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                * ข้อบังคับควบคุมประกาศกระทรวงอุตสาหกรรมไทย (กรอ.) กำหนดเกณฑ์จำกัดสูงสุดน้ำทิ้งอุตสาหกรรมห้ามระบายเกินพิกัดสูงสุดทนทานที่ **{DIW_STANDARDS.FACTORY_BOD_MAX} มก./ลิตรสำหรับ BOD** และ **{DIW_STANDARDS.FACTORY_COD_MAX} มก./ลิตรสำหรับ COD** เพื่อพยุงคุณภาพน้ำต้นธารอย่างสม่ำเสมอสากล
              </p>
            </div>

            {/* Checkpoints Data Table */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  🌊 สถานีจุดคัดส่งวัดประเมินคุณภาพลำน้ำหลัก (เรียงจากพิกัดระดับต้นลุ่มน้ำลงหาปลายลุ่มน้ำ)
                </span>
                <span className="text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5">
                  {selectedRiverName === '__all__' ? `ทุกลุ่มน้ำ · ${visibleRiverCheckpoints.length} สถานี` : `${selectedRiverName} · ${visibleRiverCheckpoints.length} สถานี`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowProfileChart(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <GitCompareArrows className="w-3.5 h-3.5" />
                    กราฟภาพรวมเปรียบเทียบทุกสถานี
                  </button>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    วันที่/เวลาย้อนหลัง:
                    <input
                      type="datetime-local"
                      value={checkpointDateTime}
                      onChange={(e) => setCheckpointDateTime(e.target.value)}
                      min="2015-01-01T00:00"
                      max="2024-12-31T23:59"
                      className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                    />
                  </label>
                </div>
              </div>
              {checkpointError && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  ⚠ {checkpointError}
                </p>
              )}
              <div className="overflow-x-auto overflow-y-auto max-h-[300px] border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="p-3">รหัสสถานี</th>
                      <th className="p-3">ชื่อสถานีคัดตรวจร่วม</th>
                      <th className="p-3">พิกัดในเขตลุ่มน้ำ (Y, X)</th>
                      <th className="p-3 text-right">pH</th>
                      <th className="p-3 text-right">DO (มก./ลิตร)</th>
                      <th className="p-3 text-right">EC (µS/cm)</th>
                      <th className="p-3 text-right">Temp (°C)</th>
                      <th className="p-3">เวลาที่บันทึกจริง</th>
                      <th className="p-3 text-center">กราฟ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {loadingCheckpoints ? (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-slate-400">กำลังโหลดข้อมูล...</td>
                      </tr>
                    ) : (
                      visibleRiverCheckpoints.length === 0 ? (
                        <tr><td colSpan={9} className="p-6 text-center text-slate-400">ไม่พบสถานีที่ระบุแหล่งน้ำตรงกับแม่น้ำที่เลือก</td></tr>
                      ) : visibleRiverCheckpoints.map((cp) => {
                        const reading = checkpointReadings[cp.id];
                        const fmt = (v: number | null | undefined, digits = 2) =>
                          v === null || v === undefined ? '—' : v.toFixed(digits);

                        return (
                          <tr key={cp.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-900">{cp.code ?? cp.id}</td>
                            <td className="p-3">{cp.name}</td>
                            <td className="p-3 font-mono text-slate-500">{cp.lat.toFixed(4)}°, {cp.lon.toFixed(4)}°</td>
                            <td className="p-3 text-right font-mono">{fmt(reading?.values.pH)}</td>
                            <td className="p-3 text-right font-mono">{fmt(reading?.values.DO)}</td>
                            <td className="p-3 text-right font-mono">{fmt(reading?.values.EC, 1)}</td>
                            <td className="p-3 text-right font-mono">{fmt(reading?.values.Temp, 1)}</td>
                            <td className="p-3 font-mono text-slate-400 text-[10px]">
                              {reading ? reading.timestamp.replace('T', ' ') : 'ไม่มีข้อมูล'}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => setTrendChartStationId(cp.id)}
                                title="ดูกราฟแนวโน้มย้อนหลัง"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <LineChart className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                * ค่าที่แสดงคือค่าที่วัดได้จริงจากไฟล์ข้อมูลย้อนหลังของแต่ละสถานี โดยเลือกแถวที่มีเวลาใกล้เคียงกับวันที่/เวลาที่เลือกมากที่สุด (ข้อมูลบันทึกทุก 30 นาที ตั้งแต่ปี 2558 เป็นต้นไป (สถานีส่วนใหญ่ถึงปี 2566 ยกเว้นกระทุ่มแบนที่มีข้อมูลถึงปี 2567 แต่ไม่มีข้อมูลปี 2563)) ช่องที่แสดง "—" หมายถึงไม่มีการบันทึกค่านั้นในช่วงเวลาดังกล่าว
              </p>
            </div>
          </div>
        </div>

        {/* 7. Footer details */}
        <footer className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between text-[11px] text-slate-400 gap-2 items-center select-none font-medium">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>© 2569 กรมโรงงานอุตสาหกรรม (กรอ.) กระทรวงอุตสาหกรรม ประเทศไทย สงวนลิขสิทธิ์ความปลอดภัยข้อมูล</span>
          </div>
          <div className="flex gap-3 font-bold font-mono">
            <span>เกราะปกป้องสากล: Secure HTTPS SHA-256</span>
            <span>Version 4.2.0-STABLE</span>
          </div>
        </footer>

      </main>

      {trendChartStationId && (
        <CheckpointTrendChart
          stations={visibleRiverCheckpoints}
          initialStationId={trendChartStationId}
          onClose={() => setTrendChartStationId(null)}
        />
      )}

      {factoryTrendId && (() => {
        const factoryRecord = factoryHistory.find((record) => record.factoryId === factoryTrendId);
        if (!factoryRecord) return null;
        return (
          <FactoryTrendChart
            factoryId={factoryTrendId}
            factoryName={factoryRecord.name}
            history={factoryHistory}
            initialYear={factoryDateTime.slice(0, 4)}
            onClose={() => setFactoryTrendId(null)}
          />
        );
      })()}

      {showProfileChart && (
        <StationProfileChart
          stations={visibleRiverCheckpoints}
          onClose={() => setShowProfileChart(false)}
        />
      )}
    </div>
  );
}
function calcStatus(factory: Pick<Factory, 'industryType' | 'dischargeBOD' | 'dischargeCOD'>): Factory['status'] {
  const isTextile = factory.industryType.includes('สิ่งทอ') || factory.industryType.includes('ฟอกย้อม');
  const codMax = isTextile ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX;
  return factory.dischargeBOD > DIW_STANDARDS.FACTORY_BOD_MAX || factory.dischargeCOD > codMax ? 'Violation' : 'Compliant';
}
