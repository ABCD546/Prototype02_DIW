import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Trash2, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { FactoryImportRecord, StationImportRecord } from '../types';

interface Props {
  onImportFactory: (records: FactoryImportRecord[]) => void;
  onImportStation: (records: StationImportRecord[]) => void;
  onClearFactoryData: () => void;
  factoryRecordCount: number;
}

const FACTORY_COLUMNS = ['factory_id', 'name', 'industry_type', 'latitude', 'longitude', 'timestamp', 'pH', 'BOD', 'COD', 'TSS', 'TDS'];
type UploadKind = 'factory' | 'station';
type StationUploadKind = 'automatic' | 'manual';

const normalized = (value: unknown) => String(value ?? '').trim();
const key = (value: unknown) => normalized(value).toLowerCase();
const STATION_HEADER_ALIASES: Record<string, string> = {
  'station name': 'station name', station: 'station name', station_name: 'station name', stationname: 'station name',
  'ชื่อสถานี': 'station name', 'สถานี': 'station name', 'จุดตรวจวัด': 'station name',
  'station code': 'station code', station_code: 'station code', stationcode: 'station code', code: 'station code',
  'รหัสสถานี': 'station code', 'รหัสจุดตรวจวัด': 'station code',
  latitude: 'latitude', lat: 'latitude', y: 'latitude', 'ละติจูด': 'latitude',
  longitude: 'longitude', lon: 'longitude', long: 'longitude', lng: 'longitude', x: 'longitude', 'ลองจิจูด': 'longitude',
  timestamp: 'timestamp', datetime: 'timestamp', date_time: 'timestamp', 'date time': 'timestamp', date: 'timestamp',
  'วันเวลา': 'timestamp', 'วันที่เวลา': 'timestamp', 'วันที่/เวลา': 'timestamp', 'วันที่': 'timestamp', 'วันที่บันทึก': 'timestamp',
  time: 'record time', 'เวลาบันทึก': 'record time', 'เวลา': 'record time',
  ph: 'ph', 'p.h.': 'ph', 'ความเป็นกรดด่าง': 'ph',
  do: 'do', 'do ล่าสุด': 'do', 'do (mg/l)': 'do', 'dissolved oxygen': 'do', dissolved_oxygen: 'do', 'ออกซิเจนละลายน้ำ': 'do',
  'do(mg/l)': 'do',
  ec: 'ec', conductivity: 'ec', 'electrical conductivity': 'ec', 'ค่าการนำไฟฟ้า': 'ec', 'cond(μs)': 'ec', 'cond(µs)': 'ec',
  temp: 'temp', temperature: 'temp', 'water temperature': 'temp', 'อุณหภูมิ': 'temp', 'temp(w)': 'temp',
};
const canonicalHeader = (value: unknown, kind: UploadKind) => {
  const header = key(value);
  return kind === 'station' ? (STATION_HEADER_ALIASES[header] ?? header) : header;
};

function rowsFromCsv(text: string): unknown[][] {
  return XLSX.utils.sheet_to_json(XLSX.read(text.replace(/^\uFEFF/, ''), { type: 'string' }).Sheets.Sheet1, { header: 1, raw: false });
}

function parseThaiDate(value: unknown) {
  const raw = normalized(value);
  const match = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  const thaiMatch = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (thaiMatch) {
    const year = Number(thaiMatch[3]) > 2400 ? Number(thaiMatch[3]) - 543 : Number(thaiMatch[3]);
    return `${year}-${thaiMatch[2].padStart(2, '0')}-${thaiMatch[1].padStart(2, '0')}T${(thaiMatch[4] || '00').padStart(2, '0')}:${thaiMatch[5] || '00'}:${thaiMatch[6] || '00'}`;
  }
  if (!match) {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) throw new Error(`วันที่เก็บตัวอย่างไม่ถูกต้อง: ${raw}`);
    return date.toISOString();
  }
  const year = Number(match[1]) > 2400 ? Number(match[1]) - 543 : Number(match[1]);
  const iso = `${year}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}T${(match[4] || '00').padStart(2, '0')}:${match[5] || '00'}:${match[6] || '00'}`;
  return iso;
}

function parseEReport(rows: unknown[][]): FactoryImportRecord[] | null {
  const headerRow = rows.findIndex((row) => row.some((value) => key(value) === 'รหัสปฏิบัติการ'));
  if (headerRow < 0) return null;
  const headers = rows[headerRow].map(key);
  const at = (row: unknown[], name: string) => normalized(row[headers.indexOf(key(name))]);
  const required = ['รหัสปฏิบัติการ', 'ชื่อโรงงาน/แหล่งเก็บนอกโรงงาน', 'เลขทะเบียนโรงงาน', 'วันที่เก็บตัวอย่าง', 'พารามิเตอร์', 'ค่าวิเคราะห์'];
  const missing = required.filter((name) => !headers.includes(key(name)));
  if (missing.length) throw new Error(`ไฟล์ E-Report ขาดคอลัมน์: ${missing.join(', ')}`);
  const parameterKey: Record<string, 'pH' | 'bod' | 'cod' | 'tss' | 'tds'> = {
    'ค่าความเป็นกรดและด่าง': 'pH', 'ค่าบีโอดี': 'bod', 'ค่าซีโอดี': 'cod',
    'ค่าของแข็งแขวนลอยทั้งหมด': 'tss', 'ค่าของแข็งละลายน้ำทั้งหมด': 'tds',
  };
  const groups = new Map<string, FactoryImportRecord>();
  rows.slice(headerRow + 1).filter((row) => row.some((value) => normalized(value))).forEach((row) => {
    const operationId = at(row, 'รหัสปฏิบัติการ');
    const registration = at(row, 'เลขทะเบียนโรงงาน').split(' ')[0];
    const timestamp = parseThaiDate(at(row, 'วันที่เก็บตัวอย่าง'));
    const groupKey = `${operationId}|${registration}|${timestamp}`;
    if (!groups.has(groupKey)) groups.set(groupKey, {
      factoryId: registration || operationId,
      name: at(row, 'ชื่อโรงงาน/แหล่งเก็บนอกโรงงาน') || registration,
      industryType: at(row, 'ประเภทตัวอย่าง') || 'ไม่ระบุ', lat: null, lon: null, timestamp,
      pH: null, bod: null, cod: null, tss: null, tds: null, operationId,
      province: at(row, 'สถานที่ตั้ง (จังหวัด)'), collectionPoint: at(row, 'จุดเก็บ'), extraParameters: {},
      testedParameters: [],
    });
    const record = groups.get(groupKey)!;
    const parameter = at(row, 'พารามิเตอร์');
    const rawValue = at(row, 'ค่าวิเคราะห์');
    const numeric = rawValue && rawValue !== '-' ? Number(rawValue.replace(/,/g, '')) : null;
    const value = numeric !== null && Number.isFinite(numeric) ? numeric : null;
    const mapped = parameterKey[parameter];
    if (parameter && !record.testedParameters!.includes(parameter)) record.testedParameters!.push(parameter);
    if (mapped) record[mapped] = value;
    else record.extraParameters![parameter] = value;
  });
  return [...groups.values()];
}

async function enrichFactoryLocations(records: FactoryImportRecord[]) {
  const eReportRecords = records.filter((record) => record.province && (record.lat == null || record.lon == null));
  if (!eReportRecords.length) return records;
  const indexResponse = await fetch('/data/factory-registry/index.json');
  if (!indexResponse.ok) return records;
  const index = await indexResponse.json() as { provinces: Record<string, string> };
  const provinceNames = [...new Set(eReportRecords.map((record) => record.province!))];
  const registries = new Map<string, Record<string, { name: string; industryType: string; lat: number | null; lon: number | null }>>();
  await Promise.all(provinceNames.map(async (province) => {
    const filename = index.provinces[province];
    if (!filename) return;
    const response = await fetch(`/data/factory-registry/${filename}`);
    if (response.ok) registries.set(province, await response.json());
  }));
  return records.map((record) => {
    const registry = record.province ? registries.get(record.province)?.[record.factoryId] : undefined;
    if (!registry) return record;
    return {
      ...record,
      name: record.name || registry.name,
      industryType: registry.industryType || record.industryType,
      lat: registry.lat,
      lon: registry.lon,
    };
  });
}

function assertNoFutureTimestamps(records: (FactoryImportRecord | StationImportRecord)[]) {
  const now = Date.now();
  const futureRecords = records.filter((record) => {
    const timestamp = new Date(record.timestamp).getTime();
    return Number.isFinite(timestamp) && timestamp > now;
  });
  if (!futureRecords.length) return;

  const examples = futureRecords.slice(0, 3).map((record) => {
    const id = 'factoryId' in record ? record.factoryId : (record.stationCode || record.stationName);
    const date = new Date(record.timestamp).toLocaleString('th-TH');
    return `${id} (${date})`;
  });
  const remaining = futureRecords.length - examples.length;
  throw new Error(
    `ไม่สามารถนำเข้าข้อมูลวันที่ในอนาคตได้ พบ ${futureRecords.length.toLocaleString()} รายการ: ${examples.join(', ')}${remaining > 0 ? ` และอีก ${remaining.toLocaleString()} รายการ` : ''}`
  );
}

export function parseRows(rows: unknown[][], kind: UploadKind): FactoryImportRecord[] | StationImportRecord[] {
  if (rows.length < 2) throw new Error('ไฟล์ยังไม่มีแถวข้อมูล กรุณาใส่ข้อมูลใต้หัวตารางอย่างน้อย 1 แถว');
  if (kind === 'factory') {
    const eReport = parseEReport(rows);
    if (eReport) return eReport;
  }
  const headers = rows[0].map((header) => canonicalHeader(header, kind));
  const stationType: StationUploadKind = rows[0].some((header) => /ครั้งที่\s*\(round\)|depth\(m\)|temp\(w\)/i.test(normalized(header)))
    ? 'manual'
    : 'automatic';
  const wanted = (kind === 'factory' ? FACTORY_COLUMNS : ['timestamp']).map(key);
  const missing = wanted.filter((column) => !headers.includes(column));
  if (missing.length) throw new Error(`ขาดคอลัมน์: ${missing.join(', ')}`);
  const index = Object.fromEntries(headers.map((header, i) => [header, i]));
  const textAt = (row: unknown[], column: string) => normalized(row[index[key(column)]]);
  const numberAt = (row: unknown[], column: string, rowNumber: number) => {
    const value = Number(textAt(row, column));
    if (!Number.isFinite(value)) throw new Error(`แถว ${rowNumber}: ${column} ต้องเป็นตัวเลข`);
    return value;
  };
  const optionalNumberAt = (row: unknown[], column: string, rowNumber: number) => {
    if (!(key(column) in index)) return null;
    const raw = textAt(row, column);
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`แถว ${rowNumber}: ${column} ต้องเป็นตัวเลขหรือเว้นว่าง`);
    return value;
  };
  const dateAt = (row: unknown[], rowNumber: number) => {
    const datePart = textAt(row, 'timestamp');
    const timePart = textAt(row, 'record time');
    if (!datePart) throw new Error(`แถว ${rowNumber}: timestamp ไม่ถูกต้อง`);
    try { return parseThaiDate(timePart && !datePart.includes(':') ? `${datePart} ${timePart}` : datePart); }
    catch { throw new Error(`แถว ${rowNumber}: timestamp ไม่ถูกต้อง`); }
  };

  const dataRows = rows.slice(1).filter((row) => row.some((value) => normalized(value)));
  if (kind === 'factory') return dataRows.map((row, i) => {
    const rowNumber = i + 2;
    const factoryId = textAt(row, 'factory_id');
    if (!factoryId) throw new Error(`แถว ${rowNumber}: ไม่มี factory_id`);
    return {
      factoryId, name: textAt(row, 'name') || factoryId,
      industryType: textAt(row, 'industry_type') || 'ไม่ระบุ',
      lat: numberAt(row, 'latitude', rowNumber), lon: numberAt(row, 'longitude', rowNumber),
      timestamp: dateAt(row, rowNumber), pH: numberAt(row, 'pH', rowNumber),
      bod: numberAt(row, 'BOD', rowNumber), cod: numberAt(row, 'COD', rowNumber),
      tss: numberAt(row, 'TSS', rowNumber), tds: numberAt(row, 'TDS', rowNumber),
    };
  });
  return dataRows.map((row, i) => {
    const rowNumber = i + 2;
    const stationName = textAt(row, 'Station name');
    const stationCode = textAt(row, 'Station code');
    if (!stationName && !stationCode) throw new Error(`แถว ${rowNumber}: ต้องมีชื่อสถานีหรือรหัสสถานี`);
    return {
      stationName: stationName || stationCode,
      stationCode: stationCode || undefined,
      stationType,
      lat: optionalNumberAt(row, 'latitude', rowNumber), lon: optionalNumberAt(row, 'longitude', rowNumber),
      timestamp: dateAt(row, rowNumber), pH: optionalNumberAt(row, 'pH', rowNumber),
      do: optionalNumberAt(row, 'DO', rowNumber), ec: optionalNumberAt(row, 'EC', rowNumber), temp: optionalNumberAt(row, 'Temp', rowNumber),
    };
  });
}

export default function FactoryDataUpload({ onImportFactory, onImportStation, onClearFactoryData, factoryRecordCount }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<UploadKind>('factory');
  const [stationUploadKind, setStationUploadKind] = useState<StationUploadKind>('automatic');
  const [records, setRecords] = useState<(FactoryImportRecord | StationImportRecord)[]>([]);
  const [error, setError] = useState<string | null>(null);

  const readFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      let rows: unknown[][];
      let parsed: FactoryImportRecord[] | StationImportRecord[];
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        const workbook = XLSX.read(await file.arrayBuffer());
        if (kind === 'station') {
          const parsedSheets: StationImportRecord[] = [];
          const errors: string[] = [];
          workbook.SheetNames.forEach((sheetName) => {
            const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false }) as unknown[][];
            try {
              parsedSheets.push(...parseRows(sheetRows, 'station') as StationImportRecord[]);
            } catch (error) {
              errors.push(error instanceof Error ? `${sheetName}: ${error.message}` : `${sheetName}: อ่านข้อมูลไม่สำเร็จ`);
            }
          });
          if (!parsedSheets.length) throw new Error(errors[0] || 'ไม่พบชีตข้อมูลสถานีที่รองรับ');
          parsed = parsedSheets;
        } else {
          rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false }) as unknown[][];
          parsed = parseRows(rows, kind);
        }
      } else {
        rows = rowsFromCsv(await file.text());
        parsed = parseRows(rows, kind);
      }
      assertNoFutureTimestamps(parsed);
      setRecords(kind === 'factory' ? await enrichFactoryLocations(parsed as FactoryImportRecord[]) : parsed);
    } catch (err) { setRecords([]); setError(err instanceof Error ? err.message : 'อ่านไฟล์ไม่สำเร็จ'); }
  };

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    if (kind === 'factory') {
      const columns = ['#', 'รหัสปฏิบัติการ', 'ประเภทตัวอย่าง', 'หน่วยงานผู้ยื่นคำร้อง', 'จุดเก็บ', 'ชื่อโรงงาน/แหล่งเก็บนอกโรงงาน', 'สถานที่ตั้ง (จังหวัด)', 'เลขทะเบียนโรงงาน', 'วันที่เก็บตัวอย่าง', 'พารามิเตอร์', 'ค่าวิเคราะห์', 'หน่วย'];
      const base = ['12-25690720-00001', 'น้ำเสีย', 'สำนักงานอุตสาหกรรมจังหวัดสมุทรสาคร', 'น้ำเสียบ่อสุดท้าย', 'บริษัท ตัวอย่างอุตสาหกรรม จำกัด', 'สมุทรสาคร', '00740000123456', '2569/07/20 09:00:00'];
      const parameters = [
        ['ค่าความเป็นกรดและด่าง', 7.2, ''],
        ['ค่าบีโอดี', 12, 'มิลลิกรัมต่อลิตร'],
        ['ค่าซีโอดี', 80, 'มิลลิกรัมต่อลิตร'],
        ['ค่าของแข็งแขวนลอยทั้งหมด', 24, 'มิลลิกรัมต่อลิตร'],
        ['ค่าของแข็งละลายน้ำทั้งหมด', 620, 'มิลลิกรัมต่อลิตร'],
      ];
      const rows = [
        ['E-Report | สรุปรายงานแยกตามรายการตรวจวัด'],
        columns,
        ...parameters.map((parameter, index) => [index + 1, ...base, ...parameter]),
      ];
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet['!cols'] = columns.map((column) => ({ wch: Math.max(14, column.length + 3) }));
      sheet['!autofilter'] = { ref: `A2:L${rows.length}` };
      XLSX.utils.book_append_sheet(workbook, sheet, 'E-Report โรงงาน');
    } else if (stationUploadKind === 'automatic') {
      const autoColumns = ['ลำดับ', 'ชื่อสถานี', 'รหัสสถานี', 'จังหวัด', 'ภาค', 'แหล่งน้ำ', 'วันที่บันทึก', 'เวลาบันทึก', 'Salinity', 'DO ล่าสุด', 'DO เฉลี่ย', 'สถานะ', 'BOD', 'COD', 'EC', 'NH4-N', 'pH', 'อุณหภูมิ'];
      const autoRows = [
        autoColumns,
        [1, 'สถานี สองพี่น้อง', '115', 'สุพรรณบุรี', 'ภาคกลาง', 'แม่น้ำท่าจีน', '22/07/2569', '09:00:00', '-', 7.37, 7.46, 'ดี', '-', '-', 350, '-', 7.2, 30.4],
      ];
      const autoSheet = XLSX.utils.aoa_to_sheet(autoRows);
      autoSheet['!cols'] = autoColumns.map((column) => ({ wch: Math.max(13, column.length + 3) }));
      XLSX.utils.book_append_sheet(workbook, autoSheet, 'สถานีอัตโนมัติ');
    } else {
      const manualColumns = ['No.', 'แม่น้ำ (River Name)', 'ครั้งที่ (Round)', 'Month', 'Station', 'Year', 'Date', 'Time', 'Depth(m)', 'Temp(a)', 'Temp(w)', 'pH', 'tur(NTU)', 'Cond(μS)', 'Sal(ppt)', 'DO(mg/l)', 'BOD(mg/l)', 'Total Coli(MPN/100ml)'];
      const manualRows = [
        manualColumns,
        [1, 'แม่น้ำท่าจีน', 1, 2, 'TC01', 2569, '11/02/2569', '09:00:00', 1.2, 31, 28.5, 7.37, 14.8, 176.2, 0, 6.97, 0.98, 4600],
      ];
      const manualSheet = XLSX.utils.aoa_to_sheet(manualRows);
      manualSheet['!cols'] = manualColumns.map((column) => ({ wch: Math.max(13, column.length + 3) }));
      XLSX.utils.book_append_sheet(workbook, manualSheet, 'จุดตรวจวัด');
    }
    XLSX.writeFile(workbook, kind === 'factory'
      ? 'แม่แบบข้อมูลโรงงาน.xlsx'
      : stationUploadKind === 'automatic'
        ? 'แม่แบบสถานีอัตโนมัติ.xlsx'
        : 'แม่แบบจุดตรวจวัด.xlsx');
  };

  const confirm = () => {
    if (kind === 'factory') onImportFactory(records as FactoryImportRecord[]);
    else onImportStation(records as StationImportRecord[]);
    setRecords([]); setOpen(false);
  };

  return <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <button type="button" onClick={() => setOpen((value) => !value)} className="w-full p-4 flex items-center justify-between text-left">
      <span className="flex items-center gap-2 font-bold text-sm text-slate-800"><Upload className="w-4 h-4 text-blue-600" />นำเข้าข้อมูลตรวจวัด</span>
      <span className="text-[10px] text-slate-500">Excel หรือ CSV · เพิ่มจุดใหม่และข้อมูลย้อนหลัง</span>
    </button>
    {open && <div className="border-t border-slate-200 p-4 space-y-4">
      <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-bold">
        <button type="button" onClick={() => { setKind('factory'); setRecords([]); setError(null); }} className={`px-3 py-2 rounded-md ${kind === 'factory' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>จุดตรวจโรงงาน</button>
        <button type="button" onClick={() => { setKind('station'); setRecords([]); setError(null); }} className={`px-3 py-2 rounded-md ${kind === 'station' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>สถานีและจุดตรวจวัด</button>
      </div>
      {kind === 'station' && <div className="inline-flex rounded-lg bg-sky-50 border border-sky-100 p-1 text-xs font-bold">
        <button type="button" onClick={() => { setStationUploadKind('automatic'); setRecords([]); setError(null); }} className={`px-3 py-2 rounded-md ${stationUploadKind === 'automatic' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>สถานีอัตโนมัติ</button>
        <button type="button" onClick={() => { setStationUploadKind('manual'); setRecords([]); setError(null); }} className={`px-3 py-2 rounded-md ${stationUploadKind === 'manual' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>จุดตรวจวัด</button>
      </div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={downloadTemplate} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />ดาวน์โหลดไฟล์ตัวอย่าง</button>
        <button type="button" onClick={() => inputRef.current?.click()} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" />เลือกไฟล์ Excel/CSV</button>
        {kind === 'factory' && factoryRecordCount > 0 && <button
          type="button"
          onClick={() => {
            if (window.confirm(`ลบข้อมูลโรงงานที่อัปโหลดไว้ ${factoryRecordCount.toLocaleString()} รายการ แล้วอัปโหลดใหม่ใช่หรือไม่?`)) {
              onClearFactoryData();
              setRecords([]);
              if (inputRef.current) inputRef.current.value = '';
            }
          }}
          className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 hover:bg-rose-100"
        >
          <Trash2 className="w-3.5 h-3.5" />ล้างข้อมูลโรงงานที่อัปโหลด ({factoryRecordCount.toLocaleString()})
        </button>}
        <input ref={inputRef} type="file" accept=".xlsx,.csv,.tsv" className="hidden" onChange={(e) => void readFile(e.target.files?.[0])} />
      </div>
      <p className="text-[11px] text-sky-700">
        {kind === 'factory'
          ? 'ไฟล์ตัวอย่างใช้โครงสร้าง E-Report แบบหนึ่งพารามิเตอร์ต่อหนึ่งแถว เหมือนรายงานจริงจากระบบ'
          : stationUploadKind === 'automatic'
            ? 'ไฟล์ตัวอย่างใช้หัวคอลัมน์ตรงกับไฟล์ข้อมูลคุณภาพน้ำอัตโนมัติ'
            : 'ไฟล์ตัวอย่างใช้หัวคอลัมน์ตรงกับไฟล์ข้อมูลจุดตรวจวัดภาคสนาม'}
      </p>
      <p className="text-[11px] text-slate-500">ข้อมูลที่ยืนยันนำเข้าจะเก็บในพื้นที่จัดเก็บของเว็บไซต์บนเบราว์เซอร์เครื่องนี้ ไม่ได้เขียนกลับลงไฟล์ Excel หรือไฟล์ในโปรเจกต์</p>
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void readFile(e.dataTransfer.files[0]); }} className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center text-xs text-slate-500">ลากไฟล์มาวางที่นี่ หรือกด “เลือกไฟล์ Excel/CSV”</div>
      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs flex gap-2"><X className="w-4 h-4 shrink-0" />{error}</div>}
      {records.length > 0 && <div className="space-y-3">
        <div className="text-xs font-bold text-emerald-700">ตรวจสอบผ่าน {records.length.toLocaleString()} แถว</div>
        {'factoryId' in records[0] && records.some((record) => record.lat == null || record.lon == null) && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">ไฟล์ E-Report ไม่มีพิกัด ระบบจะเก็บผลตรวจไว้ก่อน และจะสร้างหมุดเมื่อมีข้อมูลพิกัดที่จับคู่กับเลขทะเบียนโรงงาน</div>}
        <div className="overflow-auto border border-slate-200 rounded-lg"><table className="w-full text-[10px]"><thead className="bg-slate-50"><tr><th className="p-2 text-left">ชื่อ/รหัส</th><th className="p-2 text-left">วันที่/เวลา</th><th className="p-2">พิกัด</th><th className="p-2">pH</th></tr></thead><tbody>{records.slice(0, 5).map((record, i) => <tr key={i} className="border-t"><td className="p-2 font-bold">{'factoryId' in record ? record.factoryId : record.stationName}</td><td className="p-2">{record.timestamp.replace('T', ' ').slice(0, 16)}</td><td className="p-2 text-center">{record.lat == null || record.lon == null ? 'ยังไม่มีพิกัด' : `${record.lat.toFixed(4)}, ${record.lon.toFixed(4)}`}</td><td className="p-2 text-center">{record.pH ?? '—'}</td></tr>)}</tbody></table></div>
        <button type="button" onClick={confirm} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold">ยืนยันนำเข้าข้อมูล</button>
      </div>}
    </div>}
  </div>;
}
