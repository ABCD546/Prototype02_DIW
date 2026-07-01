/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Factory, Checkpoint } from '../types';
import { DIW_STANDARDS } from '../data';
import { calculateSourceAttribution } from '../utils';
import { 
  Info, 
  HelpCircle, 
  Radio, 
  Shield, 
  Factory as FactoryIcon, 
  MapPin, 
  Compass,
  AlertTriangle,
  Users,
  Sprout,
  FlameKindling,
  ClipboardList,
  AlertCircle
} from 'lucide-react';

interface InteractiveMapProps {
  factories: Factory[];
  checkpoints: Checkpoint[];
  selectedId: string | null;
  onSelectEntity: (id: string, type: 'factory' | 'checkpoint') => void;
}

export default function InteractiveMap({
  factories,
  checkpoints,
  selectedId,
  onSelectEntity,
}: InteractiveMapProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [cpTab, setCpTab] = useState<'stats' | 'risk'>('stats');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const selectedFactory   = factories.find((f) => f.id === selectedId);
  const selectedCheckpoint = checkpoints.find((cp) => cp.id === selectedId);

  // นับจำนวนพารามิเตอร์ที่เกินมาตรฐานของจุดตรวจที่เลือก: 1 ค่า = เฝ้าระวัง (เหลือง), 2 ค่าขึ้นไป = วิกฤต (แดง)
  const cpViolationFlags = selectedCheckpoint ? {
    bod: selectedCheckpoint.bod > DIW_STANDARDS.RIVER_BOD_MAX,
    cod: selectedCheckpoint.cod > DIW_STANDARDS.RIVER_COD_MAX,
    fecal: selectedCheckpoint.fecalColiform > DIW_STANDARDS.RIVER_FECAL_MAX,
    nitrogen: selectedCheckpoint.nitrogen > DIW_STANDARDS.RIVER_NITROGEN_MAX,
  } : null;
  const cpViolationCount = cpViolationFlags
    ? Object.values(cpViolationFlags).filter(Boolean).length
    : 0;
  const cpRiskLevel: 'safe' | 'warning' | 'critical' =
    cpViolationCount >= 2 ? 'critical' : cpViolationCount === 1 ? 'warning' : 'safe';

  // Reset tab เมื่อเปลี่ยน entity
  useEffect(() => {
    setCpTab('stats');
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
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSelectEntity]);

  // ส่ง markers ไปให้ iframe ทุกครั้งที่ข้อมูลเปลี่ยน
  useEffect(() => {
    if (!isMapReady || !iframeRef.current?.contentWindow) return;

    iframeRef.current.contentWindow.postMessage({
      type: 'UPDATE_MARKERS',
      factories,
      checkpoints,
      selectedId,
    }, '*');
  }, [isMapReady, factories, checkpoints, selectedId]);

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
        <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-200/60 w-fit">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-white shadow-xs" /> จุดคัดตรวจแม่น้ำ (ปลอดภัย)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block border border-white shadow-xs" /> จุดคัดตรวจ (เฝ้าระวัง 1 ค่า)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block border border-white shadow-xs" /> จุดคัดตรวจ (วิกฤต 2 ค่าขึ้นไป)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block border border-white shadow-xs" /> โรงงานผ่านเกณฑ์ปกติ
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block border border-white shadow-xs" /> โรงงานปล่อยมลพิษล้นเกณฑ์
          </span>
        </div>
      </div>

      {/* Map + Sidebar */}
      <div className="relative bg-slate-50 rounded-xl overflow-hidden border border-slate-250 shadow-inner flex flex-col md:flex-row" style={{ height: '860px' }}>

        {/* ปุ่มควบคุม 2 ปุ่ม — ยึดมุมขวาล่างของ map box เสมอ ไม่ขยับตามแถบ */}
        <div className="absolute bottom-3 right-3 z-30 flex flex-col gap-1.5 items-end">
          <button
            onClick={() => {
              if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage({ type: 'TOGGLE_SIDEBAR' }, '*');
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 text-white text-[11px] font-bold shadow-lg border border-slate-700 hover:bg-slate-800 transition-colors backdrop-blur-sm whitespace-nowrap"
            title="ย่อ/ขยายแผง Layer แผนที่"
          >
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            แผง Layer
          </button>
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 text-white text-[11px] font-bold shadow-lg border border-slate-700 hover:bg-slate-800 transition-colors backdrop-blur-sm whitespace-nowrap"
            title={isSidebarOpen ? 'ซ่อนแผงข้อมูล' : 'แสดงแผงข้อมูล'}
          >
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            {isSidebarOpen ? 'ซ่อนข้อมูล' : 'แสดงข้อมูล'}
          </button>
        </div>

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
          />
        </div>

        {/* Sidebar ขวา — ลอยทับแผนที่ ไม่ดันแถบ layer */}
        <div className={`absolute top-18 right-0 h-full bg-slate-900/95 text-white flex flex-col justify-between text-xs font-sans overflow-y-auto transition-all duration-300 ease-in-out z-20 ${
          isSidebarOpen
            ? 'w-64 p-4 opacity-100'
            : 'w-0 p-0 opacity-0 pointer-events-none overflow-hidden'
        }`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-sky-400">
                <Shield className="w-4 h-4 text-sky-400 animate-pulse" />
                ค่าประเมินความเสี่ยงความโปร่งใส
              </div>
              <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">
                THA CHIN GIS
              </span>
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
              </div>

            ) : selectedCheckpoint ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2">
                  <div className={`p-1.5 rounded-lg shrink-0 ${
                    cpRiskLevel === 'critical' ? 'bg-rose-500/20 text-rose-400'
                    : cpRiskLevel === 'warning' ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-100">{selectedCheckpoint.id}</h4>
                    <p className="text-[11px] text-slate-300 font-bold leading-tight mt-0.5">{selectedCheckpoint.name}</p>
                  </div>
                </div>

                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  cpRiskLevel === 'critical'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : cpRiskLevel === 'warning'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {cpRiskLevel === 'critical'
                    ? `🚨 วิกฤต — เกินมาตรฐาน ${cpViolationCount} ค่า`
                    : cpRiskLevel === 'warning'
                    ? '⚠️ เฝ้าระวัง — เกินมาตรฐาน 1 ค่า'
                    : '🛡️ ปลอดภัย ตามเกณฑ์ปกติ'}
                </span>

                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setCpTab('stats')}
                    className={`py-1.5 px-2 rounded font-bold text-[10px] transition-all flex items-center justify-center gap-1 ${
                      cpTab === 'stats' ? 'bg-slate-800 text-emerald-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    พารามิเตอร์ตรวจวัด
                  </button>
                  <button
                    onClick={() => setCpTab('risk')}
                    className={`py-1.5 px-2 rounded font-bold text-[10px] transition-all flex items-center justify-center gap-1 ${
                      cpTab === 'risk' ? 'bg-slate-800 text-amber-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    วิเคราะห์ต้นเหตุ (Attribution)
                  </button>
                </div>

                {cpTab === 'stats' ? (
                  <div className="space-y-3">
                    <div className="space-y-2 pt-1 border-t border-slate-800 font-mono text-[11px] text-slate-350">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">ตำแหน่งที่พิกัด:</span>
                        <span className="text-slate-300">{selectedCheckpoint.lat.toFixed(4)}°N, {selectedCheckpoint.lon.toFixed(4)}°E</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-800/50 pt-1.5">
                        <span className="text-slate-500 font-sans">ค่า BOD ในลำน้ำเฉลี่ย:</span>
                        <span className={cpViolationFlags?.bod ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                          {selectedCheckpoint.bod.toFixed(2)} มก./ลิตร
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">ค่า COD ในแม่น้ำเฉลี่ย:</span>
                        <span className={cpViolationFlags?.cod ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                          {selectedCheckpoint.cod.toFixed(2)} มก./ลิตร
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans font-bold text-amber-500">แบคทีเรียฟีคัล (Fecal):</span>
                        <span className={cpViolationFlags?.fecal ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                          {selectedCheckpoint.fecalColiform.toLocaleString()} MPN
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans text-teal-400">ไนโตรเจนสะสม (N):</span>
                        <span className={cpViolationFlags?.nitrogen ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                          {selectedCheckpoint.nitrogen.toFixed(2)} มก./ลิตร
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">ค่านำไฟฟ้าแม่น้ำ (EC):</span>
                        <span className="text-slate-350">{selectedCheckpoint.ec.toLocaleString()} µS/cm</span>
                      </div>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-[10px] text-slate-400 font-sans">
                      <div className="flex gap-1 items-start">
                        <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <span>
                          เกณฑ์เป้าหมายน้ำลุ่มท่าจีนประเภทที่ 3: BOD &le; {DIW_STANDARDS.RIVER_BOD_MAX} มก./ลิตร และปริมาณแบคทีเรียชีวภาพสะสมฟีคัล &le; {DIW_STANDARDS.RIVER_FECAL_MAX} MPN
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const attr = calculateSourceAttribution(
                      selectedCheckpoint.id,
                      selectedCheckpoint.bod,
                      selectedCheckpoint.cod,
                      selectedCheckpoint.fecalColiform,
                      selectedCheckpoint.nitrogen,
                      selectedCheckpoint.ec,
                      factories
                    );
                    return (
                      <div className="space-y-4">
                        <div className="space-y-2 border-b border-slate-800 pb-3">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">เปรียบเทียบสัดส่วนต้นเหตุที่ตกกระทบ:</span>
                          {[
                            { label: '🏭 ฝั่งอุตสาหกรรม (Factories)', prob: attr.factoryProb, colorClass: attr.factoryProb > 45 ? 'bg-rose-500' : 'bg-sky-500', textClass: 'text-sky-400', Icon: FactoryIcon },
                            { label: '🏘️ เทศบาลที่พักชุมชน (Sewage)',  prob: attr.residentialProb, colorClass: 'bg-amber-500',   textClass: 'text-amber-400',  Icon: Users },
                            { label: '🌾 แฝงดินเพาะปลูก (Agriculture)', prob: attr.agricultureProb, colorClass: 'bg-emerald-500', textClass: 'text-emerald-400', Icon: Sprout },
                          ].map(({ label, prob, colorClass, textClass, Icon }) => (
                            <div key={label} className="space-y-1">
                              <div className="flex justify-between text-[11px] font-medium leading-none">
                                <span className={`flex items-center gap-1 ${textClass}`}><Icon className={`w-3.5 h-3.5 ${textClass}`} />{label}</span>
                                <span className="font-bold text-slate-100">{prob}%</span>
                              </div>
                              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                                <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${prob}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                          <span className="text-[10px] text-slate-200 font-extrabold flex items-center gap-1">
                            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            {attr.dominantSource === 'factories'    && '🚨 ค่าน้ำชี้ชัดจากของเสียเคมีอุตสาหกรรม'}
                            {attr.dominantSource === 'residential'  && '🏘️ บ่งบอกปรกติสิ่งปฏิกูลจากสุขาภิบาลชุมชน'}
                            {attr.dominantSource === 'agriculture'  && '🌾 บ่งบอกชะล้างมวลปุ๋ยเคมีฝั่งรอบพืช'}
                            {attr.dominantSource === 'normal'       && '🟢 ระดับดัชนีภาพรวมคงคุณภาพปลอดภัยเป็นปกติ'}
                          </span>
                          <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                            {attr.dominantSource === 'factories'   && 'มีระดับ COD สูงสัมพัทธ์และกระแสเทนำไฟฟ้าที่เหนี่ยวนำข้ามระดับ บ่งชี้วัตถุน้ำเสียมาจากอุตสาหกรรมเคมีและน้ำล้างแบบเข้มข้น'}
                            {attr.dominantSource === 'residential' && 'ตรวจพบดัชนีแบคทีเรียชีวภาพฟีคัลโดดสูง ท่ามกลางศักยภาพการสลายตามธรรมชาติชี้สัญญาณปฏิกูลท่อเปิดเมืองทองและบ้านพักเป็นเอกเทศ'}
                            {attr.dominantSource === 'agriculture' && 'ตรวจพบสัดส่วนสารแร่ธาตุไนโตรเจนสะสมในดินทรายล้นกระโดด ชี้การชะล้างปุ๋ยและยาเร่งบำรุงพืชผักจากลานดินชุมชนภายนอก'}
                            {attr.dominantSource === 'normal'      && 'พารามิเตอร์ทางสิ่งแวดล้อมสถิติดำเนินการอยู่ในอัตราควบคุม สอดรับเกณฑ์มาตรฐานกองลุ่มแม่น้ำชั้นดีทั่วไป'}
                          </p>
                        </div>

                        {attr.factoriesRisk.length > 0 && (
                          <div className="space-y-2 border-t border-slate-800 pt-2.5">
                            <span className="text-[10px] font-black text-slate-300 flex items-center gap-1 uppercase block tracking-wider">
                              <FlameKindling className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                              อัตราภาระคดีล้นปล่อยโรงงานเหนือขอบน้ำ ({attr.factoriesRisk.length} โรง)
                            </span>
                            <div className="space-y-2 font-sans max-h-48 overflow-y-auto pr-1">
                              {attr.factoriesRisk.map((risk) => (
                                <div key={risk.factoryId} className="bg-slate-950 p-2 rounded-lg border border-slate-850 space-y-1.5 hover:border-slate-700 transition-colors">
                                  <div className="flex justify-between items-center">
                                    <span className="font-mono font-bold text-[11px] text-sky-400">
                                      {risk.factoryId} <span className="text-slate-400 font-sans font-medium text-[10px] truncate max-w-[120px] inline-block align-bottom">{risk.name}</span>
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black font-mono tracking-wider ${
                                      risk.riskScore > 75 ? 'bg-rose-950 text-rose-300 border border-rose-900'
                                        : risk.riskScore > 45 ? 'bg-amber-950/80 text-amber-300 border border-amber-900/40'
                                        : 'bg-blue-950 text-blue-300 border border-blue-900'
                                    }`}>
                                      {risk.riskScore}% RISK
                                    </span>
                                  </div>
                                  <div className="text-[9.5px] leading-tight text-slate-400 p-1 bg-slate-900 rounded font-mono">
                                    <strong className="text-slate-500 font-sans text-[8.5px] block font-bold">⚠️ วัตถุละลายเคมี/สารอันตรายประเภทหลัก:</strong>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {risk.substances.map((sub, i) => (
                                        <span key={i} className="bg-slate-950 rounded px-1.5 py-0.5 text-[8px] text-slate-350 border border-slate-800 inline-block font-sans font-bold leading-none">
                                          {sub}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  {risk.isViolating && (
                                    <span className="text-[8.5px] font-black font-sans uppercase text-rose-400 flex items-center gap-0.5 bg-rose-500/10 w-fit px-1.5 py-0.5 rounded border border-rose-500/20 animate-pulse">
                                      <AlertCircle className="w-3 h-3" />
                                      ตรวจพบค่าเคมีเกินกฎกระทรวง!
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
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
      </div>
    </div>
  );
}
