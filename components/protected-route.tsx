"use client";

import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogoLoader } from "@/components/logo-loader";
import { UserRole } from "@/lib/types";
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

    // AuthProvider now pre-populates userProfile from localStorage cache synchronously.
    // So this fast-path covers the very first render — no flash, no spinner.
    if (userProfile && userProfile.role !== "pending" && allowedRoles.includes(userProfile.role)) {
        return <>{children}</>;
    }

    // Genuinely loading (no cache) — Firebase auth hasn't resolved yet
    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <LogoLoader />
            </div>
        );
    }

    if (!user) {
        return null; // Redirecting to login
    }

    if (!userProfile) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <LogoLoader />
            </div>
        );
    }

    if (userProfile.role === "pending") {
        return <UnauthorizedView />;
    }

    if (!allowedRoles.includes(userProfile.role)) {
        return null;
    }

    return <>{children}</>;
}
