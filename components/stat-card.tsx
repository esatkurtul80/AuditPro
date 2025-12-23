import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
    title: string;
    value: number | string;
    icon: LucideIcon;
    description?: string;
    iconColor?: string;
    iconBg?: string;
}

export function StatCard({
    title,
    value,
    icon: Icon,
    description,
    iconColor = "text-blue-600",
    iconBg = "bg-blue-100"
}: StatCardProps) {
    return (
        <Card className="relative overflow-hidden border-t-0 border-l-0 border-r-0 border-b-0 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200 group bg-white dark:bg-slate-900">
            {/* Decorative Background Element */}
            <div className={cn(
                "absolute -right-6 -top-6 h-32 w-32 rounded-full opacity-10 group-hover:opacity-20 transition-opacity",
                iconBg.replace("100", "500") // Attempt to get a darker shade if possible, or just use the bg
            )} />

            {/* Another decorative blob */}
            <div className={cn(
                "absolute -right-10 -bottom-10 h-40 w-40 rounded-full opacity-5 group-hover:scale-110 transition-transform",
                iconBg
            )} />

            <CardContent className="p-6 relative z-10">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                            {title}
                        </p>
                        <h3 className="text-4xl font-extrabold mt-3 tracking-tight text-slate-800 dark:text-slate-100">
                            {value}
                        </h3>
                    </div>
                    <div className={cn(
                        "flex items-center justify-center rounded-2xl h-14 w-14 shadow-inner ring-1 ring-white/50 backdrop-blur-sm",
                        iconBg
                    )}>
                        <Icon className={cn("h-7 w-7", iconColor)} />
                    </div>
                </div>

                {description && (
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full", iconColor.replace("text-", "bg-"))} />
                        <p className="text-xs font-medium text-muted-foreground/80">
                            {description}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
