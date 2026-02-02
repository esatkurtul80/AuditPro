"use client";

import { BarChart3 } from "lucide-react";

export function StoreReportsView() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 space-y-4">
            <div className="h-20 w-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                <BarChart3 className="h-10 w-10 text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Raporlar</h2>
            <p className="text-muted-foreground max-w-[300px]">
                Detaylı mağaza raporları ve analizleri bu ekranda görüntülenecektir.
            </p>
        </div>
    );
}
