/**
 * Kütahya-2 (L0b53Rf7piDsoudtVtbh) audit'indeki tüm aksiyon maddelerini günceller:
 * - storeNote = "Sistem hatası sebebiyle dönüşler görünmemektedir"
 * - submittedAt = 02.04.2026 00:00 (TR saati → UTC: 01.04.2026 21:00)
 * - status = mevcut korunur, yoksa pending_admin
 */

import { execSync } from 'child_process';

const AUDIT_ID = 'L0b53Rf7piDsoudtVtbh';
const PROJECT_ID = 'tugba-auditpro';
const STORE_NOTE = 'Sistem hatası sebebiyle dönüşler görünmemektedir';
// 02.04.2026 00:00:00 TR (UTC+3) → UTC: 2026-04-01T21:00:00Z
const SUBMITTED_AT_ISO = '2026-04-01T21:00:00.000Z';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Get fresh token
const ACCESS_TOKEN = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
console.log('✅ Token alındı:', ACCESS_TOKEN.substring(0, 20) + '...');

async function get(path) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}: ${await res.text()}`);
    return res.json();
}

async function patch(path, fields) {
    const fieldPaths = Object.keys(fields).map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    const res = await fetch(`${BASE}${path}?${fieldPaths}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
    });
    if (!res.ok) throw new Error(`PATCH ${path} → HTTP ${res.status}: ${await res.text()}`);
    return res.json();
}

// Firestore Value helpers
function sv(s) { return { stringValue: String(s) }; }
function iv(n) { return { integerValue: String(n) }; }
function dv(n) { return { doubleValue: n }; }
function bv(b) { return { booleanValue: b }; }
function tv(iso) { return { timestampValue: iso }; }
function nv() { return { nullValue: null }; }
function av(arr) { return { arrayValue: { values: arr.map(toFSVal) } }; }
function mv(obj) {
    const fields = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) fields[k] = toFSVal(v);
    }
    return { mapValue: { fields } };
}

function toFSVal(val) {
    if (val === null || val === undefined) return nv();
    if (typeof val === 'boolean') return bv(val);
    if (typeof val === 'string') return sv(val);
    if (typeof val === 'number') {
        if (Number.isInteger(val)) return iv(val);
        return dv(val);
    }
    if (Array.isArray(val)) return av(val);
    if (typeof val === 'object' && val._fsType === 'timestamp') return tv(val.iso);
    if (typeof val === 'object') return mv(val);
    return nv();
}

function fromFSVal(val) {
    if (!val) return undefined;
    if ('stringValue' in val) return val.stringValue;
    if ('integerValue' in val) return parseInt(val.integerValue);
    if ('doubleValue' in val) return val.doubleValue;
    if ('booleanValue' in val) return val.booleanValue;
    if ('nullValue' in val) return null;
    if ('timestampValue' in val) return val.timestampValue;
    if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFSVal);
    if ('mapValue' in val) {
        const obj = {};
        for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
            obj[k] = fromFSVal(v);
        }
        return obj;
    }
    return undefined;
}

function fromDoc(doc) {
    const obj = {};
    for (const [k, v] of Object.entries(doc.fields || {})) {
        obj[k] = fromFSVal(v);
    }
    return obj;
}

async function run() {
    console.log(`\n📥 Audit getiriliyor: ${AUDIT_ID}`);
    const doc = await get(`/audits/${AUDIT_ID}`);
    const data = fromDoc(doc);

    if (!Array.isArray(data.sections)) {
        console.error('❌ sections bulunamadı');
        process.exit(1);
    }

    let patched = 0;

    const newSections = data.sections.map((section, sIdx) => {
        const newAnswers = (section.answers || []).map((answer, aIdx) => {
            const isActionNeeded =
                answer.answer &&
                typeof answer.answer === 'string' &&
                answer.answer.trim() !== '' &&
                answer.answer !== 'muaf' &&
                (Number(answer.earnedPoints) || 0) < (Number(answer.maxPoints) || 0);

            if (!isActionNeeded) return answer;

            const currentStatus = answer.actionData?.status;
            const newStatus = currentStatus && currentStatus !== '' ? currentStatus : 'pending_admin';

            console.log(`  [S${sIdx+1}:A${aIdx+1}] "${String(answer.questionText || '').substring(0, 55)}" → ${newStatus}`);
            patched++;

            return {
                ...answer,
                actionData: {
                    ...(answer.actionData || {}),
                    status: newStatus,
                    storeNote: STORE_NOTE,
                    submittedAt: { _fsType: 'timestamp', iso: SUBMITTED_AT_ISO },
                }
            };
        });
        return { ...section, answers: newAnswers };
    });

    console.log(`\n✏️  ${patched} madde güncelleniyor...`);

    // Rebuild sections in Firestore format and PATCH only sections field
    const sectionsFS = toFSVal(newSections);
    await patch(`/audits/${AUDIT_ID}`, { sections: sectionsFS });

    console.log(`\n✅ Tamamlandı! ${patched} aksiyon maddesi güncellendi.`);
    console.log(`   storeNote  : ${STORE_NOTE}`);
    console.log(`   submittedAt: 02.04.2026 00:00 (TR)`);
}

run().catch(err => {
    console.error('\n❌ Hata:', err.message);
    process.exit(1);
});
