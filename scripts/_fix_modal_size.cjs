// Make FilePreviewDialog full viewport width on desktop
const fs = require('fs');
const path = 'components/admin/dosyalar/drive-table.tsx';
let c = fs.readFileSync(path, 'utf8');

// Update DialogContent: max-w-5xl → full width on desktop, taller height
c = c.replace(
  '<DialogContent className="max-w-5xl w-full p-0 overflow-hidden" style={{ maxHeight: "90vh" }}>',
  '<DialogContent className="w-full p-0 overflow-hidden md:!max-w-[calc(100vw-48px)] lg:!max-w-[calc(100vw-64px)]" style={{ maxHeight: "95vh", height: "95vh" }}>'
);

// Update the inner content area height to fill the space
c = c.replace(
  '<div className="bg-slate-50 dark:bg-slate-900 overflow-hidden" style={{ maxHeight: "calc(90vh - 70px)" }}>',
  '<div className="bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-col" style={{ height: "calc(95vh - 70px)" }}>'
);

// Make ExcelViewer fill full height
c = c.replace(
  '<div className="flex flex-col h-full">',
  '<div className="flex flex-col" style={{ height: "100%" }}>'
);

// Make the excel scroll area fill remaining space
c = c.replace(
  '<div className="flex-1 overflow-auto p-4">',
  '<div className="flex-1 overflow-auto p-4" style={{ minHeight: 0 }}>'
);

fs.writeFileSync(path, c, 'utf8');
console.log('Done. Verifying...');
const out = fs.readFileSync(path, 'utf8');
console.log('Has calc(100vw:', out.includes('100vw'));
console.log('Has 95vh:', out.includes('95vh'));
