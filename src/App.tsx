/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Factory, Checkpoint, CheckpointReading } from './types';
import { INITIAL_FACTORIES, INITIAL_CHECKPOINTS, SCENARIOS, DIW_STANDARDS } from './data';
import { getViolatedFactories } from './utils';
import { getCheckpointReadingAt, getLatestCommonTimestamp, getLatestOverallTimestamp, toDatetimeLocalValue } from './checkpointData';
import InteractiveMap from './components/InteractiveMap';
import CheckpointTrendChart from './components/CheckpointTrendChart';
import { 
  ShieldCheck, 
  Table, 
  Calendar,
  LineChart,
} from 'lucide-react';

export default function App() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<number>(2); // Default to Scenario 2 (Community Pollution Defense)
  const [riverFlowRate, setRiverFlowRate] = useState<number>(90000); // Default corresponding to Scenario 2
  const [riverBOD, setRiverBOD] = useState<number>(1.5);
  const [riverCOD, setRiverCOD] = useState<number>(4.0);
  const [riverFecal, setRiverFecal] = useState<number>(5500);
  const [riverNitrogen, setRiverNitrogen] = useState<number>(0.8);
  const [riverEC, setRiverEC] = useState<number>(280);
  const [factories, setFactories] = useState<Factory[]>(INITIAL_FACTORIES);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>('TTC02'); // Default selection for insight card

  // Checkpoint (CP) historical data: date-time picker + loaded readings per station
  const [checkpointDateTime, setCheckpointDateTime] = useState<string>('2023-06-15T09:00');
  const [checkpointReadings, setCheckpointReadings] = useState<Record<string, CheckpointReading | null>>({});
  const [loadingCheckpoints, setLoadingCheckpoints] = useState<boolean>(false);
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [trendChartStationId, setTrendChartStationId] = useState<string | null>(null);
  const [loadingLatestDate, setLoadingLatestDate] = useState<boolean>(false);

  // Fetch baseline scenario context
  const currentScenario = SCENARIOS.find(s => s.id === selectedScenarioId) || SCENARIOS[1];

  // Restores defaults when scenario changes
  useEffect(() => {
    setRiverFlowRate(currentScenario.riverFlowRate);
    setRiverBOD(currentScenario.riverBOD);
    setRiverCOD(currentScenario.riverCOD);
    setRiverFecal(currentScenario.riverFecal);
    setRiverNitrogen(currentScenario.riverNitrogen);
    setRiverEC(currentScenario.riverEC);
    
    // Apply factory scenario-specific overrides on top of clean baselines
    const calcStatus = (f: { industryType: string; dischargeBOD: number; dischargeCOD: number }) => {
      const isTextile = f.industryType.includes('สิ่งทอ') || f.industryType.includes('ฟอกย้อม');
      const codMax = isTextile ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX;
      return (f.dischargeBOD > DIW_STANDARDS.FACTORY_BOD_MAX || f.dischargeCOD > codMax)
        ? 'Violation' as const
        : 'Compliant' as const;
    };

    const updatedFactories = INITIAL_FACTORIES.map(factory => {
      const override = currentScenario.factoriesOverride[factory.id];
      if (override) {
        const merged = { ...factory, ...override };
        return { ...merged, status: override.status || calcStatus(merged) };
      }
      const base = {
        ...factory,
        dischargeBOD: INITIAL_FACTORIES.find(f => f.id === factory.id)?.dischargeBOD || 15,
        dischargeCOD: INITIAL_FACTORIES.find(f => f.id === factory.id)?.dischargeCOD || 45,
      };
      return { ...base, status: calcStatus(base) };
    });

    setFactories(updatedFactories);
  }, [selectedScenarioId, currentScenario]);

  // Handle manual sidebar scenario selection
  const handleSelectScenario = (id: number) => {
    setSelectedScenarioId(id);
  };

  // Load historical checkpoint readings (pH/DO/EC/Temp) for every station
  // whenever the selected date-time changes.
  useEffect(() => {
    let cancelled = false;
    setLoadingCheckpoints(true);
    setCheckpointError(null);
    const isoTarget = checkpointDateTime.length === 16 ? `${checkpointDateTime}:00` : checkpointDateTime;

    Promise.all(
      INITIAL_CHECKPOINTS.map(async (cp) => {
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

  // เมื่อโหลดแอปครั้งแรก ให้ปรับวันที่/เวลาไปยัง "จุดล่าสุดที่ทุกสถานีมีข้อมูลจริงพร้อมกัน"
  // แทนค่า default ที่ตั้งไว้กลางปี — ผู้ใช้เปิดมาจะเห็นข้อมูลใหม่สุดที่มีทันที
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const latest = await getLatestCommonTimestamp();
      if (!cancelled && latest) {
        const formatted = toDatetimeLocalValue(latest);
        if (formatted) setCheckpointDateTime(formatted);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ปุ่ม "ข้อมูลล่าสุด" — ปุ่ม "วันนี้" ของ browser (native datetime-local picker)
  // จะกระโดดไปวันที่ปฏิทินจริงเสมอ ซึ่งอยู่นอกช่วงข้อมูลย้อนหลังที่มี จึงต้องมีปุ่มนี้แยกต่างหาก
  // ใช้จุดล่าสุด "สุดๆ" ของข้อมูลทั้งหมด (ไม่ใช่จุดที่ทุกสถานีมีร่วมกัน) ตามที่ผู้ใช้เลือก —
  // สถานีที่ยังไม่มีข้อมูลถึงจุดนั้นจะขึ้นแจ้งเตือนใน checkpointError แทน
  const handleJumpToLatestData = async () => {
    setLoadingLatestDate(true);
    try {
      const latest = await getLatestOverallTimestamp();
      if (latest) {
        const formatted = toDatetimeLocalValue(latest);
        if (formatted) setCheckpointDateTime(formatted);
      }
    } finally {
      setLoadingLatestDate(false);
    }
  };

  // Handle manual hydrology slider manipulation
  const handleRiverFlowRateChange = (val: number) => {
    setRiverFlowRate(val);
  };

  // Handle manual factory discharge alterations
  const handleFactoryParamChange = (
    factoryId: string, 
    param: 'dischargeBOD' | 'dischargeCOD' | 'actualQ', 
    val: number
  ) => {
    setFactories(prev => prev.map(f => {
      if (f.id === factoryId) {
        const updated = { ...f, [param]: val };
        // Instantly recalculate target compliance status
        const isTextile = updated.industryType.includes('สิ่งทอ') || updated.industryType.includes('ฟอกย้อม');
        const codMax = isTextile ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX;
        const isBODViolation = updated.dischargeBOD > DIW_STANDARDS.FACTORY_BOD_MAX;
        const isCODViolation = updated.dischargeCOD > codMax;
        updated.status = (isBODViolation || isCODViolation) ? 'Violation' : 'Compliant';
        return updated;
      }
      return f;
    }));
  };

  // Handles manual resets of the active layout
  const handleResetToScenarioDefaults = () => {
    setRiverFlowRate(currentScenario.riverFlowRate);
    setRiverBOD(currentScenario.riverBOD);
    setRiverCOD(currentScenario.riverCOD);
    setRiverFecal(currentScenario.riverFecal);
    setRiverNitrogen(currentScenario.riverNitrogen);
    setRiverEC(currentScenario.riverEC);
    const updatedFactories = INITIAL_FACTORIES.map(factory => {
      const override = currentScenario.factoriesOverride[factory.id];
      if (override) {
        const merged = { ...factory, ...override };
        return { ...merged, status: override.status || calcStatus(merged) };
      }
      const base = {
        ...factory,
        dischargeBOD: INITIAL_FACTORIES.find(f => f.id === factory.id)?.dischargeBOD || 15,
        dischargeCOD: INITIAL_FACTORIES.find(f => f.id === factory.id)?.dischargeCOD || 45,
      };
      return { ...base, status: calcStatus(base) };
    });
    setFactories(updatedFactories);
  };

  // Checkpoints are now a static list of real monitoring stations — their
  // water-quality values come from historical CSV/Excel readings (loaded
  // above), not from a factory mass-balance simulation.
  const checkpoints = INITIAL_CHECKPOINTS;
  const violatedFactories = getViolatedFactories(factories);

  // Handle entity clicks (Highlights in overlay details)
  const handleSelectEntity = (id: string, type: 'factory' | 'checkpoint') => {
    setSelectedEntityId(id);
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

          
        </div>
      </header>

      {/* Main Layout Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6 space-y-6">
        
        {/* 4. Full-Width Spatial Map + Controls Below */}
        <div className="flex flex-col gap-6">
          {/* Spatial Google Map Area: Full Width */}
          <div className="w-full">
            <InteractiveMap 
              factories={factories}
              checkpoints={checkpoints}
              checkpointReadings={checkpointReadings}
              checkpointDateTime={checkpointDateTime}
              onCheckpointDateTimeChange={setCheckpointDateTime}
              onJumpToLatestData={handleJumpToLatestData}
              loadingLatestDate={loadingLatestDate}
              selectedId={selectedEntityId}
              onSelectEntity={handleSelectEntity}
              onFactoryParamChange={handleFactoryParamChange}
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
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                🏭 พิกัดปล่อยน้ำเสียกลุ่มอุตสาหกรรมในลุ่มแม่น้ำ (สถานประกอบการขึ้นทะเบียน 5 โหนด)
              </span>
              <div className="overflow-x-auto overflow-y-auto max-h-[300px] border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="p-3">รหัสโรงงาน</th>
                      <th className="p-3">ชื่อสถานประกอบการ</th>
                      <th className="p-3">ประเภทอุตสาหกรรมดำเนินการ</th>
                      <th className="p-3">พิกัดดาวเทียม (Y, X)</th>
                      <th className="p-3 text-right">ปล่อยสูงสุดที่อนุญาต (ลบ.ม./วัน)</th>
                      <th className="p-3 text-right">ปล่อยประเมินจริง (ลบ.ม./วัน)</th>
                      <th className="p-3 text-right">ค่า BOD น้ำทิ้งปัจจุบัน (มก./ลิตร)</th>
                      <th className="p-3 text-right">ค่า COD น้ำทิ้งปัจจุบัน (มก./ลิตร)</th>
                      <th className="p-3 text-center">สถานะตามกฎหมาย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {factories.map((factory) => {
                      const isTextile = factory.industryType.includes('สิ่งทอ') || factory.industryType.includes('ฟอกย้อม');
                      const codMax = isTextile ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX;
                      const isBODViolating = factory.dischargeBOD > DIW_STANDARDS.FACTORY_BOD_MAX;
                      const isCODViolating = factory.dischargeCOD > codMax;
                      const hasViolation = isBODViolating || isCODViolating;

                      return (
                        <tr 
                          key={factory.id} 
                          className={`hover:bg-slate-50 transition-colors ${
                            hasViolation ? 'bg-rose-500/5' : ''
                          }`}
                        >
                          <td className="p-3 font-mono font-bold text-slate-900">{factory.id}</td>
                          <td className="p-3">{factory.name}</td>
                          <td className="p-3 text-slate-500">{factory.industryType}</td>
                          <td className="p-3 font-mono text-slate-500">{factory.lat.toFixed(4)}°, {factory.lon.toFixed(4)}°</td>
                          <td className="p-3 text-right font-mono">{factory.allowedQ.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono text-slate-900">{factory.actualQ.toLocaleString()}</td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            isBODViolating ? 'text-rose-600 bg-rose-500/10' : 'text-slate-900'
                          }`}>
                            {factory.dischargeBOD}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            isCODViolating ? 'text-rose-600 bg-rose-500/10' : 'text-slate-900'
                          }`}>
                            {factory.dischargeCOD}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider ${
                              hasViolation 
                                ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {hasViolation ? 'ฝ่าฝืนเกณฑ์' : 'ผ่านพารามิเตอร์ปกติ'}
                            </span>
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
                <div className="flex flex-wrap items-center gap-2">
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
                  <button
                    onClick={handleJumpToLatestData}
                    disabled={loadingLatestDate}
                    title="ปุ่ม “วันนี้” ของปฏิทินจะพาไปวันที่ปัจจุบันจริงซึ่งไม่มีข้อมูล กดปุ่มนี้แทนเพื่อไปยังข้อมูลใหม่สุดที่มีจริง"
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-wait"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {loadingLatestDate ? 'กำลังค้นหา...' : 'ข้อมูลล่าสุด'}
                  </button>
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
                      checkpoints.map((cp) => {
                        const reading = checkpointReadings[cp.id];
                        const fmt = (v: number | null | undefined, digits = 2) =>
                          v === null || v === undefined ? '—' : v.toFixed(digits);

                        return (
                          <tr key={cp.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-900">{cp.id}</td>
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
          stations={checkpoints}
          initialStationId={trendChartStationId}
          onClose={() => setTrendChartStationId(null)}
        />
      )}
    </div>
  );
}
function calcStatus(merged: { id: string; name: string; industryType: string; lat: number; lon: number; allowedQ: number; actualQ: number; dischargeBOD: number; dischargeCOD: number; dischargeEC: number; dischargeFecal?: number; dischargeNitrogen?: number; status: "Compliant" | "Violation"; }): any {
  throw new Error('Function not implemented.');
}

