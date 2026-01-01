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
import { collection, addDoc, Timestamp, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile, NotificationType } from "@/lib/types";

export function SendNotificationDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [targetType, setTargetType] = useState<"all" | "denetmen" | "magaza" | "bolge-muduru" | "admin" | "specific">("denetmen");

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
            const batchPromises = targetUsers.map(user => {
                return addDoc(notificationsRef, {
                    userId: user.uid,
                    type: "admin_message",
                    title: title,
                    message: message,
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
                        url: "/" // veya ilgili sayfa
                    })
                });

                if (!apiResponse.ok) {
                    const errorText = await apiResponse.text();
                    console.error("Push API Error:", errorText);
                    toast.warning(`Bildirim Gönderilemedi! Hata Kodu: ${apiResponse.status} - Mesaj: ${errorText.substring(0, 100)}`);
                } else {
                    const result = await apiResponse.json();
                    console.log("Push Result:", result);
                    if (result.failureCount > 0) {
                        toast.warning(`Bildirim gönderildi fakat ${result.failureCount} cihaza iletilemedi.`);
                    }
                }
            } catch (apiErr) {
                console.error("API Fetch Error:", apiErr);
                toast.warning("Bildirim sistemi hatası (Fetch hatası)");
            }

            toast.success(`${targetUsers.length} kullanıcıya bildirim gönderildi`);
            setOpen(false);
            setTitle("");
            setMessage("");

        } catch (error) {
            console.error("Bildirim gönderme hatası:", error);
            toast.error("Bildirim gönderilirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50">
                    <BellRing className="h-4 w-4" />
                    <span className="hidden sm:inline">Bildirim Gönder</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Toplu Bildirim Gönder</DialogTitle>
                    <DialogDescription>
                        Seçilen kullanıcı grubuna sistem içi bildirim ve (yapılandırıldıysa) push bildirimi gönderir.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
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

                    <div className="grid gap-2">
                        <Label>Mesaj İçeriği</Label>
                        <Textarea
                            placeholder="Mesajınızı buraya yazın..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={4}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Iptal</Button>
                    <Button onClick={handleSend} disabled={loading} className="gap-2">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Gönder
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
