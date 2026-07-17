/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Factory, Checkpoint, CheckpointReading } from '../types';
import { DIW_STANDARDS } from '../data';
import { evaluateCheckpointReading } from '../checkpointData';
import { 
  Info, 
  HelpCircle, 
  Radio, 
  Shield, 
  Factory as FactoryIcon, 
  MapPin, 
  Compass,
  Calendar,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronRight
} from 'lucide-react';

interface InteractiveMapProps {
  factories: Factory[];
  checkpoints: Checkpoint[];
  checkpointReadings: Record<string, CheckpointReading | null>;
  checkpointDateTime: string;
  onCheckpointDateTimeChange: (val: string) => void;
  onJumpToLatestData?: () => void;
  loadingLatestDate?: boolean;
  selectedId: string | null;
  onSelectEntity: (id: string, type: 'factory' | 'checkpoint') => void;
  onFactoryParamChange: (factoryId: string, param: 'dischargeBOD' | 'dischargeCOD' | 'actualQ', val: number) => void;
}

export default function InteractiveMap({
  factories,
  checkpoints,
  checkpointReadings,
  checkpointDateTime,
  onCheckpointDateTimeChange,
  onJumpToLatestData,
  loadingLatestDate,
  selectedId,
  onSelectEntity,
  onFactoryParamChange,
}: InteractiveMapProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  // เริ่มต้นซ่อนแผงข้อมูลด้านขวาบนจอมือถือ (กว้างน้อยกว่า 768px) กันบังแผนที่ทั้งจอ — จอใหญ่ยังคงเปิดตามเดิม
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 768
  );
  const [isWhatIfOpen, setIsWhatIfOpen] = useState(false);

  const selectedFactory   = factories.find((f) => f.id === selectedId);
  const selectedCheckpoint = checkpoints.find((cp) => cp.id === selectedId);
  const selectedCheckpointReading = selectedCheckpoint ? checkpointReadings[selectedCheckpoint.id] : null;
  const selectedCheckpointEval = selectedCheckpoint
    ? evaluateCheckpointReading(selectedCheckpoint.id, selectedCheckpointReading)
    : null;

  // Reset what-if panel เมื่อเปลี่ยน entity
  useEffect(() => {
    setIsWhatIfOpen(false);
  }, [selectedId]);

  // รับ postMessage จาก iframe (MAP_READY และ SELECT_ENTITY)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data) return;

      if (data.type === 'MAP_READY') {
        setIsMapReady(true);
      }

      if (data.type === 'SELECT_ENTITY') {
        onSelectEntity(data.id, data.entityType);
        setIsSidebarOpen(true); // แตะหมุดปุ๊บ เปิดแผงข้อมูลให้เห็นทันที แม้ค่าเริ่มต้นบนมือถือจะซ่อนไว้
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSelectEntity]);


  // ส่ง markers ไปให้ iframe ทุกครั้งที่ข้อมูลเปลี่ยน
  useEffect(() => {
    if (!isMapReady || !iframeRef.current?.contentWindow) return;

    const checkpointsWithStatus = checkpoints.map((cp) => ({
      ...cp,
      isViolating: evaluateCheckpointReading(cp.id, checkpointReadings[cp.id]).isViolating,
    }));

    iframeRef.current.contentWindow.postMessage({
      type: 'UPDATE_MARKERS',
      factories,
      checkpoints: checkpointsWithStatus,
      selectedId,
    }, '*');
  }, [isMapReady, factories, checkpoints, checkpointReadings, selectedId]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full min-h-0 overflow-hidden">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-4 h-4 text-sky-500 animate-pulse" />
            ระบบแผนที่วิเคราะห์พิกัดดาวเทียมแบบโต้ตอบ (GIS)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            พื้นที่ลุ่มแม่น้ำท่าจีน ประเทศไทย — จำลองแบบจำลองระบุกรรมสิทธิ์มลพิษและการตรวจอัตลักษณ์ด้วย Open-Source Map Tiles
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200/60 rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            วันที่/เวลาย้อนหลัง:
            <input
              type="datetime-local"
              value={checkpointDateTime}
              onChange={(e) => onCheckpointDateTimeChange(e.target.value)}
              min="2015-01-01T00:00"
              max="2024-12-31T23:59"
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono"
            />
          </label>
          {onJumpToLatestData && (
            <button
              onClick={onJumpToLatestData}
              disabled={loadingLatestDate}
              title="ปุ่ม “วันนี้” ของปฏิทินจะพาไปวันที่ปัจจุบันจริงซึ่งไม่มีข้อมูล กดปุ่มนี้แทนเพื่อไปยังข้อมูลใหม่สุดที่มีจริง"
              className="flex items-center gap-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              <Calendar className="w-3.5 h-3.5" />
              {loadingLatestDate ? 'กำลังค้นหา...' : 'ข้อมูลล่าสุด'}
            </button>
          )}
          <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-200/60 w-fit">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-white shadow-xs" /> จุดคัดตรวจแม่น้ำ (ปกติ)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block border border-white shadow-xs" /> จุดคัดตรวจ (ค่าเกินเกณฑ์)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block border border-white shadow-xs" /> โรงงานผ่านเกณฑ์ปกติ
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block border border-white shadow-xs" /> โรงงานปล่อยมลพิษล้นเกณฑ์
            </span>
          </div>
        </div>
      </div>

      {/* Map + Sidebar */}
      <div className="relative bg-slate-50 rounded-xl overflow-hidden border border-slate-250 shadow-inner flex flex-col md:flex-row" style={{ height: '860px' }}>

        {/* iframe แทน Leaflet React */}
        <div className="flex-1 relative min-h-0">
          {!isMapReady && (
            <div className="absolute inset-0 flex items-center justify-center font-extrabold text-sm text-slate-400 gap-2 z-10 bg-slate-50">
              <Compass className="w-5 h-5 animate-spin" /> ค้นหาพิกัดจีไอเอส...
            </div>
          )}
          <iframe
            ref={iframeRef}
            src="/map.html"
            className="w-full h-full border-0"
            style={{ zIndex: 1 }}
            title="แผนที่แม่น้ำท่าจีน"
            allow="fullscreen"
            allowFullScreen
          />
        </div>

        {/* Sidebar ขวา — จอใหญ่ลอยทับขวาแผนที่ / จอมือถือเลื่อนขึ้นจากด้านล่างแทน ไม่บังแผนที่ทั้งจอ */}
        <div className={`absolute inset-x-0 bottom-0 md:inset-x-auto md:bottom-auto md:top-18 md:right-0 md:h-full bg-slate-900/95 text-white flex flex-col justify-between text-xs font-sans overflow-y-auto transition-all duration-300 ease-in-out z-20 rounded-t-2xl md:rounded-none border-t md:border-t-0 border-slate-700 ${
          isSidebarOpen
            ? 'h-[75%] md:h-full w-full md:w-64 p-4 opacity-100'
            : 'h-0 md:w-0 p-0 opacity-0 pointer-events-none overflow-hidden'
        }`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-sky-400">
                <Shield className="w-4 h-4 text-sky-400 animate-pulse" />
                ค่าประเมินความเสี่ยงความโปร่งใส
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">
                  THA CHIN GIS
                </span>
              </div>
            </div>

            {selectedFactory ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2">
                  <div className={`p-1.5 rounded-lg shrink-0 ${selectedFactory.status === 'Violation' ? 'bg-rose-500/20 text-rose-400' : 'bg-sky-500/20 text-sky-400'}`}>
                    <FactoryIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-100">{selectedFactory.id}</h4>
                    <p className="text-[11px] text-slate-300 font-bold leading-tight mt-0.5">{selectedFactory.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{selectedFactory.industryType}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800 font-mono text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">ตำแหน่งที่พิกัด:</span>
                    <span>{selectedFactory.lat.toFixed(4)}°N, {selectedFactory.lon.toFixed(4)}°E</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">ปริมาณระบายจริง:</span>
                    <span className="font-semibold">{selectedFactory.actualQ.toLocaleString()} ลบ.ม./วัน</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">ปริมาณปล่อยสุทธิ:</span>
                    <span className="text-slate-400">{selectedFactory.allowedQ.toLocaleString()} ลบ.ม./วัน</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800/50 pt-1.5">
                    <span className="text-slate-400 font-sans">ค่า BOD นำปล่อย:</span>
                    <span className={selectedFactory.dischargeBOD > DIW_STANDARDS.FACTORY_BOD_MAX ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                      {selectedFactory.dischargeBOD} มก./ลิตร
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">ค่า COD นำปล่อย:</span>
                    <span className={selectedFactory.dischargeCOD > DIW_STANDARDS.FACTORY_COD_MAX ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                      {selectedFactory.dischargeCOD} มก./ลิตร
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">ค่าไฟฟ้าเหนี่ยวนำ (EC):</span>
                    <span className="text-slate-300">{selectedFactory.dischargeEC} µS/cm</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="text-[9px] text-slate-400 font-bold block">🚨 บัญชีสารทำละลายและวัตถุเจตนาอันตรายในรอบดำเนินการ:</span>
                  <ul className="text-[10px] text-slate-300 font-sans space-y-1 list-disc pl-3">
                    {selectedFactory.id === 'TTC01' && (<>
                      <li>โลหะหนักฟอกสี (โครเมียม, แคดเมียม)</li>
                      <li>สีย้อมสังเคราะห์โสมมก่อสารประกอบกลุ่มดีบุกก่อมะเร็ง</li>
                      <li>ซัลฟายด์และโซเดียมไฮดรอกไซด์ฟอกจาง</li>
                    </>)}
                    {selectedFactory.id === 'TTC02' && (<>
                      <li>โปรตีนอินทรีย์ลอยตัวเหนียวปนบูดสะสม</li>
                      <li>ไขมันอินทรีย์จากเศษอาหารและเนื้อวัตถุดิบหนา</li>
                      <li>ฟอสเฟตเข้มข้นจากคราบน้ำยาสารชำระล้างด่าง</li>
                    </>)}
                    {selectedFactory.id === 'TTC03' && (<>
                      <li>เบนซีน ไนโตร-เบนซีน และโทลูอีนตกค้างระดับพิษ</li>
                      <li>ตัวทำละลายและสารระเหยง่าย VOCs แตกตัวยากมาก</li>
                      <li>เม็ดสีเหลวและสีสังเคราะห์ทำลายสมดุลแสงธรรมชาติ</li>
                    </>)}
                    {selectedFactory.id === 'TTC04' && (<>
                      <li>สารกลุ่มคลอรีนไดออกซิน (Dioxins) ตกค้างรุนแรง</li>
                      <li>ลิกนินและเซลลูโลสสับเยื่อใยบดชุ่มน้ำขุ่น</li>
                      <li>โคลนเคมีและตะกอนกระดาษบดละเอียดคลุมก้นอ่าว</li>
                    </>)}
                    {selectedFactory.id === 'TTC05' && (<>
                      <li>คาร์โบไฮเดรตและเศษแป้งมันดิบค้างเร่งบูดเน่า</li>
                      <li>สารไนโตรเจนและพาราอินทรีย์เคโมชีวภาพ</li>
                      <li>แก๊สไข่เน่าละลายจากบ่อเก็บตกตะกอนสถิตย์</li>
                    </>)}
                  </ul>
                </div>

                <div className="mt-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    selectedFactory.status === 'Violation'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {selectedFactory.status === 'Violation' ? '🚨 ตรวจเจอมลพิษล้นเกณฑ์' : '🛡️ สอดคล้องตามเกณฑ์ข้อบังคับ'}
                  </span>
                </div>

                {/* หัวข้อพับเก็บ: จำลองข้อมูลโรงงาน (What-If) — ซ่อนไว้ก่อน กดเปิดจึงแสดงสไลเดอร์ */}
                <div className="border-t border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsWhatIfOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5 text-sky-400" />
                      จำลองข้อมูลโรงงาน (What-If)
                    </span>
                    {isWhatIfOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isWhatIfOpen && (
                    <div className="mt-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-3">
                      {/* Effluent BOD slider */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[9px] text-slate-400">
                          <span>ความเข้มข้น BOD น้ำทิ้ง:</span>
                          <span className={`font-mono font-bold ${
                            selectedFactory.dischargeBOD > DIW_STANDARDS.FACTORY_BOD_MAX ? 'text-rose-400' : 'text-emerald-400'
                          }`}>
                            {selectedFactory.dischargeBOD} มก./ลิตร
                          </span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={250}
                          step={5}
                          value={selectedFactory.dischargeBOD}
                          onChange={(e) => onFactoryParamChange(selectedFactory.id, 'dischargeBOD', parseInt(e.target.value))}
                          className="w-full h-1 accent-sky-500 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Effluent COD slider */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[9px] text-slate-400">
                          <span>ความเข้มข้น COD น้ำทิ้ง:</span>
                          <span className={`font-mono font-bold ${
                            selectedFactory.dischargeCOD > DIW_STANDARDS.FACTORY_COD_MAX ? 'text-rose-400' : 'text-emerald-400'
                          }`}>
                            {selectedFactory.dischargeCOD} มก./ลิตร
                          </span>
                        </div>
                        <input
                          type="range"
                          min={20}
                          max={800}
                          step={10}
                          value={selectedFactory.dischargeCOD}
                          onChange={(e) => onFactoryParamChange(selectedFactory.id, 'dischargeCOD', parseInt(e.target.value))}
                          className="w-full h-1 accent-sky-500 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Effluent Q slider */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[9px] text-slate-400">
                          <span>ปริมาตรปล่อยน้ำเสีย:</span>
                          <span className="font-mono font-bold text-slate-200">
                            {selectedFactory.actualQ.toLocaleString()} ลบ.ม./วัน
                          </span>
                        </div>
                        <input
                          type="range"
                          min={100}
                          max={10000}
                          step={100}
                          value={selectedFactory.actualQ}
                          onChange={(e) => onFactoryParamChange(selectedFactory.id, 'actualQ', parseInt(e.target.value))}
                          className="w-full h-1 accent-sky-500 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

            ) : selectedCheckpoint ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2">
                  <div className={`p-1.5 rounded-lg shrink-0 ${
                    selectedCheckpointEval?.isViolating ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-100">{selectedCheckpoint.id}</h4>
                    <p className="text-[11px] text-slate-300 font-bold leading-tight mt-0.5">{selectedCheckpoint.name}</p>
                  </div>
                </div>

                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  selectedCheckpointEval?.isViolating
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {selectedCheckpointEval?.isViolating ? '🚨 ค่าเกินเกณฑ์มาตรฐาน' : '🛡️ ปกติ ตามเกณฑ์'}
                </span>

                <div className="space-y-3">
                  <div className="space-y-2 pt-1 border-t border-slate-800 font-mono text-[11px] text-slate-350">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">ตำแหน่งที่พิกัด:</span>
                      <span className="text-slate-300">{selectedCheckpoint.lat.toFixed(4)}°N, {selectedCheckpoint.lon.toFixed(4)}°E</span>
                    </div>
                    {selectedCheckpointReading ? (
                      <>
                        <div className="flex justify-between border-t border-slate-800/50 pt-1.5">
                          <span className="text-slate-500 font-sans">pH:</span>
                          <span className="text-slate-200 font-bold">
                            {selectedCheckpointReading.values.pH ?? '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-sans">DO (ออกซิเจนละลายน้ำ):</span>
                          <span className="text-slate-200 font-bold">
                            {selectedCheckpointReading.values.DO ?? '—'} มก./ลิตร
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-sans">ค่านำไฟฟ้าแม่น้ำ (EC):</span>
                          <span className="text-slate-200 font-bold">
                            {selectedCheckpointReading.values.EC ?? '—'} µS/cm
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-sans">อุณหภูมิ (Temp):</span>
                          <span className="text-slate-200 font-bold">
                            {selectedCheckpointReading.values.Temp ?? '—'} °C
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-500 pt-1 border-t border-slate-800/50">
                          เวลาที่บันทึกจริง: {selectedCheckpointReading.timestamp.replace('T', ' ')}
                        </div>
                      </>
                    ) : (
                      <p className="text-[10px] text-slate-500 pt-1.5 border-t border-slate-800/50">
                        ไม่มีข้อมูลบันทึกในช่วงวันที่/เวลาที่เลือกไว้บนแดชบอร์ด
                      </p>
                    )}
                  </div>

                  {selectedCheckpointEval && selectedCheckpointEval.reasons.length > 0 && (
                    <div className="bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/50 space-y-1">
                      <span className="text-[10px] text-rose-300 font-extrabold flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        เหตุผลที่เกินเกณฑ์:
                      </span>
                      <ul className="text-[10px] text-rose-200/90 leading-relaxed font-sans list-disc pl-3 space-y-0.5">
                        {selectedCheckpointEval.reasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-[10px] text-slate-400 font-sans">
                    <div className="flex gap-1 items-start">
                      <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>
                        เกณฑ์: DO &ge; 2.0 มก./ลิตร, pH 6.5-8.5, อุณหภูมิไม่เกิน 35°C — EC ไม่ประเมินที่นครชัยศรี/กระทุ่มแบน เนื่องจากมีน้ำเค็มหนุนตามธรรมชาติ ค่าที่แสดงมาจากไฟล์ข้อมูลย้อนหลังจริง เปลี่ยนวันที่/เวลาได้ที่ตารางจุดตรวจด้านล่างแดชบอร์ด
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-center text-slate-500">
                <HelpCircle className="w-8 h-8 opacity-40 mb-2 animate-pulse" />
                <p className="text-[11px] leading-relaxed">คลิกที่จุดพิกัดโรงงาน หรือจุดคัดตรวจน้ำธรรมชาติ เพื่อแสดงประวัติโทรมาตรวิเคราะห์ทางไฟฟ้าสารเจือปน</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 space-y-1 font-mono">
            <div className="flex items-center gap-1.5 text-slate-400 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              แอปพิกัดและข้อมูลเชื่อมต่อออนไลน์
            </div>
            <p>Projection: WGS 84 / UTM zone 47N</p>
          </div>
        </div>

        {/* Edge tab ฝั่งขวา — เปิด/ปิดแผงข้อมูล จุดควบคุมเดียวเหมือนฝั่งซ้าย อยู่นอกแผงเสมอ ไม่โดนแผงบังตอนเปิด */}
        <button
          type="button"
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          className={`hidden md:flex items-center justify-center absolute top-1/2 -translate-y-1/2 z-30 w-5 h-14 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-sky-400 transition-all duration-300 ease-in-out rounded-l-lg ${
            isSidebarOpen ? 'right-64' : 'right-0'
          }`}
          title={isSidebarOpen ? 'ซ่อนแผงข้อมูล' : 'แสดงแผงข้อมูล'}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${isSidebarOpen ? '' : 'rotate-180'}`} />
        </button>
        <button
          type="button"
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          className={`flex md:hidden items-center justify-center absolute left-1/2 -translate-x-1/2 z-30 w-14 h-5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-sky-400 transition-all duration-300 ease-in-out rounded-t-lg ${
            isSidebarOpen ? 'bottom-[75%]' : 'bottom-0'
          }`}
          title={isSidebarOpen ? 'ซ่อนแผงข้อมูล' : 'แสดงแผงข้อมูล'}
        >
          <ChevronUp className={`w-3.5 h-3.5 transition-transform duration-300 ${isSidebarOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
}
