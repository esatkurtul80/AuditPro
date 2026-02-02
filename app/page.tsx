"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { Loader2 } from "lucide-react";

function HomePageContent() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (userProfile) {
        // Mevcut query parametrelerini koru (örn: notificationId)
        const params = new URLSearchParams(searchParams.toString());
        const queryString = params.toString() ? `?${params.toString()}` : "";

        // Kullanıcıyı rolüne göre yönlendir
        switch (userProfile.role) {
          case "admin":
            router.push(`/admin/dashboard${queryString}`);
            break;
          case "denetmen":
            router.push(`/denetmen/panel${queryString}`);
            break;
          case "magaza":
            router.push(`/magaza/panel${queryString}`);
            break;
          case "bolge-muduru":
            router.push(`/bolge-muduru${queryString}`);
            break;
          case "pending":
            // Pending kullanıcılar bu sayfada kalır
            break;
          default:
            router.push("/login");
        }
      }
    }
  }, [user, userProfile, loading, router, searchParams]);

  return (
    <ProtectedRoute allowedRoles={["admin", "denetmen", "magaza", "bolge-muduru", "pending"]}>
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </ProtectedRoute>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <HomePageContent />
    </Suspense>
  );
}
