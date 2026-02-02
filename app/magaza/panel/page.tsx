"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { StoreHomeView } from "@/components/store/store-home-view";
import { StoreReportsView } from "@/components/store/store-reports-view";
import { StoreNotificationsView } from "@/components/store/store-notifications-view";
import { StoreSettingsView } from "@/components/store/store-settings-view"; // Import Settings
import { StoreBottomNav } from "@/components/store/store-bottom-nav";
import { useAuth } from "@/components/auth-provider";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function StoreDashboardView() {
    const [activeTab, setActiveTab] = useState<'panel' | 'reports' | 'notifications' | 'settings'>('panel');
    const { userProfile } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    // Scroll to top INSTANTLY on tab change
    // useLayoutEffect ensures this runs BEFORE the browser paints the new screen
    useLayoutEffect(() => {
        // 1. Try scrolling the specific layout container (Primary Fix)
        const scrollContainer = document.getElementById('main-content-scroll-area');
        if (scrollContainer) {
            scrollContainer.scrollTop = 0;
        }
        
        // 2. Fallback to window/body scroll
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
                onTabChange={setActiveTab}
                notificationCount={unreadCount}
            />
        </div>
    );
}
