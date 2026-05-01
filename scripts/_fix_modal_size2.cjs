// Make preview dialog full width — update DialogContent className cleanly
const fs = require('fs');
const filePath = 'components/admin/dosyalar/drive-table.tsx';
let c = fs.readFileSync(filePath, 'utf8');

// Find and replace the DialogContent line precisely
const oldLine = `<DialogContent className="w-full p-0 overflow-hidden md:!max-w-[calc(100vw-48px)] lg:!max-w-[calc(100vw-64px)]" style={{ maxHeight: "95vh", height: "95vh" }}>`;
const newLine = `<DialogContent className="w-[calc(100vw-32px)] max-w-[calc(100vw-32px)] sm:w-[calc(100vw-48px)] sm:max-w-[calc(100vw-48px)] p-0 overflow-hidden rounded-xl" style={{ height: "95vh", maxHeight: "95vh" }}>`;

if (c.includes(oldLine)) {
  c = c.replace(oldLine, newLine);
  console.log('Replaced DialogContent className');
} else {
  // fallback: find any DialogContent with 95vh
  c = c.replace(
    /(<DialogContent className=")[^"]*(")[^>]*(style=\{\{[^}]*95vh[^}]*\}\}>)/,
    `<DialogContent className="w-[calc(100vw-32px)] max-w-[calc(100vw-32px)] sm:w-[calc(100vw-48px)] sm:max-w-[calc(100vw-48px)] p-0 overflow-hidden rounded-xl" style={{ height: "95vh", maxHeight: "95vh" }}>`
  );
  console.log('Used fallback replacement');
}

fs.writeFileSync(filePath, c, 'utf8');

const out = fs.readFileSync(filePath, 'utf8');
console.log('Has 100vw-48px:', out.includes('100vw-48px'));
console.log('Done.');
