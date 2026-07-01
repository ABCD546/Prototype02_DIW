/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Factory, Checkpoint } from './types';
import { INITIAL_FACTORIES, INITIAL_CHECKPOINTS, SCENARIOS, DIW_STANDARDS } from './data';
import { simulateWaterNetwork, diagnosePollutionSource } from './utils';
import SidebarControls from './components/SidebarControls';
import InteractiveMap from './components/InteractiveMap';
import { MetricCard, DefenseBanner } from './components/DWidgetCard';
import ComparisonCharts from './components/ComparisonCharts';
import AlertHistoryLog from './components/AlertHistoryLog';
import { 
  ShieldCheck, 
  Activity, 
  Droplet, 
  Table, 
  TrendingDown,
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

  // Run full system simulation (Dynamic mass balance and spatial projections)
  const { checkpoints, violatedFactories } = simulateWaterNetwork(
    riverFlowRate,
    {
      riverBOD,
      riverCOD,
      riverFecal,
      riverNitrogen,
      riverEC,
    },
    factories
  );

  // Compute overall downriver diagnostics based on CP03 checkpoint values
  const downstreamCP = checkpoints.find(c => c.id === 'CP10') || checkpoints[checkpoints.length - 1];
  const diagnostics = diagnosePollutionSource(
    downstreamCP.bod,
    downstreamCP.cod,
    downstreamCP.fecalColiform,
    downstreamCP.nitrogen,
    downstreamCP.ec
  );

  // Determine regulatory defense outcomes
  let alertLevel: 'safe' | 'warning' | 'critical' = 'safe';
  let dynamicSystemJudgment = currentScenario.systemJudgment;
  let dynamicDefenseStatus = currentScenario.defenseStatus;

  const bViolating = violatedFactories.length > 0;

  if (bViolating) {
    alertLevel = 'critical';
    dynamicSystemJudgment = `คำแจ้งเตือนสำคัญ: ตรวจพบพฤติกรรมการปล่อยมลพิษระบายอุตสาหกรรรล้นมาตรฐานสากล สืบรากเหง้าต้นเหตุไปยังโรงงานรหัส ${violatedFactories.join(', ')}`;
    dynamicDefenseStatus = `พระราชบัญญัติบังคับใช้กฎหมาย: เริ่มกระบวนการตรวจสอบคดี เครื่องมือเจาะอัตลักษณ์โมเลกุลระบุสารเคมีสอดรับทับซ้อนชัดเจนยืนยันว่าโรงงาน ${violatedFactories.join(' และ ')} ปฏิบัติปนเปื้อนเกินมาตรฐานระบายทิ้งสูงสุด ส่วนโรงงานระแวกใกล้เคียงอื่นๆ ตรวจสอบแล้วสอดคล้องปกติ`;
  } else if (downstreamCP.fecalColiform > DIW_STANDARDS.RIVER_FECAL_MAX || downstreamCP.nitrogen > DIW_STANDARDS.RIVER_NITROGEN_MAX) {
    alertLevel = 'warning';
    dynamicSystemJudgment = 'สถานะข้อแก้ต่าง กรอ.: กลุ่มอุตสาหกรรมในเครือตรวจสอบแล้ว คลีนปลอดภัย 100% ต้นตอมลพิษเกิดจากเศษปฏิกูลเทศบาลชุมชนและสารดินปุ๋ยเกษตรกรรมล่างลุ่ม';
    dynamicDefenseStatus = 'คำแถลงอย่างเป็นทางการโดยวิทยากรฟิสิกส์: รอยนิ้วมือนิวเคลียร์ในโมเลกุลปลายน้ำพิสูจน์แล้วว่า มวลความเน่าเสีย CP03 ทั้งหมดเกิดขึ้นจากมลพิษแบบกระจายไร้จุดกำเนิดเด่นชัด (น้ำซึมบ่อโสโครกห้องน้ำอาคารบ้านเรือนชุมชนร่วมกับดินเกลือไนโตรเกษตร) โรงงานอุตสาหกรรมทั้งหมดสอดคล้องรักษากฎหมายอย่างสุจริตไร้พันธะ';
  } else if (riverFlowRate <= 15000) {
    alertLevel = 'warning';
    dynamicSystemJudgment = 'จุดเฝ้าระวังภัยล่วงหน้า: ลำน้ำท่าแม่น้ำไหลแห้งวิกฤต กำลังเจือจางปกติเหือดแห้ง มีความเสี่ยงอัตรารอระบายตกตะกอนตามธรรมชาติสูง';
    dynamicDefenseStatus = 'ประกาศเตือนภัยพิบัติและสภาพภูมิอากาศ: อัตราไหลจากสถานีต้นน้ำแห้งขอดถึงขีดอันตราย ทำให้พลังเฉลี่ยเจือจางน้ำทิ้งหมดลงชั่วคราว จึงขอความร่วมมือผู้ประกอบการทุกท่านลดปล่อยระบายเป็นสถิติลง 20% เพื่อค้ำจุนสภาพแวดล้อมระบบนิเวศลำน้ำถิ่น';
  } else {
    alertLevel = 'safe';
    dynamicSystemJudgment = 'ทุกจุดตรวจวัดสถานีอยู่ในสภาวะปลอดภัย: พารามิเตอร์ลุ่มน้ำทั้งหมดทำงานได้อย่างดีเยี่ยมตามมาตรฐานเป้าหมาย';
    dynamicDefenseStatus = 'รายงานสุขภาพลำน้ำและนิเวศวิทยา: อัตราไหลหลักไหลเวียนปกติ สัดส่วนอินทรีย์ในชุมชนอยู่ในเกลี่ยทรงตัว บ่อระบายอากาศโรงงานทุกสถานประกอบการได้รับการคุมบำบัดอย่างสม่ำเสมอ';
  }

  // Calculate sum of actual discharges vs allowed discharges to show capacity indices
  const totalActualQ = factories.reduce((acc, f) => acc + f.actualQ, 0);
  const capacityPct = (totalActualQ / riverFlowRate) * 100;

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
                ระบบปกป้องและควบคุมมลพิษทางน้ำภาคอุตสาหกรรม (กรอ. ลุ่มน้ำท่าจีน)
              </h1>
              <p className="text-xs text-slate-400 leading-snug max-w-2xl mt-0.5 font-medium">
                ระบบสนับสนุนการตัดสินใจทางวิทยาศาสตร์ด้วยการจำลองและระบุรอยนิ้วมือสารปนเปื้อน เพื่อเป็นหลักฐานปกป้องโรงวารอุตสาหกรรมผู้ปฏิบัติตามกฎหมายอย่างเที่ยงธรรม
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
        
        {/* 2. Top Banner: The core DIW Defense status display */}
        <DefenseBanner 
          systemJudgment={dynamicSystemJudgment}
          verdict={dynamicDefenseStatus}
          alertLevel={alertLevel}
        />

        {/* 3. Streamlit-Style KPI Metrics cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="ค่า BOD ปลายน้ำ (สถานี CP10)"
            value={`${downstreamCP.bod.toFixed(2)} มก./ลิตร`}
            subValue={downstreamCP.bod > DIW_STANDARDS.RIVER_BOD_MAX ? "🚨 เกินค่ามาตรฐาน" : "✓ ผ่านเกณฑ์ปกติ"}
            icon={<Droplet className="w-5 h-5 text-sky-500" />}
            colorClass={downstreamCP.bod > DIW_STANDARDS.RIVER_BOD_MAX ? "text-rose-600" : "text-emerald-600"}
            bgColorClass="bg-sky-50"
          />
          <MetricCard 
            title="แบคทีเรียชีวภาพ (สถานี CP10)"
            value={`${downstreamCP.fecalColiform.toLocaleString()} MPN`}
            subValue="ต่อ 100 มล."
            icon={<Activity className="w-5 h-5 text-amber-500" />}
            colorClass={downstreamCP.fecalColiform > DIW_STANDARDS.RIVER_FECAL_MAX ? "text-amber-600" : "text-emerald-600"}
            bgColorClass="bg-amber-50"
          />
          <MetricCard 
            title="สัดส่วนมวลน้ำทิ้งต่อปริมาณลำน้ำ"
            value={`${capacityPct.toFixed(2)}%`}
            subValue="โหนดรับผลลัพธ์ระบาย"
            icon={<TrendingDown className="w-5 h-5 text-purple-500" />}
            colorClass={capacityPct > 10 ? "text-amber-600 font-bold" : "text-sky-600"}
            bgColorClass="bg-purple-50"
          />
          <MetricCard 
            title="กลุ่มต้นกำเนิดที่ระบุอัตลักษณ์ได้"
            value={diagnostics.iconType === 'industrial' ? 'น้ำเสียปล่อยโรงงาน' : diagnostics.iconType === 'community' ? 'น้ำเสียเทศบาลชุมชน' : diagnostics.iconType === 'agriculture' ? 'ชะปุ๋ยเคมีแปลงเพาะปลูก' : 'สะอาดไม่พบมลพิษพิเศษ'}
            subValue="คำตัดสินโมเลกุลรอยนิ้วมือ"
            icon={<ShieldCheck className="w-5 h-5 text-teal-600" />}
            colorClass={diagnostics.iconType === 'industrial' ? 'text-rose-650 text-rose-600 font-bold' : 'text-slate-700 font-semibold'}
            bgColorClass="bg-teal-50"
          />
        </div>

        {/* 4. Full-Width Spatial Map + Controls Below */}
        <div className="flex flex-col gap-6">
          {/* Spatial Google Map Area: Full Width */}
          <div className="w-full">
            <InteractiveMap 
              factories={factories}
              checkpoints={checkpoints}
              selectedId={selectedEntityId}
              onSelectEntity={handleSelectEntity}
            />
          </div>

          {/* Sidebar Control Panel: Full Width below the map */}
          <div className="w-full">
            <SidebarControls 
              selectedScenarioId={selectedScenarioId}
              onSelectScenario={handleSelectScenario}
              riverFlowRate={riverFlowRate}
              onRiverFlowRateChange={handleRiverFlowRateChange}
              riverFecal={riverFecal}
              onRiverFecalChange={setRiverFecal}
              riverNitrogen={riverNitrogen}
              onRiverNitrogenChange={setRiverNitrogen}
              factories={factories}
              onFactoryParamChange={handleFactoryParamChange}
              onResetToScenarioDefaults={handleResetToScenarioDefaults}
            />
          </div>
        </div>

        {/* 5. Profile Analytical Charts section */}
        <ComparisonCharts 
          checkpoints={checkpoints}
          factories={factories}
        />

        {/* 5.5. Interactive Incident Alert History and Real-time Auditing Logs */}
        <AlertHistoryLog 
          factories={factories}
          checkpoints={checkpoints}
          currentScenarioName={currentScenario.name}
          currentScenarioId={currentScenario.id}
        />

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
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
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
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                🌊 สถานีจุดคัดส่งวัดประเมินคุณภาพลำน้ำหลัก (เรียงจากพิกัดระดัลต้นลุ่มน้ำลงหาปลายลุ่มน้ำ)
              </span>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="p-3">รหัสโหนดสถานี</th>
                      <th className="p-3">ชื่อสถานีคัดตรวจร่วม</th>
                      <th className="p-3">พิกัดในเขตลุ่มน้ำ (Y, X)</th>
                      <th className="p-3 text-right">ค่า BOD ในแม่น้ำ (มก./ลิตร)</th>
                      <th className="p-3 text-right">ค่า COD ในแม่น้ำ (มก./ลิตร)</th>
                      <th className="p-3 text-right">แบคทีเรียชุมชนฟีคัล (MPN/100มล.)</th>
                      <th className="p-3 text-right">ปริมาณไนโตรเจน (มก./ลิตร)</th>
                      <th className="p-3 text-right">ค่านำพาไฟฟ้าชะล้างแม่น้ำ (EC, µS/cm)</th>
                      <th className="p-3 text-center">สถานะจุดตรวจ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {checkpoints.map((cp) => {
                      const isBODViolating = cp.bod > DIW_STANDARDS.RIVER_BOD_MAX;
                      const isCODViolating = cp.cod > DIW_STANDARDS.RIVER_COD_MAX;
                      const isFecalViolating = cp.fecalColiform > DIW_STANDARDS.RIVER_FECAL_MAX;
                      const isNitrogenViolating = cp.nitrogen > DIW_STANDARDS.RIVER_NITROGEN_MAX;

                      // นับจำนวนพารามิเตอร์ที่เกินมาตรฐาน: 1 ค่า = เฝ้าระวัง (เหลือง), 2 ค่าขึ้นไป = วิกฤต (แดง)
                      const violationCount = [isBODViolating, isCODViolating, isFecalViolating, isNitrogenViolating]
                        .filter(Boolean).length;
                      const cpRiskLevel: 'safe' | 'warning' | 'critical' =
                        violationCount >= 2 ? 'critical' : violationCount === 1 ? 'warning' : 'safe';

                      const rowClass =
                        cpRiskLevel === 'critical' ? 'bg-rose-500/5'
                        : cpRiskLevel === 'warning' ? 'bg-amber-500/5'
                        : '';

                      return (
                        <tr 
                          key={cp.id} 
                          className={`hover:bg-slate-50 transition-colors ${rowClass}`}
                        >
                          <td className="p-3 font-mono font-bold text-slate-900">{cp.id}</td>
                          <td className="p-3">{cp.name}</td>
                          <td className="p-3 font-mono text-slate-500">{cp.lat.toFixed(4)}°, {cp.lon.toFixed(4)}°</td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            isBODViolating ? 'text-amber-600 bg-amber-500/10' : 'text-slate-900'
                          }`}>
                            {cp.bod.toFixed(2)}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            isCODViolating ? 'text-amber-600 bg-amber-500/10' : 'text-slate-900'
                          }`}>
                            {cp.cod.toFixed(2)}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            isFecalViolating ? 'text-amber-600 bg-amber-500/10' : 'text-slate-900'
                          }`}>
                            {cp.fecalColiform.toLocaleString()}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            isNitrogenViolating ? 'text-amber-600 bg-amber-500/10' : 'text-slate-900'
                          }`}>
                            {cp.nitrogen.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-900">{cp.ec.toLocaleString()}</td>
                          <td className="p-3 text-center">
                            {cpRiskLevel === 'critical' ? (
                              <span className="inline-block px-2.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                                วิกฤต ({violationCount} ค่า)
                              </span>
                            ) : cpRiskLevel === 'warning' ? (
                              <span className="inline-block px-2.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                เฝ้าระวัง (1 ค่า)
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                ปลอดภัย
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                * อิงพิกัดเกณฑ์เป้าหมายคุณภาพสิ่งแวดล้อมมาตรฐานลุ่มน้ำทั่วไปประเภทที่ 3 ลำน้ำท่าจีน กำหนดบีบขีดจำกัด BOD ต้องไม่เกินออกลื่นเกิน **{DIW_STANDARDS.RIVER_BOD_MAX} มก./ลิตร** และแบคทีเรียกลิ่นสะสมปฏิกูลต้องไม่หนาเกิน **{DIW_STANDARDS.RIVER_FECAL_MAX} MPN** ต่ออัตราคัดกรอง — จุดตรวจที่มีค่าเกินมาตรฐาน 1 รายการแสดงสถานะ <span className="text-amber-600 font-bold">เฝ้าระวัง</span> และตั้งแต่ 2 รายการขึ้นไปแสดงสถานะ <span className="text-rose-600 font-bold">วิกฤต</span>
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
    </div>
  );
}
