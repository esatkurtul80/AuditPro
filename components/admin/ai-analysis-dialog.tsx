"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, BrainCircuit, Loader2, FileText, Download } from "lucide-react";
import { Store } from "@/lib/types";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface AIAnalysisDialogProps {
    trigger?: React.ReactNode;
}

export function AIAnalysisDialog({ trigger }: AIAnalysisDialogProps) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<"select" | "processing" | "result">("select");
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<string>("");

    // Fetch stores on open
    useEffect(() => {
        if (open && stores.length === 0) {
            const fetchStores = async () => {
                const q = query(collection(db, "stores"), orderBy("name"));
                const snapshot = await getDocs(q);
                setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store)));
            };
            fetchStores();
        }
    }, [open]);

    const handleAnalyze = async () => {
        if (!selectedStoreId) return;

        setStep("processing");
        setLoading(true);

        try {
            const response = await fetch("/api/ai/analyze-store", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeId: selectedStoreId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Analiz yapılamadı");
            }

            setReport(data.report);
            setStep("result");
        } catch (error: any) {
            console.error("AI Analysis Error:", error);
            toast.error(error.message);
            setStep("select");
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep("select");
        setSelectedStoreId("");
        setReport("");
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) reset();
        }}>
            {trigger ? (
                <div onClick={() => setOpen(true)}>{trigger}</div>
            ) : (
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        AI Analiz
                    </Button>
                </DialogTrigger>
            )}

            <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BrainCircuit className="w-6 h-6 text-purple-600" />
                        Mağaza Yapay Zeka Analizi
                    </DialogTitle>
                    <DialogDescription>
                        Mağaza denetim verilerini analiz ederek içgörüler ve öneriler oluşturun.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-1">
                    {step === "select" && (
                        <div className="py-8 flex flex-col items-center gap-6">
                            <div className="w-full max-w-sm space-y-2">
                                <label className="text-sm font-medium">Analiz Edilecek Mağaza</label>
                                <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Mağaza Seçin..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {stores.map(store => (
                                            <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button
                                onClick={handleAnalyze}
                                disabled={!selectedStoreId}
                                size="lg"
                                className="w-full max-w-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold shadow-lg transition-all hover:scale-[1.02]"
                            >
                                <Sparkles className="w-5 h-5 mr-2" />
                                Analizi Başlat
                            </Button>

                            <div className="text-xs text-muted-foreground text-center max-w-xs">
                                * Son 6 aylık denetim verileri, puan trendleri ve sık yapılan hatalar analiz edilecektir.
                            </div>
                        </div>
                    )}

                    {step === "processing" && (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
                                <Loader2 className="w-16 h-16 text-purple-600 animate-spin relative z-10" />
                            </div>
                            <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent animate-pulse">
                                Yapay Zeka Verileri Analiz Ediyor...
                            </h3>
                            <p className="text-muted-foreground max-w-md">
                                Denetim geçmişi taranıyor, hata kalıpları belirleniyor ve gelişim önerileri hazırlanıyor. Bu işlem 10-20 saniye sürebilir.
                            </p>
                        </div>
                    )}

                    {step === "result" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="prose prose-sm dark:prose-invert max-w-none bg-purple-50/50 dark:bg-purple-950/10 p-6 rounded-lg border border-purple-100 dark:border-purple-900/50">
                                <ReactMarkdown>{report}</ReactMarkdown>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={reset}>
                                    Yeni Analiz
                                </Button>
                                <Button variant="default" className="bg-purple-600 hover:bg-purple-700" onClick={() => window.print()}>
                                    <Download className="w-4 h-4 mr-2" />
                                    PDF Olarak Kaydet
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
