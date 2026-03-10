"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    setDoc,
    deleteDoc,
    Timestamp,
    onSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { StorePersonnel, PersonnelEvaluation, PersonnelStatus, Store } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, UserCircle, Star, Save, CheckCircle2, UserPlus, UserMinus, ArrowRightLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
    auditId: string;
    storeId: string;
    storeName: string;
    canEdit: boolean;
    onPersonnelChange?: () => void;
}

export function PersonnelEvaluationSection({ auditId, storeId, storeName, canEdit, onPersonnelChange }: Props) {
    const { userProfile } = useAuth();
    const [personnelList, setPersonnelList] = useState<StorePersonnel[]>([]);
    const [evaluations, setEvaluations] = useState<Record<string, PersonnelEvaluation>>({});
    const [loading, setLoading] = useState(true);

    // New personnel modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newPersonnelName, setNewPersonnelName] = useState("");
    const [addingPersonnel, setAddingPersonnel] = useState(false);


    // Editing state per personnel
    const [drafts, setDrafts] = useState<Record<string, { score: string; comment: string; status: PersonnelStatus; targetStoreId?: string }>>({});

    // Mirror ref so onSnapshot callbacks always see fresh evaluations without stale closure
    const evaluationsRef = useRef<Record<string, PersonnelEvaluation>>({});

    const [savingId, setSavingId] = useState<string | null>(null);

    // List of all stores for transfer feature
    const [allStores, setAllStores] = useState<Store[]>([]);

    // State for Global Personnel Search / Pull Transfer
    const [globalSearchResults, setGlobalSearchResults] = useState<StorePersonnel[]>([]);
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
    const [pullingPersonnelId, setPullingPersonnelId] = useState<string | null>(null);

    // Refs for textareas to manage cursor positioning
    const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});

    useEffect(() => {
        if (!storeId) return;

        let unsubPersonnel = () => { };
        let unsubEvals = () => { };

        setLoading(true);

        const setupRealtime = async () => {
            try {
                // Load stores for transfer dropdown
                const sQuery = query(collection(db, "stores"));
                const sSnap = await getDocs(sQuery);
                const sList = sSnap.docs.map(s => ({ id: s.id, ...s.data() } as Store));
                sList.sort((a, b) => a.name.localeCompare(b.name));
                setAllStores(sList);
            } catch (e) {
                console.error("Error loading stores:", e);
            }

            // Realtime listener for evaluations in this audit
            const eQuery = query(collection(db, "personnel_evaluations"), where("auditId", "==", auditId));
            unsubEvals = onSnapshot(eQuery, { includeMetadataChanges: true }, (eSnap) => {
                const evalsToSet: Record<string, PersonnelEvaluation> = {};
                eSnap.docs.forEach(e => {
                    const data = { id: e.id, ...e.data() } as PersonnelEvaluation;
                    evalsToSet[data.personnelId] = data;
                });
                // Keep ref in sync so the personnelList listener can read it immediately
                evaluationsRef.current = evalsToSet;
                setEvaluations(evalsToSet);

                // Also hydrate drafts immediately when evaluations arrive
                // (handles the race where evaluations snapshot comes AFTER personnelList)
                setDrafts(prev => {
                    const newDrafts = { ...prev };
                    let changed = false;
                    Object.values(evalsToSet).forEach(ev => {
                        if (!newDrafts[ev.personnelId]) return;
                        const d = newDrafts[ev.personnelId];
                        const svScore = ev.score !== undefined ? ev.score.toString() : "";
                        const svComment = ev.comment ?? "";
                        if (d.score === "" && svScore !== "") {
                            newDrafts[ev.personnelId] = { ...d, score: svScore };
                            changed = true;
                        }
                        if (newDrafts[ev.personnelId].comment === "" && svComment !== "") {
                            newDrafts[ev.personnelId] = { ...newDrafts[ev.personnelId], comment: svComment };
                            changed = true;
                        }
                    });
                    return changed ? newDrafts : prev;
                });
            }, (error) => {
                if (error.code !== 'permission-denied') console.error("Evaluations onSnapshot error:", error);
            });

            // Realtime listener for personnel in this store
            const pQuery = query(collection(db, "store_personnel"), where("storeId", "==", storeId));
            unsubPersonnel = onSnapshot(pQuery, (pSnap) => {
                const pList = pSnap.docs.map(st => ({ id: st.id, ...st.data() } as StorePersonnel));
                setPersonnelList(pList);

                setDrafts(prev => {
                    const newDrafts = { ...prev };
                    pList.forEach(p => {
                        if (!newDrafts[p.id]) {
                            // Use evaluationsRef.current to populate score/comment immediately
                            const existingEval = evaluationsRef.current[p.id];
                            newDrafts[p.id] = {
                                score: existingEval?.score !== undefined ? existingEval.score.toString() : "",
                                comment: existingEval?.comment ?? "",
                                status: p.status,
                                targetStoreId: p.targetStoreId || "none"
                            };
                        } else if (newDrafts[p.id].status !== p.status && prev[p.id]?.status === prev[p.id]?.status) {
                            newDrafts[p.id] = { ...newDrafts[p.id], status: p.status };
                        }
                    });
                    return newDrafts;
                });
                setLoading(false);
            }, (error) => {
                if (error.code !== 'permission-denied') {
                    console.error("Error listening to personnel:", error);
                    toast.error("Personel listesi güncellenemedi.");
                }
                setLoading(false);
            });
        };

        setupRealtime();

        return () => {
            unsubPersonnel();
            unsubEvals();
        };
    }, [storeId, auditId]);

    // Sync evaluations → drafts whenever Firestore data arrives (online or from cache)
    useEffect(() => {
        if (Object.keys(evaluations).length === 0) return;

        setDrafts(prev => {
            const newDrafts = { ...prev };
            let changed = false;

            Object.values(evaluations).forEach(ev => {
                if (!newDrafts[ev.personnelId]) return;

                const draft = newDrafts[ev.personnelId];
                const serverScore = ev.score !== undefined ? ev.score.toString() : "";
                const serverComment = ev.comment ?? "";

                // Only overwrite when draft matches what the server has — this is a fresh load/remount,
                // not an in-progress keystroke. We detect this by checking if the draft has
                // never been touched (i.e. it still has the initial empty values).
                if (draft.score === "" && serverScore !== "") {
                    newDrafts[ev.personnelId] = { ...draft, score: serverScore };
                    changed = true;
                }
                if (draft.comment === "" && serverComment !== "") {
                    newDrafts[ev.personnelId] = { ...newDrafts[ev.personnelId], comment: serverComment };
                    changed = true;
                }
            });

            return changed ? newDrafts : prev;
        });
    }, [evaluations]);

    const searchGlobalPersonnel = async () => {
        if (!newPersonnelName.trim()) {
            toast.error("Lütfen aranacak personel adını girin.");
            return;
        }

        setIsSearchingGlobal(true);
        setGlobalSearchResults([]);
        try {
            // Search all active personnel in OTHER stores that match the name approximately
            const q = query(collection(db, "store_personnel"), where("status", "==", "active"));
            const snap = await getDocs(q);

            const searchTerm = newPersonnelName.trim().toLowerCase();
            const results = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as StorePersonnel))
                .filter(p => p.storeId !== storeId && p.name.toLowerCase().includes(searchTerm));

            setGlobalSearchResults(results);

            // If no match is found, just go ahead and create
            if (results.length === 0) {
                await createNewPersonnel();
            }
        } catch (error) {
            console.error("Error searching global personnel:", error);
            toast.error("Personel aranırken bir hata oluştu.");
        } finally {
            setIsSearchingGlobal(false);
        }
    };

    const handlePullPersonnel = async (p: StorePersonnel) => {
        setPullingPersonnelId(p.id);
        try {
            const now = Timestamp.now();
            await updateDoc(doc(db, "store_personnel", p.id), {
                storeId: storeId,
                status: "active",
                updatedAt: now
            });

            // We don't manually setPersonnelList anymore, onSnapshot handles it
            setDrafts(prev => ({
                ...prev,
                [p.id]: { score: "", comment: "", status: "active", targetStoreId: "none" }
            }));

            setIsAddModalOpen(false);
            setNewPersonnelName("");
            setGlobalSearchResults([]);
            toast.success(`${p.name} başarıyla bu mağazaya transfer edildi.`);
        } catch (error) {
            console.error("Error pulling personnel:", error);
            toast.error("Personel transfer edilemedi.");
        } finally {
            setPullingPersonnelId(null);
        }
    };

    const createNewPersonnel = async () => {
        setAddingPersonnel(true);
        try {
            const now = Timestamp.now();
            const newP = {
                storeId,
                name: newPersonnelName.trim(),
                status: "active" as PersonnelStatus,
                createdAt: now,
                updatedAt: now,
            };

            const docRef = await addDoc(collection(db, "store_personnel"), newP);
            const addedP: StorePersonnel = { id: docRef.id, ...newP };

            // We don't manually setPersonnelList anymore, onSnapshot handles it
            setDrafts(prev => ({
                ...prev,
                [docRef.id]: { score: "", comment: "", status: "active", targetStoreId: "none" }
            }));

            setIsAddModalOpen(false);
            setNewPersonnelName("");
            setGlobalSearchResults([]); // Reset
            toast.success("Yeni personel başarıyla Eklendi.");
        } catch (error) {
            console.error("Error adding personnel:", error);
            toast.error("Personel eklenemedi.");
        } finally {
            setAddingPersonnel(false);
        }
    };

    // To cleanly close the modal and reset search states
    const handleCloseModal = () => {
        setIsAddModalOpen(false);
        setNewPersonnelName("");
        setGlobalSearchResults([]);
    };

    // Instant Save - Operates on every keystroke/change, relying on Firestore's built-in offline caching and request batching
    const instantSaveEvaluation = async (personnelId: string, personnel: StorePersonnel, currentDraft: any) => {
        if (!userProfile?.uid) return; // Wait for profile

        setSavingId(personnelId);
        try {
            const now = Timestamp.now();
            let evalId = evaluations[personnelId]?.id;

            // 1. Handle Status Change (Transfer / Resign)
            if (currentDraft.status !== "active" && currentDraft.status !== personnel.status) {
                const updateData: any = {
                    status: currentDraft.status,
                    updatedAt: now,
                };

                if (currentDraft.status === "transferred" && currentDraft.targetStoreId !== "none") {
                    updateData.storeId = currentDraft.targetStoreId; // move them permanently
                    updateData.targetStoreId = currentDraft.targetStoreId; // keep record
                    updateData.status = "active"; // They become active in the new store
                }

                await updateDoc(doc(db, "store_personnel", personnelId), updateData);
                toast.success(`${personnel.name} durumu güncellendi.`);
            }

            // 2. Save score/comment if provided or delete if cleared
            if (currentDraft.score === "" && currentDraft.comment.trim() === "") {
                if (evalId) {
                    await deleteDoc(doc(db, "personnel_evaluations", evalId));
                    // Prevent deleting multiple times before snapshot triggers:
                    const updatedEvals = { ...evaluations };
                    delete updatedEvals[personnelId];
                    setEvaluations(updatedEvals);
                }
            } else {
                const evalData = {
                    personnelId,
                    personnelName: personnel.name,
                    auditId,
                    storeId,
                    storeName,
                    auditorId: userProfile?.uid || "unknown",
                    auditorName: userProfile?.firstName ? `${userProfile.firstName} ${userProfile.lastName}` : (userProfile?.displayName || "Denetmen"),
                    score: parseInt(currentDraft.score) || 0,
                    comment: currentDraft.comment.trim(),
                    createdAt: evaluations[personnelId] ? evaluations[personnelId].createdAt : now,
                };

                if (evalId) {
                    await updateDoc(doc(db, "personnel_evaluations", evalId), evalData);
                } else {
                    const newDocRef = doc(collection(db, "personnel_evaluations"));
                    // Store the reference immediately in local state so the next instant keystroke uses updateDoc 
                    // instead of continually creating duplicate records while waiting for snapshot or connection.
                    setEvaluations(prev => ({
                        ...prev,
                        [personnelId]: { id: newDocRef.id, ...evalData } as PersonnelEvaluation
                    }));

                    await setDoc(newDocRef, evalData);
                }
            }

            if (onPersonnelChange) onPersonnelChange();

        } catch (error) {
            console.error("Error saving eval:", error);
        } finally {
            setSavingId(null);
        }
    };


    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <Card className="mt-8 border-2 border-indigo-100 dark:border-indigo-900 shadow-lg relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-border/50 pb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <UserCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Personel Değerlendirme</CardTitle>
                            <CardDescription className="text-sm mt-1 max-w-lg">
                                Bu bölüm mağaza genel puanına (%0) etki etmez. Sadece personelin mesleki gelişim verisini sisteme işler.
                            </CardDescription>
                        </div>
                    </div>
                    {canEdit && (
                        <Dialog open={isAddModalOpen} onOpenChange={(open) => {
                            if (!open) handleCloseModal();
                            else setIsAddModalOpen(true);
                        }}>
                            <DialogTrigger asChild>
                                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Yeni Personel Ekle
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Yeni Personel Ekle</DialogTitle>
                                    <DialogDescription>
                                        Sisteme eklenen personel bu mağazanın kadrosuna dahil edilir ve sonraki ziyaretlerde otomatik listelenir.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Personel Adı Soyadı</Label>
                                        <Input
                                            placeholder="Örn: Ali Yılmaz"
                                            value={newPersonnelName}
                                            onChange={(e) => {
                                                setNewPersonnelName(e.target.value);
                                                setGlobalSearchResults([]); // clear results if user types again
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') searchGlobalPersonnel();
                                            }}
                                        />
                                    </div>

                                    {globalSearchResults.length > 0 && (
                                        <div className="mt-4 p-4 border rounded-xl bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 space-y-3">
                                            <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                                <div className="text-sm">
                                                    <p className="font-semibold">Benzer kayıtlar bulundu!</p>
                                                    <p className="text-amber-700/80 dark:text-amber-300/80">
                                                        Aradığınız kişi başka bir mağazada (veya eski mağazasında) aktif görünüyor olabilir. Çift kayıt oluşturmamak için kişiyi bu mağazaya çekebilirsiniz (Transfer).
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="space-y-2 mt-2">
                                                {globalSearchResults.map(g => {
                                                    const s = allStores.find(st => st.id === g.storeId);
                                                    return (
                                                        <div key={g.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border shadow-sm">
                                                            <div>
                                                                <p className="font-medium text-sm">{g.name}</p>
                                                                <p className="text-xs text-muted-foreground">Kayıtlı olduğu yer: {s?.name || 'Bilinmiyor'}</p>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                                                onClick={() => handlePullPersonnel(g)}
                                                                disabled={pullingPersonnelId === g.id}
                                                            >
                                                                {pullingPersonnelId === g.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ArrowRightLeft className="w-3 h-3 mr-1" />}
                                                                Bu Mağazaya Çek
                                                            </Button>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter className="gap-2 sm:gap-0">
                                    <Button variant="outline" onClick={handleCloseModal}>İptal</Button>

                                    {globalSearchResults.length > 0 ? (
                                        <Button
                                            onClick={createNewPersonnel}
                                            disabled={addingPersonnel || !newPersonnelName.trim()}
                                            className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-slate-200"
                                        >
                                            {addingPersonnel ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                            Yine de Yeni Oluştur
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={searchGlobalPersonnel}
                                            disabled={isSearchingGlobal || addingPersonnel || !newPersonnelName.trim()}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                        >
                                            {(isSearchingGlobal || addingPersonnel) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                            Ekle ve Listele
                                        </Button>
                                    )}
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                {personnelList.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-border">
                        <UserCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-muted-foreground font-medium">Bu mağazada kayıtlı personel bulunmuyor.</p>
                        {canEdit && <p className="text-sm text-muted-foreground mt-1">Lütfen "Yeni Personel Ekle" butonu ile mağaza çalışanlarını listeye ekleyin.</p>}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {personnelList.map(personnel => {
                            const evalData = evaluations[personnel.id];
                            const draft = drafts[personnel.id];
                            if (!draft) return null;

                            const isSaved = evalData !== undefined;

                            // If they are no longer active and already saved, lock it out unless they are transferring now
                            const isInactiveLocked = personnel.status !== "active";

                            return (
                                <div key={personnel.id} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
                                    <div className="flex flex-col md:flex-row md:items-start gap-6">
                                        {/* Status and Identity Column */}
                                        <div className="shrink-0 md:w-64 space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                    <UserCircle className="w-6 h-6 text-slate-500" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-base">{personnel.name}</h4>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {personnel.status === 'active' ? (
                                                            <span className="inline-flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Mevcut
                                                            </span>
                                                        ) : personnel.status === 'resigned' ? (
                                                            <span className="inline-flex items-center text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full">
                                                                <UserMinus className="w-3 h-3 mr-1" /> Ayrıldı
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                                                                <ArrowRightLeft className="w-3 h-3 mr-1" /> Transfer
                                                            </span>
                                                        )}
                                                        {isSaved && <span className="text-xs text-muted-foreground ml-2">(Kaydedildi)</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            {canEdit && !isInactiveLocked && (
                                                <div className="space-y-3 pt-2">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Durum Bildirimi</Label>
                                                        <Select
                                                            value={draft.status}
                                                            onValueChange={(val: any) => {
                                                                const newDraft = { ...draft, status: val };
                                                                setDrafts(p => ({ ...p, [personnel.id]: newDraft }));
                                                                if (val !== "transferred") {
                                                                    instantSaveEvaluation(personnel.id, personnel, newDraft);
                                                                }
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue placeholder="Durum seç" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="active">Mağazada Çalışıyor</SelectItem>
                                                                <SelectItem value="resigned">İşten Ayrıldı</SelectItem>
                                                                <SelectItem value="transferred">Başka Mağazaya Geçti</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {draft.status === "transferred" && (
                                                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Gittiği Mağaza</Label>
                                                            <Select
                                                                value={draft.targetStoreId}
                                                                onValueChange={(val) => {
                                                                    const newDraft = { ...draft, targetStoreId: val };
                                                                    setDrafts(p => ({ ...p, [personnel.id]: newDraft }));
                                                                    instantSaveEvaluation(personnel.id, personnel, newDraft);
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-9">
                                                                    <SelectValue placeholder="Mağaza Seçin" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none" disabled>Lütfen Mağaza Seçin</SelectItem>
                                                                    {allStores.filter(s => s.id !== storeId).map(s => (
                                                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Evaluation Column */}
                                        <div className="flex-1 space-y-4">
                                            {/* Score Input */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="flex items-center gap-1.5">
                                                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                                        <span className="font-semibold text-slate-700 dark:text-slate-300">Performans Puanı (0-100)</span>
                                                    </Label>
                                                    <span className="text-xs text-muted-foreground font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">Etki: %0</span>
                                                </div>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    placeholder="100 üzerinden puanlayın"
                                                    value={draft.score}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val !== "" && (!/^\d+$/.test(val))) return;
                                                        let num = parseInt(val);
                                                        let finalVal = val;
                                                        if (num > 100) finalVal = "100";
                                                        if (num < 0) finalVal = "0";

                                                        const newDraft = { ...draft, score: finalVal };
                                                        setDrafts(p => ({ ...p, [personnel.id]: newDraft }));
                                                        instantSaveEvaluation(personnel.id, personnel, newDraft);
                                                    }}
                                                    disabled={!canEdit || isInactiveLocked || draft.status !== 'active'}
                                                    className="font-medium max-w-[200px]"
                                                />
                                            </div>

                                            {/* Comment Input */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="font-semibold text-slate-700 dark:text-slate-300">Yorum & İzlenim</Label>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 mb-1">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs px-2 hover:bg-red-50 hover:text-red-600 border-slate-200"
                                                        onClick={() => {
                                                            const el = textareaRefs.current[personnel.id];
                                                            const currentNote = draft.comment || "";
                                                            const cursorStart = el?.selectionStart ?? currentNote.length;
                                                            const cursorEnd = el?.selectionEnd ?? currentNote.length;

                                                            const textToInsert = currentNote.length === 0 || cursorStart === 0 ? "ÖNEMLİ: " : "\nÖNEMLİ: ";
                                                            const newNote = currentNote.slice(0, cursorStart) + textToInsert + currentNote.slice(cursorEnd);

                                                            const newDraft = { ...draft, comment: newNote };
                                                            setDrafts(p => ({ ...p, [personnel.id]: newDraft }));
                                                            instantSaveEvaluation(personnel.id, personnel, newDraft);

                                                            setTimeout(() => {
                                                                if (el) {
                                                                    el.focus();
                                                                    el.setSelectionRange(cursorStart + textToInsert.length, cursorStart + textToInsert.length);
                                                                }
                                                            }, 50);
                                                        }}
                                                        disabled={!canEdit || isInactiveLocked || draft.status !== 'active'}
                                                    >
                                                        Önemli
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs px-2 hover:bg-green-50 hover:text-green-600 border-slate-200"
                                                        onClick={() => {
                                                            const el = textareaRefs.current[personnel.id];
                                                            const currentNote = draft.comment || "";
                                                            const cursorStart = el?.selectionStart ?? currentNote.length;
                                                            const cursorEnd = el?.selectionEnd ?? currentNote.length;

                                                            const textToInsert = currentNote.length === 0 || cursorStart === 0 ? "NOT: " : "\nNOT: ";
                                                            const newNote = currentNote.slice(0, cursorStart) + textToInsert + currentNote.slice(cursorEnd);

                                                            const newDraft = { ...draft, comment: newNote };
                                                            setDrafts(p => ({ ...p, [personnel.id]: newDraft }));
                                                            instantSaveEvaluation(personnel.id, personnel, newDraft);

                                                            setTimeout(() => {
                                                                if (el) {
                                                                    el.focus();
                                                                    el.setSelectionRange(cursorStart + textToInsert.length, cursorStart + textToInsert.length);
                                                                }
                                                            }, 50);
                                                        }}
                                                        disabled={!canEdit || isInactiveLocked || draft.status !== 'active'}
                                                    >
                                                        Not
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs px-2 hover:bg-blue-50 hover:text-blue-600 border-slate-200"
                                                        onClick={() => {
                                                            const el = textareaRefs.current[personnel.id];
                                                            const currentNote = draft.comment || "";
                                                            const cursorStart = el?.selectionStart ?? currentNote.length;
                                                            const cursorEnd = el?.selectionEnd ?? currentNote.length;

                                                            const textToInsert = currentNote.length === 0 || cursorStart === 0 ? "ÖNERİ: " : "\nÖNERİ: ";
                                                            const newNote = currentNote.slice(0, cursorStart) + textToInsert + currentNote.slice(cursorEnd);

                                                            const newDraft = { ...draft, comment: newNote };
                                                            setDrafts(p => ({ ...p, [personnel.id]: newDraft }));
                                                            instantSaveEvaluation(personnel.id, personnel, newDraft);

                                                            setTimeout(() => {
                                                                if (el) {
                                                                    el.focus();
                                                                    el.setSelectionRange(cursorStart + textToInsert.length, cursorStart + textToInsert.length);
                                                                }
                                                            }, 50);
                                                        }}
                                                        disabled={!canEdit || isInactiveLocked || draft.status !== 'active'}
                                                    >
                                                        Öneri
                                                    </Button>
                                                </div>
                                                <Textarea
                                                    ref={(el) => { textareaRefs.current[personnel.id] = el; }}
                                                    placeholder="Personelin kılık kıyafet, davranış, mesai giriş çıkış ve görev bilinci hakkında detyalı yorumunuzu yazın..."
                                                    value={draft.comment}
                                                    onChange={(e) => {
                                                        const newDraft = { ...draft, comment: e.target.value };
                                                        setDrafts(p => ({ ...p, [personnel.id]: newDraft }));
                                                        instantSaveEvaluation(personnel.id, personnel, newDraft);
                                                    }}
                                                    disabled={!canEdit || isInactiveLocked || draft.status !== 'active'}
                                                    className="min-h-[100px] resize-y"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
