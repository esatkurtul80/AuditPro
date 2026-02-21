import { cookies } from "next/headers";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { SettingsCleanup } from "@/components/admin/settings-cleanup";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    // Read the session cookie set by AuthProvider on the client.
    // Firebase Hosting ONLY passes the '__session' cookie to SSR functions.
    // This lets the server render the correct sidebar menu without skeleton flash.
    const cookieStore = await cookies();
    const initialRole = cookieStore.get("__session")?.value ?? null;

    return (
        <DashboardLayout>
            {/* Handles 2FA session cleanup on navigation — needs usePathname (client) */}
            <SettingsCleanup />
            <ProtectedRoute allowedRoles={["admin"]}>
                {children}
            </ProtectedRoute>
        </DashboardLayout>
    );
}
