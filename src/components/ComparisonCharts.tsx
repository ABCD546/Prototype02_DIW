/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Checkpoint, Factory } from '../types';
import { DIW_STANDARDS } from '../data';
import { Activity } from 'lucide-react';

interface ComparisonChartsProps {
  checkpoints: Checkpoint[];
  factories: Factory[];
}

export default function ComparisonCharts({ checkpoints, factories }: ComparisonChartsProps) {
  // Extract values for plotting
  const cpBODs = checkpoints.map(c => c.bod);
  const cpCODs = checkpoints.map(c => c.cod);
  const cpFecals = checkpoints.map(c => c.fecalColiform);
  const cpNitrogens = checkpoints.map(c => c.nitrogen);

  // Maximum value for scaling the BOD chart
  const maxBOD = Math.max(...cpBODs, DIW_STANDARDS.RIVER_BOD_MAX, 10);
  const maxCOD = Math.max(...cpCODs, 30);

  // Height and width for SVG rendering of the profile
  const chartHeight = 200;
  const chartWidth = 500;
  const getBOD_Y = (val: number) => chartHeight - (val / maxBOD) * (chartHeight - 40) - 20;
  const getCOD_Y = (val: number) => chartHeight - (val / maxCOD) * (chartHeight - 40) - 20;

  // Render three coordinate markers along the width of 500
  const xCoords = [60, 250, 440];

  // Build line path for BOD
  let bodPath = `M ${xCoords[0]} ${getBOD_Y(cpBODs[0])} L ${xCoords[1]} ${getBOD_Y(cpBODs[1])} L ${xCoords[2]} ${getBOD_Y(cpBODs[2])}`;
  let bodArea = `${bodPath} L ${xCoords[2]} ${chartHeight - 20} L ${xCoords[0]} ${chartHeight - 20} Z`;

  // Build line path for COD
  let codPath = `M ${xCoords[0]} ${getCOD_Y(cpCODs[0])} L ${xCoords[1]} ${getCOD_Y(cpCODs[1])} L ${xCoords[2]} ${getCOD_Y(cpCODs[2])}`;

  // Standard line height for CP BOD Standard (2.0 mg/L)
  const bodStandardY = getBOD_Y(DIW_STANDARDS.RIVER_BOD_MAX);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart 1: River Checkpoint Profile */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                เปรียบเทียบค่าความต้องการออกซิเจนทางชีวเคมี (BOD) และความต้องการออกซิเจนทางเคมี (COD) ตามแต่ละสถานีตรวจวัด
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-700 px-2 py-0.5 rounded border border-sky-100">
              เกณฑ์ คพ. ไทย: 2.0 มก./ลิตร
            </span>
          </div>

          {/* SVG Profile Chart */}
          <div className="w-full relative overflow-hidden flex justify-center">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full max-w-[480px] h-[200px]" preserveAspectRatio="xMidYMid meet">
              {/* Grid Lines */}
              <line x1="50" y1="20" x2="470" y2="20" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="50" y1="65" x2="470" y2="65" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="50" y1="110" x2="470" y2="110" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="50" y1="155" x2="470" y2="155" stroke="#f1f5f9" strokeWidth="1" />
              
              {/* Checkpoint alignment columns */}
              {xCoords.map((x, i) => (
                <line key={i} x1={x} y1="20" x2={x} y2={chartHeight - 20} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" opacity="0.15" />
              ))}

              {/* Regulatory Limit Guideline for BOD */}
              <g>
                <line x1="50" y1={bodStandardY} x2="470" y2={bodStandardY} stroke="#10b981" strokeWidth="1.5" strokeDasharray="4,4" />
                <text x="55" y={bodStandardY - 6} className="text-[9px] font-bold fill-emerald-600 font-sans uppercase tracking-widest">
                  เป้าหมายควบคุมน้ำประเภทที่ 3 (&le; 2.0 มก./ลิตร)
                </text>
              </g>

              {/* Graphical Area representation under BOD curve */}
              <path d={bodArea} fill="url(#bodGrad)" opacity="0.15" />

              {/* Line curves plotting */}
              <path d={bodPath} fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d={codPath} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3,3" strokeLinecap="round" strokeLinejoin="round" />

              {/* BOD Plot Points with values */}
              {xCoords.map((x, i) => {
                const val = cpBODs[i];
                const y = getBOD_Y(val);
                const isOver = val > DIW_STANDARDS.RIVER_BOD_MAX;
                return (
                  <g key={i} transform={`translate(${x}, ${y})`} className="group">
                    <circle r="6" fill={isOver ? '#f43f5e' : '#0ea5e9'} stroke="#ffffff" strokeWidth="2.5" className="filter drop-shadow-xs" />
                    <text y="-10" className="text-[10px] font-bold font-sans fill-slate-850 text-center" textAnchor="middle">
                      {val.toFixed(1)} มก./ลิตร
                    </text>
                  </g>
                );
              })}

              {/* COD Plot Points values */}
              {xCoords.map((x, i) => {
                const val = cpCODs[i];
                const y = getCOD_Y(val);
                return (
                  <g key={i} transform={`translate(${x}, ${y})`}>
                    <circle r="4.5" fill="#64748b" stroke="#ffffff" strokeWidth="1.5" />
                    <text y="13" className="text-[9px] font-bold fill-slate-500 text-center" textAnchor="middle">
                      COD: {val.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Axis Label Background Lines */}
              <line x1="40" y1={chartHeight - 20} x2="480" y2={chartHeight - 20} stroke="#cbd5e1" strokeWidth="1.2" />

              {/* Axis Checkpoint labels */}
              {xCoords.map((x, i) => (
                <text key={i} x={x} y={chartHeight - 4} className="text-[9px] font-bold fill-slate-400 font-mono tracking-tight" textAnchor="middle">
                  {checkpoints[i].id}
                </text>
              ))}

              {/* Gradient Definitions */}
              <defs>
                <linearGradient id="bodGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/60 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1.5 bg-sky-500 rounded" />
            <span>โปรไฟล์ BOD ในคำเตือนแม่น้ำท่าจีน</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-slate-450 border border-dashed border-slate-500" />
            <span>โปรไฟล์ COD ในแม่น้ำท่าจีน</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-emerald-500 border border-dashed border-emerald-500" />
            <span>เส้นเกณฑ์มาตรฐานแม่น้ำ คพ.</span>
          </div>
        </div>
      </div>

      {/* Chart 2: Chemical & Source Attribution Fingerprints */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                การตรวจสอบรอยนิ้วมือสารปนเปื้อนเชิงเปรียบเทียบ ระหว่างแบคทีเรียชุมชน ปุ๋ยเกษตรกรรม และเคมีสารละลายอุตสาหกรรม ณ จุดวัด CP03
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">
              Tracers Matrix
            </span>
          </div>

          {/* Tracer breakdown items */}
          <div className="space-y-4">
            {/* 1. Fecal Tracer */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-end text-xs">
                <span className="font-bold text-slate-700">แบคทีเรียฟีคัลโคลิฟอร์ม (สารติดตามน้ำเสียครัวเรือน/สิ่งปฏิกูลในเขตชุมชน)</span>
                <span className="font-mono font-bold text-slate-500 flex items-center gap-1">
                  ปัจจุบัน CP03: <span className="text-sky-600 font-extrabold">{cpFecals[2]?.toLocaleString() || 0}</span> MPN/100มล.
                </span>
              </div>
              <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex relative border border-slate-200">
                {/* 4000 target standard marker */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-rose-500/80 left-[26.6%] z-10" />
                <div 
                  className="h-full bg-gradient-to-r from-sky-400 to-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((cpFecals[2] / 15000) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-bold text-slate-450 leading-none">
                <span>0 (สะอาดบริสุทธิ์)</span>
                <span className="text-rose-500 font-bold">&larr; จุดขีดจำกัดมาตรฐานควบคุม (4,000)</span>
                <span>15,000+ (น้ำเสียชุมชนหนาแน่นวิกฤต)</span>
              </div>
            </div>

            {/* 2. Nitrogen Tracer */}
            <div className="space-y-1.5 pt-1.5">
              <div className="flex justify-between items-end text-xs">
                <span className="font-bold text-slate-700">ไนโตรเจนอนินทรีย์ (สารติดตามการชะล้างเกลือปุ๋ยเคมีฝั่งแปลงเพาะปลูก)</span>
                <span className="font-mono font-bold text-slate-505 flex items-center gap-1">
                  ปัจจุบัน CP03: <span className="text-green-600 font-extrabold">{(cpNitrogens[2] || 0).toFixed(2)}</span> มก./ลิตร
                </span>
              </div>
              <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex relative border border-slate-200">
                {/* 5 mg/L agricultural standard limit */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-rose-500/80 left-[41.6%] z-10" />
                <div 
                  className="h-full bg-gradient-to-r from-teal-400 to-green-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((cpNitrogens[2] / 12) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-bold text-slate-450 leading-none">
                <span>0 (สะอาดบริสุทธิ์)</span>
                <span className="text-rose-500 font-bold">&larr; เกณฑ์เตือนภัยภาคการเกษตร (5.0)</span>
                <span>12.0 มก./ลิตร (ชะช้างปุ๋ยเกษตรระดับรุนแรง)</span>
              </div>
            </div>

            {/* 3. Refractory COD/BOD ratio */}
            <div className="space-y-1.5 pt-1.5">
              {(() => {
                const ratio = cpBODs[2] > 0 ? cpCODs[2] / cpBODs[2] : 0;
                const indexPercent = Math.min((ratio / 4) * 100, 100);
                const hasIndustrialTrace = ratio > 3.0;

                return (
                  <>
                    <div className="flex justify-between items-end text-xs">
                      <span className="font-bold text-slate-700">ดัชนีเกลือสารอินทรีย์ดื้อย่อยละลาย COD/BOD (สารติดตามทางเคมีอุตสาหกรรม)</span>
                      <span className="font-mono font-bold text-slate-500 flex items-center gap-1">
                        ปัจจุบัน CP03: <span className={`${hasIndustrialTrace ? "text-rose-600" : "text-emerald-600"} font-extrabold`}>{ratio.toFixed(2)}</span> เท่าสัดส่วน
                      </span>
                    </div>
                    <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex relative border border-slate-200">
                      {/* Industrial limit indicator at ratio 3.0 */}
                      <div className="absolute top-0 bottom-0 w-0.5 bg-rose-500/80 left-[75%] z-10" />
                      <div 
                        className={`h-full ${hasIndustrialTrace ? "bg-rose-550 bg-rose-550" : "bg-emerald-500"} rounded-full transition-all duration-300`}
                        style={{ width: `${indexPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-bold text-slate-450 leading-none">
                      <span>&le; 1.5 (ย่อยสลายง่ายมากทางชีวภาพ - น้ำโสโครกเขตเมือง)</span>
                      <span className="text-rose-600 font-bold">&larr; บ่งชี้เคมีอินทรีย์ย่อยยาก (&ge; 3.0 - อุตสาหกรรม)</span>
                      <span>4.0+</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="mt-4 text-[10px] text-slate-400 italic font-medium flex items-center gap-1 pl-1">
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          หมายเหตุ: อัตราส่วน COD/BOD ต่ำ พิสูจน์ได้ว่าสารเคมีย่อยสลายทางชีวเคมีได้สูงมาก (น้ำโสโครกสิ่งปฏิกูลจากเมือง) ขณะที่อัตราส่วน COD/BOD สูง บ่งบอกสัดส่วนแร่ธาตุเคมีสังเคราะห์โรงงานอุตสาหกรรม
        </div>
      </div>
    </div>
  );
}
