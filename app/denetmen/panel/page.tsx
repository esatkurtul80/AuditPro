"use client";

import { DashboardLayout } from "@/components/dashboard-layout";


export default function PanelPage() {
    return (
        <DashboardLayout>
            <div className="container mx-auto py-8 px-4 md:px-6">
                <h1 className="text-3xl font-bold mb-6">Panel</h1>
                <div className="text-muted-foreground">
                    Bu sayfa yapım aşamasındadır.
                </div>
            </div>
        </DashboardLayout>
    );
}
