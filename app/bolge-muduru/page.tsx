"use client";

import { useState, useEffect, useLayoutEffect, Suspense } from "react";
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
    
    // Initialize from URL or default to 'panel'
    const initialTab = (searchParams.get('tab') as 'panel' | 'scores' | 'settings') || 'panel';
    const [activeTab, setActiveTab] = useState<'panel' | 'scores' | 'settings'>(initialTab);

    // Sync state when URL updates (e.g. back button)
    useEffect(() => {
        const tab = searchParams.get('tab') as 'panel' | 'scores' | 'settings';
        if (tab && ['panel', 'scores', 'settings'].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    useEffect(() => {
        if (!authLoading) {
            if (userProfile?.role !== "bolge-muduru") {
                router.push("/");
                return;
            }
        }
    }, [authLoading, userProfile, router]);

    // Handle Tab Change (Client-side only to prevent reloads, exactly like magaza/panel)
    const handleTabChange = (tab: "panel" | "scores" | "settings") => {
        setActiveTab(tab);
        // We avoid full router push to prevent Next.js from re-fetching server data.
        // We only update the URL state locally so browser 'back' button feels correct.
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        window.history.replaceState({}, '', `${pathname}?${params.toString()}`);
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

            {/* Main Content - Render ALL components but control visibility with CSS */}
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
