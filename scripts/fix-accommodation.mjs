import { readFileSync, writeFileSync } from 'fs';

const filePath = 'components/admin/schedule/ai-schedule-dialog.tsx';
let content = readFileSync(filePath, 'utf8');

// Old: only Cuma and >80km cases, no explicit home note for ≤80km
const OLD_MARKER = "// (Mağaza zaten ≤150km kısıtı ile seçilmiştir.)";

if (!content.includes(OLD_MARKER)) {
  console.log('Marker not found — already patched or changed. Current block:');
  const idx = content.indexOf('🏠 Eve dönüş');
  console.log(content.slice(Math.max(0, idx - 300), idx + 200));
  process.exit(0);
}

const oldBlock = `                    if (dayKey === 'Cuma') {
                        // §4.2: Cuma akşamı eve dönüş zorunlu — lojman asla önerilmez.
                        // (Mağaza zaten ≤150km kısıtı ile seçilmiştir.)
                        routeNote = \`🏠 Eve dönüş (~\${Math.round(roadFromHome)} km yol)\`;
                    } else if (roadFromHome > LOJMAN_ROAD_LIMIT) {
                        const nearest = findNearestLojman(storeCoords[0], storeCoords[1]);
                        if (nearest) {
                            accommodation = nearest.lojman.name;
                            accommodationDist = nearest.dist;
                            routeNote = \`\${nearest.lojman.name} konaklaması önerilir\`;
                        } else {
                            accommodation = \`\${city} Konaklama\`;
                            routeNote = \`Lojman tanımlı değil — Lojmanlar sayfasından ekleyiniz\`;
                        }
                    }`;

const newBlock = `                    if (dayKey === 'Cuma') {
                        // §4.2: Cuma akşamı eve dönüş zorunlu — lojman asla önerilmez.
                        routeNote = \`🏠 Eve dönüş (~\${Math.round(roadFromHome)} km yol)\`;
                    } else if (roadFromHome <= LOJMAN_ROAD_LIMIT) {
                        // §5.1: Mağaza eve ≤80 km yol → denetmen akşam evine döner, lojman gerekmez.
                        routeNote = \`🏠 Eve dönüş (~\${Math.round(roadFromHome)} km yol)\`;
                    } else {
                        // §5.1: Mağaza evden >80 km → lojman önerilir.
                        const nearest = findNearestLojman(storeCoords[0], storeCoords[1]);
                        if (nearest) {
                            accommodation = nearest.lojman.name;
                            accommodationDist = nearest.dist;
                            routeNote = \`\${nearest.lojman.name} konaklaması önerilir\`;
                        } else {
                            accommodation = \`\${city} Konaklama\`;
                            routeNote = \`Lojman tanımlı değil — Lojmanlar sayfasından ekleyiniz\`;
                        }
                    }`;

if (!content.includes(oldBlock)) {
  console.log('❌ Old block not found exactly. Searching for closest match...');
  const idx = content.indexOf("if (dayKey === 'Cuma')");
  console.log(JSON.stringify(content.slice(idx, idx + 600)));
  process.exit(1);
}

content = content.replace(oldBlock, newBlock);
writeFileSync(filePath, content, 'utf8');
console.log('✅ SUCCESS — accommodation logic updated.');
