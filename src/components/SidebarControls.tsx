/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Scenario } from '../types';
import { SCENARIOS } from '../data';
import { 
  RefreshCw, 
  CloudSun, 
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
  onResetToScenarioDefaults,
}: SidebarControlsProps) {
  
  const currentScenario = SCENARIOS.find(s => s.id === selectedScenarioId) || SCENARIOS[1];

  return (
    <div className="bg-white text-slate-700 rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 select-none">
      {/* 1. Header row: reset action only (title removed) */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-end gap-3 pb-4 border-b border-slate-100">
        <button 
          onClick={onResetToScenarioDefaults}
          className="shrink-0 text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors hover:underline cursor-pointer bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-100"
          title="คืนค่าตัวแปรอิงตามประวัติย้อนหลังของเวลาจำลอง"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          คืนค่าประวัติ
        </button>
      </div>

      {/* 2. Main 2-column row: ประวัติเหตุการณ์ | ตัวแปรอุทกวิทยา */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 2a. Scenario Selection (Timeline: "ประวัติข้อมูลย้อนหลัง") */}
        <div className="space-y-3">
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
                  <span>แม่น้ำไหลแรงขัด: ความสามารถฟื้นตัวลดลงต่ำขั้นวิกฤต</span>
                </div>
              )}
            </div>

            

          </div>
        </div>

      </div>
    </div>
  );
}
