// Fix xlsx dynamic import — remove .default, use namespace import
const fs = require('fs');
const path = 'components/admin/dosyalar/drive-table.tsx';
let c = fs.readFileSync(path, 'utf8');

// Old: const XLSX = (await import("xlsx")).default;
// New: use named exports directly
c = c.replace(
  'const XLSX = (await import("xlsx")).default;',
  'const { read, utils } = await import("xlsx");'
);

// Fix usages
c = c.replace(
  'const wb = XLSX.read(ab, { type: "array" });',
  'const wb = read(new Uint8Array(ab), { type: "array" });'
);

c = c.replace(
  'html: XLSX.utils.sheet_to_html(wb.Sheets[name], { editable: false }),',
  'html: utils.sheet_to_html(wb.Sheets[name], { editable: false }),'
);

fs.writeFileSync(path, c, 'utf8');

// Verify
const out = fs.readFileSync(path, 'utf8');
console.log('Has .default removed:', !out.includes('(await import("xlsx")).default'));
console.log('Has { read, utils }:', out.includes('{ read, utils }'));
console.log('Has Uint8Array:', out.includes('Uint8Array'));
console.log('Done.');
