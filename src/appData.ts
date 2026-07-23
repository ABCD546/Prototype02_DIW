import type { Checkpoint } from './types';

/** สถานีที่มีชุดข้อมูลย้อนหลังอยู่ใน public/data/checkpoints */
export const HISTORICAL_STATIONS: Checkpoint[] = [
  { id: 'หันคา', name: 'วัดท่ากฤษณา (สถานีหันคา)', lat: 14.9855, lon: 100.012, code: '114', stationType: 'automatic', riverName: 'แม่น้ำท่าจีน', province: 'ชัยนาท', hasMeasurementData: true },
  { id: 'สามชุก', name: 'สามชุก', lat: 14.683389, lon: 100.107537, code: '249', stationType: 'automatic', riverName: 'แม่น้ำท่าจีน', province: 'สุพรรณบุรี', hasMeasurementData: true },
  { id: 'สุพรรณบุรี', name: 'สุพรรณบุรี', lat: 14.499241, lon: 100.124533, code: '241', stationType: 'automatic', riverName: 'แม่น้ำท่าจีน', province: 'สุพรรณบุรี', hasMeasurementData: true },
  { id: 'สองพี่น้อง', name: 'วัดบางสาม (สถานีสองพี่น้อง)', lat: 14.1713, lon: 100.1157, code: '115', stationType: 'automatic', riverName: 'แม่น้ำท่าจีน', province: 'สุพรรณบุรี', hasMeasurementData: true },
  { id: 'บางเลน', name: 'วัดเกษมสุริยมนาท (สถานีบางเลน)', lat: 13.9988, lon: 100.1811, code: '116', stationType: 'automatic', riverName: 'แม่น้ำท่าจีน', province: 'นครปฐม', hasMeasurementData: true },
  { id: 'นครชัยศรี', name: 'วัดสัมปะทวน (สถานีนครชัยศรี)', lat: 13.8108, lon: 100.1857, code: '121', stationType: 'automatic', riverName: 'แม่น้ำท่าจีน', province: 'นครปฐม', hasMeasurementData: true },
  { id: 'กระทุ่มแบน', name: 'วัดท่าไม้ (สถานีกระทุ่มแบน)', lat: 13.6756, lon: 100.2561, code: '117', stationType: 'automatic', riverName: 'แม่น้ำท่าจีน', province: 'สมุทรสาคร', hasMeasurementData: true },
];

export const DIW_STANDARDS = {
  RIVER_BOD_MAX: 2.0,
  RIVER_COD_MAX: 120.0,
  FACTORY_BOD_MAX: 20.0,
  FACTORY_COD_MAX: 120.0,
  FACTORY_COD_MAX_TEXTILE: 400.0,
  RIVER_FECAL_MAX: 4000,
  RIVER_NITROGEN_MAX: 5.0,
};
