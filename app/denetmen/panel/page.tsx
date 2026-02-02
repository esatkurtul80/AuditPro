"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { NotificationFeed } from "@/components/announcements/notification-feed";

export default function PanelPage() {
    return (
        <DashboardLayout>
            <div className="container mx-auto py-6 px-4 md:px-6">
                 {/* Notifications */}
                 <NotificationFeed />
                 
                <div className="flex flex-col items-center justify-center min-h-[40vh]">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-slate-900">Panel</h1>
                        <p className="text-slate-500 mt-2">Denetimlerinizi ve görevlerinizi buradan takip edebilirsiniz.</p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
