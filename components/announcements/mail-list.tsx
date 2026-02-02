"use client"

import { ComponentProps } from "react"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Announcement } from "@/lib/types"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Archive, Trash2 } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface MailListProps {
  items: Announcement[]
  selectedId: string | null
  onSelect: (id: string) => void
  folder: "sent" | "trash" | "archive"
  onDelete: (id: string) => void
  onArchive: (id: string) => void
}

export function MailList({ items, selectedId, onSelect, folder, onDelete, onArchive }: MailListProps) {
  return (
    <div>
      <div className="flex flex-col gap-2 p-4 pt-3">
        {items.map((item) => (
          <ContextMenu key={item.id}>
            <ContextMenuTrigger>
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "flex w-full flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent cursor-pointer focus:outline-none",
                  selectedId === item.id && "bg-muted"
                )}
                onClick={() => onSelect(item.id)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(item.id);
                    }
                }}
              >
                <div className="grid grid-cols-12 gap-4 w-full items-center">
                  <div className="col-span-3 flex items-center gap-2">
                     <div className="font-semibold truncate">{item.senderName}</div>
                      {!item.read && (
                        <span className="flex h-2 w-2 min-w-2 rounded-full bg-blue-600" />
                      )}
                  </div>
                  <div className="col-span-6 flex flex-col justify-center">
                     <div className="text-sm font-medium truncate">{item.title}</div>
                  </div>
                  <div className="col-span-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                       {item.createdAt ? formatDistanceToNow(item.createdAt.toDate(), {
                        addSuffix: true,
                        locale: tr
                      }) : "Tarih yok"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                     {item.recipients && item.recipients.length > 0 ? (
                        (() => {
                            const allUsersParams = item.recipients.find((r: any) => r.value === "all");
                            if (allUsersParams) {
                                return (
                                    <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                        Tüm Kullanıcılar
                                    </Badge>
                                )
                            }

                            return (
                                <>
                                    {item.recipients.slice(0, 3).map((recipient: any, index: number) => {
                                        let badgeVariant = "outline";
                                        let badgeClass = "text-[10px]";

                                        // Color coding based on type
                                        if (recipient.type === "role_group") {
                                            badgeClass += " bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
                                        } else if (recipient.type === "store") {
                                            badgeClass += " bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
                                        } else if (recipient.type === "user") {
                                            badgeClass += " bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
                                        } else if (recipient.type === "region_group" || recipient.id.startsWith("city_")) {
                                            badgeClass += " bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800";
                                        }

                                        return (
                                            <Badge key={index} variant="outline" className={badgeClass}>
                                                {recipient.label}
                                            </Badge>
                                        );
                                    })}
                                    {item.recipients.length > 3 && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <Badge variant="outline" className="text-[10px] text-muted-foreground hover:bg-muted cursor-help">
                                                        +{item.recipients.length - 3} diğer
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-[200px] p-2 text-xs">
                                                    <div className="flex flex-col gap-1">
                                                        {item.recipients.slice(3).map((r: any, i: number) => (
                                                            <span key={i} className="truncate border-b last:border-0 pb-1 last:pb-0 border-border/20">
                                                                {r.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </>
                            );
                        })()
                     ) : (
                        <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-800 border-gray-200">
                            Herkese (Bilinmeyen)
                        </Badge>
                     )}
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {folder !== "archive" && folder !== "trash" && (
                  <ContextMenuItem onClick={() => onArchive(item.id)}>
                    <Archive className="mr-2 h-4 w-4" />
                    Arşive Ekle
                  </ContextMenuItem>
              )}
              <ContextMenuItem onClick={() => onDelete(item.id)} className="text-red-600 focus:text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Sil
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
        {items.length === 0 && (
            <div className="text-center text-muted-foreground py-10">
                {folder === "trash" ? "Çöp kutusu boş." : 
                 folder === "archive" ? "Arşivlenmiş bildirim yok." : 
                 "Hiç bildirim bulunmadı."}
            </div>
        )}
      </div>
    </div>
  )
}
