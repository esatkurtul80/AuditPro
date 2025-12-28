"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

/**
 * Custom hook for aggressive link prefetching on hover
 * Improves perceived performance by preloading pages before click
 */
export function usePrefetch() {
    const router = useRouter();
    const prefetchedRef = useRef<Set<string>>(new Set());

    const prefetchOnHover = useCallback(
        (href: string) => {
            // Only prefetch once per URL
            if (!prefetchedRef.current.has(href)) {
                router.prefetch(href);
                prefetchedRef.current.add(href);
            }
        },
        [router]
    );

    const handleMouseEnter = useCallback(
        (href: string) => {
            prefetchOnHover(href);
        },
        [prefetchOnHover]
    );

    return { handleMouseEnter, prefetch: prefetchOnHover };
}
