const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fix() {
    const auditId = 'msQXWX9lWkGC3Hcn3yOr';
    const docRef = db.collection('audits').doc(auditId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
        console.log('Audit not found');
        return;
    }
    
    const data = docSnap.data();
    let found = false;
    
    for (let i = 0; i < data.sections.length; i++) {
        for (let j = 0; j < data.sections[i].answers.length; j++) {
            const answer = data.sections[i].answers[j];
            if (answer.questionText && answer.questionText.includes('Lokum tepsi doluluklar')) {
                console.log(`Found question: ${answer.questionText}`);
                
                // Set the action data
                data.sections[i].answers[j].actionData = {
                    status: 'approved',
                    storeNote: 'sistem kaynaklı dönüş görünmüyor',
                    storeImages: [], 
                    adminNote: '',
                    submittedAt: admin.firestore.Timestamp.fromDate(new Date('2026-04-23T12:00:00Z')),
                    completedAt: admin.firestore.Timestamp.fromDate(new Date('2026-04-23T12:05:00Z'))
                };
                found = true;
            }
        }
    }
    
    if (found) {
        await docRef.update({ sections: data.sections });
        console.log('Update successful');
    } else {
        console.log('Question not found');
    }
}

fix().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
