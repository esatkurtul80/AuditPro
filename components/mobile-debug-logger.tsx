"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface LogEntry {
    timestamp: Date;
    level: "log" | "warn" | "error" | "info";
    message: string;
    data?: any;
}

interface MobileDebugLoggerProps {
    open: boolean;
    onClose: () => void;
}

export function MobileDebugLogger({ open, onClose }: MobileDebugLoggerProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const originalConsoleRef = useRef<{
        log: typeof console.log;
        warn: typeof console.warn;
        error: typeof console.error;
        info: typeof console.info;
    } | undefined>(undefined);

    // Capture console logs
    useEffect(() => {
        // Store original console methods
        if (!originalConsoleRef.current) {
            originalConsoleRef.current = {
                log: console.log,
                warn: console.warn,
                error: console.error,
                info: console.info,
            };
        }

        const addLog = (level: LogEntry["level"], args: any[]) => {
            const message = args
                .map((arg) =>
                    typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
                )
                .join(" ");

            // Defer update to avoid "Cannot update during render" error
            setTimeout(() => {
                setLogs((prev) => {
                    const newLogs = [
                        ...prev,
                        {
                            timestamp: new Date(),
                            level,
                            message,
                            data: args.length > 0 ? args : undefined,
                        },
                    ];
                    // Keep only last 100 logs
                    return newLogs.slice(-100);
                });
            }, 0);
        };

        // Override console methods
        console.log = (...args: any[]) => {
            originalConsoleRef.current?.log(...args);
            addLog("log", args);
        };

        console.warn = (...args: any[]) => {
            originalConsoleRef.current?.warn(...args);
            addLog("warn", args);
        };

        console.error = (...args: any[]) => {
            originalConsoleRef.current?.error(...args);
            addLog("error", args);
        };

        console.info = (...args: any[]) => {
            originalConsoleRef.current?.info(...args);
            addLog("info", args);
        };

        // Cleanup on unmount
        return () => {
            if (originalConsoleRef.current) {
                console.log = originalConsoleRef.current.log;
                console.warn = originalConsoleRef.current.warn;
                console.error = originalConsoleRef.current.error;
                console.info = originalConsoleRef.current.info;
            }
        };
    }, []);

    const handleCopyLogs = () => {
        const logText = logs
            .map(
                (log) =>
                    `[${log.timestamp.toLocaleTimeString("tr-TR")}] [${log.level.toUpperCase()}] ${log.message}`
            )
            .join("\n");

        const deviceInfo = getDeviceInfo();
        const fullText = `=== Cihaz Bilgileri ===\n${deviceInfo}\n\n=== Loglar ===\n${logText}`;

        // Try modern clipboard API first, fallback to execCommand
        if (typeof window !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(fullText).then(
                () => {
                    toast.success("Loglar kopyalandı!");
                },
                (err) => {
                    // Fallback to execCommand if clipboard API fails
                    copyTextFallback(fullText);
                }
            );
        } else {
            // Use fallback method directly
            copyTextFallback(fullText);
        }
    };

    // Fallback copy method for browsers without clipboard API
    const copyTextFallback = (text: string) => {
        try {
            // iOS requires a contentEditable element for robust copying in some versions
            const el = document.createElement("div");
            el.contentEditable = "true";
            el.innerHTML = text.replace(/\n/g, "<br>"); // Preserve line breaks
            
            // Ensure element is visible but out of view
            el.style.position = "fixed";
            el.style.left = "-9999px";
            el.style.top = "0";
            el.style.width = "1px";
            el.style.height = "1px";
            el.style.overflow = "hidden";
            el.style.opacity = "0";
            el.style.whiteSpace = "pre-wrap"; // Preserve formatting
            
            document.body.appendChild(el);
            
            // Select content
            const range = document.createRange();
            range.selectNodeContents(el);
            
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            // Execute copy
            const successful = document.execCommand('copy');
            document.body.removeChild(el);
            
            // Cleanup selection
            if (selection) {
                selection.removeAllRanges();
            }
            
            if (successful) {
                toast.success("Loglar kopyalandı!");
            } else {
                toast.error("Kopyalama başarısız (execCommand)");
            }
        } catch (err) {
            console.error("Copy fallback failed:", err);
            toast.error("Kopyalama başarısız");
        }
    };

    const handleClearLogs = () => {
        setLogs([]);
        toast.success("Loglar temizlendi");
    };

    const getDeviceInfo = () => {
        // Client-side only checks
        if (typeof window === 'undefined') {
            return 'Server-side rendering - device info not available';
        }
        
        return `User Agent: ${navigator.userAgent}
Ekran Boyutu: ${window.screen.width}x${window.screen.height}
Viewport: ${window.innerWidth}x${window.innerHeight}
Platform: ${navigator.platform}
Dil: ${navigator.language}
Online: ${navigator.onLine}
Cookie Enabled: ${navigator.cookieEnabled}
Timestamp: ${new Date().toISOString()}`;
    };

    const getLevelColor = (level: LogEntry["level"]) => {
        switch (level) {
            case "error":
                return "bg-red-100 text-red-800 border-red-200";
            case "warn":
                return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "info":
                return "bg-blue-100 text-blue-800 border-blue-200";
            default:
                return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl w-[calc(100%-2rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
                <DialogHeader className="p-6 pb-4">
                    <DialogTitle>Mobil Debug Logger</DialogTitle>
                    <DialogDescription>
                        Son 100 console log kaydı. Hata ayıklama için kullanın.
                    </DialogDescription>
                </DialogHeader>

                {/* Actions */}
                <div className="flex gap-2 px-6 pb-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyLogs}
                        className="flex-1"
                    >
                        <Copy className="h-4 w-4 mr-2" />
                        Kopyala ({logs.length})
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearLogs}
                        className="flex-1"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Temizle
                    </Button>
                </div>

                {/* Device Info */}
                <div className="mx-6 mb-4 border rounded-lg p-3 bg-muted/30">
                    <h4 className="text-sm font-semibold mb-2">Cihaz Bilgileri</h4>
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                        {getDeviceInfo()}
                    </pre>
                </div>

                {/* Logs - Fixed height with native scroll */}
                <div className="mx-6 mb-6 border rounded-lg overflow-hidden" style={{ height: '300px' }}>
                    <div 
                        className="h-full overflow-y-auto p-3 pb-8 space-y-2"
                        style={{ 
                            WebkitOverflowScrolling: 'touch',
                            overscrollBehavior: 'contain'
                        }}
                    >
                        {logs.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                Henüz log kaydı yok
                            </p>
                        ) : (
                            <>
                                {logs.map((log, index) => (
                                    <div
                                        key={index}
                                        className={`border rounded-lg p-2 ${getLevelColor(log.level)}`}
                                    >
                                        <div className="flex items-start gap-2 mb-1">
                                            <Badge
                                                variant="outline"
                                                className="text-xs shrink-0"
                                            >
                                                {log.level.toUpperCase()}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground shrink-0">
                                                {log.timestamp.toLocaleTimeString("tr-TR")}
                                            </span>
                                        </div>
                                        <pre className="text-xs whitespace-pre-wrap font-mono break-all">
                                            {log.message}
                                        </pre>
                                    </div>
                                ))}
                                {/* iOS scroll spacer */}
                                <div className="h-16" aria-hidden="true" />
                            </>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
