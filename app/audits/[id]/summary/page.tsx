"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AuditSummaryRedirect() {
    const params = useParams();
    const router = useRouter();
    const auditId = params.id as string;

    useEffect(() => {
        // Redirect to actions page
        router.replace(`/audits/${auditId}/actions`);
    }, [auditId, router]);

    return null;
}
