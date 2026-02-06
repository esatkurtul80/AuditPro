import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
    // 1. Verify Admin Session (Basic check - middleware handles detailed protection, but good to have)
    // In a real app, you might verify the session cookie here using adminAuth.verifySessionCookie
    
    try {
        const adminApp = initAdmin();
        if (!adminApp) {
             return NextResponse.json({ error: "Failed to initialize Firebase Admin" }, { status: 500 });
        }

        // 2. Get Access Token for Google Cloud API
        // We use the same service account credentials initiated in firebase-admin
        const credential = adminApp.options.credential;
        if (!credential) {
             return NextResponse.json({ error: "Missing Admin Credentials" }, { status: 500 });
        }
        
        const accessTokenObj = await credential.getAccessToken();
        const accessToken = accessTokenObj.access_token;
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

        if (!projectId) {
            return NextResponse.json({ error: "Missing Project ID" }, { status: 500 });
        }

        // 3. Define Metric Queries
        // Google Cloud Monitoring API v3
        // Base URL: https://monitoring.googleapis.com/v3/projects/{name}/timeSeries
        
        // Helper to fetch metric
        const fetchMetric = async (metricType: string, alignmentPeriod = "86400s", aligner = "ALIGN_SUM", resourceTypeOverride?: string) => {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30); // Last 30 days

            // Determine resource type based on metric
            let resourceType = "firestore_instance";
            if (resourceTypeOverride !== undefined) {
                resourceType = resourceTypeOverride;
            } else if (metricType.includes("cloudfunctions")) {
                resourceType = "cloud_function";
            }

            let filter = `metric.type = "${metricType}"`;
            if (resourceType) {
                filter += ` AND resource.type = "${resourceType}"`;
            }

             console.log(`FetchMetric: ${metricType} -> ResourceType: '${resourceType}' -> Filter: ${filter}`);

            const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?filter=${encodeURIComponent(filter)}&interval.startTime=${startDate.toISOString()}&interval.endTime=${endDate.toISOString()}&aggregation.alignmentPeriod=${alignmentPeriod}&aggregation.perSeriesAligner=${aligner}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const text = await response.text();
                // Warn but don't crash whole page if one metric fails (optional, currently it returns error obj)
                console.error(`Monitoring API Error (${metricType}):`, text);
                return { error: text, status: response.status };
            }

            return await response.json();
        };

        // 4. Fetch Core Metrics Parallel
        // read_count, write_count, delete_count, storage_size, function_invocations, hosting_bandwidth
        const [reads, writes, deletes, storage, functionsUsage, hostingUsage, hostingStorage] = await Promise.all([
            fetchMetric("firestore.googleapis.com/document/read_count"),
            fetchMetric("firestore.googleapis.com/document/write_count"),
            fetchMetric("firestore.googleapis.com/document/delete_count"),
            // Storage is usually a gauge, so we might want ALIGN_MAX or ALIGN_MEAN for daily view
            fetchMetric("firestore.googleapis.com/document/storage_bytes", "86400s", "ALIGN_MAX"),
            // Cloud Functions Invocations
            fetchMetric("cloudfunctions.googleapis.com/function/execution_count"),
            // Hosting Bandwidth (Sent Bytes) - Empty resource type
            fetchMetric("firebasehosting.googleapis.com/network/sent_bytes_count", "86400s", "ALIGN_SUM", ""),
            // Hosting Storage (Total Bytes) - Empty resource type
            fetchMetric("firebasehosting.googleapis.com/storage/total_bytes", "86400s", "ALIGN_MAX", "")
        ]);

        console.log("Hosting Storage Raw:", JSON.stringify(hostingStorage, null, 2));
        console.log("Hosting Bandwidth Raw:", JSON.stringify(hostingUsage, null, 2));

        return NextResponse.json({
            projectId,
            data: {
                reads: reads,
                writes: writes,
                deletes: deletes,
                storage: storage,
                functionsInvocations: functionsUsage,
                hostingBandwidth: hostingUsage,
                hostingStorage: hostingStorage
            }
        });

    } catch (error: any) {
        console.error("Firebase Stats API Error:", error);
        return NextResponse.json({ 
            error: "Internal Server Error", 
            details: error.message 
        }, { status: 500 });
    }
}
