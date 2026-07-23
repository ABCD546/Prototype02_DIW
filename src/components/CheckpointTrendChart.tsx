/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, X, LineChart as LineChartIcon, ZoomIn, ZoomOut } from 'lucide-react';
import { Checkpoint, CheckpointReading } from '../types';
import { loadCheckpointIndex, loadCheckpointYear, ParamKey, PARAM_LABELS, getReferenceLines, STATION_FILE_CODE } from '../checkpointData';

interface CheckpointTrendChartProps {
  stations: Checkpoint[];
  initialStationId: string;
  onClose: () => void;
}

export default function CheckpointTrendChart({ stations, initialStationId, onClose }: CheckpointTrendChartProps) {
  const stationId = initialStationId;
  const [param, setParam] = useState<ParamKey>('pH');
  const [years, setYears] = useState<string[]>([]);
  const [year, setYear] = useState('2023');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<{ t: number; v: number }[]>([]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [viewRange, setViewRange] = useState<[number, number] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ clientX: number; range: [number, number] } | null>(null);

  const station = stations.find(s => s.id === stationId);

  const loadAndFilter = async () => {
    setLoading(true);
    setError(null);
    try {
      const all: CheckpointReading[] = await loadCheckpointYear(stationId, Number(year));
      const filtered = all
        .map(r => ({ t: new Date(r.timestamp).getTime(), v: r.values[param] }))
        .filter((r): r is { t: number; v: number } => r.v !== null && r.v !== undefined)
        .sort((a, b) => a.t - b.t);

      setPoints(filtered);
      setViewRange(filtered.length ? [filtered[0].t, filtered[filtered.length - 1].t] : null);
      setHoverIdx(null);
      if (filtered.length === 0) {
        setError('ไม่มีข้อมูลของพารามิเตอร์นี้ในปีที่เลือก');
      }
    } catch (err) {
      setError('โหลดข้อมูลไม่สำเร็จ');
      setPoints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const code = STATION_FILE_CODE[stationId];
    if (!code) {
      setYears([]);
      setError('สถานีนี้มีเฉพาะข้อมูลตำแหน่ง ยังไม่มีข้อมูลย้อนหลังสำหรับสร้างกราฟ');
      return;
    }
    loadCheckpointIndex().then((index) => {
      const availableYears = (index.stations[code]?.years ?? []).map(String);
      setYears(availableYears);
      if (availableYears.length && !availableYears.includes(year)) setYear(availableYears[availableYears.length - 1]);
    }).catch(() => setError('โหลดรายการปีของสถานีไม่สำเร็จ'));
  }, [stationId, year]);

  useEffect(() => {
    if (years.includes(year)) void loadAndFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, year, param, years]);

  const refLines = getReferenceLines(param, stationId);
  const fullRange = useMemo<[number, number] | null>(
    () => points.length ? [points[0].t, points[points.length - 1].t] : null,
    [points]
  );
  const visiblePoints = useMemo(() => {
    if (!viewRange) return points;
    return points.filter((point) => point.t >= viewRange[0] && point.t <= viewRange[1]);
  }, [points, viewRange]);

  const setClampedRange = (start: number, end: number) => {
    if (!fullRange) return;
    const fullSpan = Math.max(1, fullRange[1] - fullRange[0]);
    const span = Math.min(fullSpan, Math.max(30 * 60 * 1000, end - start));
    let nextStart = start;
    if (nextStart < fullRange[0]) nextStart = fullRange[0];
    if (nextStart + span > fullRange[1]) nextStart = fullRange[1] - span;
    setViewRange([nextStart, nextStart + span]);
    setHoverIdx(null);
  };
  const zoomBy = (factor: number, anchor = 0.5) => {
    if (!viewRange || !fullRange) return;
    const span = viewRange[1] - viewRange[0];
    const nextSpan = span * factor;
    const anchorTime = viewRange[0] + span * anchor;
    setClampedRange(anchorTime - nextSpan * anchor, anchorTime + nextSpan * (1 - anchor));
  };
  const panBy = (fraction: number) => {
    if (!viewRange) return;
    const shift = (viewRange[1] - viewRange[0]) * fraction;
    setClampedRange(viewRange[0] + shift, viewRange[1] + shift);
  };

  // ── SVG chart geometry ──────────────────────────────────────────────
  const W = 900, H = 320;
  const padL = 46, padR = 20, padT = 16, padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const { pathD, xScale, yScale, yTicks, xTicks } = useMemo(() => {
    if (visiblePoints.length === 0) {
      return { pathD: '', xScale: (t: number) => 0, yScale: (v: number) => 0, yTicks: [] as number[], xTicks: [] as { x: number; label: string }[] };
    }
    const tMin = viewRange?.[0] ?? visiblePoints[0].t;
    const tMax = viewRange?.[1] ?? visiblePoints[visiblePoints.length - 1].t;
    const vals = visiblePoints.map(p => p.v).concat(refLines.map(r => r.value));
    let vMin = Math.min(...vals);
    let vMax = Math.max(...vals);
    if (vMin === vMax) { vMin -= 1; vMax += 1; }
    const pad = (vMax - vMin) * 0.1;
    vMin -= pad; vMax += pad;

    const xScale = (t: number) => padL + (tMax === tMin ? 0 : ((t - tMin) / (tMax - tMin)) * plotW);
    const yScale = (v: number) => padT + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

    const pathD = visiblePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.t).toFixed(1)} ${yScale(p.v).toFixed(1)}`).join(' ');

    const yTickCount = 5;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => vMin + ((vMax - vMin) * i) / yTickCount);

    const xTickCount = Math.min(6, visiblePoints.length);
    const xTicks = Array.from({ length: xTickCount }, (_, i) => {
      const t = tMin + ((tMax - tMin) * i) / (xTickCount - 1 || 1);
      const d = new Date(t);
      return {
        x: xScale(t),
        label: `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('th-TH', { month: 'short' })} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      };
    });

    return { pathD, xScale, yScale, yTicks, xTicks };
  }, [visiblePoints, refLines, viewRange]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (visiblePoints.length === 0 || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (dragRef.current && viewRange) {
      const shift = -((e.clientX - dragRef.current.clientX) / rect.width) * (dragRef.current.range[1] - dragRef.current.range[0]);
      setClampedRange(dragRef.current.range[0] + shift, dragRef.current.range[1] + shift);
      return;
    }
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    // หาจุดที่ใกล้ mouseX ที่สุด
    let closest = 0, closestDist = Infinity;
    visiblePoints.forEach((p, i) => {
      const d = Math.abs(xScale(p.t) - mouseX);
      if (d < closestDist) { closestDist = d; closest = i; }
    });
    setHoverIdx(closest);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const anchor = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    zoomBy(e.deltaY > 0 ? 1.25 : 0.8, anchor);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <LineChartIcon className="w-4.5 h-4.5 text-blue-600" />
              กราฟข้อมูลย้อนหลังเฉพาะสถานีตรวจวัดน้ำ
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">{station?.code ?? stationId} · {station?.name ?? stationId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-5 flex flex-wrap gap-4 border-b border-slate-100 bg-slate-50/50">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">ปี</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={!years.length}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white font-medium disabled:text-slate-400"
            >
              {years.length ? years.map((item) => <option key={item} value={item}>ปี {item}</option>) : <option>ยังไม่มีข้อมูล</option>}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">พารามิเตอร์ในกราฟ</label>
            <select
              value={param}
              onChange={(e) => setParam(e.target.value as ParamKey)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white font-medium"
            >
              {(Object.keys(PARAM_LABELS) as ParamKey[]).map(k => (
                <option key={k} value={k}>{PARAM_LABELS[k]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Chart */}
        <div className="p-5">
          {!loading && !error && points.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => panBy(-0.35)} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600" title="เลื่อนกราฟไปทางซ้าย">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => panBy(0.35)} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600" title="เลื่อนกราฟไปทางขวา">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => zoomBy(0.6)} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-blue-600" title="ซูมเข้า">
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => zoomBy(1.6)} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-blue-600" title="ซูมออก">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setViewRange(fullRange)} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-600">
                  <RotateCcw className="w-3.5 h-3.5" /> แสดงทั้งหมด
                </button>
              </div>
              <p className="text-[10px] text-slate-500">หมุนล้อเมาส์เพื่อซูม · กดค้างแล้วลากเพื่อเลื่อนกราฟ</p>
            </div>
          )}
          {loading ? (
            <div className="h-[320px] flex items-center justify-center text-slate-400 text-xs">กำลังโหลดข้อมูล...</div>
          ) : error ? (
            <div className="h-[320px] flex items-center justify-center text-amber-600 text-xs bg-amber-50 rounded-xl border border-amber-200">⚠ {error}</div>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full select-none cursor-grab active:cursor-grabbing"
              onMouseMove={handleMouseMove}
              onMouseDown={(e) => {
                if (viewRange) dragRef.current = { clientX: e.clientX, range: viewRange };
              }}
              onMouseUp={() => { dragRef.current = null; }}
              onMouseLeave={() => { dragRef.current = null; setHoverIdx(null); }}
              onWheel={handleWheel}
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
              {hoverIdx !== null && visiblePoints[hoverIdx] && (
                <g>
                  <line
                    x1={xScale(visiblePoints[hoverIdx].t)} x2={xScale(visiblePoints[hoverIdx].t)}
                    y1={padT} y2={H - padB}
                    stroke="#94a3b8" strokeWidth={1} strokeDasharray="3,3"
                  />
                  <circle cx={xScale(visiblePoints[hoverIdx].t)} cy={yScale(visiblePoints[hoverIdx].v)} r={4} fill="#2563eb" stroke="#fff" strokeWidth={1.5} />
                </g>
              )}
            </svg>
          )}

          {hoverIdx !== null && visiblePoints[hoverIdx] && !loading && !error && (
            <div className="mt-2 inline-flex items-center gap-2 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="text-slate-400">{new Date(visiblePoints[hoverIdx].t).toLocaleString('th-TH')}</span>
              <span className="font-bold text-blue-700">{station?.name}: {visiblePoints[hoverIdx].v}</span>
            </div>
          )}

          {!loading && !error && visiblePoints.length > 0 && (
            <div className="mt-5 overflow-auto border border-slate-200 rounded-xl max-h-64">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-2 text-left">วันที่/เวลาตรวจวัด</th>
                    <th className="p-2 text-left">สถานี</th>
                    <th className="p-2 text-left">พารามิเตอร์</th>
                    <th className="p-2 text-right">ค่าที่วัดได้</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visiblePoints.map((point) => (
                    <tr key={point.t} className="hover:bg-slate-50">
                      <td className="p-2 font-mono">{new Date(point.t).toLocaleString('th-TH')}</td>
                      <td className="p-2">{station?.name ?? stationId}</td>
                      <td className="p-2">{PARAM_LABELS[param]}</td>
                      <td className="p-2 text-right font-mono">{point.v.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] text-slate-400 leading-tight mt-3">
            * เส้นประสีคือเกณฑ์มาตรฐานคุณภาพน้ำ ลากเมาส์บนกราฟเพื่อดูค่า ณ เวลานั้นๆ ข้อมูลบันทึกทุก 30 นาที ตั้งแต่ปี 2558 เป็นต้นไป (สถานีส่วนใหญ่ถึงปี 2566 ยกเว้นกระทุ่มแบนที่มีข้อมูลถึงปี 2567 แต่ไม่มีข้อมูลปี 2563) (ช่องที่ไม่มีข้อมูลจะถูกข้ามไป)
          </p>
        </div>
      </div>
    </div>
  );
}
