// Fix pdfjs render call - use `as any` directly
const fs = require('fs');
const path = 'components/admin/dosyalar/drive-table.tsx';
let c = fs.readFileSync(path, 'utf8');

// Replace the broken render line entirely
c = c.replace(
  /const ctx = canvas\.getContext\("2d"\); if \(ctx\) await page\.render\(.*?\)\.promise;/,
  'const ctx = canvas.getContext("2d"); if (ctx) { await (page.render as any)({ canvasContext: ctx, viewport }).promise; }'
);

fs.writeFileSync(path, c, 'utf8');
console.log('Fixed.');
