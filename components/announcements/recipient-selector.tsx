"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export type RecipientType = "role_group" | "user" | "store" | "region_group"

export interface RecipientOption {
    id: string
    label: string
    type: RecipientType
    value: string
    avatar?: string
    city?: string // For stores, to allow filtering by city
    regionalManagerId?: string // For stores
    role?: string // For users (to allow filtering by role like 'denetmen')
    count?: number // For groups, how many users
}

interface RecipientSelectorProps {
    options: RecipientOption[]
    selected: RecipientOption[]
    onChange: (selected: RecipientOption[]) => void
    isLoading?: boolean
}

export function RecipientSelector({ options, selected, onChange, isLoading }: RecipientSelectorProps) {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")

    const handleSelect = (option: RecipientOption) => {
        const exists = selected.find((item) => item.id === option.id)
        
        // 1. TÜM KULLANICILAR (Her şeyi seç)
        if (option.value === "all" && option.type === "role_group") {
            if (exists) {
                // Hepsini kaldır
                onChange([])
            } else {
                // Hepsini seç (zaten seçili olanları tekrar ekleme)
                onChange(options)
            }
            return
        }

        // 2. TÜM MAĞAZALAR
        if (option.value === "magaza" && option.type === "role_group") {
            const allStores = options.filter(o => o.type === "store")
            if (exists) {
                 // Gruptan ve mağazalardan kaldır
                const storeIds = new Set(allStores.map(s => s.id))
                onChange(selected.filter(item => item.id !== option.id && !storeIds.has(item.id)))
            } else {
                // Grubu ve mağazaları ekle
                const newStores = allStores.filter(s => !selected.find(sel => sel.id === s.id))
                onChange([...selected, option, ...newStores])
            }
            return
        }

        // 3. TÜM DENETMENLER
        if (option.value === "denetmen" && option.type === "role_group") {
            const allAuditors = options.filter(o => o.type === "user" && o.role === "denetmen")
            if (exists) {
                const auditorIds = new Set(allAuditors.map(u => u.id))
                onChange(selected.filter(item => item.id !== option.id && !auditorIds.has(item.id)))
            } else {
                const newAuditors = allAuditors.filter(u => !selected.find(sel => sel.id === u.id))
                onChange([...selected, option, ...newAuditors])
            }
            return
        }

        // 4. TÜM BÖLGE MÜDÜRLERİ
        if (option.value === "bolge-muduru" && option.type === "role_group") {
            const allRMs = options.filter(o => o.type === "user" && o.role === "bolge-muduru")
            if (exists) {
                const rmIds = new Set(allRMs.map(u => u.id))
                onChange(selected.filter(item => item.id !== option.id && !rmIds.has(item.id)))
            } else {
                const newRMs = allRMs.filter(u => !selected.find(sel => sel.id === u.id))
                onChange([...selected, option, ...newRMs])
            }
            return
        }

        // 5. ŞEHİR SEÇİMİ (İl Grupları)
        if (option.id.startsWith("city_")) {
            const cityName = option.value
            const cityStores = options.filter(o => o.type === "store" && o.city === cityName)
            
            if (exists) {
                // Şehir grubunu ve o şehrin mağazalarını kaldır
                const storeIds = new Set(cityStores.map(s => s.id))
                onChange(selected.filter(item => item.id !== option.id && !storeIds.has(item.id)))
            } else {
                // Şehir grubunu ve o şehrin mağazalarını ekle
                const newStores = cityStores.filter(s => !selected.find(sel => sel.id === s.id))
                onChange([...selected, option, ...newStores])
            }
             return
        }

         // 4. BÖLGE MÜDÜRÜ SEÇİMİ
         if (option.id.startsWith("region_")) {
             const rmId = option.value
             // Note: Store options need to have regionalManagerId for this to work perfectly.
             // Assuming we add regionalManagerId to store options.
             const regionStores = options.filter(o => o.type === "store" && o.regionalManagerId === rmId)
             
             if (exists) {
                const storeIds = new Set(regionStores.map(s => s.id))
                onChange(selected.filter(item => item.id !== option.id && !storeIds.has(item.id)))
             } else {
                const newStores = regionStores.filter(s => !selected.find(sel => sel.id === s.id))
                onChange([...selected, option, ...newStores])
             }
             return
         }

        // Normal Tekli Seçim
        if (exists) {
            onChange(selected.filter((item) => item.id !== option.id))
        } else {
            onChange([...selected, option])
        }
    }

    const handleRemove = (id: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        // Smart Remove Logic: If we remove 'group_all', should we remove everything? 
        // User asked: "tüm kullanıcıları kaldırınca tüm kullanıcıların ticki otomatik kalkması lazım"
        // This usually applies to clicking the item in the list again (toggle).
        // If clicking 'X' on the badge... if it's a group badge, we should probably remove its children too.
        
        const optionToRemove = selected.find(s => s.id === id)
        if (!optionToRemove) return

        let newSelected = selected.filter(item => item.id !== id)

        if (optionToRemove.value === "all" && optionToRemove.type === "role_group") {
             // Remove everything if 'All Users' badge is removed? 
             // Logic: If I click X on "All Users" badge, I probably want to clear all.
             newSelected = []
        }
        else if (optionToRemove.value === "magaza" && optionToRemove.type === "role_group") {
             // Remove all stores
             newSelected = newSelected.filter(item => item.type !== "store")
        }
        else if (optionToRemove.value === "denetmen" && optionToRemove.type === "role_group") {
             // Remove all auditors
             newSelected = newSelected.filter(item => !(item.type === "user" && item.role === "denetmen"))
        }
        else if (optionToRemove.value === "bolge-muduru" && optionToRemove.type === "role_group") {
             // Remove all regional managers
             newSelected = newSelected.filter(item => !(item.type === "user" && item.role === "bolge-muduru"))
        }
        else if (optionToRemove.id.startsWith("city_")) {
             // Remove all stores in that city
             const cityName = optionToRemove.value
             newSelected = newSelected.filter(item => !(item.type === "store" && item.city === cityName))
        }
        else if (optionToRemove.id.startsWith("region_")) {
             const rmId = optionToRemove.value
             newSelected = newSelected.filter(item => !(item.type === "store" && item.regionalManagerId === rmId))
        }

        onChange(newSelected)
    }

    // Gruplandırma
    const groups = {
        role_group: options.filter(o => o.type === "role_group"),
        region_group: options.filter(o => o.type === "region_group"),
        user: options.filter(o => o.type === "user"),
        store: options.filter(o => o.type === "store"),
    }

    return (
        <div className="flex flex-col gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="min-h-[44px] h-auto w-full justify-between hover:bg-background px-3 py-2 text-left font-normal"
                    >
                        <div className="flex flex-wrap gap-1">
                            {selected.length === 0 && (
                                <span className="text-muted-foreground">Kime gönderilecek? (Grup veya Kişi seçin)</span>
                            )}
                            {selected.map((item) => (
                                <Badge key={item.id} variant="secondary" className="mr-1 mb-1 pl-1 gap-1 flex items-center pr-1 py-1">
                                    {item.avatar && (
                                        <Avatar className="h-4 w-4">
                                            <AvatarImage src={item.avatar} alt={item.label} />
                                            <AvatarFallback>{item.label ? item.label.charAt(0) : "?"}</AvatarFallback>
                                        </Avatar>
                                    )}
                                    <span className={cn(item.avatar ? "" : "ml-1")}>{item.label}</span>
                                    <div
                                        className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                handleRemove(item.id, e as unknown as React.MouseEvent)
                                            }
                                        }}
                                        onMouseDown={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                        }}
                                        onClick={(e) => handleRemove(item.id, e)}
                                    >
                                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </div>
                                </Badge>
                            ))}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                    <Command shouldFilter={true}>
                        <CommandInput placeholder="Kişi, mağaza veya grup ara..." />
                        <CommandList className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
                            
                            {groups.role_group.length > 0 && (
                                <CommandGroup heading="GENEL GRUPLAR">
                                    {groups.role_group.map((option) => (
                                        <CommandItem
                                            key={option.id}
                                            value={option.label} // Search by label
                                            onSelect={() => handleSelect(option)}
                                            className="cursor-pointer"
                                        >
                                            <div className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                selected.find(s => s.id === option.id)
                                                    ? "bg-primary text-white dark:text-black"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}>
                                                <Check className={cn("h-4 w-4")} />
                                            </div>
                                            <span className="font-medium">{option.label}</span>
                                            {option.count !== undefined && (
                                                <span className="ml-auto text-xs text-muted-foreground">{option.count} kişi</span>
                                            )}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                            
                            <CommandSeparator />

                           {groups.region_group.length > 0 && (
                                <CommandGroup heading="BÖLGE GRUPLARI">
                                    {groups.region_group.map((option) => (
                                        <CommandItem
                                            key={option.id}
                                            value={option.label}
                                            onSelect={() => handleSelect(option)}
                                            className="cursor-pointer"
                                        >
                                            <div className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                selected.find(s => s.id === option.id)
                                                    ? "bg-primary text-white dark:text-black"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}>
                                                <Check className={cn("h-4 w-4")} />
                                            </div>
                                            {option.label}
                                            <span className="ml-auto text-xs text-muted-foreground">Tüm Mağazalar</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                             <CommandSeparator />
                            
                            {groups.user.length > 0 && (
                                <CommandGroup heading="KİŞİLER">
                                    {groups.user.map((option) => (
                                        <CommandItem
                                            key={option.id}
                                            value={option.label}
                                            onSelect={() => handleSelect(option)}
                                            className="cursor-pointer flex items-center gap-2"
                                        >
                                            <div className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                selected.find(s => s.id === option.id)
                                                    ? "bg-primary text-white dark:text-black"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}>
                                                <Check className={cn("h-4 w-4")} />
                                            </div>
                                            
                                            {option.avatar ? (
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={option.avatar} alt={option.label} />
                                                    <AvatarFallback>{option.label ? option.label.charAt(0) : "?"}</AvatarFallback>
                                                </Avatar>
                                            ) : (
                                                 <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                    {option.label ? option.label.charAt(0) : "?"}
                                                </div>
                                            )}
                                            
                                            <span>{option.label}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                            <CommandSeparator />

                            {groups.store.length > 0 && (
                                <CommandGroup heading="MAĞAZALAR">
                                    {groups.store.map((option) => (
                                        <CommandItem
                                            key={option.id}
                                            value={option.label}
                                            onSelect={() => handleSelect(option)}
                                            className="cursor-pointer"
                                        >
                                            <div className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                selected.find(s => s.id === option.id)
                                                    ? "bg-primary text-white dark:text-black"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}>
                                                <Check className={cn("h-4 w-4")} />
                                            </div>
                                            {option.label}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
