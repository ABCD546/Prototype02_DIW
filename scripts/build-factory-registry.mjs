import fs from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';

const downloads = 'C:/Users/HSM/Downloads';
const outputDir = 'D:/Project_DIW/NEWindustrial-water-compliance-defense-system1/PROJECT_DIW01/public/data/factory-registry';
const files = ['northeastern.csv', 'northern.csv', 'central.csv', 'bangkok.csv', 'southern.csv', 'western.csv', 'eastern.csv'];
const provinces = new Map();

for (const file of files) {
  const bytes = await fs.readFile(path.join(downloads, file));
  const workbook = XLSX.read(bytes, { type: 'buffer', raw: false });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: false });
  for (const row of rows) {
    const id = String(row.FID ?? '').trim().replace(/\D/g, '');
    const province = String(row.FPROVNAME ?? '').trim();
    if (!id || !province) continue;
    if (!provinces.has(province)) provinces.set(province, {});
    const lat = Number(row.LAT);
    const lon = Number(row.LNG);
    provinces.get(province)[id] = {
      id,
      name: String(row.FNAME || row.ONAME || '').trim(),
      owner: String(row.ONAME || '').trim(),
      displayRegistration: String(row.DISPFACREG || '').trim(),
      province,
      district: String(row.FAMPNAME || '').trim(),
      subdistrict: String(row.FTUMNAME || '').trim(),
      industryType: String(row.OBJECT || '').trim(),
      status: String(row.STATUS || '').trim(),
      lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
      lon: Number.isFinite(lon) && lon !== 0 ? lon : null,
    };
  }
}

await fs.mkdir(outputDir, { recursive: true });
const index = {};
let total = 0;
let withCoordinates = 0;
let sequence = 1;
for (const province of [...provinces.keys()].sort((a, b) => a.localeCompare(b, 'th'))) {
  const filename = `province-${String(sequence).padStart(2, '0')}.json`;
  const records = provinces.get(province);
  index[province] = filename;
  total += Object.keys(records).length;
  withCoordinates += Object.values(records).filter((record) => record.lat != null && record.lon != null).length;
  await fs.writeFile(path.join(outputDir, filename), JSON.stringify(records));
  sequence += 1;
}
await fs.writeFile(path.join(outputDir, 'index.json'), JSON.stringify({ provinces: index, total, withCoordinates }, null, 2));
console.log(JSON.stringify({ provinceCount: provinces.size, total, withCoordinates }, null, 2));
