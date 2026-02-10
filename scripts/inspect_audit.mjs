
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';

// Manual config since we might not load .env.local automatically in node without config
// attempting to load .env.local
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Simple check
if (!firebaseConfig.apiKey) {
    console.error("Error: Environment variables not loaded correctly.");
    process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspectAudit() {
    console.log("Searching for AFYON audits...");
    
    const q = query(collection(db, "audits"), where("storeName", "==", "AFYON"));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        console.log("No audits found for 'AFYON'.");
        return;
    }

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`\n=== Audit ID: ${doc.id} ===`);
        console.log(`Store: ${data.storeName}`);
        console.log(`Status: ${data.status}`);
        console.log(`CompletedAt: ${data.completedAt ? data.completedAt.toDate() : 'N/A'}`);

        let pendingPoints = 0;
        let pendingStore = 0;
        let pendingAdmin = 0;
        let rejected = 0;
        let approved = 0;

        // Check sections
        data.sections.forEach((section, sIndex) => {
            section.answers.forEach((answer, aIndex) => {
                const isActionNeeded = answer.answer === "hayir" || (answer.questionType === "checkbox" && (answer.earnedPoints || 0) < (answer.maxPoints || 0));
                
                if (isActionNeeded) {
                    pendingPoints++;
                    const status = answer.actionData ? answer.actionData.status : 'undefined';
                    
                    console.log(`\n  [${sIndex}-${aIndex}] Question: "${answer.questionText.substring(0, 50)}..."`);
                    console.log(`    Is Action Needed: ${isActionNeeded}`);
                    console.log(`    Action Status: ${status}`);
                    console.log(`    Store Note: "${answer.actionData?.storeNote || ""}"`);
                    console.log(`    Images: ${answer.actionData?.storeImages ? answer.actionData.storeImages.length : 0}`);

                    if (!status || status === 'pending_store') pendingStore++;
                    else if (status === 'rejected') rejected++;
                    else if (status === 'pending_admin') pendingAdmin++;
                    else if (status === 'approved') approved++;
                }
            });
        });

        console.log(`\n--- Summary ---`);
        console.log(`Total Action Items: ${pendingPoints}`);
        console.log(`Pending Store: ${pendingStore}`);
        console.log(`Pending Admin: ${pendingAdmin}`);
        console.log(`Rejected: ${rejected}`);
        console.log(`Approved: ${approved}`);
    });
}

inspectAudit().catch(console.error);
