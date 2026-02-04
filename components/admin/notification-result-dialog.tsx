"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NotificationResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: {
    success: boolean;
    successCount: number;
    failureCount: number;
    failedUserNames?: string[];
    totalTarget?: number;
  } | null;
}

export function NotificationResultDialog({
  open,
  onOpenChange,
  results,
}: NotificationResultDialogProps) {
  if (!results) return null;

  const total = results.totalTarget || (results.successCount + results.failureCount);
  const successRate = total > 0 ? Math.round((results.successCount / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {results.failureCount === 0 ? (
                <>
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                    <span>Gönderim Başarılı</span>
                </>
            ) : (results.successCount === 0) ? (
                <>
                    <XCircle className="h-6 w-6 text-red-500" />
                    <span>Gönderim Başarısız</span>
                </>
            ) : (
                <>
                    <AlertTriangle className="h-6 w-6 text-yellow-500" />
                    <span>Kısmi Başarı</span>
                </>
            )}
          </DialogTitle>
          <DialogDescription>
            Bildirim gönderim işleminin detayları aşağıdadır.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-green-50 p-3 rounded-lg border border-green-100 dark:bg-green-900/20 dark:border-green-800">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{results.successCount}</div>
                    <div className="text-xs text-green-700 dark:text-green-300 font-medium">Başarılı</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg border border-red-100 dark:bg-red-900/20 dark:border-red-800">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{results.failureCount}</div>
                    <div className="text-xs text-red-700 dark:text-red-300 font-medium">Hatalı</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                    <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">%{successRate}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">Başarı Oranı</div>
                </div>
            </div>

            {/* Failed Users List */}
            {results.failureCount > 0 && (
                <div className="space-y-2 mt-2">
                    <div className="text-sm font-semibold text-red-600 flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        İletilemeyen Kullanıcılar ({results.failureCount})
                    </div>
                    <ScrollArea className="h-[150px] w-full rounded-md border p-2 bg-red-50/50 dark:bg-red-950/10">
                        {results.failedUserNames && results.failedUserNames.length > 0 ? (
                            <ul className="text-sm space-y-1">
                                {results.failedUserNames.map((name, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-red-700 dark:text-red-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                        {name}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-sm text-muted-foreground italic p-2">
                                Kullanıcı isimleri alınamadı, ancak tokenler geçersizdi ve temizlendi.
                            </div>
                        )}
                    </ScrollArea>
                </div>
            )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
