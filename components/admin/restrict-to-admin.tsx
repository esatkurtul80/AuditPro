"use client";

import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export function RestrictToAdminWrapper({ children }: { children: React.ReactNode }) {
  const { userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!userProfile || userProfile.role !== "admin")) {
      // Not admin, redirect
      router.push("/");
    }
  }, [userProfile, loading, router]);

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userProfile || userProfile.role !== "admin") {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}
