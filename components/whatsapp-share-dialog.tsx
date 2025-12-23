"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    MessageCircle,
    FileText,
    Store,
    Loader2,
    Calendar,
    CheckCircle2,
    User
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    doc,
    getDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit, Store as StoreType } from "@/lib/types"; // Renamed to avoid collision
import { generateAuditPDF } from "@/lib/pdf-generator";

interface WhatsAppShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WhatsAppShareDialog({ open, onOpenChange }: WhatsAppShareDialogProps) {
    const { userProfile } = useAuth();
    const [step, setStep] = useState<"landing" | "select-audit" | "sending">("landing");
    const [recentAudits, setRecentAudits] = useState<Audit[]>([]);
    const [loadingAudits, setLoadingAudits] = useState(false);
    const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
    const [storePhone, setStorePhone] = useState<string | null>(null);
    const [regionalManagerPhone, setRegionalManagerPhone] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile environment
    useEffect(() => {
        setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    }, []);

    // Reset state when closed
    useEffect(() => {
        if (!open) {
            setStep("landing");
            setSelectedAudit(null);
            setStorePhone(null);
            setRegionalManagerPhone(null);
            setLoading(false);
        }
    }, [open]);

    const handlePrivateReport = () => {
        toast.info("Özel rapor özelliği yakında eklenecek.");
    };

    const handleStoreReport = async () => {
        setStep("select-audit");
        fetchRecentAudits();
    };

    const fetchRecentAudits = async () => {
        if (!userProfile) return;

        setLoadingAudits(true);
        try {
            const auditsRef = collection(db, "audits");
            const q = query(
                auditsRef,
                where("auditorId", "==", userProfile.uid),
                where("status", "==", "tamamlandi"),
                orderBy("completedAt", "desc"),
                limit(5)
            );

            const snapshot = await getDocs(q);
            const audits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Audit));
            setRecentAudits(audits);
        } catch (error) {
            console.error("Denetimler yüklenirken hata oluştu:", error);
            toast.error("Geçmiş denetimler yüklenirken hata oluştu.");
        } finally {
            setLoadingAudits(false);
        }
    };

    const handleAuditSelect = async (audit: Audit) => {
        setSelectedAudit(audit);
        setStep("sending");

        try {
            if (audit.storeId) {
                const storeDoc = await getDoc(doc(db, "stores", audit.storeId));
                if (storeDoc.exists()) {
                    const storeData = storeDoc.data() as StoreType;
                    setStorePhone(storeData.phone || null);
                    setRegionalManagerPhone(null);
                }
            }
        } catch (error) {
            console.error("Mağaza verileri getirilirken hata oluştu:", error);
        }
    };

    const sendToWhatsApp = async (phone: string | null) => {
        if (!selectedAudit || !phone) {
            if (!phone) toast.error("Telefon numarası bulunamadı.");
            return;
        }

        setLoading(true);

        try {
            // 1. Generate PDF Blob
            const pdfDoc = await generateAuditPDF(selectedAudit);
            const blob = pdfDoc.output("blob");
            const file = new File([blob], "DenetimRaporu.pdf", { type: "application/pdf" });

            // 2. Prepare Message (Short for mobile native share)
            // Note: For native share we don't need the long text usually as the file is attached.
            // But we prepare the long one for the fallback.

            const score = selectedAudit.totalScore;
            const maxScore = selectedAudit.maxScore;
            const percentage = ((score / maxScore) * 100).toFixed(0);

            const longMessage = `*DENETİM RAPORU BİLGİLENDİRMESİ*\n\n` +
                `🏢 *Mağaza:* ${selectedAudit.storeName}\n` +
                `📋 *Denetim Türü:* ${selectedAudit.auditTypeName}\n` +
                `👤 *Denetmen:* ${selectedAudit.auditorName}\n` +
                `📅 *Tarih:* ${selectedAudit.completedAt?.toDate().toLocaleDateString("tr-TR")}\n\n` +
                `📊 *PUAN:* ${score} / ${maxScore} (%${percentage})\n\n` +
                `📄 *Lütfen bu mesajla birlikte indirilen PDF raporunu ekleyiniz.*`;

            const shortMessage = `Merhaba, ${selectedAudit.storeName} mağazasına ait denetim raporu ektedir.`;

            const cleanPhone = phone.replace(/\D/g, '');
            let shared = false;

            // 3. Try Native Share (Mobile)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'Denetim Raporu',
                        text: shortMessage
                    });
                    shared = true;
                } catch (shareError: any) {
                    if (shareError.name === 'AbortError') {
                        setLoading(false);
                        return; // User cancelled
                    }
                    console.error("Native share failed, falling back to download:", shareError);
                }
            }

            if (shared) {
                setLoading(false);
                return;
            }

            // 4. Fallback: Download + WhatsApp Web/App Link
            // If native share didn't work (desktop or rejected), we download the file and open the link.
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "DenetimRaporu.pdf";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            toast.info("PDF indirildi. Lütfen açılan WhatsApp sohbetine dosyayı ekleyiniz.", { duration: 5000 });

            const encodedMessage = encodeURIComponent(longMessage);
            const waUrl = isMobile
                ? `whatsap://send?phone=${cleanPhone}&text=${encodedMessage}`
                : `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

            // We use window.open for better compatibility
            window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');

            setTimeout(() => URL.revokeObjectURL(url), 10000);

        } catch (error) {
            console.error("Error in share dialog:", error);
            toast.error("İşlem sırasında bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-green-600" />
                        WhatsApp Paylaşımı
                    </DialogTitle>
                    <DialogDescription>
                        {step === "landing" && "Paylaşmak istediğiniz rapor türünü seçin."}
                        {step === "select-audit" && "Raporunu paylaşmak istediğiniz denetimi seçin."}
                        {step === "sending" && "Raporu göndermek istediğiniz kişiyi seçin."}
                    </DialogDescription>
                </DialogHeader>

                {step === "landing" && (
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <Button
                            variant="outline"
                            className="flex flex-col items-center justify-center h-32 gap-3 hover:border-green-500 hover:bg-green-50 transition-all group"
                            onClick={handlePrivateReport}
                        >
                            <div className="p-3 rounded-full bg-slate-100 group-hover:bg-green-100 transition-colors">
                                <FileText className="h-6 w-6 text-slate-600 group-hover:text-green-600" />
                            </div>
                            <span className="font-semibold">Özel Rapor</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="flex flex-col items-center justify-center h-32 gap-3 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                            onClick={handleStoreReport}
                        >
                            <div className="p-3 rounded-full bg-slate-100 group-hover:bg-blue-100 transition-colors">
                                <Store className="h-6 w-6 text-slate-600 group-hover:text-blue-600" />
                            </div>
                            <span className="font-semibold">Mağaza Raporu</span>
                        </Button>
                    </div>
                )}

                {step === "select-audit" && (
                    <div className="py-2">
                        {loadingAudits ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : recentAudits.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Tamamlanmış denetim bulunamadı.
                            </div>
                        ) : (
                            <div className="h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                                <div className="space-y-3">
                                    {recentAudits.map((audit) => (
                                        <button
                                            key={audit.id}
                                            onClick={() => handleAuditSelect(audit)}
                                            className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 hover:border-slate-300 transition-all group text-left"
                                        >
                                            <div className="flex flex-col gap-1">
                                                <span className="font-semibold text-sm">{audit.storeName}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {audit.auditTypeName}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="flex items-center text-xs text-muted-foreground">
                                                    <Calendar className="h-3 w-3 mr-1" />
                                                    {audit.completedAt?.toDate().toLocaleDateString("tr-TR")}
                                                </div>
                                                <div className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    {audit.totalScore} Puan
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {step === "sending" && selectedAudit && (
                    <div className="space-y-4 py-4">
                        <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="font-medium text-sm">{selectedAudit.storeName}</span>
                                <span className="text-xs text-muted-foreground">Rapor Gönderime Hazır</span>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </div>
                        </div>

                        <div className="grid gap-4">
                            <Button
                                className="w-full flex-col h-auto py-4 items-center justify-center gap-1 bg-[#25D366] hover:bg-[#128C7E] text-white shadow-md transition-all hover:scale-[1.02]"
                                onClick={() => sendToWhatsApp(storePhone)}
                                disabled={!storePhone || loading}
                            >
                                {loading ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    <div className="flex items-center gap-2 text-lg font-bold">
                                        <Store className="h-5 w-5" />
                                        WhatsApp ile Paylaş
                                    </div>
                                )}
                                <span className="text-xs opacity-90 font-light">
                                    {isMobile ? "Dosya otomatik eklenir veya indirilir" : "Dosya indirilir ve WhatsApp Web açılır"}
                                </span>
                            </Button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">Veya</span>
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                className="w-full justify-between h-auto py-3 border-slate-300 hover:bg-slate-50"
                                onClick={() => sendToWhatsApp(regionalManagerPhone)}
                                disabled={true}
                            >
                                <span className="flex items-center gap-2 font-medium text-slate-700">
                                    <User className="h-4 w-4" />
                                    Bölge Müdürüne Gönder
                                </span>
                                <span className="text-xs text-muted-foreground bg-slate-100 px-2 py-1 rounded">Bilgi Yok</span>
                            </Button>
                        </div>

                        <div className="text-[10px] text-muted-foreground text-center px-4 mt-2">
                            * <b>Mobilde:</b> Dosya otomatik paylaşılır. Desteklenmezse indirilir.<br />
                            * <b>Masaüstünde:</b> Dosya indirilir, lütfen açılan sohbete sürükleyiniz.
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
