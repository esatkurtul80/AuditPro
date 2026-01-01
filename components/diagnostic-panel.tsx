"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DiagnosticPanel() {
    const [logs, setLogs] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const log = (msg: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
    };

    const runDiagnostics = async () => {
        setLogs([]);
        log("Diagnostic started...");

        // 1. Check Environment
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        log(`Display Mode: ${isStandalone ? 'Standalone (PWA)' : 'Browser'}`);
        log(`User Agent: ${navigator.userAgent.substring(0, 50)}...`);
        log(`Online Status: ${navigator.onLine}`);
        log(`Current URL: ${window.location.href}`);

        // 2. Network Tests
        try {
            log("Test 1: Fetching current domain auth handler...");
            const res1 = await fetch('/__/auth/handler');
            log(`Current Domain Auth: ${res1.status} ${res1.statusText}`);
        } catch (e: any) {
            log(`Current Domain Auth FAILED: ${e.message}`);
        }

        try {
            log("Test 2: Fetching Google (Internet Check)...");
            const res2 = await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors' });
            log("Google Reachable: YES (Opaque)");
        } catch (e: any) {
            log(`Google Reachable FAILED: ${e.message}`);
        }

        try {
            log("Test 3: Fetching Firebase Default Domain...");
            const res3 = await fetch('https://tugba-auditpro.firebaseapp.com/__/auth/handler');
            log(`Firebase Domain Auth: ${res3.status} ${res3.statusText}`);
        } catch (e: any) {
            log(`Firebase Domain Auth FAILED: ${e.message}`);
        }

        log("Diagnostics complete.");
    };

    if (!isOpen) {
        return (
            <div className="fixed bottom-4 left-4 z-[9999]">
                <Button variant="destructive" size="sm" onClick={() => setIsOpen(true)}>
                    Hata Tespit Et
                </Button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 text-green-400 p-4 font-mono text-xs overflow-auto">
            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                <h3 className="text-lg font-bold text-white"> Sistem Tanı Aracı </h3>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={runDiagnostics}>Testi Başlat</Button>
                    <Button variant="destructive" size="sm" onClick={() => setIsOpen(false)}>Kapat</Button>
                </div>
            </div>

            <div className="space-y-1">
                {logs.length === 0 ? "Testi başlatmak için butona basın..." : logs.map((l, i) => (
                    <div key={i} className="border-b border-gray-800 pb-1">{l}</div>
                ))}
            </div>
        </div>
    );
}
