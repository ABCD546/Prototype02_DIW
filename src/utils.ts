/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Factory, Checkpoint, SimulationResult, SourceAttribution, AllowedDischarge } from './types';
import { DIW_STANDARDS } from './data';

// ─────────────────────────────────────────────────────────────────────────────
// CP_COORDS: พิกัดของจุดตรวจทั้งหมด (single source of truth — ใช้ร่วมกันทุกฟังก์ชัน
// ในไฟล์นี้ เดิมมีการ hardcode พิกัดซ้ำอยู่ทั้งใน simulateWaterNetwork และ
// calculateSourceAttribution แยกกัน ทำให้แก้ค่าที่เดียวไม่ครบ)
// ─────────────────────────────────────────────────────────────────────────────
export const CP_COORDS: Record<string, { lat: number; lon: number }> = {
  'CP01': { lat: 14.1566,  lon: 100.1276  },
  'CP02': { lat: 14.0159,  lon: 100.1804  },
  'CP03': { lat: 13.8018,  lon: 100.1879  },
  'CP04': { lat: 13.67817, lon: 100.25647 },
  'CP05': { lat: 13.78254, lon: 100.24356 },
  'CP06': { lat: 13.7219,  lon: 100.2069  },
  'CP07': { lat: 13.6672,  lon: 100.2443  },
  'CP08': { lat: 13.5606,  lon: 100.2743  },
  'CP09': { lat: 13.58583, lon: 100.23025 },
  'CP10': { lat: 13.51897, lon: 100.26695 },
};

// ─────────────────────────────────────────────────────────────────────────────
// CP_FACTORY_ZONES: โรงงานที่อยู่ "ต้นน้ำโดยตรง" ของจุดตรวจแต่ละจุด เรียงตามลำดับ
// การไหลจริง (ต้นน้ำ→ปลายน้ำ) — ดึงมาจาก routing chain เดียวกันกับที่ใช้ใน
// simulateWaterNetwork ด้านล่าง เพื่อให้ทั้งไฟล์อ้างอิง "โรงงานของ CP ไหน"
// จากที่เดียวกันเสมอ ไม่ใช่คำนวณ radius/lat ซ้ำที่อาจให้ผลทับซ้อนกันระหว่าง CP
//
// CP01, CP02 ไม่มีโรงงานอยู่ในช่วงต้นน้ำของตัวเอง (ยังไม่ผ่านโรงงานใดเลย)
// ─────────────────────────────────────────────────────────────────────────────
export const CP_FACTORY_ZONES: Record<string, string[]> = {
  'CP01': [],
  'CP02': [],
  'CP03': ['TTC23', 'TTC22'],
  'CP05': ['TTC21', 'TTC20', 'TTC17', 'TTC18', 'TTC19'],
  'CP06': ['TTC16'],
  'CP04': ['TTC15', 'TTC14', 'TTC13', 'TTC12'],
  'CP07': ['TTC11', 'TTC10'],
  'CP08': ['TTC09', 'TTC08'],
  'CP09': ['TTC07', 'TTC03', 'TTC05', 'TTC04'],
  'CP10': ['TTC06', 'TTC02', 'TTC01'],
};

// จุดตรวจ "ก่อนหน้า" ของแต่ละโซน ใช้เป็นจุดเริ่มคำนวณระยะทางเข้าโรงงานตัวแรกของโซน
const CP_ZONE_PREV: Record<string, string> = {
  'CP03': 'CP02',
  'CP05': 'CP03',
  'CP06': 'CP05',
  'CP04': 'CP06',
  'CP07': 'CP04',
  'CP08': 'CP07',
  'CP09': 'CP08',
  'CP10': 'CP09',
};

/**
 * Calculates mass balance mixing for water quality variables.
 * C_mix = (Q1 * C1 + Q2 * C2 + ...) / (Q1 + Q2 + ...)
 */
export function calculateMixing(
  riverQ: number,
  riverConc: number,
  discharges: { q: number; conc: number }[]
): number {
  let totalMass = riverQ * riverConc;
  let totalFlow = riverQ;

  for (const discharge of discharges) {
    totalMass += discharge.q * discharge.conc;
    totalFlow += discharge.q;
  }

  return totalFlow > 0 ? totalMass / totalFlow : 0;
}

/**
 * Executes core diagnostics to find the main driver of water pollution
 * based on Thailand Department of Industrial Works analytical standards.
 */
export function diagnosePollutionSource(
  bod: number,
  cod: number,
  fecalColiform: number,
  nitrogen: number,
  ec: number
): { diagnostic: string; iconType: 'community' | 'agriculture' | 'industrial' | 'pristine' } {
  const codBodRatio = bod > 0 ? cod / bod : 0;

  if (codBodRatio > 3.0 || ec > 1000) {
    return {
      diagnostic: 'อิทธิพลเคมีภัณฑ์อุตสาหกรรมชะล้างอิ่มตัว (ตรวจพบรหัสสารอินทรีย์ย่อยยากร่วมกับเกลือเคมีอุตสาหกรรมปริมาณเข้มข้น)',
      iconType: 'industrial'
    };
  }

  if (fecalColiform > 5000 && codBodRatio < 2.0) {
    return {
      diagnostic: 'อิทธิพลมลพิษจากชุมชนหนาแน่น / สิ่งสิ่งปฏิกูล (พบแบคทีเรียฟีคัลโคลิฟอร์มพุ่งสูง ร่วมกับดัชนีย่อยสลายทางชีวเคมีดีเยี่ยม)',
      iconType: 'community'
    };
  }

  if (nitrogen > 5.0 && fecalColiform < 2000) {
    return {
      diagnostic: 'อิทธิพลน้ำหลากดินปุ๋ยเคมีฝั่งแปลงเกษตร (การชะล้างปุ๋ยไนโตรเจนที่หนาแน่นจากแปลงนาข้าวและพื้นที่ปลูกอ้อย)',
      iconType: 'agriculture'
    };
  }

  if (fecalColiform > 3000 || nitrogen > 3.0 || bod > DIW_STANDARDS.RIVER_BOD_MAX) {
    return {
      diagnostic: 'การชะล้างปนมัลติซอร์สแบบกระจัดกระจาย (มลพิษผสมผสานสะสมระหว่างสิ่งโสโครกเขตเมืองหนาและสารบำรุงพืชผัก)',
      iconType: 'community'
    };
  }

  return {
    diagnostic: 'แม่น้ำสะอาดอยู่ในขีดเป้าหมายธรรมชาติปกติ (กระบวนการบำบัดรักษาตัวเองทางชีวภาพแม่น้ำทำงานได้อย่างราบรื่น)',
    iconType: 'pristine'
  };
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dx = (lat1 - lat2) * 111.32;
  const dy = (lon1 - lon2) * 111.32 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Routes water quality from one point down to another, applying decay, and then mixing factory effluent.
 */
function routeSegment(
  flowIn: number,
  bodIn: number,
  codIn: number,
  fecalIn: number,
  nitrogenIn: number,
  ecIn: number,
  distance: number,
  factory: Factory | null
) {
  const k_bod = 0.012;
  const k_cod = 0.004;
  const k_fecal = 0.022;
  const k_nitrogen = 0.006;

  const bodDecayed = bodIn * Math.exp(-k_bod * distance);
  const codDecayed = codIn * Math.exp(-k_cod * distance);
  const fecalDecayed = fecalIn * Math.exp(-k_fecal * distance);
  const nitrogenDecayed = nitrogenIn * Math.exp(-k_nitrogen * distance);
  const ecDecayed = ecIn;

  if (!factory || factory.actualQ <= 0) {
    return {
      flowOut: flowIn,
      bodOut: bodDecayed,
      codOut: codDecayed,
      fecalOut: fecalDecayed,
      nitrogenOut: nitrogenDecayed,
      ecOut: ecDecayed
    };
  }

  const totalFlow = flowIn + factory.actualQ;
  const bodOut = (flowIn * bodDecayed + factory.actualQ * factory.dischargeBOD) / totalFlow;
  const codOut = (flowIn * codDecayed + factory.actualQ * factory.dischargeCOD) / totalFlow;
  const fecalOut = (flowIn * fecalDecayed + factory.actualQ * (factory.dischargeFecal || 0)) / totalFlow;
  const nitrogenOut = (flowIn * nitrogenDecayed + factory.actualQ * (factory.dischargeNitrogen || 0)) / totalFlow;
  const ecOut = (flowIn * ecDecayed + factory.actualQ * factory.dischargeEC) / totalFlow;

  return { flowOut: totalFlow, bodOut, codOut, fecalOut, nitrogenOut, ecOut };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: สร้าง Checkpoint object จาก node output
// ─────────────────────────────────────────────────────────────────────────────
function makeCheckpoint(
  id: string,
  name: string,
  lat: number,
  lon: number,
  node: ReturnType<typeof routeSegment>
): Checkpoint {
  return {
    id,
    name,
    lat,
    lon,
    bod: parseFloat(node.bodOut.toFixed(2)),
    cod: parseFloat(node.codOut.toFixed(2)),
    ec: Math.round(node.ecOut),
    fecalColiform: Math.round(node.fecalOut),
    nitrogen: parseFloat(node.nitrogenOut.toFixed(2)),
  };
}

/**
 * Computes water quality metrics at all checkpoints (CP01–CP10)
 * Routing chain: upstream→downstream (high lat → low lat)
 * TTC23→TTC22→CP03→TTC05→CP03→...→CP10
 *
 * ลำดับ lat สูง→ต่ำ (ต้นน้ำ→ปลายน้ำ):
 * TTC23(13.83)→TTC22(13.79)→CP03(13.80)→TTC21(13.75)→TTC20(13.74)
 * →TTC17(13.73)→TTC18(13.73)→TTC19(13.73)→CP05(13.78)→TTC16(13.71)
 * →TTC15(13.71)→TTC14(13.69)→TTC13(13.68)→TTC12(13.68)→CP04(13.68)
 * →TTC11(13.62)→TTC10(13.62)→CP07(13.67)→TTC09(13.59)→TTC08(13.58)
 * →CP08(13.56)→TTC07(13.56)→TTC03(13.55)→TTC05(13.55)→TTC04(13.54)
 * →TTC06(13.54)→TTC02(13.54)→TTC01(13.53)→CP10(13.52)
 */
export function simulateWaterNetwork(
  riverQ: number,
  scenario: {
    riverBOD: number;
    riverCOD: number;
    riverFecal: number;
    riverNitrogen: number;
    riverEC: number;
  },
  factories: Factory[]
): {
  checkpoints: Checkpoint[];
  violatedFactories: string[];
  // ค่าน้ำที่ "ไหลเข้า" โซนโรงงานของแต่ละ CP (ก่อนผสมกับโรงงานในโซนนั้น)
  // ใช้เป็น input ให้ calculateAllowedDischarge เพื่อไม่ต้องคำนวณ chain ซ้ำ
  zoneInputs: Record<string, { flow: number; bod: number; cod: number; fecal: number; nitrogen: number; ec: number }>;
} {

  // ── CP01: Upstream boundary (pure river input, no factory upstream) ─────────
  const cp01: Checkpoint = {
    id: 'CP01',
    name: 'CP01 - จุดตรวจวัด ใต้ปากคลองพระยาบรรลือ (อ.สองพี่น้อง)',
    lat: 14.1566,
    lon: 100.1276,
    bod: scenario.riverBOD,
    cod: scenario.riverCOD,
    fecalColiform: scenario.riverFecal,
    nitrogen: scenario.riverNitrogen,
    ec: scenario.riverEC,
  };

  // ── Find all factories ──────────────────────────────────────────────────────
  const ff = (id: string) => factories.find(f => f.id === id) || null;
  const f01 = ff('TTC01'); const f02 = ff('TTC02'); const f03 = ff('TTC03');
  const f04 = ff('TTC04'); const f05 = ff('TTC05'); const f06 = ff('TTC06');
  const f07 = ff('TTC07'); const f08 = ff('TTC08'); const f09 = ff('TTC09');
  const f10 = ff('TTC10'); const f11 = ff('TTC11'); const f12 = ff('TTC12');
  const f13 = ff('TTC13'); const f14 = ff('TTC14'); const f15 = ff('TTC15');
  const f16 = ff('TTC16'); const f17 = ff('TTC17'); const f18 = ff('TTC18');
  const f19 = ff('TTC19'); const f20 = ff('TTC20'); const f21 = ff('TTC21');
  const f22 = ff('TTC22'); const f23 = ff('TTC23');

  // ── CP02: ต้นน้ำสุด (สะพานบางเลน) ─────────────────────────────────────────
  // ไม่มีโรงงานระหว่าง CP01→CP02 (lat 14.16→14.02)
  const cp02Lat = 14.0159; const cp02Lon = 100.1804;
  const d_cp01_cp02 = calculateDistance(cp01.lat, cp01.lon, cp02Lat, cp02Lon);
  const nodeCp02 = routeSegment(riverQ, cp01.bod, cp01.cod, cp01.fecalColiform, cp01.nitrogen, cp01.ec, d_cp01_cp02, null);
  const cp02 = makeCheckpoint('CP02', 'CP02 - จุดตรวจวัด สะพานบางเลน (อ.บางเลน)', cp02Lat, cp02Lon, nodeCp02);

  // ── CP03 zone: TTC23→TTC22→CP03 (lat 13.83→13.79→13.80) ──────────────────
  // TTC23 (lat 13.83) ต้นน้ำสุดในกลุ่ม
  const d_cp02_f23 = calculateDistance(cp02Lat, cp02Lon, f23?.lat ?? 13.834, f23?.lon ?? 100.192);
  const node23 = routeSegment(nodeCp02.flowOut, nodeCp02.bodOut, nodeCp02.codOut, nodeCp02.fecalOut, nodeCp02.nitrogenOut, nodeCp02.ecOut, d_cp02_f23, f23);

  // TTC22 (lat 13.79)
  const d_f23_f22 = calculateDistance(f23?.lat ?? 13.834, f23?.lon ?? 100.192, f22?.lat ?? 13.791, f22?.lon ?? 100.194);
  const node22 = routeSegment(node23.flowOut, node23.bodOut, node23.codOut, node23.fecalOut, node23.nitrogenOut, node23.ecOut, d_f23_f22, f22);

  // CP03 (lat 13.80 อยู่ระหว่าง TTC22 และ TTC21)
  const cp03Lat = 13.8018; const cp03Lon = 100.1879;
  const d_f22_cp03 = calculateDistance(f22?.lat ?? 13.791, f22?.lon ?? 100.194, cp03Lat, cp03Lon);
  const nodeCp03 = routeSegment(node22.flowOut, node22.bodOut, node22.codOut, node22.fecalOut, node22.nitrogenOut, node22.ecOut, d_f22_cp03, null);
  const cp03 = makeCheckpoint('CP03', 'CP03 - จุดตรวจวัด หน้าที่ว่าการอำเภอนครชัยศรี', cp03Lat, cp03Lon, nodeCp03);

  // ── CP05 zone: TTC21→TTC20→TTC17→TTC18→TTC19→CP05 (lat ~13.75→13.78) ─────
  const d_cp03_f21 = calculateDistance(cp03Lat, cp03Lon, f21?.lat ?? 13.747, f21?.lon ?? 100.230);
  const node21 = routeSegment(nodeCp03.flowOut, nodeCp03.bodOut, nodeCp03.codOut, nodeCp03.fecalOut, nodeCp03.nitrogenOut, nodeCp03.ecOut, d_cp03_f21, f21);

  const d_f21_f20 = calculateDistance(f21?.lat ?? 13.747, f21?.lon ?? 100.230, f20?.lat ?? 13.739, f20?.lon ?? 100.216);
  const node20 = routeSegment(node21.flowOut, node21.bodOut, node21.codOut, node21.fecalOut, node21.nitrogenOut, node21.ecOut, d_f21_f20, f20);

  const d_f20_f17 = calculateDistance(f20?.lat ?? 13.739, f20?.lon ?? 100.216, f17?.lat ?? 13.730, f17?.lon ?? 100.244);
  const node17 = routeSegment(node20.flowOut, node20.bodOut, node20.codOut, node20.fecalOut, node20.nitrogenOut, node20.ecOut, d_f20_f17, f17);

  const d_f17_f18 = calculateDistance(f17?.lat ?? 13.730, f17?.lon ?? 100.244, f18?.lat ?? 13.729, f18?.lon ?? 100.247);
  const node18 = routeSegment(node17.flowOut, node17.bodOut, node17.codOut, node17.fecalOut, node17.nitrogenOut, node17.ecOut, d_f17_f18, f18);

  const d_f18_f19 = calculateDistance(f18?.lat ?? 13.729, f18?.lon ?? 100.247, f19?.lat ?? 13.727, f19?.lon ?? 100.245);
  const node19 = routeSegment(node18.flowOut, node18.bodOut, node18.codOut, node18.fecalOut, node18.nitrogenOut, node18.ecOut, d_f18_f19, f19);

  // CP05 (lat 13.78)
  const cp05Lat = 13.78254; const cp05Lon = 100.24356;
  const d_f19_cp05 = calculateDistance(f19?.lat ?? 13.727, f19?.lon ?? 100.245, cp05Lat, cp05Lon);
  const nodeCp05 = routeSegment(node19.flowOut, node19.bodOut, node19.codOut, node19.fecalOut, node19.nitrogenOut, node19.ecOut, d_f19_cp05, null);
  const cp05 = makeCheckpoint('CP05', 'CP05 - จุดตรวจวัด สะพานโพธิ์แก้ว (อ.สามพราน)', cp05Lat, cp05Lon, nodeCp05);

  // ── CP06 zone: TTC16→CP06 ─────────────────────────────────────────────────
  const d_cp05_f16 = calculateDistance(cp05Lat, cp05Lon, f16?.lat ?? 13.711, f16?.lon ?? 100.234);
  const node16 = routeSegment(nodeCp05.flowOut, nodeCp05.bodOut, nodeCp05.codOut, nodeCp05.fecalOut, nodeCp05.nitrogenOut, nodeCp05.ecOut, d_cp05_f16, f16);

  const cp06Lat = 13.7219; const cp06Lon = 100.2069;
  const d_f16_cp06 = calculateDistance(f16?.lat ?? 13.711, f16?.lon ?? 100.234, cp06Lat, cp06Lon);
  const nodeCp06 = routeSegment(node16.flowOut, node16.bodOut, node16.codOut, node16.fecalOut, node16.nitrogenOut, node16.ecOut, d_f16_cp06, null);
  const cp06 = makeCheckpoint('CP06', 'CP06 - จุดตรวจวัด วัดบางช้างเหนือ (อ.สามพราน)', cp06Lat, cp06Lon, nodeCp06);

  // ── CP04 zone: TTC15→TTC14→TTC13→TTC12→CP04 ─────────────────────────────
  const d_cp06_f15 = calculateDistance(cp06Lat, cp06Lon, f15?.lat ?? 13.707, f15?.lon ?? 100.267);
  const node15 = routeSegment(nodeCp06.flowOut, nodeCp06.bodOut, nodeCp06.codOut, nodeCp06.fecalOut, nodeCp06.nitrogenOut, nodeCp06.ecOut, d_cp06_f15, f15);

  const d_f15_f14 = calculateDistance(f15?.lat ?? 13.707, f15?.lon ?? 100.267, f14?.lat ?? 13.687, f14?.lon ?? 100.282);
  const node14 = routeSegment(node15.flowOut, node15.bodOut, node15.codOut, node15.fecalOut, node15.nitrogenOut, node15.ecOut, d_f15_f14, f14);

  const d_f14_f13 = calculateDistance(f14?.lat ?? 13.687, f14?.lon ?? 100.282, f13?.lat ?? 13.685, f13?.lon ?? 100.279);
  const node13 = routeSegment(node14.flowOut, node14.bodOut, node14.codOut, node14.fecalOut, node14.nitrogenOut, node14.ecOut, d_f14_f13, f13);

  const d_f13_f12 = calculateDistance(f13?.lat ?? 13.685, f13?.lon ?? 100.279, f12?.lat ?? 13.676, f12?.lon ?? 100.284);
  const node12 = routeSegment(node13.flowOut, node13.bodOut, node13.codOut, node13.fecalOut, node13.nitrogenOut, node13.ecOut, d_f13_f12, f12);

  const cp04Lat = 13.67817; const cp04Lon = 100.25647;
  const d_f12_cp04 = calculateDistance(f12?.lat ?? 13.676, f12?.lon ?? 100.284, cp04Lat, cp04Lon);
  const nodeCp04 = routeSegment(node12.flowOut, node12.bodOut, node12.codOut, node12.fecalOut, node12.nitrogenOut, node12.ecOut, d_f12_cp04, null);
  const cp04 = makeCheckpoint('CP04', 'CP04 - จุดตรวจวัด วัดท่าไม้ (อ.สามพราน)', cp04Lat, cp04Lon, nodeCp04);

  // ── CP07 zone: TTC11→TTC10→CP07 ─────────────────────────────────────────
  const d_cp04_f11 = calculateDistance(cp04Lat, cp04Lon, f11?.lat ?? 13.624, f11?.lon ?? 100.228);
  const node11 = routeSegment(nodeCp04.flowOut, nodeCp04.bodOut, nodeCp04.codOut, nodeCp04.fecalOut, nodeCp04.nitrogenOut, nodeCp04.ecOut, d_cp04_f11, f11);

  const d_f11_f10 = calculateDistance(f11?.lat ?? 13.624, f11?.lon ?? 100.228, f10?.lat ?? 13.622, f10?.lon ?? 100.230);
  const node10 = routeSegment(node11.flowOut, node11.bodOut, node11.codOut, node11.fecalOut, node11.nitrogenOut, node11.ecOut, d_f11_f10, f10);

  const cp07Lat = 13.6672; const cp07Lon = 100.2443;
  const d_f10_cp07 = calculateDistance(f10?.lat ?? 13.622, f10?.lon ?? 100.230, cp07Lat, cp07Lon);
  const nodeCp07 = routeSegment(node10.flowOut, node10.bodOut, node10.codOut, node10.fecalOut, node10.nitrogenOut, node10.ecOut, d_f10_cp07, null);
  const cp07 = makeCheckpoint('CP07', 'CP07 - จุดตรวจวัด รร.บ้านปล่องเหลี่ยม (อ.กระทุ่มแบน)', cp07Lat, cp07Lon, nodeCp07);

  // ── CP08 zone: TTC09→TTC08→CP08 ─────────────────────────────────────────
  const d_cp07_f09 = calculateDistance(cp07Lat, cp07Lon, f09?.lat ?? 13.586, f09?.lon ?? 100.242);
  const node09 = routeSegment(nodeCp07.flowOut, nodeCp07.bodOut, nodeCp07.codOut, nodeCp07.fecalOut, nodeCp07.nitrogenOut, nodeCp07.ecOut, d_cp07_f09, f09);

  const d_f09_f08 = calculateDistance(f09?.lat ?? 13.586, f09?.lon ?? 100.242, f08?.lat ?? 13.578, f08?.lon ?? 100.244);
  const node08 = routeSegment(node09.flowOut, node09.bodOut, node09.codOut, node09.fecalOut, node09.nitrogenOut, node09.ecOut, d_f09_f08, f08);

  const cp08Lat = 13.5606; const cp08Lon = 100.2743;
  const d_f08_cp08 = calculateDistance(f08?.lat ?? 13.578, f08?.lon ?? 100.244, cp08Lat, cp08Lon);
  const nodeCp08 = routeSegment(node08.flowOut, node08.bodOut, node08.codOut, node08.fecalOut, node08.nitrogenOut, node08.ecOut, d_f08_cp08, null);
  const cp08 = makeCheckpoint('CP08', 'CP08 - จุดตรวจวัด วัดศิริมงคล (อ.เมืองฯ)', cp08Lat, cp08Lon, nodeCp08);

  // ── CP09 zone: TTC07→TTC03→TTC05→TTC04→CP09 ────────────────────────────
  const d_cp08_f07 = calculateDistance(cp08Lat, cp08Lon, f07?.lat ?? 13.557, f07?.lon ?? 100.262);
  const node07 = routeSegment(nodeCp08.flowOut, nodeCp08.bodOut, nodeCp08.codOut, nodeCp08.fecalOut, nodeCp08.nitrogenOut, nodeCp08.ecOut, d_cp08_f07, f07);

  const d_f07_f03 = calculateDistance(f07?.lat ?? 13.557, f07?.lon ?? 100.262, f03?.lat ?? 13.551, f03?.lon ?? 100.287);
  const node03 = routeSegment(node07.flowOut, node07.bodOut, node07.codOut, node07.fecalOut, node07.nitrogenOut, node07.ecOut, d_f07_f03, f03);

  const d_f03_f05 = calculateDistance(f03?.lat ?? 13.551, f03?.lon ?? 100.287, f05?.lat ?? 13.548, f05?.lon ?? 100.245);
  const node05 = routeSegment(node03.flowOut, node03.bodOut, node03.codOut, node03.fecalOut, node03.nitrogenOut, node03.ecOut, d_f03_f05, f05);

  const d_f05_f04 = calculateDistance(f05?.lat ?? 13.548, f05?.lon ?? 100.245, f04?.lat ?? 13.543, f04?.lon ?? 100.242);
  const node04 = routeSegment(node05.flowOut, node05.bodOut, node05.codOut, node05.fecalOut, node05.nitrogenOut, node05.ecOut, d_f05_f04, f04);

  const cp09Lat = 13.58583; const cp09Lon = 100.23025;
  const d_f04_cp09 = calculateDistance(f04?.lat ?? 13.543, f04?.lon ?? 100.242, cp09Lat, cp09Lon);
  const nodeCp09 = routeSegment(node04.flowOut, node04.bodOut, node04.codOut, node04.fecalOut, node04.nitrogenOut, node04.ecOut, d_f04_cp09, null);
  const cp09 = makeCheckpoint('CP09', 'CP09 - จุดตรวจวัด วัดบางปลา (อ.เมืองฯ)', cp09Lat, cp09Lon, nodeCp09);

  // ── CP10: TTC06→TTC02→TTC01→CP10 ─────────────────────────────────────────
  const d_cp09_f06 = calculateDistance(cp09Lat, cp09Lon, f06?.lat ?? 13.542, f06?.lon ?? 100.231);
  const node06 = routeSegment(nodeCp09.flowOut, nodeCp09.bodOut, nodeCp09.codOut, nodeCp09.fecalOut, nodeCp09.nitrogenOut, nodeCp09.ecOut, d_cp09_f06, f06);

  const d_f06_f02 = calculateDistance(f06?.lat ?? 13.542, f06?.lon ?? 100.231, f02?.lat ?? 13.540, f02?.lon ?? 100.273);
  const node02 = routeSegment(node06.flowOut, node06.bodOut, node06.codOut, node06.fecalOut, node06.nitrogenOut, node06.ecOut, d_f06_f02, f02);

  const d_f02_f01 = calculateDistance(f02?.lat ?? 13.540, f02?.lon ?? 100.273, f01?.lat ?? 13.526, f01?.lon ?? 100.270);
  const node01 = routeSegment(node02.flowOut, node02.bodOut, node02.codOut, node02.fecalOut, node02.nitrogenOut, node02.ecOut, d_f02_f01, f01);

  const cp10Lat = 13.51897; const cp10Lon = 100.26695;
  const d_f01_cp10 = calculateDistance(f01?.lat ?? 13.526, f01?.lon ?? 100.270, cp10Lat, cp10Lon);
  const nodeCp10 = routeSegment(node01.flowOut, node01.bodOut, node01.codOut, node01.fecalOut, node01.nitrogenOut, node01.ecOut, d_f01_cp10, null);
  const cp10 = makeCheckpoint('CP10', 'CP10 - จุดตรวจวัด ปากแม่น้ำท่าจีน (อ.เมืองฯ)', cp10Lat, cp10Lon, nodeCp10);

  // ── Violated factories ──────────────────────────────────────────────────────
  const isTextileIndustry = (f: Factory) =>
    f.industryType.includes('สิ่งทอ') || f.industryType.includes('ฟอกย้อม');
  const getCODMax = (f: Factory) =>
    isTextileIndustry(f) ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX;

  const violatedFactories = factories
    .filter(f => f.dischargeBOD > DIW_STANDARDS.FACTORY_BOD_MAX || f.dischargeCOD > getCODMax(f))
    .map(f => f.id);

  return {
    checkpoints: [cp01, cp02, cp03, cp04, cp05, cp06, cp07, cp08, cp09, cp10],
    violatedFactories,
    zoneInputs: {
      'CP03': { flow: nodeCp02.flowOut, bod: nodeCp02.bodOut, cod: nodeCp02.codOut, fecal: nodeCp02.fecalOut, nitrogen: nodeCp02.nitrogenOut, ec: nodeCp02.ecOut },
      'CP05': { flow: nodeCp03.flowOut, bod: nodeCp03.bodOut, cod: nodeCp03.codOut, fecal: nodeCp03.fecalOut, nitrogen: nodeCp03.nitrogenOut, ec: nodeCp03.ecOut },
      'CP06': { flow: nodeCp05.flowOut, bod: nodeCp05.bodOut, cod: nodeCp05.codOut, fecal: nodeCp05.fecalOut, nitrogen: nodeCp05.nitrogenOut, ec: nodeCp05.ecOut },
      'CP04': { flow: nodeCp06.flowOut, bod: nodeCp06.bodOut, cod: nodeCp06.codOut, fecal: nodeCp06.fecalOut, nitrogen: nodeCp06.nitrogenOut, ec: nodeCp06.ecOut },
      'CP07': { flow: nodeCp04.flowOut, bod: nodeCp04.bodOut, cod: nodeCp04.codOut, fecal: nodeCp04.fecalOut, nitrogen: nodeCp04.nitrogenOut, ec: nodeCp04.ecOut },
      'CP08': { flow: nodeCp07.flowOut, bod: nodeCp07.bodOut, cod: nodeCp07.codOut, fecal: nodeCp07.fecalOut, nitrogen: nodeCp07.nitrogenOut, ec: nodeCp07.ecOut },
      'CP09': { flow: nodeCp08.flowOut, bod: nodeCp08.bodOut, cod: nodeCp08.codOut, fecal: nodeCp08.fecalOut, nitrogen: nodeCp08.nitrogenOut, ec: nodeCp08.ecOut },
      'CP10': { flow: nodeCp09.flowOut, bod: nodeCp09.bodOut, cod: nodeCp09.codOut, fecal: nodeCp09.fecalOut, nitrogen: nodeCp09.nitrogenOut, ec: nodeCp09.ecOut },
    },
  };
}

/**
 * ─── calculateSourceAttribution (ปรับปรุงใหม่) ────────────────────────────
 * Logic:
 * 1. หาโรงงานที่อยู่ในโซนต้นน้ำของ CP นี้โดยตรง (อ้างจาก CP_FACTORY_ZONES
 *    ซึ่งเป็น mapping เดียวกับ routing chain ใน simulateWaterNetwork — แก้บัค
 *    เดิมที่ใช้ "รัศมี 15 กม. + lat >= cp.lat" ทำให้หลาย CP อ่านค่าทับซ้อนกัน
 *    เพราะวงรัศมีของ CP ที่อยู่ใกล้กันไปคาบเกี่ยวกัน)
 * 2. คำนวณ COD รวมที่โรงงานเหล่านั้นปล่อยลงแม่น้ำ (mass balance อย่างง่าย)
 * 3. ถ้า COD รวมจากโรงงานในโซนเกินเกณฑ์ → ระบุว่าโรงงานไหนปล่อยเกิน
 * 4. ถ้าไม่เกิน → ดูว่ามาจาก Fecal (ชุมชน) หรือ Nitrogen (เกษตร)
 */
export function calculateSourceAttribution(
  checkpointId: string,
  bod: number,
  cod: number,
  fecalColiform: number,
  nitrogen: number,
  ec: number,
  factories: Factory[]
): SourceAttribution {

  const cpCoord = CP_COORDS[checkpointId] ?? { lat: 13.94, lon: 100.20 };
  const cpLat = cpCoord.lat;
  const cpLon = cpCoord.lon;

  // ── Step 1: โรงงานที่อยู่ในโซนต้นน้ำของ CP นี้โดยตรง (ไม่ทับซ้อนกับ CP อื่น) ──
  const zoneFactoryIds = CP_FACTORY_ZONES[checkpointId] ?? [];
  const nearbyFactories = factories.filter(f => zoneFactoryIds.includes(f.id));
  // ระยะที่ใช้ normalize risk score เท่านั้น (ไม่ใช่เกณฑ์คัดเลือกโรงงานอีกต่อไป)
  const RADIUS_KM = 15;

  // ── Step 2: ตรวจเกณฑ์แต่ละโรงงาน ────────────────────────────────────────
  const isTextile = (f: Factory) =>
    f.industryType.includes('สิ่งทอ') || f.industryType.includes('ฟอกย้อม');
  const getCODMax = (f: Factory) =>
    isTextile(f) ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX;

  const violatingNearby = nearbyFactories.filter(f =>
    f.dischargeBOD > DIW_STANDARDS.FACTORY_BOD_MAX || f.dischargeCOD > getCODMax(f)
  );

  // ── Step 3: คำนวณ COD รวมจากโรงงานในโซน (weighted by flow & distance) ─────
  // ใช้ estimated discharge flow และ decay ตามระยะทาง
  const k_cod = 0.004;
  let totalFactoryCODLoad = 0;
  nearbyFactories.forEach(f => {
    const d = calculateDistance(cpLat, cpLon, f.lat, f.lon);
    const decayedCOD = f.dischargeCOD * Math.exp(-k_cod * d);
    totalFactoryCODLoad += (f.actualQ * decayedCOD) / 86400; // m³/day → m³/s approx
  });

  // ── Step 4: คำนวณ probability scores ─────────────────────────────────────
  let factoryScore = 0;
  let residentialScore = 0;
  let agricultureScore = 0;

  // Factory score: ถ้ามีโรงงานใกล้ๆ ปล่อยเกินเกณฑ์ → score สูง
  if (violatingNearby.length > 0) {
    factoryScore += violatingNearby.length * 120;
  }
  // COD สูง + EC สูง = signature ของน้ำเสียอุตสาหกรรม
  const codBodRatio = bod > 0 ? cod / bod : 0;
  if (codBodRatio > 2.5 || ec > 800) {
    factoryScore += Math.min(80, (codBodRatio - 1.5) * 30 + (ec > 800 ? 30 : 0));
  }
  // ถ้ามีโรงงานใกล้เคียงแต่ไม่เกินเกณฑ์ → factory score เล็กน้อย
  if (nearbyFactories.length > 0 && factoryScore === 0) {
    factoryScore = 10 + nearbyFactories.length * 2;
  }

  // Residential score: Fecal สูง = น้ำเสียชุมชน
  if (fecalColiform > 500) {
    residentialScore += Math.min(150, (fecalColiform / 100) * 1.2);
  }
  if (codBodRatio > 0 && codBodRatio < 2.0) {
    residentialScore += 30;
  }

  // Agriculture score: Nitrogen สูง = ปุ๋ยเคมีเกษตร
  if (nitrogen > 1.5) {
    agricultureScore += Math.min(120, nitrogen * 20);
  }
  if (fecalColiform < 2000 && nitrogen > 2.0) {
    agricultureScore += 40;
  }

  factoryScore = Math.max(factoryScore, 5);
  residentialScore = Math.max(residentialScore, 5);
  agricultureScore = Math.max(agricultureScore, 5);

  if (checkpointId === 'CP01') {
    factoryScore = 0.05;
  }

  const sum = factoryScore + residentialScore + agricultureScore;
  let factoryProb = Math.round((factoryScore / sum) * 100);
  let residentialProb = Math.round((residentialScore / sum) * 100);
  let agricultureProb = 100 - factoryProb - residentialProb;

  if (agricultureProb < 0) {
    const drift = -agricultureProb;
    if (factoryProb > residentialProb) {
      factoryProb = Math.max(0, factoryProb - drift);
    } else {
      residentialProb = Math.max(0, residentialProb - drift);
    }
    agricultureProb = 0;
  }

  // ── Step 5: dominant source ───────────────────────────────────────────────
  let dominantSource: 'factories' | 'residential' | 'agriculture' | 'normal' = 'normal';
  if (bod > DIW_STANDARDS.RIVER_BOD_MAX || fecalColiform > DIW_STANDARDS.RIVER_FECAL_MAX || nitrogen > DIW_STANDARDS.RIVER_NITROGEN_MAX) {
    const maxVal = Math.max(factoryProb, residentialProb, agricultureProb);
    if (maxVal === factoryProb) dominantSource = 'factories';
    else if (maxVal === residentialProb) dominantSource = 'residential';
    else dominantSource = 'agriculture';
  }

  // ── Step 6: factoriesRisk เฉพาะโรงงานใกล้เคียง ────────────────────────────
  const substanceDatabase: Record<string, string[]> = {
    'TTC01': ['โลหะหนักฟอกสี (โครเมียม, ตะกั่ว, แคดเมียม)', 'สารสีย้อมกลุ่มอะโซ (Azo Dyes) ก่อสารก่อมะเร็ง', 'กรดกำมะถัน-สารละลายซัลไฟด์เข้มข้น'],
    'TTC02': ['สารอินทรีย์โปรตีนตกค้างระดับหนาแน่นมาก', 'น้ำมันและน้ำมันดิบไขมันอินทรีย์ลอยผิว', 'โคลนชีวภาพอิ่มตัว'],
    'TTC03': ['ตัวทำละลายโมเลกุลซับซ้อน (เบนซีน, โทลูอีน, ไซลีน)', 'สาร VOCs ต้านทานการย่อยทางชีวภาพขั้นรุนแรง', 'เม็ดสีโลหะหนักหลอมละลาย'],
    'TTC04': ['สารคลอรีนฟอกอินทรีย์กลุ่มไดออกซิน (Dioxins)', 'ลิกนินโมเลกุลฟายเบอร์ไม้ละลายน้ำ', 'กาวเรซินสังเคราะห์เคมีหุ้ม'],
    'TTC05': ['แป้งคาร์โบไฮเดรตละลายค้างทำลายสมดุล O2', 'สารซัลไฟต์และแก๊สไข่เน่าบูดเน่ากุ้งหอย', 'กรดอินทรีย์ระเหยง่าย'],
    'TTC10': ['สีย้อมผ้า (Reactive Dyes, Disperse Dyes)', 'สารลดแรงตึงผิว (Surfactants)', 'เกลืออนินทรีย์ความเข้มข้นสูง'],
    'TTC11': ['สีย้อมผ้า (Reactive Dyes)', 'โซดาไฟและกรดอะซิติกจากการฟอกย้อม', 'สารเคมีปรับสภาพน้ำยาย้อม'],
    'TTC12': ['เส้นใยสังเคราะห์ละลายน้ำ (Microfibers)', 'น้ำมันหล่อลื่นเครื่องจักรทอผ้า', 'สีย้อมและสารช่วยย้อม'],
    'TTC13': ['เส้นใยสังเคราะห์ละลายน้ำ', 'สารฟอกขาว (Optical Brighteners)', 'กรดอะซิติกและด่างจากกระบวนการฟอก'],
    'TTC14': ['สีย้อมผ้าโพลีเอสเตอร์ (Disperse Dyes)', 'สารช่วยย้อม (Leveling Agents)', 'เกลือและสารปรับ pH'],
    'TTC15': ['สีย้อมผ้าฝ้าย (Direct Dyes)', 'สารเคมีเตรียมผ้า (Sizing Agents)', 'สารตรึงสี (Fixatives)'],
    'TTC16': ['สารอินทรีย์จากกระบวนการผลิตอาหาร', 'ไขมันและน้ำมันจากวัตถุดิบ', 'สารอินทรีย์ที่ย่อยสลายได้ทางชีวภาพ'],
    'TTC17': ['สารอินทรีย์จากกระบวนการผลิตอาหาร', 'ไขมันและน้ำมันจากวัตถุดิบ', 'สารแต่งกลิ่นรสสังเคราะห์'],
    'TTC18': ['สีย้อมผ้า (Vat Dyes, Sulfur Dyes)', 'สารรีดิวซ์ (Reducing Agents)', 'เกลืออนินทรีย์'],
    'TTC19': ['สารอินทรีย์จากแป้งข้าว', 'สารกันบูดอาหาร', 'น้ำมันพืชและไขมัน'],
    'TTC20': ['น้ำเสียจากกระบวนการเย็บกระป๋อง', 'สารอินทรีย์จากน้ำผลไม้', 'น้ำตาลและกรดอินทรีย์'],
    'TTC21': ['เส้นใยสังเคราะห์ (Nylon, Polyester Fibers)', 'สารเคมีตกแต่งผ้า (Finishing Agents)', 'สีย้อมและสารปรับ pH'],
    'TTC22': ['เส้นใยโพลีเอสเตอร์ละลายน้ำ', 'สารเคมีกระบวนการปั่นเส้นใย', 'น้ำมันหล่อลื่นอุตสาหกรรม'],
    'TTC23': ['เส้นใยสังเคราะห์ (Synthetic Fibers)', 'สารเคมีย้อมสีเส้นใย', 'สารช่วยผลิต (Process Chemicals)'],
  };

  const factoriesRisk = nearbyFactories.map(f => {
    const isTextileF = isTextile(f);
    const codMaxF = isTextileF ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX;
    const dist = calculateDistance(cpLat, cpLon, f.lat, f.lon);
    let riskScore = 10;
    riskScore += Math.floor(Math.max(0, 1 - dist / RADIUS_KM) * 20); // ใกล้ = score สูง
    riskScore += Math.floor((f.actualQ / f.allowedQ) * 15);
    if (f.dischargeBOD > DIW_STANDARDS.FACTORY_BOD_MAX) {
      riskScore += 35 + Math.floor(((f.dischargeBOD - DIW_STANDARDS.FACTORY_BOD_MAX) / DIW_STANDARDS.FACTORY_BOD_MAX) * 25);
    } else {
      riskScore += Math.floor((f.dischargeBOD / DIW_STANDARDS.FACTORY_BOD_MAX) * 10);
    }
    if (f.dischargeCOD > codMaxF) {
      riskScore += 35 + Math.floor(((f.dischargeCOD - codMaxF) / codMaxF) * 25);
    } else {
      riskScore += Math.floor((f.dischargeCOD / codMaxF) * 10);
    }
    if (f.status === 'Violation') {
      riskScore = Math.max(89, riskScore);
    }
    riskScore = Math.min(100, Math.max(5, riskScore));

    return {
      factoryId: f.id,
      name: f.name,
      riskScore,
      substances: substanceDatabase[f.id] || ['สารเจือปนทั่วไปในอุตสาหกรรม'],
      isViolating: f.status === 'Violation'
    };
  });

  return { factoryProb, residentialProb, agricultureProb, dominantSource, factoriesRisk };
}

/**
 * ─── calculateAllowedDischarge ────────────────────────────────────────────
 * สำหรับ CP หนึ่งจุด: หาว่าโรงงานแต่ละโรงในโซนต้นน้ำของ CP นั้น "ปล่อยได้ไม่เกิน
 * เท่าไหร่" (BOD/COD mg/L) โดยสมมติว่าโรงงานอื่นในโซนเดียวกันยังปล่อยตามค่าจริง
 * ปัจจุบัน (ceteris paribus) — แล้วหาค่าที่ทำให้ CP ปลายโซนยังไม่เกินมาตรฐานแม่น้ำ
 * (DIW_STANDARDS.RIVER_BOD_MAX / RIVER_COD_MAX)
 *
 * วิธี: binary search บน chain ผสม/สลายตัวเดียวกับ simulateWaterNetwork โดยอิง
 * ว่าความเข้มข้นที่โรงงานปล่อยส่งผลทางเดียว (monotonic increasing) ต่อค่าที่ CP
 * วัดได้ ซึ่งเป็นจริงตามสมการ mass-balance ที่ routeSegment ใช้อยู่แล้ว
 */
export function calculateAllowedDischarge(
  checkpointId: string,
  zoneInput: { flow: number; bod: number; cod: number; fecal: number; nitrogen: number; ec: number } | undefined,
  factories: Factory[]
): AllowedDischarge[] {
  const zoneFactoryIds = CP_FACTORY_ZONES[checkpointId] ?? [];
  if (!zoneInput || zoneFactoryIds.length === 0) return [];

  const cpCoord = CP_COORDS[checkpointId];
  const prevCpId = CP_ZONE_PREV[checkpointId];
  const prevCoord = prevCpId ? CP_COORDS[prevCpId] : cpCoord;
  if (!cpCoord || !prevCoord) return [];

  const chainFactories = zoneFactoryIds
    .map(id => factories.find(f => f.id === id))
    .filter((f): f is Factory => !!f);

  if (chainFactories.length === 0) return [];

  const RIVER_BOD_TARGET = DIW_STANDARDS.RIVER_BOD_MAX;
  const RIVER_COD_TARGET = DIW_STANDARDS.RIVER_COD_MAX;

  // รัน chain ทั้งโซนจาก zoneInput → CP ปลายโซน โดยแทนค่า BOD/COD ของ "โรงงานเป้าหมาย"
  // ด้วยค่าทดสอบ ส่วนโรงงานอื่นในโซนใช้ค่าจริงปัจจุบันทั้งหมด
  function runChain(targetId: string, testBOD: number, testCOD: number) {
    let flow = zoneInput!.flow;
    let bod = zoneInput!.bod;
    let cod = zoneInput!.cod;
    let fecal = zoneInput!.fecal;
    let nitrogen = zoneInput!.nitrogen;
    let ec = zoneInput!.ec;
    let prevLat = prevCoord!.lat;
    let prevLon = prevCoord!.lon;

    for (const f of chainFactories) {
      const dist = calculateDistance(prevLat, prevLon, f.lat, f.lon);
      const segFactory: Factory = f.id === targetId
        ? { ...f, dischargeBOD: testBOD, dischargeCOD: testCOD }
        : f;
      const node = routeSegment(flow, bod, cod, fecal, nitrogen, ec, dist, segFactory);
      flow = node.flowOut; bod = node.bodOut; cod = node.codOut;
      fecal = node.fecalOut; nitrogen = node.nitrogenOut; ec = node.ecOut;
      prevLat = f.lat; prevLon = f.lon;
    }

    const finalDist = calculateDistance(prevLat, prevLon, cpCoord!.lat, cpCoord!.lon);
    return routeSegment(flow, bod, cod, fecal, nitrogen, ec, finalDist, null);
  }

  // หาค่าสูงสุดที่ "โรงงานเป้าหมาย" ปล่อยได้โดยไม่ทำให้ CP เกินมาตรฐาน
  // (โรงงานอื่นในโซนคงค่าจริงปัจจุบันไว้ — สมมติฐาน "all else equal")
  function findMaxAllowed(targetId: string, pollutant: 'bod' | 'cod', standardMax: number): number {
    const target = chainFactories.find(f => f.id === targetId)!;
    let lo = 0;
    let hi = Math.max(target.dischargeBOD, target.dischargeCOD, standardMax) * 6 + 200;

    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      const node = pollutant === 'bod'
        ? runChain(targetId, mid, target.dischargeCOD)
        : runChain(targetId, target.dischargeBOD, mid);
      const out = pollutant === 'bod' ? node.bodOut : node.codOut;
      if (out > standardMax) hi = mid; else lo = mid;
    }
    return Math.max(0, parseFloat(lo.toFixed(2)));
  }

  return chainFactories.map(f => {
    const distanceToCheckpointKm = parseFloat(
      calculateDistance(f.lat, f.lon, cpCoord.lat, cpCoord.lon).toFixed(2)
    );

    // โรงงานที่ไม่ได้ระบายน้ำจริง (actualQ <= 0) ไม่ส่งผลต่อ CP เลย ไม่ต้องจำกัด
    if (f.actualQ <= 0) {
      return {
        factoryId: f.id,
        name: f.name,
        distanceToCheckpointKm,
        currentBOD: f.dischargeBOD,
        currentCOD: f.dischargeCOD,
        maxAllowedBOD: Infinity,
        maxAllowedCOD: Infinity,
        isOverBOD: false,
        isOverCOD: false,
      };
    }

    const maxAllowedBOD = findMaxAllowed(f.id, 'bod', RIVER_BOD_TARGET);
    const maxAllowedCOD = findMaxAllowed(f.id, 'cod', RIVER_COD_TARGET);

    return {
      factoryId: f.id,
      name: f.name,
      distanceToCheckpointKm,
      currentBOD: f.dischargeBOD,
      currentCOD: f.dischargeCOD,
      maxAllowedBOD,
      maxAllowedCOD,
      isOverBOD: f.dischargeBOD > maxAllowedBOD,
      isOverCOD: f.dischargeCOD > maxAllowedCOD,
    };
  });
}
