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

             console.log(`FetchMetricV2: ${metricType} -> ResourceType: '${resourceType}' -> Filter: ${filter}`);

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
        const [reads, writes, deletes, storage, functionsUsage, functionsExecutionTime, hostingUsage, hostingStorage] = await Promise.all([
            fetchMetric("firestore.googleapis.com/document/read_count"),
            fetchMetric("firestore.googleapis.com/document/write_count"),
            fetchMetric("firestore.googleapis.com/document/delete_count"),
            // Storage is usually a gauge, so we might want ALIGN_MAX or ALIGN_MEAN for daily view
            fetchMetric("firestore.googleapis.com/document/storage_bytes", "86400s", "ALIGN_MAX"),
            fetchMetric("cloudfunctions.googleapis.com/function/execution_count"),
            // Cloud Functions Execution Time (for cost calculation) - in nanoseconds
            fetchMetric("cloudfunctions.googleapis.com/function/execution_time"),
            // Hosting Bandwidth (Sent Bytes) - Empty resource type
            fetchMetric("firebasehosting.googleapis.com/network/sent_bytes_count", "86400s", "ALIGN_SUM", ""),
            // Hosting Storage (Total Bytes) - Empty resource type
            fetchMetric("firebasehosting.googleapis.com/storage/total_bytes", "86400s", "ALIGN_MAX", "")
        ]);

        // 5. Fetch Actual Billing Data from BigQuery
        let billingData = null;
        try {
            const bigQueryUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`;
            
            // Step A: Find the table name
            // We look for a table in 'billing_data' dataset starting with 'gcp_billing_export_v1_'
            const findTableQuery = `SELECT table_name FROM \`${projectId}.billing_data.INFORMATION_SCHEMA.TABLES\` WHERE table_name LIKE 'gcp_billing_export_v1_%' LIMIT 1`;
            
            const findTableRes = await fetch(bigQueryUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: findTableQuery, useLegacySql: false })
            });

            if (findTableRes.ok) {
                const findTableJson = await findTableRes.json();
                if (findTableJson.rows && findTableJson.rows.length > 0) {
                    const tableName = findTableJson.rows[0].f[0].v;
                    const fullTableName = `${projectId}.billing_data.${tableName}`;

                    // Step B: Query the cost
                    // Current month filter
                    const costQuery = `
                        SELECT 
                            SUM(cost) as total_cost,
                            service.description as service_name
                        FROM \`${fullTableName}\`
                        WHERE usage_start_time >= TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH))
                        GROUP BY service_name
                    `;

                    const costRes = await fetch(bigQueryUrl, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: costQuery, useLegacySql: false })
                    });

                    if (costRes.ok) {
                        const costJson = await costRes.json();
                        // Parse BigQuery response format: { rows: [ { f: [ {v: "1.23"}, {v: "Service Name"} ] } ] }
                        if (costJson.rows) {
                             billingData = costJson.rows.map((row: any) => ({
                                cost: parseFloat(row.f[0].v),
                                service: row.f[1].v
                            }));
                        } else {
                            // No rows means 0 cost or no data yet
                            billingData = [];
                        }
                    } else {
                        console.error("BigQuery Cost Query Failed:", await costRes.text());
                    }
                } else {
                   console.warn("BigQuery: No billing table found yet (might be provisioning).");
                }
            } else {
                 console.error("BigQuery Find Table Failed:", await findTableRes.text());
            }

        } catch (bqError) {
            console.error("BigQuery Error:", bqError);
            // Non-blocking, we just return null for billingData
        }

        console.log("Hosting Storage Raw V2:", JSON.stringify(hostingStorage, null, 2));
        console.log("Hosting Bandwidth Raw V2:", JSON.stringify(hostingUsage, null, 2));

        return NextResponse.json({
            projectId,
            data: {
                reads: reads,
                writes: writes,
                deletes: deletes,
                storage: storage,
                functionsInvocations: functionsUsage,
                functionsExecutionTime: functionsExecutionTime,
                hostingBandwidth: hostingUsage,
                hostingStorage: hostingStorage,
                billing: billingData
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
