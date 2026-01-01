"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface SendNotificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SendNotificationDialog({ open, onOpenChange }: SendNotificationDialogProps) {
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [targetRole, setTargetRole] = useState("denetmen");
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) {
            toast.error("Başlık ve mesaj alanları zorunludur");
            return;
        }

        setSending(true);
        try {
            const response = await fetch("/api/send-notification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, message, targetRole }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Bildirim gönderilemedi");
            }

            toast.success(`Bildirim başarıyla gönderildi (${data.successCount} kişiye)`);
            onOpenChange(false);
            setTitle("");
            setMessage("");
        } catch (error: any) {
            console.error("Error sending notification:", error);
            toast.error(error.message || "Bildirim gönderilirken bir hata oluştu");
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Bildirim Gönder</DialogTitle>
                    <DialogDescription>
                        Tüm denetmenlere anlık bildirim gönderin. Bu bildirim mobil cihazlarına düşecektir.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="target">Hedef Kitle</Label>
                        <Select value={targetRole} onValueChange={setTargetRole}>
                            <SelectTrigger>
                                <SelectValue placeholder="Hedef seçin" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="denetmen">Sadece Denetmenler</SelectItem>
                                <SelectItem value="admin">Sadece Adminler (Test)</SelectItem>
                                <SelectItem value="magaza">Sadece Mağazalar</SelectItem>
                                <SelectItem value="all">Tüm Kullanıcılar</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="title">Başlık</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Örn: Yeni Denetim Duyurusu"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="message">Mesaj</Label>
                        <Textarea
                            id="message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Bildirim içeriğini buraya yazın..."
                            rows={4}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                        İptal
                    </Button>
                    <Button onClick={handleSend} disabled={sending} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Gönder
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
