"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/components/auth-provider";

export default function MagazaLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-background">
            <ProtectedRoute allowedRoles={["magaza"]}>
                <DashboardLayout>{children}</DashboardLayout>
            </ProtectedRoute>
        </div>
    );
}
