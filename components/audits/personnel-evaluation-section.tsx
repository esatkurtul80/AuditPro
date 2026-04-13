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
import { Loader2, Plus, UserCircle, Star, Save, CheckCircle2, UserPlus, UserMinus, ArrowRightLeft, AlertCircle, Pencil, ChevronsUpDown, Check } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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
    // Debounce ref: prevents rapid status changes from overlapping async saves
    const saveDebouncerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    // Write-time guard: suppress Firestore echo for 3s after any local write (like main audit page pattern)
    const lastEvalWriteTimeRef = useRef<Record<string, number>>({});

    // List of all stores for transfer feature
    const [allStores, setAllStores] = useState<Store[]>([]);

    // State for Global Personnel Search / Pull Transfer
    const [globalSearchResults, setGlobalSearchResults] = useState<StorePersonnel[]>([]);
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
    const [pullingPersonnelId, setPullingPersonnelId] = useState<string | null>(null);

    // Personel Çek (browse by store) state
    const [modalTab, setModalTab] = useState<'new' | 'pull'>('new');
    const [pullStoreOpen, setPullStoreOpen] = useState(false);
    const [pullStoreId, setPullStoreId] = useState<string>('');
    const [pullStorePersonnel, setPullStorePersonnel] = useState<StorePersonnel[]>([]);
    const [loadingPullStore, setLoadingPullStore] = useState(false);

    // Inline name editing
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingNameValue, setEditingNameValue] = useState("");
    const [savingName, setSavingName] = useState(false);
    // Duplicate warning after name edit
    const [nameEditDuplicates, setNameEditDuplicates] = useState<{ personnelId: string; matches: (StorePersonnel & { storeName?: string })[] }>({ personnelId: '', matches: [] });

    // Refs for textareas to manage cursor positioning
    const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
    // Tracks which personnel's textarea is currently focused — prevents onSnapshot from resetting cursor mid-edit
    const focusedPersonnelIdRef = useRef<string | null>(null);

    // ── Save inline name edit ──────────────────────────────────────────────────
    const handleSaveName = async (personnelId: string) => {
        const trimmed = editingNameValue.trim();
        if (!trimmed) { setEditingNameId(null); return; }
        setSavingName(true);
        try {
            const { updateDoc, doc: fsDoc, getDocs: gds, collection: col, query: q, where: wh, Timestamp } = await import("firebase/firestore");
            // Update store_personnel
            await updateDoc(fsDoc(db, "store_personnel", personnelId), { name: trimmed, updatedAt: Timestamp.now() });
            // Update any existing eval for this audit
            const existingEval = evaluationsRef.current[personnelId];
            if (existingEval?.id) {
                await updateDoc(fsDoc(db, "personnel_evaluations", existingEval.id), { personnelName: trimmed });
            }
            // Update local personnel list
            setPersonnelList(prev => prev.map(p => p.id === personnelId ? { ...p, name: trimmed } : p));
            toast.success("İsim güncellendi.");

            // Search other stores for same name (duplicate check)
            try {
                const snap = await gds(q(col(db, "store_personnel"), wh("status", "==", "active")));
                const matches = snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as StorePersonnel))
                    .filter(p => p.storeId !== storeId && p.name.toLocaleUpperCase('tr-TR') === trimmed.toLocaleUpperCase('tr-TR'));
                if (matches.length > 0) {
                    const storeMap: Record<string, string> = {};
                    allStores.forEach(s => { storeMap[s.id] = s.name; });
                    const withNames = matches.map(p => ({ ...p, storeName: storeMap[p.storeId] || 'Bilinmiyor' }));
                    setNameEditDuplicates({ personnelId, matches: withNames });
                }
            } catch (_) { /* silent */ }
        } catch (e) {
            console.error(e);
            toast.error("İsim kaydedilemedi.");
        } finally {
            setSavingName(false);
            setEditingNameId(null);
        }
    };

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

                // Also sync drafts on every evaluation snapshot — enables cross-device real-time updates
                setDrafts(prev => {
                    const newDrafts = { ...prev };
                    let changed = false;
                    Object.values(evalsToSet).forEach(ev => {
                        if (!newDrafts[ev.personnelId]) return;
                        // Never hydrate sentinel (on_leave / cleared) values into the UI draft
                        const isSentinel = (ev.score !== undefined && ev.score < 0) || ev.comment === "[İzinli]";
                        if (isSentinel) return;
                        // Echo suppression: skip if WE wrote this recently (our own Firestore echo)
                        const recentWrite = Date.now() - (lastEvalWriteTimeRef.current[ev.personnelId] || 0) < 3000;
                        if (recentWrite) return;
                        // Outside echo window: server wins — applies cross-device changes
                        const d = newDrafts[ev.personnelId];
                        const svScore = ev.score !== undefined ? ev.score.toString() : "";
                        const svComment = ev.comment ?? "";
                        let updated = { ...d };
                        let anyChange = false;
                        if (svScore !== d.score) { updated.score = svScore; anyChange = true; }
                        // CURSOR FIX: don't update comment if this textarea is currently focused
                        // — React re-renders from external setDrafts reset cursor position mid-edit
                        const isBeingEdited = focusedPersonnelIdRef.current === ev.personnelId;
                        if (!isBeingEdited && svComment !== d.comment) { updated.comment = svComment; anyChange = true; }
                        if (anyChange) { newDrafts[ev.personnelId] = updated; changed = true; }
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
                            const initScore = existingEval?.score !== undefined && existingEval.score >= 0
                                ? existingEval.score.toString() : "";
                            const initComment = existingEval?.comment && existingEval.comment !== "[İzinli]"
                                ? existingEval.comment : "";
                            newDrafts[p.id] = {
                                score: initScore,
                                comment: initComment,
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

    // Load personnel of a selected store for the pull tab
    const loadStorePersonnel = async (selectedStoreId: string) => {
        if (!selectedStoreId) { setPullStorePersonnel([]); return; }
        setLoadingPullStore(true);
        try {
            const snap = await getDocs(query(
                collection(db, 'store_personnel'),
                where('storeId', '==', selectedStoreId),
                where('status', '==', 'active')
            ));
            setPullStorePersonnel(snap.docs.map(d => ({ id: d.id, ...d.data() } as StorePersonnel)));
        } catch { toast.error('Personel listesi yüklenemedi.'); }
        finally { setLoadingPullStore(false); }
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
            setModalTab('new');
            setPullStoreOpen(false);
            setPullStoreId('');
            setPullStorePersonnel([]);
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
        setModalTab('new');
        setPullStoreOpen(false);
        setPullStoreId('');
        setPullStorePersonnel([]);
    };

    // Instant Save - Operates on every keystroke/change, relying on Firestore's built-in offline caching and request batching
    const instantSaveEvaluation = async (personnelId: string, personnel: StorePersonnel, currentDraft: any) => {
        if (!userProfile?.uid) return; // Wait for profile

        setSavingId(personnelId);
        // Mark this personnel's eval as "just written" to suppress Firestore echo
        lastEvalWriteTimeRef.current[personnelId] = Date.now();
        try {
            const now = Timestamp.now();
            // Always read from ref (mutable, never stale) — prevents duplicate doc creation
            // from rapid saves where React state hasn't re-rendered yet
            let evalId = evaluationsRef.current[personnelId]?.id;

            // 1. Handle Status Change (any direction including back to active)
            if (currentDraft.status !== personnel.status) {
                const updateData: any = {
                    status: currentDraft.status,
                    updatedAt: now,
                };

                if (currentDraft.status === "transferred" && currentDraft.targetStoreId !== "none") {
                    updateData.storeId = currentDraft.targetStoreId;
                    updateData.targetStoreId = currentDraft.targetStoreId;
                    updateData.status = "active";
                }

                await updateDoc(doc(db, "store_personnel", personnelId), updateData);

                // If switching back to active from on_leave, clear the sentinel eval record
                // NOTE: denetmenler delete yapamıyor — score:-2 ile "temizlendi" sentinel yaz
                if (currentDraft.status === "active" && personnel.status === "on_leave") {
                    if (evalId) {
                        // score:-2 = "cleared pending" sentinel — filtered same as score:-1
                        await updateDoc(doc(db, "personnel_evaluations", evalId), {
                            score: -2,
                            comment: "",
                        });
                    }
                    toast.success(`${personnel.name} tekrar aktif.`);
                    if (onPersonnelChange) onPersonnelChange();
                    return;
                }

                if (currentDraft.status !== "active") {
                    toast.success(`${personnel.name} durumu güncellendi.`);
                }
            }

            // 2. on_leave: save a special marker evaluation (score=-1 signals "on leave")
            if (currentDraft.status === "on_leave") {
                const evalData = {
                    personnelId,
                    personnelName: personnel.name,
                    auditId,
                    storeId,
                    storeName,
                    auditorId: userProfile?.uid || "unknown",
                    auditorName: userProfile?.firstName ? `${userProfile.firstName} ${userProfile.lastName}` : (userProfile?.displayName || "Denetmen"),
                    score: -1, // sentinel: means "on leave, no score"
                    comment: "[İzinli]",
                    createdAt: evaluations[personnelId] ? evaluations[personnelId].createdAt : now,
                };
                if (evalId) {
                    await updateDoc(doc(db, "personnel_evaluations", evalId), evalData);
                } else {
                    const newDocRef = doc(collection(db, "personnel_evaluations"));
                    setEvaluations(prev => ({
                        ...prev,
                        [personnelId]: { id: newDocRef.id, ...evalData } as PersonnelEvaluation
                    }));
                    await setDoc(newDocRef, evalData);
                }
                if (onPersonnelChange) onPersonnelChange();
                return;
            }

            // 3. Save score/comment if provided; if cleared, write sentinel (denetmen can't delete)
            if (currentDraft.score === "" && currentDraft.comment.trim() === "") {
                if (evalId) {
                    // Can't deleteDoc — denetmen has no delete permission.
                    // Write score:-2 "cleared" sentinel instead; it's filtered everywhere in the UI.
                    await updateDoc(doc(db, "personnel_evaluations", evalId), {
                        score: -2,
                        comment: "",
                    });
                }
                // If no evalId yet, nothing to clear — just skip writing.
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
                    // Update ref IMMEDIATELY (sync) so any concurrent debounced call
                    // sees the new ID and uses updateDoc, never creating a duplicate.
                    evaluationsRef.current[personnelId] = { id: newDocRef.id, ...evalData } as PersonnelEvaluation;
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
                                    <DialogTitle>Personel İşlemleri</DialogTitle>
                                    <DialogDescription>
                                        Yeni personel oluşturun veya başka bir mağazadan personel çekin.
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Tab buttons */}
                                <div className="flex gap-2 border-b border-border pb-0">
                                    <button
                                        onClick={() => setModalTab('new')}
                                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                            modalTab === 'new'
                                                ? 'border-indigo-600 text-indigo-600'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <Plus className="w-3.5 h-3.5 inline mr-1" />Yeni Ekle
                                    </button>
                                    <button
                                        onClick={() => setModalTab('pull')}
                                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                            modalTab === 'pull'
                                                ? 'border-indigo-600 text-indigo-600'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <ArrowRightLeft className="w-3.5 h-3.5 inline mr-1" />Personel Çek
                                    </button>
                                </div>

                                {/* ── TAB: Yeni Ekle ── */}
                                {modalTab === 'new' && (
                                    <>
                                        <div className="space-y-4 py-2">
                                            <div className="space-y-2">
                                                <Label>Personel Adı Soyadı</Label>
                                                <Input
                                                    placeholder="Örn: ALİ YILMAZ"
                                                    value={newPersonnelName}
                                                    autoCapitalize="characters"
                                                    onChange={(e) => {
                                                        setNewPersonnelName(e.target.value.toLocaleUpperCase('tr-TR'));
                                                        setGlobalSearchResults([]);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') searchGlobalPersonnel();
                                                    }}
                                                />
                                            </div>

                                            {globalSearchResults.length > 0 && (
                                                <div className="p-4 border rounded-xl bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 space-y-3">
                                                    <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                                                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                                        <div className="text-sm">
                                                            <p className="font-semibold">Benzer kayıtlar bulundu!</p>
                                                            <p className="text-amber-700/80 dark:text-amber-300/80">
                                                                Bu kişi başka bir mağazada kayıtlı olabilir. Çift kayıt oluşturmamak için Transfer butonunu kullanın.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {globalSearchResults.map(g => {
                                                            const s = allStores.find(st => st.id === g.storeId);
                                                            return (
                                                                <div key={g.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border shadow-sm">
                                                                    <div>
                                                                        <p className="font-medium text-sm">{g.name}</p>
                                                                        <p className="text-xs text-muted-foreground">{s?.name || 'Bilinmiyor'}</p>
                                                                    </div>
                                                                    <Button size="sm" variant="outline"
                                                                        className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                                                        onClick={() => handlePullPersonnel(g)}
                                                                        disabled={pullingPersonnelId === g.id}
                                                                    >
                                                                        {pullingPersonnelId === g.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ArrowRightLeft className="w-3 h-3 mr-1" />}
                                                                        Bu Mağazaya Çek
                                                                    </Button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <DialogFooter className="gap-2 sm:gap-0">
                                            <Button variant="outline" onClick={handleCloseModal}>İptal</Button>
                                            {globalSearchResults.length > 0 ? (
                                                <Button onClick={createNewPersonnel}
                                                    disabled={addingPersonnel || !newPersonnelName.trim()}
                                                    className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-slate-200">
                                                    {addingPersonnel ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                                    Yine de Yeni Oluştur
                                                </Button>
                                            ) : (
                                                <Button onClick={searchGlobalPersonnel}
                                                    disabled={isSearchingGlobal || addingPersonnel || !newPersonnelName.trim()}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                                    {(isSearchingGlobal || addingPersonnel) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                                    Ekle ve Listele
                                                </Button>
                                            )}
                                        </DialogFooter>
                                    </>
                                )}

                                {/* ── TAB: Personel Çek ── */}
                                {modalTab === 'pull' && (
                                    <>
                                        <div className="space-y-4 py-2">
                                            <div className="space-y-1.5">
                                                <Label>Mağaza Seç</Label>
                                                <Select
                                                    value={pullStoreId}
                                                    onValueChange={(val) => {
                                                        setPullStoreId(val);
                                                        setPullStorePersonnel([]);
                                                        loadStorePersonnel(val);
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Mağaza seçin..." />
                                                    </SelectTrigger>
                                                    <SelectContent
                                                        position="popper"
                                                        side="bottom"
                                                        className="max-h-72 overflow-y-auto"
                                                    >
                                                        {allStores.filter(s => s.id !== storeId).map(s => (
                                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {loadingPullStore && (
                                                <div className="flex items-center justify-center py-6 text-muted-foreground">
                                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yükleniyor...
                                                </div>
                                            )}

                                            {!loadingPullStore && pullStoreId && pullStorePersonnel.length === 0 && (
                                                <p className="text-sm text-muted-foreground text-center py-4">Bu mağazada aktif personel bulunmuyor.</p>
                                            )}

                                            {pullStorePersonnel.length > 0 && (
                                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                                    {pullStorePersonnel.map(p => (
                                                        <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                                                            <div className="flex items-center gap-2">
                                                                <UserCircle className="w-5 h-5 text-slate-400" />
                                                                <span className="font-medium text-sm">{p.name}</span>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                                                onClick={() => handlePullPersonnel(p)}
                                                                disabled={pullingPersonnelId === p.id}
                                                            >
                                                                {pullingPersonnelId === p.id
                                                                    ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                    : <ArrowRightLeft className="w-3 h-3 mr-1" />
                                                                }
                                                                Çek
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={handleCloseModal}>İptal</Button>
                                        </DialogFooter>
                                    </>
                                )}
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
                                <div key={personnel.id} id={`personnel-card-${personnel.id}`} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
                                    <div className="flex flex-col md:flex-row md:items-start gap-6">
                                        {/* Status and Identity Column */}
                                        <div className="shrink-0 md:w-64 space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                    <UserCircle className="w-6 h-6 text-slate-500" />
                                                </div>
                                                <div>
                                                    {editingNameId === personnel.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                autoFocus
                                                                autoCapitalize="characters"
                                                                value={editingNameValue}
                                                                onChange={e => setEditingNameValue(e.target.value.toLocaleUpperCase('tr-TR'))}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleSaveName(personnel.id);
                                                                    if (e.key === 'Escape') setEditingNameId(null);
                                                                }}
                                                                onBlur={() => handleSaveName(personnel.id)}
                                                                className="h-7 text-sm font-semibold px-2 py-0 w-40"
                                                                disabled={savingName}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1">
                                                            <h4 className="font-semibold text-base">{personnel.name}</h4>
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => { setEditingNameId(personnel.id); setEditingNameValue(personnel.name); }}
                                                                    className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                                                                    title="İsmi düzenle"
                                                                >
                                                                    <Pencil className="w-3 h-3 text-slate-400" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {personnel.status === 'active' ? (
                                                            <span className="inline-flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Mevcut
                                                            </span>
                                                        ) : personnel.status === 'resigned' ? (
                                                            <span className="inline-flex items-center text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full">
                                                                <UserMinus className="w-3 h-3 mr-1" /> Ayrıldı
                                                            </span>
                                                        ) : personnel.status === 'on_leave' ? (
                                                            <span className="inline-flex items-center text-xs font-medium text-sky-600 bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 rounded-full">
                                                                İzinli
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

                                            {/* Duplicate name warning after inline edit */}
                                            {nameEditDuplicates.personnelId === personnel.id && nameEditDuplicates.matches.length > 0 && (
                                                <div className="mt-2 p-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50 space-y-2">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                                                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                            <p className="text-xs font-semibold">Bu isimde biri başka mağazada kayıtlı!</p>
                                                        </div>
                                                        <button
                                                            onClick={() => setNameEditDuplicates({ personnelId: '', matches: [] })}
                                                            className="text-amber-600 hover:text-amber-800 dark:text-amber-400 shrink-0"
                                                        >
                                                            <span className="text-xs">✕</span>
                                                        </button>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {nameEditDuplicates.matches.map(m => (
                                                            <div key={m.id} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg px-2.5 py-2 border text-xs">
                                                                <div>
                                                                    <p className="font-medium">{m.name}</p>
                                                                    <p className="text-muted-foreground">{m.storeName}</p>
                                                                </div>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                                                    onClick={() => {
                                                                        handlePullPersonnel(m);
                                                                        setNameEditDuplicates({ personnelId: '', matches: [] });
                                                                    }}
                                                                    disabled={pullingPersonnelId === m.id}
                                                                >
                                                                    {pullingPersonnelId === m.id
                                                                        ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                                                        : <ArrowRightLeft className="w-3 h-3 mr-1" />}
                                                                    Bu Mağazaya Çek
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {canEdit && personnel.status !== 'transferred' && (
                                                <div className="space-y-3 pt-2">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Durum Bildirimi</Label>
                                                        <Select
                                                            value={draft.status}
                                                            onValueChange={(val: any) => {
                                                                let newDraft = { ...draft, status: val };
                                                                // When switching back from on_leave → active, clear sentinel values
                                                                if (val === "active" && draft.status === "on_leave") {
                                                                    newDraft = { ...newDraft, score: "", comment: "" };
                                                                }
                                                                setDrafts(p => ({ ...p, [personnel.id]: newDraft }));
                                                                if (val !== "transferred") {
                                                                    // Debounce: cancel pending save for this personnel, schedule a new one
                                                                    clearTimeout(saveDebouncerRef.current[personnel.id]);
                                                                    saveDebouncerRef.current[personnel.id] = setTimeout(() => {
                                                                        instantSaveEvaluation(personnel.id, personnel, newDraft);
                                                                    }, 500);
                                                                }
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue placeholder="Durum seç" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="active">Mağazada Çalışıyor</SelectItem>
                                                                <SelectItem value="on_leave">Haftalık İzinli</SelectItem>
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
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="100 üzerinden puanlayın"
                                                    value={draft.score}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        // Allow empty string or digits only
                                                        if (val !== "" && !/^\d+$/.test(val)) return;
                                                        // Clamp 0-100
                                                        let finalVal = val;
                                                        if (val !== "") {
                                                            const num = parseInt(val, 10);
                                                            if (num > 100) finalVal = "100";
                                                            else if (num < 0) finalVal = "0";
                                                        }
                                                        const newDraft = { ...draft, score: finalVal };
                                                        setDrafts(p => ({ ...p, [personnel.id]: newDraft }));
                                                        // Debounce: rapid keystrokes → only the final value hits Firestore
                                                        clearTimeout(saveDebouncerRef.current[`score_${personnel.id}`]);
                                                        saveDebouncerRef.current[`score_${personnel.id}`] = setTimeout(() => {
                                                            instantSaveEvaluation(personnel.id, personnel, newDraft);
                                                        }, 300);
                                                    }}
                                                    disabled={!canEdit || isInactiveLocked || draft.status === 'on_leave'}
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
                                                        className="h-7 text-xs px-2 active:bg-red-50 active:text-red-600 border-slate-200"
                                                        onPointerDown={(e) => {
                                                            e.preventDefault();
                                                            const el = textareaRefs.current[personnel.id];
                                                            const currentNote = draft.comment || "";
                                                            const cursorStart = el?.selectionStart ?? currentNote.length;
                                                            const cursorEnd = el?.selectionEnd ?? currentNote.length;

                                                            const textToInsert = currentNote.length === 0 || cursorStart === 0 ? "ÖNEMLİ: " : "\nÖNEMLİ: ";
                                                            const newNote = currentNote.slice(0, cursorStart) + textToInsert + currentNote.slice(cursorEnd);

                                                            if (el) el.value = newNote;

                                                            const newDraft = { ...draft, comment: newNote };
                                                            setDrafts(p => ({ ...p, [personnel.id]: newDraft }));
                                                            instantSaveEvaluation(personnel.id, personnel, newDraft);

                                                            setTimeout(() => {
                                                                if (el) {
                                                                    el.focus();
                                                                    el.setSelectionRange(cursorStart + textToInsert.length, cursorStart + textToInsert.length);
                                                                }
                                                            }, 20);
                                                        }}
                                                        disabled={!canEdit || isInactiveLocked || draft.status === 'on_leave'}
                                                    >
                                                        Önemli
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs px-2 active:bg-green-50 active:text-green-600 border-slate-200"
                                                        onPointerDown={(e) => {
                                                            e.preventDefault();
                                                            const el = textareaRefs.current[personnel.id];
                                                            const currentNote = draft.comment || "";
                                                            const cursorStart = el?.selectionStart ?? currentNote.length;
                                                            const cursorEnd = el?.selectionEnd ?? currentNote.length;

                                                            const textToInsert = currentNote.length === 0 || cursorStart === 0 ? "NOT: " : "\nNOT: ";
                                                            const newNote = currentNote.slice(0, cursorStart) + textToInsert + currentNote.slice(cursorEnd);

                                                            if (el) el.value = newNote;

                                                            const newDraft = { ...draft, comment: newNote };
                                                            setDrafts(p => ({ ...p, [personnel.id]: newDraft }));
                                                            instantSaveEvaluation(personnel.id, personnel, newDraft);

                                                            setTimeout(() => {
                                                                if (el) {
                                                                    el.focus();
                                                                    el.setSelectionRange(cursorStart + textToInsert.length, cursorStart + textToInsert.length);
                                                                }
                                                            }, 20);
                                                        }}
                                                        disabled={!canEdit || isInactiveLocked || draft.status === 'on_leave'}
                                                    >
                                                        Not
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs px-2 active:bg-blue-50 active:text-blue-600 border-slate-200"
                                                        onPointerDown={(e) => {
                                                            e.preventDefault();
                                                            const el = textareaRefs.current[personnel.id];
                                                            const currentNote = draft.comment || "";
                                                            const cursorStart = el?.selectionStart ?? currentNote.length;
                                                            const cursorEnd = el?.selectionEnd ?? currentNote.length;

                                                            const textToInsert = currentNote.length === 0 || cursorStart === 0 ? "ÖNERİ: " : "\nÖNERİ: ";
                                                            const newNote = currentNote.slice(0, cursorStart) + textToInsert + currentNote.slice(cursorEnd);

                                                            if (el) el.value = newNote;

                                                            const newDraft = { ...draft, comment: newNote };
                                                            setDrafts(p => ({ ...p, [personnel.id]: newDraft }));
                                                            instantSaveEvaluation(personnel.id, personnel, newDraft);

                                                            setTimeout(() => {
                                                                if (el) {
                                                                    el.focus();
                                                                    el.setSelectionRange(cursorStart + textToInsert.length, cursorStart + textToInsert.length);
                                                                }
                                                            }, 20);
                                                        }}
                                                        disabled={!canEdit || isInactiveLocked || draft.status === 'on_leave'}
                                                    >
                                                        Öneri
                                                    </Button>
                                                </div>
                                                <Textarea
                                                    ref={(el) => { textareaRefs.current[personnel.id] = el; }}
                                                    placeholder="Personelin kılık kıyafet, davranış, mesai giriş çıkış ve görev bilinci hakkında detaylı yorumunuzu yazın..."
                                                    value={draft.comment}
                                                    onFocus={() => { focusedPersonnelIdRef.current = personnel.id; }}
                                                    onBlur={(e) => {
                                                        focusedPersonnelIdRef.current = null;
                                                        // Textarea'dan ayrılınca bekleyen debounce'u iptal et ve hemen kaydet
                                                        clearTimeout(saveDebouncerRef.current[`comment_${personnel.id}`]);
                                                        const latestDraft = { ...draft, comment: e.target.value };
                                                        instantSaveEvaluation(personnel.id, personnel, latestDraft);
                                                    }}
                                                    onChange={(e) => {
                                                        const newDraft = { ...draft, comment: e.target.value };
                                                        setDrafts(p => ({ ...p, [personnel.id]: newDraft }));
                                                        // Debounce: kullanıcı yazmayı bırakınca Firestore'a yaz
                                                        clearTimeout(saveDebouncerRef.current[`comment_${personnel.id}`]);
                                                        saveDebouncerRef.current[`comment_${personnel.id}`] = setTimeout(() => {
                                                            instantSaveEvaluation(personnel.id, personnel, newDraft);
                                                        }, 800);
                                                    }}
                                                    disabled={!canEdit || isInactiveLocked || draft.status === 'on_leave'}
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
