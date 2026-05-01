"use client";

import { FileText, FileSpreadsheet, Presentation, Image as ImageIcon, Music, Video, File as FileIcon, Folder as FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileTypeIcon({ type, isFolder, size = "md" }: { type?: string; isFolder?: boolean; size?: "sm" | "md" | "lg" }) {
    const sz = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-14 h-14" : "w-10 h-10";
    const ic = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";
    const c = (bg: string, tx: string) => cn("flex items-center justify-center rounded-lg shrink-0", bg, tx, sz);

    if (isFolder) return <div className={c("bg-amber-50 dark:bg-amber-900/20", "text-amber-500")}><FolderIcon className={ic} /></div>;
    if (!type) return <div className={c("bg-slate-100 dark:bg-slate-700", "text-slate-500")}><FileIcon className={ic} /></div>;
    if (type === "application/pdf") return <div className={c("bg-red-50 dark:bg-red-900/20", "text-red-500")}><FileText className={ic} /></div>;
    if (type.includes("spreadsheet") || type.includes("excel") || type === "application/vnd.ms-excel") return <div className={c("bg-green-50 dark:bg-green-900/20", "text-green-600")}><FileSpreadsheet className={ic} /></div>;
    if (type.includes("wordprocessing") || type.includes("msword")) return <div className={c("bg-blue-50 dark:bg-blue-900/20", "text-blue-600")}><FileText className={ic} /></div>;
    if (type.includes("presentation") || type.includes("powerpoint")) return <div className={c("bg-orange-50 dark:bg-orange-900/20", "text-orange-500")}><Presentation className={ic} /></div>;
    if (type.startsWith("image/")) return <div className={c("bg-purple-50 dark:bg-purple-900/20", "text-purple-500")}><ImageIcon className={ic} /></div>;
    if (type.startsWith("audio/")) return <div className={c("bg-yellow-50 dark:bg-yellow-900/20", "text-yellow-500")}><Music className={ic} /></div>;
    if (type.startsWith("video/")) return <div className={c("bg-slate-100 dark:bg-slate-800", "text-slate-500")}><Video className={ic} /></div>;
    return <div className={c("bg-slate-100 dark:bg-slate-700", "text-slate-500")}><FileIcon className={ic} /></div>;
}

export function fmt(b: number) {
    if (!b) return "-";
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
}

export function fmtDate(ts: any) {
    if (!ts?.toDate) return "-";
    return ts.toDate().toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export const ALLOWED_TYPES = [
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "audio/mpeg", "audio/mp3", "audio/wav",
    "video/mp4", "video/quicktime", "video/x-msvideo",
];

export const MAX_SIZE = 50 * 1024 * 1024;

/** Blob download - works with cross-origin Firebase Storage URLs */
export async function downloadBlob(url: string, name: string) {
    const r = await fetch(url);
    const blob = await r.blob();
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}