import { DashboardLayout } from "@/components/dashboard-layout";
import { NotificationFeed } from "@/components/announcements/notification-feed";
import { WeeklyScheduleList } from "@/components/auditor/weekly-schedule-list";

export default function PanelPage() {
    return (
        <DashboardLayout>
            <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
                 {/* Notifications */}
                 <div className="max-w-4xl mx-auto w-full">
                    <NotificationFeed />
                 </div>
                 
                 {/* Weekly Schedule & Analysis */}
                 <div className="max-w-7xl mx-auto w-full">
                    <WeeklyScheduleList />
                 </div>
            </div>
        </DashboardLayout>
    );
}
