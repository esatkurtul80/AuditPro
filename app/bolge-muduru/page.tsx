"use client";

import { useEffect, useLayoutEffect, Suspense } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { RegionalManagerHeader } from "@/components/regional-manager/regional-header";
import { RegionalBottomNav } from "@/components/regional-manager/regional-bottom-nav";
import { RegionalDashboard } from "@/components/regional-manager/regional-dashboard";
import { RegionalScores } from "@/components/regional-manager/regional-scores";
import { Settings } from "lucide-react";

function RegionalContent() {
    const { userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    // Get active tab from URL or default to "panel"
    const activeTab = (searchParams.get("tab") as "panel" | "scores" | "settings") || "panel";

    useEffect(() => {
        if (!authLoading) {
            if (userProfile?.role !== "bolge-muduru") {
                router.push("/");
                return;
            }
        }
    }, [authLoading, userProfile, router]);

    // Handle Tab Change - Update URL
    const handleTabChange = (tab: "panel" | "scores" | "settings") => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        router.push(`${pathname}?${params.toString()}`);
    };

    // Scroll to top on tab change
    useLayoutEffect(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
    }, [activeTab]);

    if (authLoading) {
        return null;
    }

    if (userProfile?.role !== "bolge-muduru") {
        return null;
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <RegionalManagerHeader />

            {/* Main Content - Render based on activeTab */}
            <main className="animate-in fade-in duration-300">
                <div className={activeTab === "panel" ? "block" : "hidden"}>
                    <RegionalDashboard />
                </div>
                <div className={activeTab === "scores" ? "block" : "hidden"}>
                    <RegionalScores />
                </div>
                <div className={activeTab === "settings" ? "block" : "hidden"}>
                    <div className="container mx-auto py-4 px-4">
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <Settings className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Ayarlar</h3>
                            <p className="text-muted-foreground">Çok yakında...</p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom Navigation */}
            <RegionalBottomNav activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
    );
}

export default function RegionalManagerPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>}>
            <RegionalContent />
        </Suspense>
    );
}
