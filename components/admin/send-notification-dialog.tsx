"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BellRing, Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { collection, addDoc, Timestamp, getDocs, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile, NotificationType } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { NotificationResultDialog } from "./notification-result-dialog";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export function SendNotificationDialog({ trigger, open: controlledOpen, onOpenChange: setControlledOpen }: { trigger?: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) {
    const { userProfile } = useAuth();
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? setControlledOpen! : setInternalOpen;
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [targetType, setTargetType] = useState<"all" | "denetmen" | "magaza" | "bolge-muduru" | "admin" | "specific">("denetmen");

    const [resultData, setResultData] = useState<{
        success: boolean;
        successCount: number;
        failureCount: number;
        failedUserNames?: string[];
        totalTarget?: number;
    } | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        if (!open) return;
        const q = query(collection(db, "broadcast_history"), orderBy("createdAt", "desc"), limit(10));
        const unsubscribe = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistory(data);
        });
        return () => unsubscribe();
    }, [open]);

    // Basit bir gönderim fonksiyonu
    const handleSend = async () => {
        if (!title || !message) {
            toast.error("Lütfen başlık ve mesaj giriniz");
            return;
        }

        try {
            setLoading(true);

            // 1. Hedef Kullanıcıları Bul
            let targetUsers: UserProfile[] = [];
            const usersRef = collection(db, "users");

            if (targetType === "all") {
                // Herkese göndermek biraz tehlikeli olabilir ama admin istediyse yapalım
                const snapshot = await getDocs(usersRef);
                targetUsers = snapshot.docs.map(d => d.data() as UserProfile);
            } else if (targetType === "specific") {
                // Şimdilik "specific" seçeneğini arayüzde göstermeyelim veya sonra ekleyelim
                // Basitlik için sadece rollere gönderelim
            } else {
                const q = query(usersRef, where("role", "==", targetType));
                const snapshot = await getDocs(q);
                targetUsers = snapshot.docs.map(d => d.data() as UserProfile);
            }

            if (targetUsers.length === 0) {
                toast.warning("Seçilen kriterde kullanıcı bulunamadı");
                setLoading(false);
                return;
            }

            // 2. Bildirimleri Oluştur (Batch mantığı gerekebilir ama şimdilik döngü ile)
            // Firebase Batch limiti 500'dür. Eğer kullanıcı çoksa batch kullanmak gerekir.
            const notificationsRef = collection(db, "notifications");
            const senderName = userProfile
                ? (userProfile.firstName && userProfile.lastName
                    ? `${userProfile.firstName} ${userProfile.lastName}`
                    : userProfile.displayName)
                : "Admin";

            const batchPromises = targetUsers.map(user => {
                return addDoc(notificationsRef, {
                    userId: user.uid,
                    type: "admin_message",
                    title: title,
                    message: message,
                    senderName: senderName,
                    read: false,
                    createdAt: Timestamp.now()
                });
            });

            await Promise.all(batchPromises);

            // 3. Push Notification API'sini Tetikle
            try {
                const targetUserIds = targetUsers.map(u => u.uid);
                // API çağrısını arka planda yapabiliriz veya awaitleyebiliriz. Awaitlemek hata durumunu görmek için iyidir.
                const apiResponse = await fetch("/api/send-notification", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        title: title,
                        message: message,
                        userIds: targetUserIds,
                        url: "/notifications" // Varsayılan bildirim sayfası
                    })
                });

                if (!apiResponse.ok) {
                    const errorText = await apiResponse.text();
                    console.error("Push API Error:", errorText);
                    toast.warning(`Bildirim Gönderilemedi! Hata Kodu: ${apiResponse.status} - Mesaj: ${errorText.substring(0, 100)}`);
                    setLoading(false);
                } else {
                    const result = await apiResponse.json();
                    
                    setResultData({
                        success: result.success,
                        successCount: result.successCount,
                        failureCount: result.failureCount,
                        failedUserNames: result.failedUserNames,
                        totalTarget: targetUsers.length
                    });
                    
                    setOpen(false); // Close input dialog
                    setShowResult(true); // Open result dialog
                    
                    // Save broadcast history
                    await addDoc(collection(db, "broadcast_history"), {
                        title,
                        message,
                        targetType,
                        totalTarget: targetUsers.length,
                        successCount: result.successCount,
                        senderName,
                        senderId: userProfile?.uid,
                        createdAt: Timestamp.now()
                    });

                    setTitle("");
                    setMessage("");
                }
            } catch (apiErr) {
                console.error("API Fetch Error:", apiErr);
                toast.warning("Bildirim sistemi hatası (Fetch hatası)");
            }

        } catch (error) {
            console.error("Bildirim gönderme hatası:", error);
            toast.error("Bildirim gönderilirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? trigger : (
                    <Button variant="outline" size="sm" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50">
                        <BellRing className="h-4 w-4" />
                        <span className="hidden sm:inline">Bildirim Gönder</span>
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Toplu Bildirim Gönder</DialogTitle>
                    <DialogDescription>
                        Seçilen kullanıcı grubuna sistem içi bildirim ve (yapılandırıldıysa) push bildirimi gönderir.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid md:grid-cols-2 gap-6 py-4 flex-1 overflow-hidden">
                    {/* Left Side: Form */}
                    <div className="flex flex-col gap-4 overflow-y-auto pr-1">
                        <div className="grid gap-2">
                            <Label>Gönderilecek Grup</Label>
                            <Select value={targetType} onValueChange={(v: any) => setTargetType(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="denetmen">Tüm Denetmenler</SelectItem>
                                    <SelectItem value="magaza">Tüm Mağazalar</SelectItem>
                                    <SelectItem value="bolge-muduru">Tüm Bölge Müdürleri</SelectItem>
                                    <SelectItem value="admin">Tüm Adminler</SelectItem>
                                    <SelectItem value="all">Tüm Kullanıcılar</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Bildirim Başlığı</Label>
                            <Input
                                placeholder="Örn: Sistem Bakımı Hakkında"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-2 flex-1">
                            <Label>Mesaj İçeriği</Label>
                            <Textarea
                                placeholder="Mesajınızı buraya yazın..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="min-h-[120px] resize-none h-full"
                            />
                        </div>
                    </div>

                    {/* Right Side: History */}
                    <div className="flex flex-col gap-2 overflow-hidden border-t md:border-t-0 md:border-l pt-4 md:pt-0 pl-0 md:pl-6">
                        <Label className="text-muted-foreground mb-1">Gönderilmiş Bildirimler (Son 10)</Label>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {history.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">Henüz bildirim gönderilmemiş.</p>
                            ) : (
                                history.map((item) => (
                                    <div key={item.id} className="rounded-lg border p-3 flex flex-col gap-1.5 bg-accent/30">
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="font-semibold text-sm line-clamp-1 flex-1">{item.title}</span>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap bg-background px-1.5 py-0.5 rounded border">
                                                {item.targetType === "all" ? "Tümü" :
                                                 item.targetType === "denetmen" ? "Denetmenler" :
                                                 item.targetType === "magaza" ? "Mağazalar" :
                                                 item.targetType === "bolge-muduru" ? "Bölge Md." :
                                                 item.targetType === "admin" ? "Adminler" : item.targetType}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                            {item.message}
                                        </p>
                                        <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-border/50">
                                            <div className="flex gap-2 items-center text-[10px] text-muted-foreground">
                                                <span className="font-medium text-foreground">{item.senderName}</span>
                                                <span className="text-blue-600/70">{item.successCount}/{item.totalTarget} ulaştı</span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                                {item.createdAt ? format(item.createdAt.toDate(), "dd MMM HH:mm", { locale: tr }) : "Şimdi"}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-auto pt-4">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>İptal</Button>
                    <Button onClick={handleSend} disabled={loading} className="gap-2">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Gönder
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <NotificationResultDialog 
            open={showResult} 
            onOpenChange={setShowResult} 
            results={resultData} 
        />
        </>
    );
}
