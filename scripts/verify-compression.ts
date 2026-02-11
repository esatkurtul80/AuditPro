
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, orderBy, limit, getDocs } = require("firebase/firestore");
const { getAuth, signInAnonymously } = require("firebase/auth");

// Config from lib/firebase.ts
const firebaseConfig = {
    apiKey: "AIzaSyAWNOeyW0mHSqhjcLqdhPoL4TmOzyP7f6w",
    authDomain: "tugba-auditpro.firebaseapp.com",
    projectId: "tugba-auditpro",
    storageBucket: "tugba-auditpro.firebasestorage.app",
    messagingSenderId: "187720079346",
    appId: "1:187720079346:web:fcc9bd140dc790196bbd6b",
};

// Polyfill for fetch
// @ts-ignore
global.XMLHttpRequest = require('xhr2');

async function checkImages() {
    console.log("Initialize Firebase...");
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    try {
        console.log("Auth Anonymously...");
        await signInAnonymously(auth);
        console.log("Auth OK.");
    } catch (e) {
        console.log("Auth Failed (continuing): " + (e instanceof Error ? e.message : String(e)));
    }

    try {
        console.log("Querying Audits...");
        const auditsRef = collection(db, "audits");
        const q = query(auditsRef, orderBy("createdAt", "desc"), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("No audits found.");
            return;
        }

        const auditDoc = snapshot.docs[0];
        const audit = auditDoc.data();
        console.log("Audit ID: " + auditDoc.id);
        console.log("Store: " + audit.storeName);

        let imageUrls: string[] = [];

        if (audit.sections) {
            audit.sections.forEach((section: any) => {
                section.answers.forEach((answer: any) => {
                    if (answer.images && Array.isArray(answer.images)) {
                        answer.images.forEach((img: any) => imageUrls.push(img));
                    }
                    if (answer.actionData && answer.actionData.storeImages) {
                        answer.actionData.storeImages.forEach((img: any) => imageUrls.push(img));
                    }
                });
            });
        }

        console.log("Total Images: " + imageUrls.length);
        const recentImages = imageUrls.slice(0, 5);

        for (const url of recentImages) {
            if (typeof url === 'string' && url.startsWith("http")) {
                try {
                    const res = await fetch(url, { method: 'HEAD' });
                    const size = res.headers.get('content-length');
                    if (size) {
                        const sizeMB = (parseInt(size) / (1024 * 1024)).toFixed(2);
                        const sizeKB = (parseInt(size) / 1024).toFixed(0);
                        console.log("Image: " + url.substring(0, 30) + "...");
                        console.log("  Size: " + sizeMB + " MB (" + sizeKB + " KB)");
                    }
                } catch (err) {
                    console.log("  Error fetching: " + (err instanceof Error ? err.message : String(err)));
                }
            }
        }

    } catch (error) {
        console.log("Error: " + (error instanceof Error ? error.message : String(error)));
    }
}

checkImages().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
