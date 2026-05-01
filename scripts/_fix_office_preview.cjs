// Replace gdocsUrl (Google Docs Viewer) with Microsoft Office Online Viewer
const fs = require('fs');
const path = 'components/admin/dosyalar/drive-table.tsx';

let c = fs.readFileSync(path, 'utf8');

// 1. Replace the gdocsUrl line — switch from Google Docs to Microsoft Office Online
c = c.replace(
  /const gdocsUrl = `https:\/\/docs\.google\.com\/viewer\?url=\$\{encodeURIComponent\(file\.downloadUrl\)\}&embedded=true`;/,
  'const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.downloadUrl)}`;'
);

// 2. Update canPreview to use new var name (officeUrl doesn't affect logic, but officeError still does)
// No change needed for canPreview logic

// 3. Replace gdocsUrl references in JSX
c = c.replace(/key=\{gdocsUrl\}/g, 'key={officeUrl}');
c = c.replace(/src=\{gdocsUrl\}/g, 'src={officeUrl}');

fs.writeFileSync(path, c, 'utf8');

// Verify
const result = fs.readFileSync(path, 'utf8');
const hasGoogle = result.includes('docs.google.com');
const hasMicrosoft = result.includes('view.officeapps.live.com');
console.log('Google Docs Viewer removed:', !hasGoogle);
console.log('Microsoft Office Viewer added:', hasMicrosoft);
console.log('Done.');
