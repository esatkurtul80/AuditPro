"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import { Loader2, Check } from "lucide-react";
import { Store } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChangeStoreDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentItem: { id: string; storeName: string; } | null;
    stores: Store[];
    onConfirm: (storeId: string, storeName: string) => Promise<void>;
}

export function ChangeStoreDialog({ open, onOpenChange, currentItem, stores, onConfirm }: ChangeStoreDialogProps) {
    const [selectedStoreId, setSelectedStoreId] = useState<string>("");
    const [submitting, setSubmitting] = useState(false);

    // Reset selection when dialog opens/closes
    useEffect(() => {
        if (!open) {
            setSelectedStoreId("");
        }
    }, [open]);

    const handleConfirm = async () => {
        const store = stores.find(s => s.id === selectedStoreId);
        if (!store) return;

        setSubmitting(true);
        try {
            await onConfirm(store.id, store.name);
            onOpenChange(false);
        } catch (error) {
            console.error("Change store failed", error);
        } finally {
            setSubmitting(false);
        }
    };

    const selectedStore = stores.find(s => s.id === selectedStoreId);

    if (!currentItem) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0">
                <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle>Mağazayı Değiştir</DialogTitle>
                    <DialogDescription>
                        Mevcut: <span className="font-bold text-slate-800">{currentItem.storeName}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4">
                    <div className="border rounded-md overflow-hidden">
                        <Command className="h-[300px]">
                            <CommandInput placeholder="Yeni mağazayı ara..." autoFocus />
                            <CommandList>
                                <CommandEmpty>Mağaza bulunamadı.</CommandEmpty>
                                <CommandGroup heading="Mağazalar">
                                    {stores.map((store) => (
                                        <CommandItem
                                            key={store.id}
                                            value={store.name}
                                            onSelect={() => setSelectedStoreId(store.id)}
                                            className="cursor-pointer"
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <span>{store.name}</span>
                                                {selectedStoreId === store.id && (
                                                    <Check className="h-4 w-4 text-blue-600" />
                                                )}
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </div>

                    {selectedStore && (
                        <div className="mt-3 text-sm bg-blue-50 text-blue-700 p-2 rounded border border-blue-100 flex items-center gap-2">
                            <span className="font-semibold">Seçilen:</span> {selectedStore.name}
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 pb-6 pt-2 bg-slate-50/50 border-t items-center sm:justify-between">
                    <div className="text-xs text-slate-500 hidden sm:block">
                        * Değişiklik anında yayınlanır.
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                            İptal
                        </Button>
                        <Button onClick={handleConfirm} disabled={!selectedStoreId || submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Değiştir
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
