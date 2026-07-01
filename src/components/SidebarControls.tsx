/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Scenario, Factory } from '../types';
import { SCENARIOS, DIW_STANDARDS } from '../data';
import { 
  Layers, 
  Settings, 
  RefreshCw, 
  CloudSun, 
  Calendar,
  AlertTriangle
} from 'lucide-react';

interface SidebarControlsProps {
  selectedScenarioId: number;
  onSelectScenario: (id: number) => void;
  riverFlowRate: number;
  onRiverFlowRateChange: (val: number) => void;
  riverFecal: number;
  onRiverFecalChange: (val: number) => void;
  riverNitrogen: number;
  onRiverNitrogenChange: (val: number) => void;
  factories: Factory[];
  onFactoryParamChange: (factoryId: string, param: 'dischargeBOD' | 'dischargeCOD' | 'actualQ', val: number) => void;
  onResetToScenarioDefaults: () => void;
}

export default function SidebarControls({
  selectedScenarioId,
  onSelectScenario,
  riverFlowRate,
  onRiverFlowRateChange,
  riverFecal,
  onRiverFecalChange,
  riverNitrogen,
  onRiverNitrogenChange,
  factories,
  onFactoryParamChange,
  onResetToScenarioDefaults,
}: SidebarControlsProps) {
  
  const currentScenario = SCENARIOS.find(s => s.id === selectedScenarioId) || SCENARIOS[1];

  return (
    <div className="bg-white text-slate-700 rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 select-none">
      {/* 1. Header row: title + reset action inline (full-width layout) */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            ระบบจำลองคุณภาพน้ำ กรอ.
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-snug max-w-2xl">
            ติดตามและทำนายวิกฤตสิ่งแวดล้มลุ่มแม่น้ำท่าจีน ด้วยโมเดลระบบจำลองระดับสารผสมคลาดเคลื่อนทางคณิตศาสตร์
          </p>
        </div>
        <button 
          onClick={onResetToScenarioDefaults}
          className="shrink-0 text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors hover:underline cursor-pointer bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-100"
          title="คืนค่าตัวแปรอิงตามประวัติย้อนหลังของเวลาจำลอง"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          คืนค่าประวัติ
        </button>
      </div>

      {/* 2. Main 3-column row: ประวัติเหตุการณ์ | ตัวแปรอุทกวิทยา | วิเคราะห์รอยนิ้วมือ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 2a. Scenario Selection (Timeline: "ประวัติข้อมูลย้อนหลัง") */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-600" />
            ประวัติข้อมูลย้อนหลังเชิงเหตุการณ์
          </label>
          
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
            {SCENARIOS.map((sc) => {
              const isActive = selectedScenarioId === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => {
                    onSelectScenario(sc.id);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all duration-200 cursor-pointer text-xs ${
                    isActive
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[9px] mb-0.5">
                    <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>
                      เฟรมบันทึกย้อนหลัง #{sc.id}
                    </span>
                    {sc.alertLevel === 'critical' ? (
                      <span className="bg-rose-50 text-rose-600 px-1.5 py-0.2 rounded text-[8px] font-extrabold border border-rose-150">ฝ่าฝืนอุตสาหกรรม</span>
                    ) : sc.id === 2 ? (
                      <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.2 rounded text-[8px] font-extrabold border border-emerald-150">สิ่งปฏิกูลเทศบาล</span>
                    ) : sc.id === 3 ? (
                      <span className="bg-cyan-50 text-cyan-600 px-1.5 py-0.2 rounded text-[8px] font-extrabold border border-cyan-155 text-center">ชะแปลงเกษตรกรรม</span>
                    ) : sc.id === 4 ? (
                      <span className="bg-amber-50 text-amber-600 px-1.5 py-0.2 rounded text-[8px] font-extrabold border border-amber-150">วิกฤตภัยแล้ง</span>
                    ) : sc.id === 6 ? (
                      <span className="bg-blue-50 text-blue-600 px-1.5 py-0.2 rounded text-[8px] font-extrabold border border-blue-150 text-center">ฤดูฝนน้ำหลาก</span>
                    ) : (
                      <span className="bg-green-50 text-green-600 px-1.5 py-0.2 rounded text-[8px] font-extrabold border border-green-150 text-center">สภาวะปกติ</span>
                    )}
                  </div>
                  <div className={`font-semibold text-[11px] truncate ${isActive ? 'text-blue-950' : 'text-slate-700'}`}>
                    {sc.name.split('(')[1]?.replace(')', '') || sc.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2b. Hydrology Inputs Component Area */}
        <div className="space-y-3 text-xs">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-blue-600" />
            ตัวแปรอุทกวิทยาทางกายภาพ & เคมีชีวภาพ
          </label>

          {/* Dynamic Readouts synced with timeline, but customizable */}
          <div className="space-y-3">
            
            {/* A. River Flow Rate (Q) */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-bold">อัตราการไหลของน้ำ (Q)</span>
                <span className="font-mono text-blue-600 font-black">
                  {riverFlowRate.toLocaleString()} ลบ.ม./วัน
                </span>
              </div>
              <input
                type="range"
                min={5000}
                max={150000}
                step={5000}
                value={riverFlowRate}
                onChange={(e) => onRiverFlowRateChange(parseInt(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer text-slate-300"
              />
              {riverFlowRate <= 15000 && (
                <div className="flex gap-1.5 items-start px-2 py-1 rounded bg-amber-50 border border-amber-200 text-[9px] text-amber-700 leading-tight">
                  <CloudSun className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>แม่น้ำไหลแร้งขัด: ความสามารถฟื้นตัวเจือจางหดลดลงต่ำวิกฤต</span>
                </div>
              )}
            </div>

            {/* B. Community Sewage Inputs (Fecal Coliform) */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-600 font-bold">ปฏิกูลเทศบาลชุมชน (Fecal):</span>
                <span className="font-mono text-emerald-600 font-extrabold">
                  {riverFecal.toLocaleString()} MPN
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={15000}
                step={100}
                value={riverFecal}
                onChange={(e) => onRiverFecalChange(parseInt(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer text-slate-300"
              />
            </div>

            {/* C. Agricultural Fertilizer Inputs (Nitrogen) */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-600 font-bold">ปุ๋ยเคมีแปลงเพาะปลูก (Nitrogen):</span>
                <span className="font-mono text-cyan-600 font-extrabold">
                  {riverNitrogen.toFixed(1)} มก./ลิตร
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={12.0}
                step={0.1}
                value={riverNitrogen}
                onChange={(e) => onRiverNitrogenChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-600 cursor-pointer text-slate-300"
              />
            </div>

          </div>
        </div>

        {/* 2c. Decision Support block (moved beside hydrology inputs to fill the 3rd column) */}
        <div className="flex flex-col">
          <div className="p-4 bg-blue-950 text-white rounded-xl h-full flex flex-col justify-center">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-300">วิเคราะห์รอยนิ้วมือ กรอ.</h4>
            <p className="text-[11px] leading-snug opacity-90 mt-1">
              ระบบแยกประเภทและวิเคราะห์ต้นน้ำเพื่อคืนความยุติธรรมให้สถานบริการอุตสาหกรรมในลุ่มน้ำท่าจีนอย่างน่าเชื่อถือ
            </p>
          </div>
        </div>

      </div>

      {/* 3. Custom Manual Factory Outflow Controllers — responsive grid (full width) */}
      <div className="space-y-3 pt-4 border-t border-slate-100 text-slate-700 text-xs">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
          แทรกแซงจำลองอัตราปล่อยน้ำเสียโรงงาน (What-If)
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
          {factories.map((factory) => {
            const isTextile = factory.industryType.includes('สิ่งทอ') || factory.industryType.includes('ฟอกย้อม');
            const codMax = isTextile ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX;
            const hasBODViolation = factory.dischargeBOD > DIW_STANDARDS.FACTORY_BOD_MAX;
            const hasCODViolation = factory.dischargeCOD > codMax;
            const hasAnyViolation = hasBODViolation || hasCODViolation;
            return (
              <div 
                key={factory.id} 
                className={`p-2.5 rounded-xl border space-y-1.5 transition-colors ${
                  hasAnyViolation 
                    ? 'bg-rose-50/70 border-rose-200' 
                    : 'bg-slate-50/50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-1">
                  <span className="font-extrabold text-slate-800 truncate max-w-[150px]">
                    {factory.id} - {factory.name.replace(/บจก\.|โรงงาน|อุตสาหกรรม/g, '').trim()}
                  </span>
                  <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-bold ${
                    hasAnyViolation ? 'bg-rose-100 text-rose-700 border border-rose-200/30' : 'bg-emerald-100 text-emerald-700/80 border border-emerald-200/20'
                  }`}>
                    {hasAnyViolation ? 'ระบายล้นพิกัด' : 'ปกติความสะอาด'}
                  </span>
                </div>

                {/* Effluent BOD slider */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>ความเข้มข้น BOD น้ำทิ้ง:</span>
                    <span className={`font-mono font-bold ${hasBODViolation ? 'text-rose-600' : 'text-slate-800'}`}>
                      {factory.dischargeBOD} มก./ลิตร
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={250}
                    step={5}
                    value={factory.dischargeBOD}
                    onChange={(e) => onFactoryParamChange(factory.id, 'dischargeBOD', parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Effluent COD slider */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>ความเข้มข้น COD น้ำทิ้ง:</span>
                    <span className={`font-mono font-bold ${hasCODViolation ? 'text-rose-600' : 'text-slate-800'}`}>
                      {factory.dischargeCOD} มก./ลิตร
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={800}
                    step={10}
                    value={factory.dischargeCOD}
                    onChange={(e) => onFactoryParamChange(factory.id, 'dischargeCOD', parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Effluent Q slider */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>ปริมาตรปล่อยน้ำเสีย:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {factory.actualQ.toLocaleString()} ลบ.ม./วัน
                    </span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={10000}
                    step={100}
                    value={factory.actualQ}
                    onChange={(e) => onFactoryParamChange(factory.id, 'actualQ', parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
