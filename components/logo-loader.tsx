"use client";

import Image from "next/image";
import { MobileDebugLogger } from "@/components/mobile-debug-logger";
import { useState, useRef } from "react";

export function LogoLoader() {
    const [tapCount, setTapCount] = useState(0);
    const [showDebugger, setShowDebugger] = useState(false);
    const tapTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const handleTap = () => {
        if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current);
        }
        const newCount = tapCount + 1;
        setTapCount(newCount);
        if (newCount >= 10) {
            setShowDebugger(true);
            setTapCount(0);
        } else {
            tapTimeoutRef.current = setTimeout(() => setTapCount(0), 3000);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 w-full h-full">
            <div 
                className="relative w-[80vw] h-[80vw] max-w-[500px] max-h-[500px] md:w-64 md:h-64 animate-pulse cursor-pointer"
                onClick={handleTap}
            >
                <Image
                    src="/login-assets-new/logo.png"
                    alt="Yükleniyor..."
                    fill
                    className="object-contain"
                    priority
                />
            </div>
            <MobileDebugLogger open={showDebugger} onClose={() => setShowDebugger(false)} />
        </div>
    );
}
