"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import { Store } from "@/lib/types";
import { Check } from "lucide-react";

interface StoreSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    stores: Store[];
    onConfirm: (storeId: string, storeName: string) => Promise<void>;
}

export function StoreSelectorDialog({ open, onOpenChange, title = "Mağaza Seç", stores, onConfirm }: StoreSelectorDialogProps) {
    const [selectedStoreId, setSelectedStoreId] = useState<string>("");

    // Reset selection on open
    useEffect(() => {
        if (open) setSelectedStoreId("");
    }, [open]);

    const handleSelect = async (storeId: string, storeName: string) => {
        setSelectedStoreId(storeId);
        // Immediate confirm upon selection to mimic "Popover" feel
        onOpenChange(false);
        await onConfirm(storeId, storeName);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-4 py-3 border-b bg-slate-50/50">
                    <DialogTitle className="text-sm font-semibold text-slate-700">{title}</DialogTitle>
                </DialogHeader>

                <Command className="max-h-[350px]">
                    <CommandInput placeholder="Mağaza ara..." autoFocus className="border-none focus:ring-0" />
                    <CommandList>
                        <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                            Mağaza bulunamadı.
                        </CommandEmpty>
                        <CommandGroup>
                            {stores.map((store) => (
                                <CommandItem
                                    key={store.id}
                                    value={store.name}
                                    onSelect={() => handleSelect(store.id, store.name)}
                                    className="cursor-pointer aria-selected:bg-blue-50 aria-selected:text-blue-700"
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
            </DialogContent>
        </Dialog>
    );
}
