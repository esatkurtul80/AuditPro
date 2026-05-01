// Fix encoding issue: opening double-quote was stripped from "use client"; on line 1
const fs = require('fs');

const targets = [
  'components/admin/dosyalar/drive-table.tsx',
  'components/admin/dosyalar/file-helpers.tsx',
  'components/admin/dosyalar/folder-nav.tsx',
];

targets.forEach((filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // The PowerShell heredoc stripped the opening quote from "use client";
  // Result was: use client"; -> fix to: "use client";
  if (content.startsWith('use client')) {
    content = '"use client";' + content.slice('use client";'.length);
    console.log(`Fixed "use client" in ${filePath}`);
  }

  fs.writeFileSync(filePath, content, { encoding: 'utf8' });

  const bytes = fs.readFileSync(filePath);
  console.log(`${filePath}: first byte = ${bytes[0]} ('${String.fromCharCode(bytes[0])}'), total non-ASCII = ${[...bytes].filter(b => b > 127).length}`);
});

console.log('Done.');
