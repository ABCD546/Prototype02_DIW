import React, { useMemo, useRef, useState } from 'react';
import { LineChart as LineChartIcon, X } from 'lucide-react';
import { DIW_STANDARDS } from '../appData';
import { FactoryImportRecord } from '../types';

type FactoryParam = 'pH' | 'bod' | 'cod' | 'tss' | 'tds';

const PARAM_LABELS: Record<FactoryParam, string> = {
  pH: 'pH',
  bod: 'BOD (มก./ลิตร)',
  cod: 'COD (มก./ลิตร)',
  tss: 'TSS (มก./ลิตร)',
  tds: 'TDS (มก./ลิตร)',
};

interface Props {
  factoryId: string;
  factoryName: string;
  history: FactoryImportRecord[];
  initialYear: string;
  onClose: () => void;
}

export default function FactoryTrendChart({ factoryId, factoryName, history, initialYear, onClose }: Props) {
  const factoryHistory = useMemo(
    () => history.filter((record) => record.factoryId === factoryId).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [factoryId, history]
  );
  const years = useMemo(
    () => [...new Set(factoryHistory.map((record) => record.timestamp.slice(0, 4)))].sort(),
    [factoryHistory]
  );
  const [year, setYear] = useState(() => years.includes(initialYear) ? initialYear : (years[years.length - 1] ?? initialYear));
  const [param, setParam] = useState<FactoryParam>('bod');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const yearRecords = useMemo(
    () => factoryHistory.filter((record) => record.timestamp.slice(0, 4) === year),
    [factoryHistory, year]
  );
  const points = useMemo(
    () => yearRecords
      .filter((record): record is FactoryImportRecord & Record<FactoryParam, number> => record[param] !== null)
      .map((record) => ({ t: new Date(record.timestamp).getTime(), v: record[param], record })),
    [yearRecords, param]
  );

  const isTextile = /สิ่งทอ|ฟอกย้อม|ทอผ้า|ย้อม/.test(factoryHistory[0]?.industryType ?? '');
  const referenceLines = param === 'bod'
    ? [{ value: DIW_STANDARDS.FACTORY_BOD_MAX, label: `เกณฑ์ BOD ${DIW_STANDARDS.FACTORY_BOD_MAX}`, color: '#e11d48' }]
    : param === 'cod'
      ? [{ value: isTextile ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX, label: `เกณฑ์ COD ${isTextile ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX}`, color: '#e11d48' }]
      : [];

  const W = 900, H = 310, padL = 54, padR = 22, padT = 18, padB = 38;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const geometry = useMemo(() => {
    if (!points.length) return { path: '', x: (_: number) => 0, y: (_: number) => 0, yTicks: [] as number[] };
    const times = points.map((point) => point.t);
    const values = points.map((point) => point.v).concat(referenceLines.map((line) => line.value));
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    let vMin = Math.min(...values);
    let vMax = Math.max(...values);
    if (vMin === vMax) { vMin -= 1; vMax += 1; }
    const padding = (vMax - vMin) * 0.12;
    vMin = Math.max(0, vMin - padding);
    vMax += padding;
    const x = (time: number) => padL + (tMax === tMin ? plotW / 2 : ((time - tMin) / (tMax - tMin)) * plotW);
    const y = (value: number) => padT + plotH - ((value - vMin) / (vMax - vMin)) * plotH;
    return {
      path: points.map((point, index) => `${index ? 'L' : 'M'} ${x(point.t).toFixed(1)} ${y(point.v).toFixed(1)}`).join(' '),
      x,
      y,
      yTicks: Array.from({ length: 6 }, (_, index) => vMin + ((vMax - vMin) * index) / 5),
    };
  }, [points, referenceLines, plotH, plotW]);

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!points.length || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * W;
    let closest = 0;
    points.forEach((point, index) => {
      if (Math.abs(geometry.x(point.t) - mouseX) < Math.abs(geometry.x(points[closest].t) - mouseX)) closest = index;
    });
    setHoverIndex(closest);
  };

  const value = (record: FactoryImportRecord, key: FactoryParam) =>
    record[key] === null ? '—' : Number(record[key]).toFixed(key === 'pH' ? 2 : 1);

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-slate-200 bg-white">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <LineChartIcon className="w-4.5 h-4.5 text-blue-600" />
              กราฟข้อมูลย้อนหลังเฉพาะโรงงาน
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">{factoryId} · {factoryName}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="p-5 flex flex-wrap gap-4 border-b border-slate-100 bg-slate-50/60">
          <label className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-500">ปี</span>
            <select value={year} onChange={(event) => setYear(event.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white">
              {years.map((item) => <option key={item} value={item}>ปี {Number(item) + 543}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-500">พารามิเตอร์ในกราฟ</span>
            <select value={param} onChange={(event) => setParam(event.target.value as FactoryParam)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white">
              {(Object.keys(PARAM_LABELS) as FactoryParam[]).map((key) => <option key={key} value={key}>{PARAM_LABELS[key]}</option>)}
            </select>
          </label>
        </div>

        <div className="p-5">
          {!points.length ? (
            <div className="h-[310px] flex items-center justify-center text-amber-700 bg-amber-50 border border-amber-200 rounded-xl text-xs">
              ไม่มีค่าพารามิเตอร์นี้ในปีที่เลือก
            </div>
          ) : (
            <>
              <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full select-none" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIndex(null)}>
                {geometry.yTicks.map((tick) => <g key={tick}>
                  <line x1={padL} x2={W - padR} y1={geometry.y(tick)} y2={geometry.y(tick)} stroke="#e2e8f0" />
                  <text x={padL - 7} y={geometry.y(tick) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{tick.toFixed(1)}</text>
                </g>)}
                {points.map((point, index) => <text key={point.t} x={geometry.x(point.t)} y={H - 12} textAnchor="middle" fontSize="8.5" fill="#94a3b8">
                  {new Date(point.t).toLocaleString('th-TH', { month: 'short' })}
                </text>)}
                {referenceLines.map((line) => <g key={line.label}>
                  <line x1={padL} x2={W - padR} y1={geometry.y(line.value)} y2={geometry.y(line.value)} stroke={line.color} strokeDasharray="5,4" strokeWidth="1.4" />
                  <text x={W - padR} y={geometry.y(line.value) - 5} textAnchor="end" fontSize="9" fontWeight="bold" fill={line.color}>{line.label}</text>
                </g>)}
                <path d={geometry.path} fill="none" stroke="#2563eb" strokeWidth="2" />
                {points.map((point) => <circle key={point.t} cx={geometry.x(point.t)} cy={geometry.y(point.v)} r="3" fill="#2563eb" stroke="#fff" strokeWidth="1.2" />)}
                {hoverIndex !== null && points[hoverIndex] && <g>
                  <line x1={geometry.x(points[hoverIndex].t)} x2={geometry.x(points[hoverIndex].t)} y1={padT} y2={H - padB} stroke="#64748b" strokeDasharray="3,3" />
                  <circle cx={geometry.x(points[hoverIndex].t)} cy={geometry.y(points[hoverIndex].v)} r="5" fill="#2563eb" stroke="#fff" strokeWidth="2" />
                </g>}
              </svg>
              {hoverIndex !== null && points[hoverIndex] && <div className="mt-2 inline-flex gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
                <span className="text-slate-500">{new Date(points[hoverIndex].t).toLocaleDateString('th-TH')}</span>
                <span className="font-bold text-blue-700">{PARAM_LABELS[param]}: {points[hoverIndex].v}</span>
              </div>}
            </>
          )}

          <div className="mt-5 overflow-auto border border-slate-200 rounded-xl max-h-64">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr><th className="p-2 text-left">วันที่ตรวจ</th><th className="p-2 text-right">pH</th><th className="p-2 text-right">BOD</th><th className="p-2 text-right">COD</th><th className="p-2 text-right">TSS</th><th className="p-2 text-right">TDS</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {yearRecords.map((record) => <tr key={`${record.factoryId}-${record.timestamp}`} className="hover:bg-slate-50">
                  <td className="p-2">{new Date(record.timestamp).toLocaleDateString('th-TH')}</td>
                  {(['pH', 'bod', 'cod', 'tss', 'tds'] as FactoryParam[]).map((key) => <td key={key} className="p-2 text-right font-mono">{value(record, key)}</td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 mt-3">แสดงเฉพาะประวัติของโรงงานที่เลือก ไม่รวมข้อมูลจากโรงงานอื่น</p>
        </div>
      </div>
    </div>
  );
}
