"use client";

import { useState, useEffect } from "react";
import {
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Hotel, Plus, Pencil, Trash2, MapPin, Loader2, Search, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

interface Lojman {
    id: string;
    name: string;
    city: string;
    address?: string;
    lat: number;
    lng: number;
    capacity?: number;
    notes?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

const EMPTY_FORM = {
    name: "",
    city: "",
    address: "",
    lat: "",
    lng: "",
    capacity: "",
    notes: "",
};

// Quick city presets for common Turkish lodging cities
const CITY_PRESETS: { city: string; lat: number; lng: number }[] = [
    { city: "İzmir", lat: 38.4192, lng: 27.1287 },
    { city: "Bursa", lat: 40.1826, lng: 29.0665 },
    { city: "Eskişehir", lat: 39.7767, lng: 30.5206 },
    { city: "Balıkesir", lat: 39.6484, lng: 27.8826 },
    { city: "Afyonkarahisar", lat: 38.7507, lng: 30.5567 },
    { city: "Ankara", lat: 39.9334, lng: 32.8597 },
    { city: "İstanbul", lat: 41.0082, lng: 28.9784 },
    { city: "Manisa", lat: 38.6191, lng: 27.4289 },
    { city: "Denizli", lat: 37.7765, lng: 29.0864 },
    { city: "Kocaeli", lat: 40.7654, lng: 29.9408 },
    { city: "Sakarya", lat: 40.7569, lng: 30.3781 },
    { city: "Antalya", lat: 36.8841, lng: 30.7056 },
];

export default function LojmanlarPage() {
    const [lojmanlar, setLojmanlar] = useState<Lojman[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Lojman | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    // Delete state
    const [deleteTarget, setDeleteTarget] = useState<Lojman | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => { fetchLojmanlar(); }, []);

    const fetchLojmanlar = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "lodging_locations"), orderBy("city"));
            const snap = await getDocs(q);
            setLojmanlar(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lojman)));
        } catch (e) {
            console.error(e);
            toast.error("Lojmanlar yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const openAdd = () => {
        setEditTarget(null);
        setForm(EMPTY_FORM);
        setDialogOpen(true);
    };

    const openEdit = (l: Lojman) => {
        setEditTarget(l);
        setForm({
            name: l.name,
            city: l.city,
            address: l.address || "",
            lat: String(l.lat),
            lng: String(l.lng),
            capacity: l.capacity ? String(l.capacity) : "",
            notes: l.notes || "",
        });
        setDialogOpen(true);
    };

    const applyPreset = (preset: typeof CITY_PRESETS[0]) => {
        setForm(f => ({
            ...f,
            city: preset.city,
            lat: String(preset.lat),
            lng: String(preset.lng),
            name: f.name || `${preset.city} Lojmanı`,
        }));
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.city.trim() || !form.lat || !form.lng) {
            toast.error("Lojman adı, şehir ve koordinatlar zorunludur.");
            return;
        }
        const lat = parseFloat(form.lat);
        const lng = parseFloat(form.lng);
        if (isNaN(lat) || isNaN(lng)) {
            toast.error("Enlem ve boylam geçerli sayılar olmalıdır.");
            return;
        }

        setSaving(true);
        const now = Timestamp.now();
        const payload = {
            name: form.name.trim(),
            city: form.city.trim(),
            address: form.address.trim() || null,
            lat,
            lng,
            capacity: form.capacity ? parseInt(form.capacity) : null,
            notes: form.notes.trim() || null,
            updatedAt: now,
        };

        try {
            if (editTarget) {
                await updateDoc(doc(db, "lodging_locations", editTarget.id), payload);
                toast.success("Lojman güncellendi.");
            } else {
                await addDoc(collection(db, "lodging_locations"), { ...payload, createdAt: now });
                toast.success("Lojman eklendi.");
            }
            setDialogOpen(false);
            fetchLojmanlar();
        } catch (e) {
            console.error(e);
            toast.error("Kayıt başarısız.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, "lodging_locations", deleteTarget.id));
            toast.success("Lojman silindi.");
            setDeleteTarget(null);
            fetchLojmanlar();
        } catch (e) {
            toast.error("Silme başarısız.");
        } finally {
            setDeleting(false);
        }
    };

    const filtered = lojmanlar.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.city.toLowerCase().includes(search.toLowerCase())
    );

    // Group by city
    const grouped = filtered.reduce((acc, l) => {
        if (!acc[l.city]) acc[l.city] = [];
        acc[l.city].push(l);
        return acc;
    }, {} as Record<string, Lojman[]>);

    const cities = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'tr'));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/30">
                            <Hotel className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Lojman Yönetimi</h1>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Denetmen konaklamaları için kullanılan lojman ve konaklama noktaları
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={openAdd}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Lojman Ekle
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <Card className="border-0 shadow-sm bg-white">
                        <CardContent className="pt-5 pb-4">
                            <p className="text-xs text-slate-500 font-medium">Toplam Lojman</p>
                            <p className="text-3xl font-bold text-slate-800 mt-1">{lojmanlar.length}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm bg-white">
                        <CardContent className="pt-5 pb-4">
                            <p className="text-xs text-slate-500 font-medium">Farklı Şehir</p>
                            <p className="text-3xl font-bold text-slate-800 mt-1">
                                {new Set(lojmanlar.map(l => l.city)).size}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm bg-white">
                        <CardContent className="pt-5 pb-4">
                            <p className="text-xs text-slate-500 font-medium">Koordinatlı</p>
                            <p className="text-3xl font-bold text-emerald-600 mt-1">
                                {lojmanlar.filter(l => l.lat && l.lng).length}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Lojman adı veya şehir ara..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 bg-white border-slate-200 shadow-sm"
                    />
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    </div>
                ) : filtered.length === 0 ? (
                    <Card className="border-dashed border-slate-200 shadow-none">
                        <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                            <Hotel className="h-12 w-12 text-slate-200" />
                            <p className="font-medium text-slate-500">
                                {search ? "Arama kriterlerine uygun lojman bulunamadı." : "Henüz lojman eklenmemiş."}
                            </p>
                            {!search && (
                                <Button onClick={openAdd} variant="outline" size="sm" className="mt-2 gap-2">
                                    <Plus className="h-4 w-4" />
                                    İlk Lojmanı Ekle
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {cities.map(city => (
                            <div key={city}>
                                <div className="flex items-center gap-2 mb-2">
                                    <MapPin className="h-4 w-4 text-indigo-500" />
                                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{city}</h2>
                                    <Badge variant="secondary" className="text-xs">{grouped[city].length}</Badge>
                                </div>
                                <div className="grid gap-3">
                                    {grouped[city].map(lojman => (
                                        <Card key={lojman.id} className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white group">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                                        <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 shrink-0 mt-0.5">
                                                            <Hotel className="h-4 w-4 text-indigo-600" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-slate-800 truncate">{lojman.name}</p>
                                                            {lojman.address && (
                                                                <p className="text-xs text-slate-500 mt-0.5 truncate">{lojman.address}</p>
                                                            )}
                                                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                                <span className="text-xs text-emerald-600 font-mono bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                                                                    <Navigation className="h-3 w-3" />
                                                                    {lojman.lat.toFixed(4)}, {lojman.lng.toFixed(4)}
                                                                </span>
                                                                {lojman.capacity && (
                                                                    <span className="text-xs text-slate-500">
                                                                        Kapasite: {lojman.capacity} kişi
                                                                    </span>
                                                                )}
                                                                {lojman.notes && (
                                                                    <span className="text-xs text-slate-400 italic truncate max-w-[200px]">
                                                                        {lojman.notes}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                            onClick={() => openEdit(lojman)}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() => setDeleteTarget(lojman)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Hotel className="h-5 w-5 text-indigo-600" />
                            {editTarget ? "Lojman Düzenle" : "Yeni Lojman Ekle"}
                        </DialogTitle>
                        <DialogDescription>
                            Yapay zeka program oluşturucusu bu bilgileri kullanarak konaklama önerileri yapar.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Quick Presets */}
                        {!editTarget && (
                            <div>
                                <Label className="text-xs text-slate-500 mb-2 block">Hızlı Şehir Seçimi</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {CITY_PRESETS.map(p => (
                                        <button
                                            key={p.city}
                                            onClick={() => applyPreset(p)}
                                            className={cn(
                                                "text-xs px-2.5 py-1 rounded-full border transition-all",
                                                form.city === p.city
                                                    ? "bg-indigo-600 text-white border-indigo-600"
                                                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                                            )}
                                        >
                                            {p.city}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <Label htmlFor="loj-name">Lojman Adı *</Label>
                                <Input
                                    id="loj-name"
                                    placeholder="örn: İzmir Lojmanı"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label htmlFor="loj-city">Şehir *</Label>
                                <Input
                                    id="loj-city"
                                    placeholder="örn: İzmir"
                                    value={form.city}
                                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label htmlFor="loj-capacity">Kapasite (kişi)</Label>
                                <Input
                                    id="loj-capacity"
                                    type="number"
                                    placeholder="örn: 4"
                                    value={form.capacity}
                                    onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label htmlFor="loj-lat">Enlem (Lat) *</Label>
                                <Input
                                    id="loj-lat"
                                    type="number"
                                    step="0.0001"
                                    placeholder="örn: 38.4192"
                                    value={form.lat}
                                    onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
                                    className="mt-1 font-mono text-sm"
                                />
                            </div>

                            <div>
                                <Label htmlFor="loj-lng">Boylam (Lng) *</Label>
                                <Input
                                    id="loj-lng"
                                    type="number"
                                    step="0.0001"
                                    placeholder="örn: 27.1287"
                                    value={form.lng}
                                    onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
                                    className="mt-1 font-mono text-sm"
                                />
                            </div>

                            <div className="col-span-2">
                                <Label htmlFor="loj-address">Adres (opsiyonel)</Label>
                                <Input
                                    id="loj-address"
                                    placeholder="Tam adres"
                                    value={form.address}
                                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>

                            <div className="col-span-2">
                                <Label htmlFor="loj-notes">Notlar (opsiyonel)</Label>
                                <Input
                                    id="loj-notes"
                                    placeholder="örn: Park yeri mevcut, klimalı"
                                    value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        {/* Google Maps helper tip */}
                        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                            💡 <strong>Koordinat nasıl bulunur?</strong> Google Maps'te konuma sağ tıklayıp koordinatları kopyalayabilirsiniz.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {editTarget ? "Güncelle" : "Kaydet"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm */}
            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            Lojmanı Sil
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>{deleteTarget?.name}</strong> lojmanını silmek istediğinize emin misiniz?
                            Bu işlem geri alınamaz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
