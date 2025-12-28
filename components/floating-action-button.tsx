"use client";

import { useState } from "react";
import { Plus, Bell, Circle, ClipboardPen, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { CreateAuditDialog } from "@/components/create-audit-dialog";
import { WhatsAppShareDialog } from "@/components/whatsapp-share-dialog";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit } from "@/lib/types";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function FloatingActionButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreateAuditOpen, setIsCreateAuditOpen] = useState(false);
    const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    const handleNewAuditClick = async () => {
        // Eğer şu an bir denetim sayfasındaysak (/audits/...) durumunu kontrol et
        if (pathname?.startsWith('/audits/')) {
            const auditId = pathname.split('/audits/')[1];
            if (auditId) {
                try {
                    const auditDoc = await getDoc(doc(db, "audits", auditId));
                    if (auditDoc.exists()) {
                        const audit = auditDoc.data() as Audit;
                        if (audit.status === "devam_ediyor") {
                            setShowConfirmDialog(true);
                            setIsOpen(false);
                            return;
                        }
                    }
                } catch (error) {
                    console.error("Error checking audit status:", error);
                    // Hata durumunda güvenli davranıp direkt açabiliriz veya toast gösterebiliriz
                }
            }
        }

        setIsCreateAuditOpen(true);
        setIsOpen(false);
    };

    const toggleOpen = () => setIsOpen(!isOpen);

    const buttonVariants = {
        closed: { rotate: 0 },
        open: { rotate: 0 },
    };

    const subButtonVariants = {
        hidden: { opacity: 0, y: 20, scale: 0.8 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                delay: i * 0.1,
                duration: 0.3,
            },
        }),
        exit: { opacity: 0, y: 20, scale: 0.8, transition: { duration: 0.2 } },
    };

    return (
        <>
            <CreateAuditDialog open={isCreateAuditOpen} onOpenChange={setIsCreateAuditOpen} />
            <WhatsAppShareDialog open={isWhatsAppOpen} onOpenChange={setIsWhatsAppOpen} />

            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Yeni Denetim Başlat</AlertDialogTitle>
                        <AlertDialogDescription>
                            Devam eden bir denetim işleminiz bulunuyor. Yeni bir denetim başlatmak istediğinize emin misiniz?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => setIsCreateAuditOpen(true)}>
                            Devam Et
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>



            {/* Backdrop for focus */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
                    />
                )}
            </AnimatePresence>

            <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3">
                <AnimatePresence>
                    {isOpen && (
                        <div className="flex flex-col items-end gap-3 mb-2">
                            {/* WhatsApp Share Button */}
                            <motion.div
                                custom={2}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                variants={subButtonVariants}
                            >
                                <Button
                                    variant="default"
                                    className="h-14 pr-6 pl-2 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-3 group transition-all"
                                    onClick={() => {
                                        setIsWhatsAppOpen(true);
                                        setIsOpen(false);
                                    }}
                                >
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-500 group-hover:scale-110 transition-transform">
                                        <MessageCircle className="h-5 w-5" />
                                    </div>
                                    <span className="font-semibold text-base">WhatsApp ile Paylaş</span>
                                </Button>
                            </motion.div>

                            {/* Notification Button */}
                            <motion.div
                                custom={1}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                variants={subButtonVariants}
                            >
                                <Button
                                    variant="default"
                                    className="h-14 pr-6 pl-2 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-3 group transition-all"
                                    onClick={() => {
                                        console.log("Bildirim Yap clicked");
                                        setIsOpen(false);
                                    }}
                                >
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-500 group-hover:scale-110 transition-transform">
                                        <Bell className="h-5 w-5" />
                                    </div>
                                    <span className="font-semibold text-base">Bildirim Yap</span>
                                </Button>
                            </motion.div>

                            {/* New Audit Button */}
                            <motion.div
                                custom={0}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                variants={subButtonVariants}
                            >
                                <Button
                                    variant="default"
                                    className="h-14 pr-6 pl-2 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-3 group transition-all"
                                    onClick={handleNewAuditClick}
                                >
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-500 group-hover:scale-110 transition-transform">
                                        <ClipboardPen className="h-5 w-5" />
                                    </div>
                                    <span className="font-semibold text-base">Yeni Denetim Yap</span>
                                </Button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <motion.button
                    className="relative flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white shadow-2xl hover:bg-indigo-700 hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:bg-indigo-600 dark:hover:bg-indigo-700 dark:focus:ring-indigo-800 z-50"
                    onClick={toggleOpen}
                    variants={buttonVariants}
                    animate={isOpen ? "open" : "closed"}
                    whileTap={{ scale: 0.90 }}
                >
                    <Plus className="h-8 w-8" />
                </motion.button>
            </div>
        </>
    );
}
