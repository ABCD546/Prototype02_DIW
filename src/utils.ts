/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Factory } from './types';
import { DIW_STANDARDS } from './data';

/**
 * Calculates mass balance mixing for water quality variables.
 * C_mix = (Q1 * C1 + Q2 * C2 + ...) / (Q1 + Q2 + ...)
 * (Kept as a general-purpose utility; no longer used to derive checkpoint
 * values — checkpoints now read historical measurements directly from file.)
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
 * Still available for use against factory-side discharge figures, but no
 * longer fed by computed checkpoint mass-balance values.
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
 * ─── getViolatedFactories ─────────────────────────────────────────────────
 * Factory-side compliance check only (independent of checkpoints).
 * Extracted from the old simulateWaterNetwork(), which used to compute this
 * as a side-effect of the checkpoint mass-balance chain. Checkpoints are no
 * longer computed from factories, but factory violation status is still
 * needed for the factory table / map markers, so this stays standalone.
 */
export function getViolatedFactories(factories: Factory[]): string[] {
  const isTextileIndustry = (f: Factory) =>
    f.industryType.includes('สิ่งทอ') || f.industryType.includes('ฟอกย้อม');
  const getCODMax = (f: Factory) =>
    isTextileIndustry(f) ? DIW_STANDARDS.FACTORY_COD_MAX_TEXTILE : DIW_STANDARDS.FACTORY_COD_MAX;

  return factories
    .filter(f => f.dischargeBOD > DIW_STANDARDS.FACTORY_BOD_MAX || f.dischargeCOD > getCODMax(f))
    .map(f => f.id);
}
