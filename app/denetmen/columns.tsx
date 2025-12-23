"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Audit } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlayCircle, CheckCircle2, Eye, Edit, XCircle } from "lucide-react"
import Link from "next/link"
import { Timestamp } from "firebase/firestore"

const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
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
                <Badge className="bg-green-500">
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
            return <div>{row.getValue("totalScore") || 0}</div>
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
        id: "actions",
        header: () => <div className="text-right">İşlem</div>,
        cell: ({ row }) => {
            const audit = row.original
            return (
                <div className="flex gap-2 justify-end">
                    {audit.status === "devam_ediyor" ? (
                        <>
                            <Link href={`/audits/${audit.id}`} title="Devam Et">
                                <Button variant="ghost" size="icon">
                                    <PlayCircle className="h-4 w-4" />
                                </Button>
                            </Link>
                            {onCancel && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => onCancel(audit.id)}
                                    title="İptal Et"
                                >
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            {audit.status === "tamamlandi" && (
                                <Link href={`/audits/${audit.id}?mode=view`}>
                                    <Button variant="ghost" size="icon" title="Görüntüle">
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </Link>
                            )}
                            <Link href={`/audits/${audit.id}?mode=edit`}>
                                <Button variant="ghost" size="icon" title="Düzenle">
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </Link>
                        </>
                    )}
                </div>
            )
        },
    },
]

// Maintain backward compatibility
export const auditColumns = getAuditColumns()
