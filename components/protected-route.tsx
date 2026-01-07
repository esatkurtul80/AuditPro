"use client";

import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogoLoader } from "@/components/logo-loader";
import { UserRole } from "@/lib/types";
import { toast } from "sonner";
import { UnauthorizedView } from "@/components/unauthorized-view";

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/login");
            } else if (userProfile && userProfile.role !== "pending" && !allowedRoles.includes(userProfile.role)) {
                router.push("/");
            }
        }
    }, [user, userProfile, loading, allowedRoles, router]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <LogoLoader />
            </div>
        );
    }

    if (!user || !userProfile) {
        return null;
    }

    if (userProfile.role === "pending") {
        return <UnauthorizedView />;
    }

    if (!allowedRoles.includes(userProfile.role)) {
        return null;
    }

    return <>{children}</>;
}
