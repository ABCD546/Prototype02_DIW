/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, AlertOctagon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  colorClass: string;
  bgColorClass: string;
}

export function MetricCard({
  title,
  value,
  subValue,
  icon,
  colorClass,
  bgColorClass,
}: MetricCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fadeIn">
      <div className="space-y-1">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          {title}
        </span>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-black tracking-tight ${colorClass}`}>{value}</span>
          {subValue && <span className="text-xs font-mono font-bold text-slate-400">{subValue}</span>}
        </div>
      </div>
      <div className={`p-3.5 rounded-xl ${bgColorClass}`}>
        {icon}
      </div>
    </div>
  );
}

interface DefenseBannerProps {
  verdict: string;
  systemJudgment: string;
  alertLevel: 'safe' | 'warning' | 'critical';
}

export function DefenseBanner({
  verdict,
  systemJudgment,
  alertLevel,
}: DefenseBannerProps) {
  const getColors = () => {
    switch (alertLevel) {
      case 'critical':
        return {
          bg: 'bg-rose-50 border-rose-220 border-rose-200',
          text: 'text-rose-900',
          descText: 'text-rose-700',
          badge: 'bg-rose-600 text-white',
          icon: <AlertOctagon className="w-8 h-8 text-rose-600 animate-bounce" />,
          title: 'ตรวจเจอมลพิษอุตสาหกรรมล้นเกณฑ์มาตรฐาน',
          confidence: '99.8%',
          confidenceLabel: 'ความแม่นยำอัตลักษณ์',
          confidenceColor: 'text-rose-900'
        };
      case 'warning':
        return {
          bg: 'bg-blue-50 border-blue-200',
          text: 'text-blue-900',
          descText: 'text-blue-700 font-semibold',
          badge: 'bg-blue-600 text-white',
          icon: <ShieldCheck className="w-8 h-8 text-blue-600 animate-pulse" />,
          title: 'ข้อพิสูจน์ระบบเกราะแก้ต่าง กรอ. ทำงาน',
          confidence: '94.2%',
          confidenceLabel: 'ความแม่นยำทางคดี',
          confidenceColor: 'text-blue-900'
        };
      case 'safe':
      default:
        return {
          bg: 'bg-emerald-50 border-emerald-250 border-emerald-200',
          text: 'text-emerald-950',
          descText: 'text-emerald-700',
          badge: 'bg-emerald-600 text-white',
          icon: <ShieldCheck className="w-8 h-8 text-emerald-600" />,
          title: 'ระบบตรวจวัดลุ่มน้ำอยู่ในเกณฑ์ปกติ',
          confidence: '98.5%',
          confidenceLabel: 'ดัชนีความสะอาดปลอดภัย',
          confidenceColor: 'text-emerald-950'
        };
    }
  };

  const colors = getColors();

  return (
    <div className={`border rounded-2xl p-5 md:p-6 ${colors.bg} shadow-sm transition-all duration-300 relative overflow-hidden animate-slideDown`}>
      {/* Decorative subtle ambient stripe */}
      <div className="absolute right-0 top-0 bottom-0 w-1/4 bg-gradient-to-l from-blue-500/5 opacity-[0.1] pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between relative z-10">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-white/70 rounded-full border border-blue-100 shadow-sm shrink-0">
            {colors.icon}
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${colors.badge}`}>
                {colors.title}
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-500">DIW LABS</span>
            </div>
            <h2 className={`text-base md:text-lg font-extrabold tracking-tight text-slate-900 leading-snug`}>
              {systemJudgment}
            </h2>
            <p className={`text-xs md:text-sm ${colors.descText} max-w-4xl leading-relaxed`}>
              {verdict}
            </p>
          </div>
        </div>

        {/* Confidence metric indicator and justice description badge */}
        <div className="flex sm:flex-row flex-col gap-4 items-stretch lg:items-center shrink-0">
          <div className="bg-white/90 backdrop-blur-xs px-4 py-3 border border-slate-200 rounded-xl space-y-1 text-[11px] font-sans sm:max-w-[220px] leading-snug shadow-sm">
            <span className="font-bold text-slate-800 uppercase tracking-wider block">⚖️ ผลลัพธ์แกะรอยนิ้วมือ</span>
            <p className="text-slate-500 text-[10.5px]">
              {alertLevel === 'warning' 
                ? 'ตรวจพบรอยมวลเกษตรและน้ำทิ้งเทศบาลชุมชน ไม่พบรอยเชื่อมต่อพันธะโมเลกุลเคมีระบายยากของพิกัดกลุ่มงานอุตสาหกรรม' 
                : alertLevel === 'critical'
                ? 'ค่าตรวจขัดแย้งปล่อยน้ำอุตสาหกรรรล้นระดับวิกฤต รอยเชื่อมโยงเคมีภัณฑ์ทับตำแหน่งกับจุดมลพิษแม่น้ำพุ่งสูงสุดจริง'
                : 'ตัวแปรสภาวะแวดล้อมและพฤติกรรมระบายต้นน้ำ-กลางน้ำ-ปลายน้ำ ทำงานสอดคล้องอยู่ภายใต้กรอบมาตรฐานคพ.ปกติดี'}
            </p>
          </div>

          <div className="bg-white/90 backdrop-blur-xs px-4 py-3 border border-slate-200 rounded-xl text-center flex flex-col justify-center min-w-[130px] shadow-sm">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{colors.confidenceLabel}</div>
            <div className={`text-2xl font-black ${colors.confidenceColor}`}>{colors.confidence}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
