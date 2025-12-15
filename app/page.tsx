"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (userProfile) {
        // Kullanıcıyı rolüne göre yönlendir
        switch (userProfile.role) {
          case "admin":
            router.push("/admin/dashboard");
            break;
          case "denetmen":
            router.push("/denetmen");
            break;
          case "magaza":
            router.push("/magaza");
            break;
          case "pending":
            // Pending kullanıcılar bu sayfada kalır, ProtectedRoute UnauthorizedView gösterecek
            break;
          default:
            router.push("/login");
        }
      }
    }
  }, [user, userProfile, loading, router]);

  return (
    <ProtectedRoute allowedRoles={["admin", "denetmen", "magaza", "pending"]}>
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </ProtectedRoute>
  );
}
