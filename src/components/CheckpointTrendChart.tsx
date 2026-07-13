/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, LineChart as LineChartIcon } from 'lucide-react';
import { Checkpoint, CheckpointReading } from '../types';
import { loadCheckpointYear } from '../checkpointData';

interface CheckpointTrendChartProps {
  stations: Checkpoint[];
  initialStationId: string;
  onClose: () => void;
}

type ParamKey = 'pH' | 'DO' | 'EC' | 'Temp';

const PARAM_LABELS: Record<ParamKey, string> = {
  pH: 'พารามิเตอร์ความเป็นกรด-ด่าง (pH)',
  DO: 'พารามิเตอร์ออกซิเจนละลายน้ำ (DO, มก./ลิตร)',
  EC: 'พารามิเตอร์ค่าการนำไฟฟ้า (EC, µS/cm)',
  Temp: 'พารามิเตอร์อุณหภูมิ (Temp, °C)',
};

const BRACKISH_ZONE_STATIONS = new Set<string>(['นครชัยศรี', 'กระทุ่มแบน']);

// Reference threshold lines per parameter (value, color, label)
function getReferenceLines(param: ParamKey, stationId: string): { value: number; color: string; label: string }[] {
  switch (param) {
    case 'pH':
      return [
        { value: 8.5, color: '#f43f5e', label: 'มากกว่า 8.5 เกินเกณฑ์มาตรฐาน (เป็นด่าง)' },
        { value: 6.5, color: '#f43f5e', label: 'ต่ำกว่า 6.5 เกินเกณฑ์มาตรฐาน (เป็นกรด)' },
      ];
    case 'DO':
      return [
        { value: 4.0, color: '#f59e0b', label: 'ต่ำกว่า 4.0 น้ำเสื่อมโทรมปานกลาง' },
        { value: 2.0, color: '#f43f5e', label: 'ต่ำกว่า 2.0 น้ำเสียขั้นรุนแรง' },
      ];
    case 'EC':
      if (BRACKISH_ZONE_STATIONS.has(stationId)) return []; // น้ำเค็มหนุนตามธรรมชาติ ไม่ใช้เกณฑ์นี้
      return [
        { value: 800, color: '#f59e0b', label: 'มากกว่า 800 เริ่มผิดปกติสำหรับน้ำจืด' },
        { value: 1500, color: '#f43f5e', label: 'มากกว่า 1,500 มีการปนเปื้อนสารเคมี/น้ำทิ้งสูง' },
      ];
    case 'Temp':
      return [
        { value: 32, color: '#f59e0b', label: 'มากกว่า 32°C เริ่มผิดปกติ' },
        { value: 35, color: '#f43f5e', label: 'มากกว่า 35°C ผิดปกติชัดเจน (อาจมีน้ำหล่อเย็นโรงงาน)' },
      ];
  }
}

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

export default function CheckpointTrendChart({ stations, initialStationId, onClose }: CheckpointTrendChartProps) {
  const [stationId, setStationId] = useState(initialStationId);
  const [param, setParam] = useState<ParamKey>('pH');
  const [startDate, setStartDate] = useState('2023-06-06');
  const [endDate, setEndDate] = useState('2023-06-09');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<{ t: number; v: number }[]>([]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const station = stations.find(s => s.id === stationId);

  const loadAndFilter = async () => {
    setLoading(true);
    setError(null);
    try {
      const startYear = new Date(startDate).getFullYear();
      const endYear = new Date(endDate).getFullYear();
      const startMs = new Date(`${startDate}T00:00:00`).getTime();
      const endMs = new Date(`${endDate}T23:59:59`).getTime();

      let all: CheckpointReading[] = [];
      for (let y = startYear; y <= endYear; y++) {
        try {
          const yearData = await loadCheckpointYear(stationId, y);
          all = all.concat(yearData);
        } catch {
          // ปีนั้นอาจไม่มีไฟล์สำหรับสถานีนี้ ข้ามไป
        }
      }

      const filtered = all
        .map(r => ({ t: new Date(r.timestamp).getTime(), v: r.values[param] }))
        .filter((r): r is { t: number; v: number } => r.v !== null && r.v !== undefined && r.t >= startMs && r.t <= endMs)
        .sort((a, b) => a.t - b.t);

      setPoints(filtered);
      if (filtered.length === 0) {
        setError('ไม่มีข้อมูลของพารามิเตอร์นี้ในช่วงวันที่ที่เลือก');
      }
    } catch (err) {
      setError('โหลดข้อมูลไม่สำเร็จ');
      setPoints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAndFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);

  const refLines = getReferenceLines(param, stationId);

  // ── SVG chart geometry ──────────────────────────────────────────────
  const W = 900, H = 320;
  const padL = 46, padR = 20, padT = 16, padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const { pathD, xScale, yScale, yTicks, xTicks } = useMemo(() => {
    if (points.length === 0) {
      return { pathD: '', xScale: (t: number) => 0, yScale: (v: number) => 0, yTicks: [] as number[], xTicks: [] as { x: number; label: string }[] };
    }
    const tMin = points[0].t;
    const tMax = points[points.length - 1].t;
    const vals = points.map(p => p.v).concat(refLines.map(r => r.value));
    let vMin = Math.min(...vals);
    let vMax = Math.max(...vals);
    if (vMin === vMax) { vMin -= 1; vMax += 1; }
    const pad = (vMax - vMin) * 0.1;
    vMin -= pad; vMax += pad;

    const xScale = (t: number) => padL + (tMax === tMin ? 0 : ((t - tMin) / (tMax - tMin)) * plotW);
    const yScale = (v: number) => padT + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.t).toFixed(1)} ${yScale(p.v).toFixed(1)}`).join(' ');

    const yTickCount = 5;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => vMin + ((vMax - vMin) * i) / yTickCount);

    const xTickCount = Math.min(6, points.length);
    const xTicks = Array.from({ length: xTickCount }, (_, i) => {
      const t = tMin + ((tMax - tMin) * i) / (xTickCount - 1 || 1);
      const d = new Date(t);
      return {
        x: xScale(t),
        label: `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('th-TH', { month: 'short' })} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      };
    });

    return { pathD, xScale, yScale, yTicks, xTicks };
  }, [points, refLines]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length === 0 || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    // หาจุดที่ใกล้ mouseX ที่สุด
    let closest = 0, closestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xScale(p.t) - mouseX);
      if (d < closestDist) { closestDist = d; closest = i; }
    });
    setHoverIdx(closest);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <LineChartIcon className="w-4.5 h-4.5 text-blue-600" />
            เปรียบเทียบสถานีคุณภาพน้ำ
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-slate-100 bg-slate-50/50">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">พารามิเตอร์</label>
            <select
              value={param}
              onChange={(e) => setParam(e.target.value as ParamKey)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
            >
              {(Object.keys(PARAM_LABELS) as ParamKey[]).map(k => (
                <option key={k} value={k}>{PARAM_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">สถานีคุณภาพน้ำ</label>
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
            >
              {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">ช่วงวันที่</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date" value={startDate} min="2015-01-01" max="2023-12-31"
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] font-mono"
              />
              <span className="text-slate-400 text-xs">–</span>
              <input
                type="date" value={endDate} min="2015-01-01" max="2023-12-31"
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] font-mono"
              />
            </div>
          </div>
          <div className="sm:col-span-3">
            <button
              onClick={loadAndFilter}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              แสดง
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="p-5">
          {loading ? (
            <div className="h-[320px] flex items-center justify-center text-slate-400 text-xs">กำลังโหลดข้อมูล...</div>
          ) : error ? (
            <div className="h-[320px] flex items-center justify-center text-amber-600 text-xs bg-amber-50 rounded-xl border border-amber-200">⚠ {error}</div>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full select-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverIdx(null)}
            >
              {/* Y grid + labels */}
              {yTicks.map((v, i) => (
                <g key={i}>
                  <line x1={padL} x2={W - padR} y1={yScale(v)} y2={yScale(v)} stroke="#e2e8f0" strokeWidth={1} />
                  <text x={padL - 6} y={yScale(v) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{v.toFixed(2)}</text>
                </g>
              ))}
              {/* X labels */}
              {xTicks.map((t, i) => (
                <text key={i} x={t.x} y={H - padB + 14} textAnchor="middle" fontSize="8.5" fill="#94a3b8">{t.label}</text>
              ))}

              {/* Reference threshold lines */}
              {refLines.map((r, i) => (
                <g key={i}>
                  <line x1={padL} x2={W - padR} y1={yScale(r.value)} y2={yScale(r.value)} stroke={r.color} strokeWidth={1.3} strokeDasharray="5,4" />
                  <text x={W - padR} y={yScale(r.value) - 4} textAnchor="end" fontSize="8.5" fontWeight="bold" fill={r.color}>{r.label}</text>
                </g>
              ))}

              {/* Data line */}
              <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={1.8} />

              {/* Hover crosshair + point */}
              {hoverIdx !== null && points[hoverIdx] && (
                <g>
                  <line
                    x1={xScale(points[hoverIdx].t)} x2={xScale(points[hoverIdx].t)}
                    y1={padT} y2={H - padB}
                    stroke="#94a3b8" strokeWidth={1} strokeDasharray="3,3"
                  />
                  <circle cx={xScale(points[hoverIdx].t)} cy={yScale(points[hoverIdx].v)} r={4} fill="#2563eb" stroke="#fff" strokeWidth={1.5} />
                </g>
              )}
            </svg>
          )}

          {hoverIdx !== null && points[hoverIdx] && !loading && !error && (
            <div className="mt-2 inline-flex items-center gap-2 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="text-slate-400">{new Date(points[hoverIdx].t).toLocaleString('th-TH')}</span>
              <span className="font-bold text-blue-700">{station?.name}: {points[hoverIdx].v}</span>
            </div>
          )}

          <p className="text-[10px] text-slate-400 leading-tight mt-3">
            * เส้นประสีคือเกณฑ์มาตรฐานคุณภาพน้ำ ลากเมาส์บนกราฟเพื่อดูค่า ณ เวลานั้นๆ ข้อมูลบันทึกทุก 30 นาที ตั้งแต่ปี 2558-2566 (ช่องที่ไม่มีข้อมูลจะถูกข้ามไป)
          </p>
        </div>
      </div>
    </div>
  );
}
