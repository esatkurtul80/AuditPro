
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, Timestamp } = require('firebase/firestore');

// Mock config
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// We need to read env vars, but this is a script.
// Assuming we can just hardcode or read from process.env if loaded.
// Since I can't guarantee env vars are loaded in this context without dotenv, I'll try to use dotenv if available or assume they are set.

require('dotenv').config({ path: '.env.local' });

const app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

const db = getFirestore(app);

async function inspectAudit() {
    console.log("Searching for AFYON audits...");
    
    // Search by storeName (case sensitive usually, but let's try exact first)
    // Audits collection
    const q = query(collection(db, "audits"), where("storeName", "==", "AFYON"));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        console.log("No audits found for 'AFYON'. Trying to list all stores.");
        return;
    }

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`\nAudit ID: ${doc.id}`);
        console.log(`Store: ${data.storeName}`);
        console.log(`Status: ${data.status}`);
        console.log(`CompletedAt: ${data.completedAt ? data.completedAt.toDate() : 'N/A'}`);

        let allResolved = true;
        let pending = 0;
        let rejected = 0;

        // Check sections
        data.sections.forEach((section, sIndex) => {
            section.answers.forEach((answer, aIndex) => {
                const isActionNeeded = answer.answer === "hayir" || (answer.questionType === "checkbox" && answer.earnedPoints < answer.maxPoints);
                if (isActionNeeded) {
                    const status = answer.actionData ? answer.actionData.status : 'undefined/pending_store';
                    
                    console.log(`\n  Section ${sIndex}, Answer ${aIndex}:`);
                    console.log(`    Question: ${answer.questionText}`);
                    console.log(`    Is Action Needed: ${isActionNeeded}`);
                    console.log(`    Action Data Status: ${status}`);
                    console.log(`    Note: ${answer.actionData?.storeNote || "No Store Note"}`);
                    console.log(`    Images: ${answer.actionData?.storeImages?.length || 0}`);
                    
                    if (!status || status === 'pending_store') pending++;
                    if (status === 'rejected') rejected++;
                }
            });
        });

        console.log(`\nStats: Pending: ${pending}, Rejected: ${rejected}`);
    });
}

inspectAudit().catch(console.error);
