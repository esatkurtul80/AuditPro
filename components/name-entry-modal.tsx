"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface NameEntryModalProps {
    userId: string;
    onComplete: (firstName: string, lastName: string) => void;
}

export function NameEntryModal({ userId, onComplete }: NameEntryModalProps) {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!firstName.trim() || !lastName.trim()) {
            toast.error("Lütfen ad ve soyadınızı girin");
            return;
        }

        setIsSubmitting(true);
        try {
            await updateDoc(doc(db, "users", userId), {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
            });
            toast.success("Bilgileriniz kaydedildi");
            onComplete(firstName.trim(), lastName.trim());
        } catch (error) {
            console.error("Error saving name:", error);
            toast.error("Kaydetme hatası");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Hoş Geldiniz!</DialogTitle>
                    <DialogDescription>
                        Lütfen ad ve soyadınızı girin. Bu bilgiler sistemde görüntülenecektir.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="firstName">Ad</Label>
                        <Input
                            id="firstName"
                            placeholder="Adınız"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            disabled={isSubmitting}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lastName">Soyad</Label>
                        <Input
                            id="lastName"
                            placeholder="Soyadınız"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            disabled={isSubmitting}
                            required
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Kaydediliyor...
                            </>
                        ) : (
                            "Devam Et"
                        )}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
