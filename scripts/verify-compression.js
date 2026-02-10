
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

// Polyfill XMLHttpRequest for Firebase (if available, otherwise we might need to rely on what's present)
try {
    global.XMLHttpRequest = require('xhr2');
} catch (e) {
    console.log("xhr2 not found, trying without polyfill. Firebase might fail in Node.");
}

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
        console.log("Auth Warning: " + e.message);
    }

    try {
        console.log("Querying Audits...");
        const auditsRef = collection(db, "audits");
        // Get latest 3 in case the very last one doesn't have images
        const q = query(auditsRef, orderBy("createdAt", "desc"), limit(3));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("No audits found.");
            process.exit(0);
        }

        console.log(`Analyzing ${snapshot.docs.length} recent audits...`);

        let totalImagesFound = 0;

        for (const auditDoc of snapshot.docs) {
            const audit = auditDoc.data();
            const auditId = auditDoc.id;
            const auditorName = audit.auditorName || 'Unknown';
            const storeName = audit.storeName || 'Unknown';
            
            console.log(`\nAudit [${auditId}]: ${storeName} by ${auditorName}`);
            
            let imageUrls = [];

            if (audit.sections) {
                audit.sections.forEach(section => {
                    section.answers.forEach(answer => {
                        // Direct validation images
                        if (answer.images && Array.isArray(answer.images)) {
                            answer.images.forEach(img => {
                                if(typeof img === 'string') imageUrls.push({url: img, type: 'Audit Photo'});
                            });
                        }
                        // Store action images
                        if (answer.actionData && answer.actionData.storeImages) {
                            answer.actionData.storeImages.forEach(img => {
                                if(typeof img === 'string') imageUrls.push({url: img, type: 'Action Photo'});
                            });
                        }
                    });
                });
            }

            if (imageUrls.length === 0) {
                console.log("  No images in this audit.");
                continue;
            }

            totalImagesFound += imageUrls.length;
            
            // Check last 5 images of this audit
            const recentImages = imageUrls.slice(-5); 

            for (const img of recentImages) {
                if (img.url.startsWith("http")) {
                    try {
                        const res = await fetch(img.url, { method: 'HEAD' });
                        const size = res.headers.get('content-length');
                        const contentType = res.headers.get('content-type');
                        
                        if (size) {
                            const sizeVal = parseInt(size);
                            const sizeMB = (sizeVal / (1024 * 1024)).toFixed(2);
                            const sizeKB = (sizeVal / 1024).toFixed(0);
                            
                            let status = "✅ OK";
                            if (sizeVal > 600 * 1024) status = "⚠️ LARGE";
                            
                            console.log(`  [${img.type}] ${sizeKB} KB (${sizeMB} MB) ${status}`);
                        }
                    } catch (err) {
                        console.log("  Error checking size: " + err.message);
                    }
                }
            }
        }

        if (totalImagesFound === 0) {
            console.log("\nNo images found in the recent audits to verify.");
        }

    } catch (error) {
        console.log("Error: " + error.message);
    }
}

checkImages().then(() => {
    setTimeout(() => process.exit(0), 2000);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
