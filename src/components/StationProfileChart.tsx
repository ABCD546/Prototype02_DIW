/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, GitCompareArrows } from 'lucide-react';
import { Checkpoint } from '../types';
import {
  getCheckpointReadingAt,
  ParamKey,
  PARAM_LABELS,
  getReferenceLines,
  BRACKISH_ZONE_STATIONS,
} from '../checkpointData';

interface StationProfileChartProps {
  /** Stations already ordered upstream (top) → downstream (mouth) */
  stations: Checkpoint[];
  onClose: () => void;
}

const LINE_A_COLOR = '#2563eb'; // blue
const LINE_B_COLOR = '#f97316'; // orange

export default function StationProfileChart({ stations, onClose }: StationProfileChartProps) {
  const [param, setParam] = useState<ParamKey>('pH');
  const [dateTimeA, setDateTimeA] = useState('2023-06-15T09:00');
  const [dateTimeB, setDateTimeB] = useState('2023-12-15T09:00');
  const [loading, setLoading] = useState(false);
  const [valuesA, setValuesA] = useState<Record<string, number | null>>({});
  const [valuesB, setValuesB] = useState<Record<string, number | null>>({});
  const [timestampsA, setTimestampsA] = useState<Record<string, string | null>>({});
  const [timestampsB, setTimestampsB] = useState<Record<string, string | null>>({});

  const loadProfile = async () => {
    setLoading(true);
    const isoA = dateTimeA.length === 16 ? `${dateTimeA}:00` : dateTimeA;
    const isoB = dateTimeB.length === 16 ? `${dateTimeB}:00` : dateTimeB;

    const [resultsA, resultsB] = await Promise.all([
      Promise.all(stations.map(async (s) => {
        try {
          const r = await getCheckpointReadingAt(s.id, isoA);
          return [s.id, r] as const;
        } catch { return [s.id, null] as const; }
      })),
      Promise.all(stations.map(async (s) => {
        try {
          const r = await getCheckpointReadingAt(s.id, isoB);
          return [s.id, r] as const;
        } catch { return [s.id, null] as const; }
      })),
    ]);

    const vA: Record<string, number | null> = {};
    const tA: Record<string, string | null> = {};
    for (const [id, r] of resultsA) { vA[id] = r ? (r.values[param] ?? null) : null; tA[id] = r ? r.timestamp : null; }
    const vB: Record<string, number | null> = {};
    const tB: Record<string, string | null> = {};
    for (const [id, r] of resultsB) { vB[id] = r ? (r.values[param] ?? null) : null; tB[id] = r ? r.timestamp : null; }

    setValuesA(vA); setTimestampsA(tA);
    setValuesB(vB); setTimestampsB(tB);
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  // ── SVG chart geometry: X = station index (categorical), Y = value ────
  const W = 900, H = 340;
  const padL = 46, padR = 20, padT = 16, padB = 56;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const refLines = useMemo(() => {
    // ใช้เกณฑ์ของสถานีน้ำจืด เป็นตัวแทนเส้นอ้างอิงบนกราฟภาพรวม (EC จะมีหมายเหตุกำกับแยกสำหรับ 2 สถานีน้ำกร่อย)
    const freshwaterStation = stations.find(s => !BRACKISH_ZONE_STATIONS.has(s.id))?.id ?? stations[0]?.id ?? '';
    return getReferenceLines(param, freshwaterStation);
  }, [param, stations]);

  const { xForIndex, yScale, yTicks } = useMemo(() => {
    const allVals = [
      ...stations.map(s => valuesA[s.id]).filter((v): v is number => v !== null && v !== undefined),
      ...stations.map(s => valuesB[s.id]).filter((v): v is number => v !== null && v !== undefined),
      ...refLines.map(r => r.value),
    ];
    let vMin = allVals.length ? Math.min(...allVals) : 0;
    let vMax = allVals.length ? Math.max(...allVals) : 1;
    if (vMin === vMax) { vMin -= 1; vMax += 1; }
    const pad = (vMax - vMin) * 0.12;
    vMin -= pad; vMax += pad;

    const n = stations.length;
    const xForIndex = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const yScale = (v: number) => padT + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

    const yTickCount = 5;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => vMin + ((vMax - vMin) * i) / yTickCount);

    return { xForIndex, yScale, yTicks };
  }, [stations, valuesA, valuesB, refLines]);

  const buildPath = (values: Record<string, number | null>) => {
    const pts: { x: number; y: number }[] = [];
    stations.forEach((s, i) => {
      const v = values[s.id];
      if (v !== null && v !== undefined) pts.push({ x: xForIndex(i), y: yScale(v) });
    });
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <GitCompareArrows className="w-4.5 h-4.5 text-blue-600" />
            เปรียบเทียบโปรไฟล์คุณภาพน้ำทุกสถานี (ต้นน้ำ → ปลายน้ำ)
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
            <label className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: LINE_A_COLOR }}>
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: LINE_A_COLOR }} />
              วันที่/เวลา A
            </label>
            <input
              type="datetime-local" value={dateTimeA} min="2015-01-01T00:00" max="2024-12-31T23:59"
              onChange={(e) => setDateTimeA(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: LINE_B_COLOR }}>
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: LINE_B_COLOR }} />
              วันที่/เวลา B (สำหรับเปรียบเทียบ)
            </label>
            <input
              type="datetime-local" value={dateTimeB} min="2015-01-01T00:00" max="2024-12-31T23:59"
              onChange={(e) => setDateTimeB(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] font-mono"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              onClick={loadProfile}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              แสดง
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="p-5">
          {loading ? (
            <div className="h-[340px] flex items-center justify-center text-slate-400 text-xs">กำลังโหลดข้อมูล...</div>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none">
              {/* Y grid + labels */}
              {yTicks.map((v, i) => (
                <g key={i}>
                  <line x1={padL} x2={W - padR} y1={yScale(v)} y2={yScale(v)} stroke="#e2e8f0" strokeWidth={1} />
                  <text x={padL - 6} y={yScale(v) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{v.toFixed(2)}</text>
                </g>
              ))}

              {/* X station labels (upstream → downstream), rotated for readability */}
              {stations.map((s, i) => (
                <g key={s.id}>
                  <line x1={xForIndex(i)} x2={xForIndex(i)} y1={padT} y2={H - padB} stroke="#f1f5f9" strokeWidth={1} />
                  <text
                    x={xForIndex(i)} y={H - padB + 14}
                    textAnchor="end" fontSize="9.5" fontWeight="bold" fill="#475569"
                    transform={`rotate(-30 ${xForIndex(i)} ${H - padB + 14})`}
                  >
                    {s.name.replace('สถานี', '')}
                  </text>
                  {BRACKISH_ZONE_STATIONS.has(s.id) && (
                    <text x={xForIndex(i)} y={H - padB + 30} textAnchor="middle" fontSize="7.5" fill="#0ea5e9">🌊 น้ำกร่อย</text>
                  )}
                </g>
              ))}

              {/* Reference threshold lines */}
              {refLines.map((r, i) => (
                <g key={i}>
                  <line x1={padL} x2={W - padR} y1={yScale(r.value)} y2={yScale(r.value)} stroke={r.color} strokeWidth={1.3} strokeDasharray="5,4" />
                  <text x={W - padR} y={yScale(r.value) - 4} textAnchor="end" fontSize="8" fontWeight="bold" fill={r.color}>{r.label}</text>
                </g>
              ))}

              {/* Line A */}
              <path d={buildPath(valuesA)} fill="none" stroke={LINE_A_COLOR} strokeWidth={2} />
              {stations.map((s, i) => valuesA[s.id] != null && (
                <circle key={`a-${s.id}`} cx={xForIndex(i)} cy={yScale(valuesA[s.id]!)} r={3.5} fill={LINE_A_COLOR} stroke="#fff" strokeWidth={1.3} />
              ))}

              {/* Line B */}
              <path d={buildPath(valuesB)} fill="none" stroke={LINE_B_COLOR} strokeWidth={2} strokeDasharray="6,3" />
              {stations.map((s, i) => valuesB[s.id] != null && (
                <circle key={`b-${s.id}`} cx={xForIndex(i)} cy={yScale(valuesB[s.id]!)} r={3.5} fill={LINE_B_COLOR} stroke="#fff" strokeWidth={1.3} />
              ))}
            </svg>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5" style={{ color: LINE_A_COLOR }}>
              <span className="w-3 h-0.5 inline-block" style={{ background: LINE_A_COLOR }} /> วันที่/เวลา A: {dateTimeA.replace('T', ' ')}
            </span>
            <span className="flex items-center gap-1.5" style={{ color: LINE_B_COLOR }}>
              <span className="w-3 h-0.5 inline-block border-t-2 border-dashed" style={{ borderColor: LINE_B_COLOR }} /> วันที่/เวลา B: {dateTimeB.replace('T', ' ')}
            </span>
          </div>

          <p className="text-[10px] text-slate-400 leading-tight mt-3">
            * แกน X เรียงสถานีจากต้นน้ำ (ซ้าย) ไปปลายน้ำ (ขวา) ตามลำดับจริงในลุ่มแม่น้ำท่าจีน — เส้นประสีคือเกณฑ์มาตรฐานอ้างอิงสำหรับโซนน้ำจืด
            {param === 'EC' && ' ไม่นำไปใช้ตัดสินที่สถานีนครชัยศรี/กระทุ่มแบน (มีน้ำเค็มหนุนตามธรรมชาติ ทำเครื่องหมาย 🌊 ไว้ใต้ชื่อสถานี)'}
            . จุดที่ไม่มีข้อมูลในวันเวลานั้นจะไม่แสดงจุดบนกราฟ
          </p>
        </div>
      </div>
    </div>
  );
}
