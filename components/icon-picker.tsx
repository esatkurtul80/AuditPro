"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import * as Icons from "lucide-react";

// List of icons to include in the picker
// Focusing on retail, food, audit, and general UI icons
const ICON_NAMES = [
    // Store & Retail
    "Store", "ShoppingCart", "ShoppingBag", "CreditCard", "Tag", "Percent", "DollarSign", "Euro",
    "Package", "PackageCheck", "PackageOpen", "Truck", "Container", "Barcode", "Scan", "QrCode",
    
    // Food & Drink (Limited in Lucide, using general shapes/metaphors where needed)
    "Coffee", "CupSoda", "Beer", "Wine", "Pizza", "Salad", "Sandwich", "Soup", "Cookie", "Cake",
    "Utensils", "UtensilsCrossed", "ChefHat", "Refrigerator", "Microwave", "Flame", "Droplets",
    
    // Products & Categories
    "Shirt", "Glasses", "Watch", "Gem", "Gift", "Book", "Smartphone", "Laptop", "Headphones",
    "Monitor", "Camera", "Gamepad", "ToyBrick", "Baby", "Flower", "Trees", "Zap", "Lightbulb",
    
    // Audit & Management
    "ClipboardList", "ClipboardCheck", "Clipboard", "FileText", "FileCheck", "FileWarning",
    "CheckCircle2", "AlertCircle", "AlertTriangle", "Info", "HelpCircle", "Shield", "ShieldCheck",
    "Lock", "Unlock", "Key", "User", "Users", "UserCog", "Briefcase", "Building2", "Warehouse",
    
    // Cleanliness & Maintenance
    "Sparkles", "SprayCan", "Brush", "Eraser", "Trash2", "Recycle", "Wrench", "Hammer", "Construction",
    "Thermometer", "Wind", "CloudRain", "Sun", "Moon",
    
    // General UI
    "LayoutGrid", "List", "Settings", "MoreHorizontal", "Star", "Heart", "ThumbsUp", "ThumbsDown",
    "Flag", "Bookmark", "MapPin", "Navigation", "Globe", "Link", "Paperclip", "Calendar", "Clock"
];

interface IconPickerProps {
    value?: string;
    onChange: (value: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const filteredIcons = ICON_NAMES.filter(name => 
        name.toLowerCase().includes(search.toLowerCase())
    );

    // Get the icon component for the current value
    const SelectedIcon = value && (Icons as any)[value] ? (Icons as any)[value] : Icons.HelpCircle;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-10 px-3"
                >
                    <div className="flex items-center gap-2">
                        <SelectedIcon className="h-4 w-4 shrink-0 opacity-70" />
                        <span className="truncate">
                            {value || "İkon seçiniz..."}
                        </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="İkon ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="max-h-[300px] overflow-y-auto p-2">
                    <div className="grid grid-cols-5 gap-2">
                        {filteredIcons.map((iconName) => {
                            const Icon = (Icons as any)[iconName];
                            if (!Icon) return null;

                            return (
                                <button
                                    key={iconName}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-1 rounded-md p-2 text-xs hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none transition-colors",
                                        value === iconName && "bg-accent text-accent-foreground shadow-sm ring-1 ring-ring"
                                    )}
                                    onClick={() => {
                                        onChange(iconName);
                                        setOpen(false);
                                    }}
                                    title={iconName}
                                >
                                    <Icon className="h-5 w-5" />
                                </button>
                            );
                        })}
                    </div>
                    {filteredIcons.length === 0 && (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            İkon bulunamadı.
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
