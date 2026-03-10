"use client";

import { useState, useEffect, useLayoutEffect, Suspense } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ReportManagerHeader } from "@/components/report-manager/report-header";
import { ReportSidebar } from "@/components/report-manager/report-sidebar";
import { Loader2 } from "lucide-react";

// Lazy-load the actual report components (they are heavy but already exist)
// We directly import them; since they are client components, they won't cause SSR issues.
// Using dynamic CSS show/hide for zero-wait SPA (same pattern as bolge-muduru)
import PersonnelReportPage from "@/app/admin/reports/personnel/page";
import PuanRaporuPage from "@/app/admin/reports/puan-raporu/page";
import QuestionsReportPage from "@/app/admin/reports/questions/page";
import ActionPerformancePage from "@/app/admin/reports/action-performance/page";
import AuditorPerformancePage from "@/app/admin/reports/auditor-performance/page";

// Panel: daily audits dashboard (store special reports)
import ReportPanelDashboard from "@/components/report-manager/report-panel-dashboard";
import { ReportScheduleView } from "@/components/report-manager/report-schedule-view";

type ReportTab = "panel" | "personel" | "puan" | "soru" | "aksiyon" | "denetci" | "program";

const VALID_TABS: ReportTab[] = ["panel", "personel", "puan", "soru", "aksiyon", "denetci", "program"];

function ReportManagerContent() {
    const { userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const initialTab = (searchParams.get("tab") as ReportTab) || "panel";
    const [activeTab, setActiveTab] = useState<ReportTab>(
        VALID_TABS.includes(initialTab) ? initialTab : "panel"
    );

    // Sync when URL changes (back/forward)
    useEffect(() => {
        const tab = searchParams.get("tab") as ReportTab;
        if (tab && VALID_TABS.includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    // Auth guard
    useEffect(() => {
        if (!authLoading) {
            if (userProfile?.role !== "rapor-yoneticisi") {
                router.push("/");
            }
        }
    }, [authLoading, userProfile, router]);

    const handleTabChange = (tab: ReportTab) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        window.history.replaceState({}, "", `${pathname}?${params.toString()}`);
    };

    // Scroll to top on tab change
    useLayoutEffect(() => {
        window.scrollTo(0, 0);
    }, [activeTab]);

    if (authLoading) return null;
    if (userProfile?.role !== "rapor-yoneticisi") return null;

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:shrink-0 lg:border-r">
                <ReportSidebar activeTab={activeTab} onTabChange={handleTabChange} />
            </aside>

            {/* Main area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <ReportManagerHeader activeTab={activeTab} onTabChange={handleTabChange} />

                {/* Content - CSS show/hide for instant SPA tabs */}
                <main className="flex-1 overflow-y-auto overscroll-contain pb-8">
                    <div className={activeTab === "panel" ? "block" : "hidden"}>
                        <ReportPanelDashboard />
                    </div>
                    <div className={activeTab === "personel" ? "block" : "hidden"}>
                        <PersonnelReportPage />
                    </div>
                    <div className={activeTab === "puan" ? "block" : "hidden"}>
                        <PuanRaporuPage />
                    </div>
                    <div className={activeTab === "soru" ? "block" : "hidden"}>
                        <QuestionsReportPage />
                    </div>
                    <div className={activeTab === "aksiyon" ? "block" : "hidden"}>
                        <ActionPerformancePage />
                    </div>
                    <div className={activeTab === "denetci" ? "block" : "hidden"}>
                        <AuditorPerformancePage />
                    </div>
                    <div className={activeTab === "program" ? "block h-full" : "hidden"} style={{ height: 'calc(100vh - 64px)' }}>
                        <ReportScheduleView />
                    </div>
                </main>
            </div>
        </div>
    );
}

export default function ReportManagerPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            }
        >
            <ReportManagerContent />
        </Suspense>
    );
}
