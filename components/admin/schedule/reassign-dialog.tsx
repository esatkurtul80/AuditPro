"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Calendar as CalendarIcon, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfile } from "@/lib/types";

interface ReassignDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    targetItem: {
        id: string;
        storeName: string;
        currentAuditorId: string;
        currentDate: Date;
    } | null;
    auditors: UserProfile[];
    onConfirm: (newAuditorId: string, newDate: Date) => Promise<void>;
}

export function ReassignDialog({ open, onOpenChange, targetItem, auditors, onConfirm }: ReassignDialogProps) {
    const [selectedAuditorId, setSelectedAuditorId] = useState<string>("");
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open && targetItem) {
            setSelectedAuditorId(targetItem.currentAuditorId);
            setSelectedDate(targetItem.currentDate);
        }
    }, [open, targetItem]);

    const handleConfirm = async () => {
        if (!selectedAuditorId || !selectedDate) return;

        setSubmitting(true);
        try {
            await onConfirm(selectedAuditorId, selectedDate);
            onOpenChange(false);
        } catch (error) {
            console.error("Reassign failed", error);
        } finally {
            setSubmitting(false);
        }
    };

    if (!targetItem) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Atama Değişikliği (Acil Durum)</DialogTitle>
                    <DialogDescription>
                        Bu işlem canlı yayındaki programı anında günceller.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label className="text-xs text-slate-500 font-medium">MAĞAZA</Label>
                        <div className="font-bold text-lg">{targetItem.storeName}</div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="auditor">Yeni Denetmen</Label>
                        <Select value={selectedAuditorId} onValueChange={setSelectedAuditorId}>
                            <SelectTrigger id="auditor">
                                <SelectValue placeholder="Denetmen seçin" />
                            </SelectTrigger>
                            <SelectContent>
                                {auditors.map((auditor) => (
                                    <SelectItem key={auditor.uid} value={auditor.uid}>
                                        {auditor.firstName} {auditor.lastName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>Yeni Tarih</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !selectedDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? (
                                        format(selectedDate, "d MMMM yyyy, EEEE", { locale: tr })
                                    ) : (
                                        <span>Tarih seçin</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    initialFocus
                                    locale={tr}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="bg-amber-50 p-3 rounded-md border border-amber-200 flex gap-2 items-start">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div className="text-xs text-amber-800">
                            <strong>Dikkat:</strong> Denetmenin o günkü doluluk durumunu kontrol etmez. Zorla atama yapar.
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        İptal
                    </Button>
                    <Button onClick={handleConfirm} disabled={!selectedAuditorId || !selectedDate || submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Değişikliği Onayla
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
