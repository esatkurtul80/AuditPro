"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation"; // Add router/pathname
import { StoreHomeView } from "@/components/store/store-home-view";
import { StoreReportsView } from "@/components/store/store-reports-view";
import { StoreNotificationsView } from "@/components/store/store-notifications-view";
import { StoreSettingsView } from "@/components/store/store-settings-view";
import { StoreBottomNav } from "@/components/store/store-bottom-nav";
import { useAuth } from "@/components/auth-provider";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function StoreDashboardView() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const { userProfile } = useAuth();
    
    // Initialize from URL or default to 'panel'
    const initialTab = (searchParams.get('tab') as 'panel' | 'reports' | 'notifications' | 'settings') || 'panel';
    const [activeTab, setActiveTab] = useState<'panel' | 'reports' | 'notifications' | 'settings'>(initialTab);
    const [unreadCount, setUnreadCount] = useState(0);

    // Sync state when URL updates (e.g. back button or external navigation)
    useEffect(() => {
        const tab = searchParams.get('tab') as 'panel' | 'reports' | 'notifications' | 'settings';
        if (tab && ['panel', 'reports', 'notifications', 'settings'].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    // Handle Tab Change (Client-side only to prevent reloads)
    const handleTabChange = (tab: 'panel' | 'reports' | 'notifications' | 'settings') => {
        setActiveTab(tab);
        // We do NOT update URL here to prevent triggering any router/suspense loading states
        // window.history.replaceState({}, '', url.toString()); 
    };

    // Scroll to top on tab change
    useLayoutEffect(() => {
        const scrollContainer = document.getElementById('main-content-scroll-area');
        if (scrollContainer) {
            scrollContainer.scrollTop = 0;
        }
        window.scrollTo(0, 0);
        document.body.scrollTop = 0; 
        document.documentElement.scrollTop = 0;
    }, [activeTab]);

    // Track unread notifications for badge
    useEffect(() => {
        if (!userProfile?.uid) return;

        const q = query(
            collection(db, "notifications"),
            where("userId", "==", userProfile.uid),
            where("read", "==", false)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUnreadCount(snapshot.size);
        });

        return () => unsubscribe();
    }, [userProfile]);

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Main Content Area - Render based on activeTab */}
            <main className="animate-in fade-in duration-300">
                <div className={activeTab === 'panel' ? 'block' : 'hidden'}>
                    <StoreHomeView />
                </div>
                <div className={activeTab === 'reports' ? 'block' : 'hidden'}>
                    <StoreReportsView />
                </div>
                <div className={activeTab === 'notifications' ? 'block' : 'hidden'}>
                    <StoreNotificationsView />
                </div>
                {/* Add Settings View */}
                <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
                    <StoreSettingsView />
                </div>
            </main>

            {/* Custom Bottom Nav */}
            <StoreBottomNav 
                activeTab={activeTab} 
                onTabChange={handleTabChange}
                notificationCount={unreadCount}
            />
        </div>
    );
}
