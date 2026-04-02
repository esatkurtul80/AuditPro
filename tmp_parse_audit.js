const fs = require('fs');
const text = fs.readFileSync('C:/Users/PC/.gemini/antigravity/brain/4f93b683-e02e-42c9-81f0-fc4cf72fa544/.system_generated/steps/370/output.txt', 'utf8');
const lines = text.split('\n');

const results = [];

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('"earnedPoints"')) {
    const epLine = lines[i + 1] || '';
    const epMatch = epLine.match(/"integerValue":\s*"(\d+)"/);
    if (!epMatch) continue;
    const ep = parseInt(epMatch[1]);
    
    let mp = null;
    for (let k = i + 1; k < Math.min(i + 5, lines.length); k++) {
      if (lines[k].includes('"maxPoints"')) {
        const mpMatch = (lines[k + 1] || '').match(/"integerValue":\s*"(\d+)"/);
        if (mpMatch) { mp = parseInt(mpMatch[1]); break; }
      }
    }
    
    if (mp !== null && ep < mp) {
      // Look FORWARD for questionId and questionText (alphabetically after earnedPoints)
      let qt = '', qid = '';
      for (let k = i + 1; k < Math.min(i + 200, lines.length); k++) {
        // Stop at next answer block
        if (k > i + 3 && lines[k].includes('"actionPhotoRequired"')) break;
        if (lines[k].includes('"questionId"') && !qid) {
          qid = (lines[k + 1] || '').replace(/"stringValue":\s*"/, '').replace(/"$/, '').trim().replace(/[\n\r]/g,'');
        }
        if (lines[k].includes('"questionText"') && !qt) {
          qt = (lines[k + 1] || '').replace(/"stringValue":\s*"/, '').replace(/"$/, '').trim().replace(/[\n\r]/g,'').substring(0, 80);
        }
        if (qt && qid) break;
      }
      
      // Look FORWARD for nearest sectionName
      let secName = '';
      for (let k = i; k < Math.min(i + 5000, lines.length); k++) {
        if (lines[k].includes('"sectionName"')) {
          secName = (lines[k + 1] || '').replace(/"stringValue":\s*"/, '').replace(/"$/, '').trim().replace(/[\n\r]/g,'');
          break;
        }
      }
      
      // Check if actionData exists nearby
      let hasActionData = false;
      for (let k = i; k < Math.min(i + 300, lines.length); k++) {
        if (k > i + 3 && lines[k].includes('"actionPhotoRequired"')) break;
        if (lines[k].includes('"actionData"')) { hasActionData = true; break; }
      }
      
      // Check actionPhotoRequired for this answer (in the 300 lines before earnedPoints)
      let apt = false;
      for (let k = i - 1; k > Math.max(0, i - 30); k--) {
        if (lines[k].includes('"actionPhotoRequired"')) {
          const boolLine = lines[k + 1] || '';
          apt = boolLine.includes('true');
          break;
        }
      }

      results.push({ line: i, ep, mp, qt, qid, secName, hasActionData, apt });
    }
  }
}

const output = results.map((r, idx) => 
  `[${idx}] Ln:${r.line} Section:${r.secName}\n    Score:${r.ep}/${r.mp} ActionPhotoReq:${r.apt} HasActionData:${r.hasActionData}\n    QID:${r.qid}\n    Q:${r.qt}\n`
).join('\n');

fs.writeFileSync('C:/Users/PC/Desktop/ai/tmp_results.txt', output, 'utf8');
console.log(`Found ${results.length} partial score answers. Written to tmp_results.txt`);
