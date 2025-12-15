"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    LayoutDashboard,
    Users,
    Store,
    FileQuestion,
    LayoutList,
    ClipboardList,
    CheckSquare,
    BarChart3,
    LogOut,
    Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function MainNav() {
    const { userProfile, signOut } = useAuth();
    const pathname = usePathname();

    const adminLinks = [
        { href: "/admin/dashboard", label: "Panel", icon: LayoutDashboard },
        { href: "/admin/users", label: "Kullanıcılar", icon: Users },
        { href: "/admin/stores", label: "Mağazalar", icon: Store },
        { href: "/admin/actions", label: "Aksiyonlar", icon: CheckSquare },
        { href: "/admin/reports/stores", label: "Raporlar", icon: BarChart3 },
    ];

    const auditSubLinks = [
        { href: "/admin/questions", label: "Sorular", icon: FileQuestion },
        { href: "/admin/sections", label: "Bölümler", icon: LayoutList },
        { href: "/admin/audit-types", label: "Denetim Formları", icon: ClipboardList },
    ];

    const denetmenLinks = [
        { href: "/denetmen", label: "Denetimlerim", icon: ClipboardList },
    ];

    const magazaLinks = [
        { href: "/magaza", label: "Aksiyonlarım", icon: CheckSquare },
    ];

    const links =
        userProfile?.role === "admin"
            ? adminLinks
            : userProfile?.role === "denetmen"
                ? denetmenLinks
                : magazaLinks;

    return (
        <nav className="border-b bg-white">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                {/* Logo Left */}
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
                        <span className="text-xl font-bold text-white">A</span>
                    </div>
                    <span className="text-xl font-bold">AuditPro</span>
                </Link>

                {/* Navigation Right */}
                <div className="flex items-center gap-4">
                    {/* Desktop Navigation */}
                    {userProfile?.role === "admin" && (
                        <div className="hidden items-center gap-1 md:flex">
                            {adminLinks.map((link) => {
                                const Icon = link.icon;
                                const isActive = pathname === link.href;
                                return (
                                    <Link key={link.href} href={link.href}>
                                        <Button
                                            variant={isActive ? "default" : "ghost"}
                                            size="sm"
                                            className="gap-2"
                                        >
                                            <Icon className="h-4 w-4" />
                                            {link.label}
                                        </Button>
                                    </Link>
                                );
                            })}

                            {/* Denetim Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant={auditSubLinks.some(l => pathname === l.href) ? "default" : "ghost"}
                                        size="sm"
                                        className="gap-2"
                                    >
                                        <ClipboardList className="h-4 w-4" />
                                        Denetim
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {auditSubLinks.map((link) => {
                                        const Icon = link.icon;
                                        return (
                                            <DropdownMenuItem key={link.href} asChild>
                                                <Link href={link.href} className="flex items-center gap-2">
                                                    <Icon className="h-4 w-4" />
                                                    {link.label}
                                                </Link>
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}

                    {userProfile?.role === "denetmen" && (
                        <div className="hidden items-center gap-1 md:flex">
                            {denetmenLinks.map((link) => {
                                const Icon = link.icon;
                                const isActive = pathname === link.href;
                                return (
                                    <Link key={link.href} href={link.href}>
                                        <Button
                                            variant={isActive ? "default" : "ghost"}
                                            size="sm"
                                            className="gap-2"
                                        >
                                            <Icon className="h-4 w-4" />
                                            {link.label}
                                        </Button>
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {/* User Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-2">
                                {userProfile?.photoURL && (
                                    <img
                                        src={userProfile.photoURL}
                                        alt={userProfile.displayName || "User"}
                                        className="h-6 w-6 rounded-full"
                                    />
                                )}
                                {userProfile?.displayName || userProfile?.email}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Hesabım</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-muted-foreground">
                                Rol: {userProfile?.role === "admin" ? "Admin" : userProfile?.role === "denetmen" ? "Denetmen" : "Mağaza"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => signOut()} className="text-red-600">
                                <LogOut className="mr-2 h-4 w-4" />
                                Çıkış Yap
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Mobile Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild className="md:hidden">
                            <Button variant="ghost" size="sm">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {links.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <DropdownMenuItem key={link.href} asChild>
                                        <Link href={link.href} className="flex items-center gap-2">
                                            <Icon className="h-4 w-4" />
                                            {link.label}
                                        </Link>
                                    </DropdownMenuItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </nav>
    );
}
