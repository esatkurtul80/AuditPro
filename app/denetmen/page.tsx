"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DenetmenRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/denetmen/bekleyen");
    }, [router]);

    return null;
}
