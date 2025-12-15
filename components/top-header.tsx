"use client";

import { HeaderActions } from "@/components/header-actions";

export function TopHeader() {
    return (
        <>
            {/* Full-width border underneath sidebar + header */}
            <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center justify-between px-4">
                    {/* Left: Page title placeholder */}
                    <div className="flex-1">
                    </div>

                    {/* Right: Header actions */}
                    <HeaderActions />
                </div>
            </div>
        </>
    );
}

