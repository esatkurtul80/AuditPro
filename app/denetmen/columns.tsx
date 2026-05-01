"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Audit } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlayCircle, CheckCircle2, Eye, Edit, XCircle, FileText, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { Timestamp } from "firebase/firestore"
import { applyScoreRule } from "@/lib/utils"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    })
}

const formatTime = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
    })
}

export const getAuditColumns = (onCancel?: (auditId: string) => void): ColumnDef<Audit>[] => [
    {
        accessorKey: "auditTypeName",
        header: "Denetim Türü",
        cell: ({ row }) => (
            <div className="font-medium">{row.getValue("auditTypeName")}</div>
        ),
    },
    {
        accessorKey: "storeName",
        header: "Mağaza",
    },
    {
        accessorKey: "status",
        header: "Durum",
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            if (status === "devam_ediyor") {
                return (
                    <Badge className="bg-yellow-500">
                        <PlayCircle className="mr-1 h-3 w-3" />
                        Devam Ediyor
                    </Badge>
                )
            }
            if (status === "iptal_edildi") {
                return (
                    <Badge variant="destructive">
                        <XCircle className="mr-1 h-3 w-3" />
                        İptal Edildi
                    </Badge>
                )
            }
            return (
                <Badge className="bg-green-700 hover:bg-green-800 text-white">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Tamamlandı
                </Badge>
            )
        },
    },
    {
        accessorKey: "totalScore",
        header: "Puan",
        cell: ({ row }) => {
            return <div>{applyScoreRule(row.getValue("totalScore") || 0)}</div>
        },
    },
    {
        accessorKey: "startedAt",
        header: "Tarih",
        cell: ({ row }) => {
            const timestamp = row.getValue("startedAt") as Timestamp
            return <div className="whitespace-nowrap">{formatDate(timestamp)}</div>
        },
    },
    {
        id: "startTime",
        accessorFn: (row) => row.startedAt,
        header: "Başlangıç Saati",
        cell: ({ row }) => {
            const timestamp = row.getValue("startTime") as Timestamp
            return <div className="whitespace-nowrap">{formatTime(timestamp)}</div>
        },
    },
    {
        id: "endTime",
        accessorFn: (row) => row.completedAt,
        header: "Bitiş Saati",
        cell: ({ row }) => {
            const timestamp = row.getValue("endTime") as Timestamp
            return <div className="whitespace-nowrap">{timestamp ? formatTime(timestamp) : "-"}</div>
        },
    },
    {
        id: "actions",
        header: () => <div className="text-right">İşlem</div>,
        cell: ({ row }) => {
            const audit = row.original

            return (
                <div className="flex justify-end">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Menüyü aç</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            {audit.status === "devam_ediyor" ? (
                                <>
                                    <Link href={`/audits/${audit.id}?mode=edit`}>
                                        <DropdownMenuItem className="cursor-pointer gap-2 font-medium">
                                            <PlayCircle className="h-4 w-4 text-slate-600" />
                                            <span>Devam Et</span>
                                        </DropdownMenuItem>
                                    </Link>
                                    {onCancel && (
                                        <DropdownMenuItem 
                                            className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 gap-2 font-medium"
                                            onClick={() => onCancel(audit.id)}
                                        >
                                            <XCircle className="h-4 w-4" />
                                            <span>İptal Et</span>
                                        </DropdownMenuItem>
                                    )}
                                </>
                            ) : (
                                <>
                                    {audit.status === "tamamlandi" && (
                                        <>
                                            <Link href={`/audits/${audit.id}/summary`}>
                                                <DropdownMenuItem className="cursor-pointer gap-2 font-medium">
                                                    <Eye className="h-4 w-4 text-slate-600" />
                                                    <span>Özet Rapor</span>
                                                </DropdownMenuItem>
                                            </Link>
                                            <Link href={`/audits/${audit.id}/report`}>
                                                <DropdownMenuItem className="cursor-pointer text-indigo-700 focus:bg-indigo-50 focus:text-indigo-800 gap-2 font-medium">
                                                    <FileText className="h-4 w-4" />
                                                    <span>Özel Rapor</span>
                                                </DropdownMenuItem>
                                            </Link>
                                        </>
                                    )}
                                    <Link href={`/audits/${audit.id}?mode=edit`}>
                                        <DropdownMenuItem className="cursor-pointer gap-2 font-medium">
                                            <Edit className="h-4 w-4 text-slate-600" />
                                            <span>Düzenle</span>
                                        </DropdownMenuItem>
                                    </Link>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )
        },
    },
]

// Maintain backward compatibility
export const auditColumns = getAuditColumns()
