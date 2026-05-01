import { Timestamp } from "firebase/firestore";

export interface SharedFile {
    id: string;
    name: string;
    fileName: string;
    storagePath: string;
    downloadUrl: string;
    fileType: string;
    fileSize: number;
    folderId: string | null;   // null = root
    uploadedBy: string;
    uploadedByName: string;
    createdAt: Timestamp;
}

export interface Folder {
    id: string;
    name: string;
    parentId: string | null;   // null = root
    storagePath: string;       // mirrors Storage path e.g. "shared-files/Raporlar"
    createdBy: string;
    createdAt: Timestamp;
}

export interface FileTypeDetails {
    label: string;
    color: string;
    bg: string;
    emoji: string;
}

export function getFileTypeInfo(mimeType: string): FileTypeDetails {
    if (mimeType === "application/pdf")
        return { label: "PDF", color: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-900/30", emoji: "📄" };
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "application/vnd.ms-excel")
        return { label: "Excel", color: "text-green-700 dark:text-green-300", bg: "bg-green-100 dark:bg-green-900/30", emoji: "📊" };
    if (mimeType.includes("wordprocessing") || mimeType.includes("msword"))
        return { label: "Word", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-900/30", emoji: "📝" };
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
        return { label: "PowerPoint", color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-100 dark:bg-orange-900/30", emoji: "📑" };
    if (mimeType.startsWith("image/"))
        return { label: "Resim", color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-100 dark:bg-purple-900/30", emoji: "🖼️" };
    if (mimeType.startsWith("audio/"))
        return { label: "Ses", color: "text-yellow-700 dark:text-yellow-300", bg: "bg-yellow-100 dark:bg-yellow-900/30", emoji: "🎵" };
    if (mimeType.startsWith("video/"))
        return { label: "Video", color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-700", emoji: "🎬" };
    return { label: "Dosya", color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-700", emoji: "📁" };
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function canPrint(mimeType: string): boolean {
    return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

/** Blob-based download — works with cross-origin Firebase Storage URLs */
export async function downloadFileBlob(url: string, fileName: string): Promise<void> {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
}

/** Blob-based print — fetches the file to bypass cross-origin restrictions and triggers print */
export async function printFileBlob(url: string, mimeType: string): Promise<void> {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    if (mimeType.startsWith("image/")) {
        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.write(`
                <html>
                    <head><title>Yazdır</title></head>
                    <body style="margin:0;display:flex;justify-content:center;align-items:center;">
                        <img src="${blobUrl}" style="max-width:100%; max-height:100vh;" onload="window.print();" />
                    </body>
                </html>
            `);
            doc.close();
        }
    } else {
        iframe.src = blobUrl;
        iframe.onload = () => {
            try {
                iframe.contentWindow?.print();
            } catch (e) {
                console.error("Print blocked by browser:", e);
                const w = window.open(blobUrl);
                if (w) {
                    w.onload = () => w.print();
                }
            }
        };
    }

    setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(blobUrl);
    }, 60000); // 1 minute to ensure print dialog stays active before cleanup
}
