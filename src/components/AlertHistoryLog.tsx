import React, { useState } from 'react';
import { 
  Search, 
  Trash2, 
  FileSpreadsheet, 
  Clock, 
  AlertTriangle, 
  ShieldAlert,
  CheckCircle,
  HelpCircle,
  Filter
} from 'lucide-react';
import { DIW_STANDARDS } from '../data';
import { Factory, Checkpoint } from '../types';

export interface AlertLogEntry {
  id: string;
  timestamp: string;
  sourceId: string;
  sourceName: string;
  type: 'factory' | 'river';
  parameter: string;
  value: string | number;
  limit: number;
  status: 'critical' | 'warning' | 'safe';
  details: string;
}

interface AlertHistoryLogProps {
  factories: Factory[];
  checkpoints: Checkpoint[];
  currentScenarioName: string;
  currentScenarioId: number;
}

// 1. Pre-populated official historical logs from past incidents (June 2026 / May 2026)
const INITIAL_HISTORICAL_LOGS: AlertLogEntry[] = [
  {
    id: 'AL-001',
    timestamp: '2569-06-08 08:00:15',
    sourceId: 'TTC02',
    sourceName: 'บจก. แปรรูปและบรรจุอาหารกระป๋อง ท่าจีน',
    type: 'factory',
    parameter: 'BOD',
    value: 220,
    limit: DIW_STANDARDS.FACTORY_BOD_MAX,
    status: 'critical',
    details: 'ตรวจพบน้ำทิ้งโรงงานอุตสาหกรรมปนเปื้อนสารอินทรีย์เคมีเข้มข้นจัดละเลงสู่สภาพแวดล้อมแม่น้ำท่าจีน เกณฑ์สูงสุดห้ามเกิน 20 มก./ลิตร',
  },
  {
    id: 'AL-002',
    timestamp: '2569-06-08 08:00:15',
    sourceId: 'TTC02',
    sourceName: 'บจก. แปรรูปและบรรจุอาหารกระป๋อง ท่าจีน',
    type: 'factory',
    parameter: 'COD',
    value: 680,
    limit: DIW_STANDARDS.FACTORY_COD_MAX,
    status: 'critical',
    details: 'ตรวจพบค่าน้ำเสียทางเคมีพุ่งเกิน 5 เท่าของเส้นมาตรฐานสูงสุดที่กำหนดไว้ไม่เกิน 120 มก./ลิตร',
  },
  {
    id: 'AL-003',
    timestamp: '2569-06-05 14:30:22',
    sourceId: 'CP03',
    sourceName: 'CP03 - ปลายลุ่มแม่น้ำท่าจีน (สามพราน)',
    type: 'river',
    parameter: 'Fecal Coliform',
    value: 16000,
    limit: DIW_STANDARDS.RIVER_FECAL_MAX,
    status: 'warning',
    details: 'ค่าแบคทีเรียสิ่งปฏิกูลในเขตเทศบาลปลายแม่น้ำสูงเกินเกณฑ์ความปลอดภัยสำหรับอุปโภค (ไม่เกิน 4,000 MPN)',
  },
  {
    id: 'AL-004',
    timestamp: '2569-06-03 10:00:10',
    sourceId: 'CP03',
    sourceName: 'CP03 - ปลายลุ่มแม่น้ำท่าจีน (สามพราน)',
    type: 'river',
    parameter: 'Nitrogen',
    value: 14.0,
    limit: DIW_STANDARDS.RIVER_NITROGEN_MAX,
    status: 'warning',
    details: 'ตรวจพบการสะสมพัดพาของปุ๋ยเคมีอุดมสารอาหารไนโตรเจนจากแปลงนาเกษตรกรรมตอนกลางสู่จุดตรวจวัดปลายแม่น้ำ',
  },
  {
    id: 'AL-005',
    timestamp: '2569-06-01 11:00:05',
    sourceId: 'CP03',
    sourceName: 'CP03 - ปลายลุ่มแม่น้ำท่าจีน (สามพราน)',
    type: 'river',
    parameter: 'EC (ค่านำไฟฟ้า)',
    value: 390,
    limit: 300,
    status: 'warning',
    details: 'สัญญานค่านำพาไฟฟ้าชะเกลือดินในแม่น้ำเพิ่มขึ้นขีดภัยแล้ง น้ำไหลหนุนเฉลี่ยพ้น 10,000 ลบ.ม./วัน อัตราเจือจางต่ำขีดสุด',
  },
  {
    id: 'AL-006',
    timestamp: '2569-05-18 11:45:10',
    sourceId: 'TTC03',
    sourceName: 'โรงงานสารทำละลายและสีอุตสาหกรรมสยาม',
    type: 'factory',
    parameter: 'COD',
    value: 340,
    limit: DIW_STANDARDS.FACTORY_COD_MAX,
    status: 'critical',
    details: 'สารทำความสะอาดสารทำละลายอินทรีย์ล้นจากขั้นพักบำบัดน้ำเสียกระทันหัน แจ้งวิกฤตระบายพ้นพรรณจำกัดสูงสุด',
  },
  {
    id: 'AL-007',
    timestamp: '2569-05-15 15:20:00',
    sourceId: 'TTC01',
    sourceName: 'บจก. เคมีสิ่งทอและฟอกย้อม นครปฐม',
    type: 'factory',
    parameter: 'BOD',
    value: 48,
    limit: DIW_STANDARDS.FACTORY_BOD_MAX,
    status: 'critical',
    details: 'สีย้อมตกค้างและสารเคมีสะสมอินทรีย์หลุดรอบการตรวจจับ ปรับตักตวงเกณฑ์ลดอัตราเป็นปกติในสองชั่วโมงหลังเกิดปัญหา',
  }
];

export default function AlertHistoryLog({ 
  factories, 
  checkpoints, 
  currentScenarioName,
  currentScenarioId
}: AlertHistoryLogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'factory' | 'river'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'safe'>('all');

  // Compute live active simulation alerts based on CURRENT state of sliders
  const liveAlerts: AlertLogEntry[] = [];
  const nowStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const todayLabel = `วันนี้ (จำลองเวลาจริง ${nowStr})`;

  factories.forEach(f => {
    const isBODViolating = f.dischargeBOD > DIW_STANDARDS.FACTORY_BOD_MAX;
    const isCODViolating = f.dischargeCOD > DIW_STANDARDS.FACTORY_COD_MAX;

    if (isBODViolating) {
      liveAlerts.push({
        id: `LIVE-${f.id}-BOD`,
        timestamp: todayLabel,
        sourceId: f.id,
        sourceName: f.name,
        type: 'factory',
        parameter: 'BOD น้ำทิ้ง',
        value: f.dischargeBOD,
        limit: DIW_STANDARDS.FACTORY_BOD_MAX,
        status: 'critical',
        details: `⚠️ โรงงาน ${f.id} จงใจหรือขัดข้องปล่อยค่าอินทรีย์ปนเปื้อน BOD ${f.dischargeBOD} มก./ลิตร (มาตรฐานสูงสุดโรงงานห้ามเกิน ${DIW_STANDARDS.FACTORY_BOD_MAX} มก./ลิตร)`
      });
    }
    if (isCODViolating) {
      liveAlerts.push({
        id: `LIVE-${f.id}-COD`,
        timestamp: todayLabel,
        sourceId: f.id,
        sourceName: f.name,
        type: 'factory',
        parameter: 'COD น้ำทิ้ง',
        value: f.dischargeCOD,
        limit: DIW_STANDARDS.FACTORY_COD_MAX,
        status: 'critical',
        details: `⚠️ ตรวจพบโรงงาน ${f.id} ระบายค่าเคมีทำปฏิกิริยา COD ${f.dischargeCOD} มก./ลิตร ซึ่งเกินขีดความปลอดภัยกรมโรงงานฯ ที่ ${DIW_STANDARDS.FACTORY_COD_MAX} มก./ลิตร`
      });
    }
  });

  checkpoints.forEach(cp => {
    const isBODViolating = cp.bod > DIW_STANDARDS.RIVER_BOD_MAX;
    const isFecalViolating = cp.fecalColiform > DIW_STANDARDS.RIVER_FECAL_MAX;
    const isNitrogenViolating = cp.nitrogen > DIW_STANDARDS.RIVER_NITROGEN_MAX;

    if (isBODViolating && cp.id !== 'CP01') {
      liveAlerts.push({
        id: `LIVE-${cp.id}-BOD`,
        timestamp: todayLabel,
        sourceId: cp.id,
        sourceName: cp.name,
        type: 'river',
        parameter: 'BOD ลำน้ำ',
        value: parseFloat(cp.bod.toFixed(2)),
        limit: DIW_STANDARDS.RIVER_BOD_MAX,
        status: 'warning',
        details: `🌊 ดัชนีความต้องการออกซิเจนชีวภาพที่สถานี ${cp.id} สูงขึ้นพ้นขีดจำกัดประเภทที่ 3 สภาพแวดล้อมเสื่อมโทรม`
      });
    }
    if (isFecalViolating) {
      liveAlerts.push({
        id: `LIVE-${cp.id}-FECAL`,
        timestamp: todayLabel,
        sourceId: cp.id,
        sourceName: cp.name,
        type: 'river',
        parameter: 'แบคทีเรีย Fecal',
        value: cp.fecalColiform,
        limit: DIW_STANDARDS.RIVER_FECAL_MAX,
        status: 'warning',
        details: `🦠 ตรวจพบการรั่วไหลสิ่งปนเปื้อนคอหอยสิ่งสุขาภิบาลชุมชนสูงขีดปลอดภัยที่สะสม ${cp.fecalColiform.toLocaleString()} MPN`
      });
    }
    if (isNitrogenViolating) {
      liveAlerts.push({
        id: `LIVE-${cp.id}-NITROGEN`,
        timestamp: todayLabel,
        sourceId: cp.id,
        sourceName: cp.name,
        type: 'river',
        parameter: 'ไนโตรเจนอนินทรีย์',
        value: cp.nitrogen,
        limit: DIW_STANDARDS.RIVER_NITROGEN_MAX,
        status: 'warning',
        details: `🌾 สารเพาะปลูกชะช้างสูงล้น ตรวจประเมินเจอปุ๋ยไนโตรเจนที่ผิวลุ่มน้ำสูง ${cp.nitrogen.toFixed(2)} มก./ลิตร`
      });
    }
  });

  // Combine official historical database with user active simulation live alerts
  const combinedLogs = [...liveAlerts, ...INITIAL_HISTORICAL_LOGS];

  // Apply filters
  const filteredLogs = combinedLogs.filter(log => {
    // 1. Search term (case insensitive search for name, detail, parameter)
    const matchesSearch = 
      log.sourceName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.sourceId.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.parameter.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.details.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Type filter
    const matchesType = typeFilter === 'all' || log.type === typeFilter;

    // 3. Severity filter
    const matchesSeverity = severityFilter === 'all' || log.status === severityFilter;

    return matchesSearch && matchesType && matchesSeverity;
  });

  const exportAsJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `diw-tha-chin-alerts-${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div id="alert-history-log-panel" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      {/* Header Panel styling with deep elegant Navy/Charcoal layout */}
      <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] text-slate-300 mt-0.5">
            สืบค้นข้อมูลบันทึกย้อนหลัง (Incident Logs) เปรียบเทียบตามช่วงเวลา ชลศาสตร์ และการตั้งกระทู้จำลองตรวจสอบเกณฑ์
          </p>
        </div>

        {/* Info stats pill */}
        <div className="flex gap-2 text-[10px] items-center">
          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold px-2.5 py-1 rounded-lg">
            ตรวจพบล่าสุดวันนี้: {liveAlerts.length} รายการเตือนจำลองถิ่น
          </span>
          <span className="bg-slate-700 text-slate-300 border border-slate-650 font-mono px-2 py-1 rounded-lg">
            Scenario {currentScenarioId}
          </span>
        </div>
      </div>

      {/* Filter and Control Toolbar */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[200px] w-full md:w-auto">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="ค้นหารหัสโรงงาน, พารามิเตอร์ หรือโรคคัดกรอง..."
              className="pl-8 pr-3 py-1.5 w-full bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Type dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500"><Filter className="w-3 h-3 inline mr-0.5" />ประเภท:</span>
            <select
              className="bg-white border border-slate-300 rounded-lg py-1 px-2 focus:outline-none text-slate-700"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="all">ทั้งหมด (โรงงาน & แม่น้ำ)</option>
              <option value="factory">กลุ่มอ่างโรงงานอุตสาหกรรมเท่านั้น</option>
              <option value="river">สถานีคัดตรวจจุดวัดลุ่มน้ำแม่น้ำ</option>
            </select>
          </div>

          {/* Severity filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">ระดับระดับเตือนภัย:</span>
            <select
              className="bg-white border border-slate-300 rounded-lg py-1 px-2 focus:outline-none text-slate-700"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
            >
              <option value="all">ทุกพิกัดเสี่ยงภัย</option>
              <option value="critical">🚨 ฝ่าฝืนกฏเกณฑ์ (วิกฤต)</option>
              <option value="warning">⚠️ เฝ้าระวังสิ่งปฏิกูล/เกษตรกรรม</option>
            </select>
          </div>
        </div>

        {/* Tools panel */}
        <button
          onClick={exportAsJSON}
          className="bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-300 rounded-lg py-1.5 px-3 flex items-center justify-center gap-1 shrink-0 select-none transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>ดึงรายงานบันทึก .JSON</span>
        </button>
      </div>

      {/* Main Alert Records List View */}
      <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="font-bold text-slate-600 text-xs">ไม่พบรายการแจ้งเตือนที่ตรงกับเงื่อนไขการค้นหาของคุณ</p>
            <p className="text-[10px] text-slate-400">พารามิเตอร์คุณภาพน้ำ ณ ปัจจุบันจัดอยู่ภายใต้ขีดจำกัดปลอดภัยหรือการบีบตัวกรองแสดงพิกัดคลีน</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isLive = log.id.startsWith('LIVE');
            const isCritical = log.status === 'critical';

            return (
              <div 
                key={log.id} 
                className={`p-4 transition-colors flex items-start justify-between gap-3 ${
                  isLive ? 'bg-amber-50/20 hover:bg-amber-50/40 border-l-4 border-l-orange-500' : 'hover:bg-slate-50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Timestamp badge */}
                    <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      {log.timestamp}
                    </span>

                    {/* Alert ID badge */}
                    <span className="text-[9px] font-mono font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded leading-none">
                      {log.id}
                    </span>

                    {/* Entity/Source type badge */}
                    <span className={`text-[9px] font-bold px-1.5 rounded uppercase font-sans ${
                      log.type === 'factory' 
                        ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}>
                      {log.type === 'factory' ? '🏭 อุตสาหกรรม' : '🌊 แม่น้ำขุมกั้น'}
                    </span>

                    {/* Current parameter being warned about */}
                    <span className="bg-slate-900 text-slate-100 font-mono font-bold text-[9px] px-1.5 py-0.2 rounded-md">
                      {log.parameter}
                    </span>

                    {/* Active Live tag */}
                    {isLive && (
                      <span className="bg-rose-500 text-white font-extrabold text-[8.5px] px-2 rounded-full shadow-sm animate-pulse tracking-wide uppercase font-sans">
                        Live Simulation Alert
                      </span>
                    )}

                    {/* Current Scenario ID indicators to track exactly what scenario was active */}
                    {!isLive && log.id === 'AL-001' && (
                      <span className="bg-slate-100 text-slate-500 text-[8px] font-sans px-1.5 py-0.2 rounded border border-slate-200">
                        เกิดในช่วง: แฟ้มประวัติ #1 (อุตสาหกรรมระบายเกณฑ์)
                      </span>
                    )}
                    {!isLive && log.id === 'AL-003' && (
                      <span className="bg-slate-100 text-slate-500 text-[8px] font-sans px-1.5 py-0.2 rounded border border-slate-200">
                        เกิดในช่วง: แฟ้มประวัติ #2 (สภาวะเศษชุมชนโสโครก)
                      </span>
                    )}
                    {!isLive && log.id === 'AL-004' && (
                      <span className="bg-slate-100 text-slate-500 text-[8px] font-sans px-1.5 py-0.2 rounded border border-slate-200">
                        เกิดในช่วง: แฟ้มประวัติ #3 (ปุ๋ยเคมีเศษของไหล)
                      </span>
                    )}
                  </div>

                  {/* Header title/source name */}
                  <h4 className="font-bold text-slate-900 text-xs">
                    {log.sourceId} - {log.sourceName}
                  </h4>

                  {/* Details paragraph */}
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {log.details}
                  </p>
                </div>

                {/* Right side warning indicators */}
                <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                  {/* Status Indicator */}
                  <div className="flex items-center gap-1 text-slate-800">
                    {isCritical ? (
                      <span className="flex items-center gap-1 font-bold text-[10px] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg leading-none">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        ระเบียบฝ่าฝืนวิกฤต
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-semibold text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg leading-none">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        สภาวะเฝ้าระวังลุ่มน้ำ
                      </span>
                    )}
                  </div>

                  {/* Chemical detail comparison block */}
                  <div className="bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/80 text-[10px] font-mono leading-tight">
                    <span className="text-slate-400 block text-[8px] text-right">ค่าวิเคราะห์จริง:</span>
                    <span className={`font-black block text-right text-[11px] ${isCritical ? 'text-rose-600' : 'text-amber-600'}`}>
                      {log.value} มก./ล.
                    </span>
                    <span className="text-slate-400 block text-[8px] text-right mt-0.5">พิกัดควบคุม:</span>
                    <span className="font-bold block text-right text-slate-600">ไม่เกิน {log.limit} มก./ล.</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Audit Guide footer */}
      <div className="bg-slate-50 p-3.5 border-t border-slate-150 text-[10.5px] text-slate-500 flex items-center gap-2">
        <HelpCircle className="w-4 h-4 text-blue-500 shrink-0" />
        <span>
          <strong>ข้อแนะนำทางกฎหมาย:</strong> รายการประวัติข้างต้นครอบคลุมบันทึกตรวจวัดน้ำทิ้งที่เป็นหลักฐานอ้างอิงทางกฎหมายได้ ทั้งนี้ ท่านสามารถจำลองสถานการณ์ต่างๆ เพื่อตรวจสอบสภาพเจือจางน้ำทิ้ง ณ พิกัดเป้าหมายแบบเรียลไทม์ได้ทันที
        </span>
      </div>
    </div>
  );
}
