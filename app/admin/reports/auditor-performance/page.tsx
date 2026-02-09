"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import with SSR disabled to fix Recharts ResponsiveContainer issue
// Error: "Cannot assign to read only property 'pendingLanes'" in React 18+
const AuditorPerformanceContent = dynamic(
    () => import("./content").then((mod) => mod.AuditorPerformanceContent),
    {
        ssr: false,
        loading: () => (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ),
    }
);

export default function AuditorPerformancePage() {
    return <AuditorPerformanceContent />;
}
