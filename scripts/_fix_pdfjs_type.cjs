// Fix pdfjs RenderParameters type error
const fs = require('fs');
const path = 'components/admin/dosyalar/drive-table.tsx';
let c = fs.readFileSync(path, 'utf8');

// Fix: canvas.getContext("2d")! needs explicit cast
c = c.replace(
  'await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;',
  'const ctx = canvas.getContext("2d"); if (ctx) await page.render({ canvasContext: ctx as unknown as import("pdfjs-dist").RenderingContext, viewport } as any).promise;'
);

fs.writeFileSync(path, c, 'utf8');
console.log('Fixed. Verifying...');
const out = fs.readFileSync(path, 'utf8');
console.log('Has fix:', out.includes('as any'));
