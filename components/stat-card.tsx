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
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">
                            {title}
                        </p>
                        <h3 className="text-3xl font-bold mt-2">{value}</h3>
                        {description && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {description}
                            </p>
                        )}
                    </div>
                    <div className={cn(
                        "flex items-center justify-center rounded-full h-14 w-14",
                        iconBg
                    )}>
                        <Icon className={cn("h-7 w-7", iconColor)} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
