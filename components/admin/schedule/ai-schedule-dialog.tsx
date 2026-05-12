"use client";

import { useState, useMemo, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserProfile, Store } from "@/lib/types";
import { format, addWeeks, startOfWeek, addDays, differenceInDays } from "date-fns";
import { tr } from "date-fns/locale";
import { Brain, MapPin, Route, Info, ChevronDown, ChevronUp, Loader2, Hotel, Home, Users } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditRecord {
    storeId: string;
    storeName: string;
    auditorId: string;
    createdAt: Date;
    totalScore?: number;
    score?: number;
}

interface ScheduleItem {
    storeId?: string;
    storeName?: string;
    auditorId: string;
    date: Date;
    status: string;
    type?: string;
}

interface PlannedSlot {
    auditorId: string;
    auditorName: string;
    day: string; // 'Pazartesi' etc.
    date: Date;
    storeId: string;
    storeName: string;
    city: string;
    distanceFromHome: number;
    accommodation?: string;     // lojman adı
    accommodationDist?: number; // lojmana mesafe km
    routeNote?: string;
    isSecondVisit: boolean;
}

interface Lojman {
    id: string;
    name: string;
    city: string;
    lat: number;
    lng: number;
    capacity?: number;
    notes?: string;
}

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    auditors: UserProfile[];
    stores: Store[];
    audits: AuditRecord[];
    schedule: ScheduleItem[];
    currentDate: Date;
}

// ─── City Coordinate Map (Turkey) ─────────────────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
    "İzmir": [38.4192, 27.1287],
    "Ankara": [39.9334, 32.8597],
    "İstanbul": [41.0082, 28.9784],
    "Bursa": [40.1826, 29.0665],
    "Antalya": [36.8841, 30.7056],
    "Adana": [37.0, 35.3213],
    "Konya": [37.8714, 32.4846],
    "Gaziantep": [37.0662, 37.3833],
    "Mersin": [36.8, 34.6333],
    "Kayseri": [38.7312, 35.4787],
    "Eskişehir": [39.7767, 30.5206],
    "Balıkesir": [39.6484, 27.8826],
    "Manisa": [38.6191, 27.4289],
    "Afyonkarahisar": [38.7507, 30.5567],
    "Afyon": [38.7507, 30.5567],
    "Denizli": [37.7765, 29.0864],
    "Sakarya": [40.7569, 30.3781],
    "Kocaeli": [40.7654, 29.9408],
    "Muğla": [37.2153, 28.3636],
    "Aydın": [37.8444, 27.845],
    "Çanakkale": [40.1553, 26.4142],
    "Edirne": [41.6818, 26.5624],
    "Tekirdağ": [40.9781, 27.5115],
    "Bergama": [39.1214, 27.179],
    "Akhisar": [38.9189, 27.8389],
    "Edremit": [39.5959, 27.0242],
    "Konak": [38.4189, 27.1289],
    "Aliağa": [38.8, 26.9731],
    "Soma": [39.1836, 27.6083],
    "Uşak": [38.6823, 29.4082],
    "Bandırma": [40.3508, 27.9778],
    "Çorlu": [41.1592, 27.8017],
    "Gebze": [40.8028, 29.4311],
    "Bolu": [40.7359, 31.6061],
    "Karabük": [41.2, 32.6333],
    "Zonguldak": [41.4564, 31.7987],
};

// ─── Haversine Distance (km) ──────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getStoreCoords(store: Store): [number, number] | null {
    // Try city match
    const cityKey = Object.keys(CITY_COORDS).find(
        k => store.city?.toLowerCase().includes(k.toLowerCase()) ||
             store.name?.toLowerCase().includes(k.toLowerCase()) ||
             store.location?.toLowerCase().includes(k.toLowerCase())
    );
    return cityKey ? CITY_COORDS[cityKey] : null;
}

function getAuditorCoords(auditor: UserProfile): [number, number] | null {
    if (auditor.homeLat && auditor.homeLng) return [auditor.homeLat, auditor.homeLng];
    return null;
}

const DAYS_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const DAY_COLORS = [
    "bg-blue-50 border-blue-200 text-blue-800",
    "bg-violet-50 border-violet-200 text-violet-800",
    "bg-emerald-50 border-emerald-200 text-emerald-800",
    "bg-amber-50 border-amber-200 text-amber-800",
    "bg-rose-50 border-rose-200 text-rose-800",
];

// ─── Onaylı İkili Denetim Çiftleri (§10 ai-schedule-rules.md) ────────────────
// Sadece bu çiftlerdeki mağazalar aynı güne atanabilir.
// Yeni çift eklemek için hem bu listeyi hem de docs/ai-schedule-rules.md §10.2'yi güncelleyin.
const APPROVED_PAIRS: [string, string][] = [
    // İzmir çiftleri
    ["GÜZELBAHÇE", "BALÇOVA"],              // ~20 km
    ["ÖZKANLAR", "FORUM"],                    // ~15 km
    ["BOSTANLI", "ÇİĞlİ"],                    // ~12 km (17. hafta Sabri Kirman)
    // Bodrum bölgesi çiftleri
    ["BODRUM 3", "BODRUM YA"],               // Bodrum3 ↔ Yalakçavak ~15 km
    ["BODRUM 5", "BODRUM GA"],               // Bodrum5 ↔ Galleria ~10 km
    ["BODRUM YA", "BODRUM 3"],               // Terés ters
    ["BODRUM GA", "BODRUM 5"],
    // Didim bölgesi
    ["ALTINKUM", "DİDİM"],                   // Altınkum ↔ Didim ~8 km
    ["DİDİM", "ALTINKUM"],
    // Eskişehir bölgesi
    ["ESKİŞEHİR-1", "ESKİŞEHİR-2"],            // ~5 km
    ["ESKİŞEHİR-2", "ESKİŞEHİR-1"],
    // Balıkesir bölgesi
    ["BALİKESİR-1", "BALıKESİR-2"],          // ~5 km
    ["BALıKESİR-2", "BALıKESİR-1"],
    // Kütahya bölgesi
    ["KÜTAHYA-1", "KÜTAHYA-2"],              // ~5 km
    ["KÜTAHYA-2", "KÜTAHYA-1"],
    // Denizli bölgesi
    ["DENİZLİ-1", "DENİZLİ Mİ"],              // Denizli Migros grubu
    ["DENİZLİ-3", "DENİZLİ Mİ"],
    ["DENİZLİ-1", "DENİZLİ-3"],
    // Bursa bölgesi
    ["BURSA ÖZLÜ", "BURSA YILDI"],            // Bursa çiftleri
    ["BURSA 5", "BURSA GA"],
    // Manisa bölgesi
    ["MANİSA-1", "MANİSA GÜ"],               // Manisa çiftleri
    ["MANİSA GÜ", "MANİSA-1"],
];

/** Verilen mağaza adının onaylı bir çift üyesi olup olmadığını döndürür. */
function findPairPartner(storeName: string): string | null {
    const upper = storeName.toUpperCase();
    for (const [a, b] of APPROVED_PAIRS) {
        if (upper.includes(a.toUpperCase())) return b;
        if (upper.includes(b.toUpperCase())) return a;
    }
    return null;
}

/** Onaylı çift kontrolü: iki mağaza ismi APPROVED_PAIRS'ta eşleşiyor mu? */
function isApprovedPair(nameA: string, nameB: string): boolean {
    const ua = nameA.toUpperCase();
    const ub = nameB.toUpperCase();
    return APPROVED_PAIRS.some(([a, b]) =>
        (ua.includes(a.toUpperCase()) && ub.includes(b.toUpperCase())) ||
        (ua.includes(b.toUpperCase()) && ub.includes(a.toUpperCase()))
    );
}

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ─── Yol Mesafesi Faktörü ──────────────────────────────────────────────────────────────────
// 150 km = yol mesafesi (haversine kuş uçuşu değil).
// Türkiye yol faktörü yaklaşık ×1.3 — haversine × 1.3 = tahmini yol km.
const ROAD_FACTOR = 1.3;
const HOME_DAY_ROAD_LIMIT = 150; // km yol mesafesi — Pazartesi (evden çıkış)
const FRIDAY_ROAD_LIMIT    = 250; // km yol mesafesi — Cuma (eve dönüş, biraz esneklik)
const LOJMAN_ROAD_LIMIT = 80;    // km yol mesafesi

function roadDist(km: number): number {
    return km * ROAD_FACTOR;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AiScheduleDialog({ open, onOpenChange, auditors, stores, audits, schedule, currentDate }: Props) {
    const [generating, setGenerating] = useState(false);
    const [plan, setPlan] = useState<PlannedSlot[] | null>(null);
    const [showLogic, setShowLogic] = useState(false);
    const [logicNotes, setLogicNotes] = useState<string[]>([]);
    const [lojmanlar, setLojmanlar] = useState<Lojman[]>([]);

    // Fetch lojmanlar when dialog opens
    useEffect(() => {
        if (!open) return;
        getDocs(query(collection(db, "lodging_locations"), orderBy("city")))
            .then(snap => setLojmanlar(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lojman))))
            .catch(console.error);
    }, [open]);

    // Find nearest lojman to a coordinate
    const findNearestLojman = (lat: number, lng: number): { lojman: Lojman; dist: number } | null => {
        if (lojmanlar.length === 0) return null;
        let best: { lojman: Lojman; dist: number } | null = null;
        for (const l of lojmanlar) {
            const d = haversine(lat, lng, l.lat, l.lng);
            if (!best || d < best.dist) best = { lojman: l, dist: Math.round(d) };
        }
        return best;
    };

    // Next week Mon–Fri
    const nextWeekMonday = startOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 1 });
    const planDays = DAYS_TR.map((name, i) => ({ name, date: addDays(nextWeekMonday, i) }));

    // ── Core Algorithm — Ev Merkezli Halka (docs/ai-schedule-rules.md) ────────
    const generatePlan = () => {
        setGenerating(true);
        setPlan(null);
        setLogicNotes([]);

        setTimeout(() => {
            const notes: string[] = [];
            const result: PlannedSlot[] = [];

            const monthStart = new Date(nextWeekMonday.getFullYear(), nextWeekMonday.getMonth(), 1);
            const monthEnd = new Date(nextWeekMonday.getFullYear(), nextWeekMonday.getMonth() + 1, 0);

            // 1. Determine eligible stores (12-day rule from next Monday)
            const eligibleStores = stores.filter(store => {
                const lastAudit = audits
                    .filter(a => a.storeId === store.id)
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
                const lastSched = schedule
                    .filter(s => s.storeId === store.id && s.type !== 'leave')
                    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

                const lastDate = [lastAudit?.createdAt, lastSched?.date]
                    .filter(Boolean)
                    .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] as Date | undefined;

                if (lastDate && differenceInDays(nextWeekMonday, lastDate) < 12) return false;

                // Monthly limit check
                const monthlyCount = [
                    ...audits.filter(a => a.storeId === store.id && a.createdAt >= monthStart && a.createdAt <= monthEnd),
                    ...schedule.filter(s => s.storeId === store.id && s.date >= monthStart && s.date <= monthEnd && s.status !== 'published' && s.type === 'audit'),
                ].length;
                return monthlyCount < 2;
            });

            notes.push(`📦 ${eligibleStores.length} mağaza denetim kriterlerini karşılıyor (12 gün kuralı + aylık limit).`);

            // 2. Per-Auditor Home-Centric Assignment (§2 ai-schedule-rules.md)
            // ─────────────────────────────────────────────────────────────────
            // Her denetmen için BAĞIMSIZ: evine en yakın mağaza listesi oluşturulur.
            // Birinci denetimler → yakından uzağa.  İkinci denetimler → yakından uzağa.
            // Böylece her denetmen önce evine yakın mağazaları işler.

            type StoreEntry = {
                store: Store;
                dist: number;              // haversine km
                rdist: number;             // yol km (×1.3)
                isFirstVisit: boolean;
                storeCoords: [number, number];
            };

            const HOME_DAYS = new Set(["Pazartesi", "Cuma"]);
            const auditorDayCount: Record<string, Record<string, number>> = {};
            const auditorDayLoc:   Record<string, Record<string, [number, number]>> = {};
            const assignedStores = new Set<string>();

            // ── Mağaza türü kontrolü ─────────────────────────────────────────
            // Migros içeren isimler Migros mağazası; diğerleri şube.
            // Şubeler için günde kesinlikle 1 atama yapılır (çift yasak).
            // Sadece APPROVED_PAIRS listesindeki Migros çiftleri aynı güne atanabilir.
            const isBranchStore = (store: Store): boolean => {
                const name = (store.name || '').toUpperCase();
                return !name.includes('MİGROS') && !name.includes('MIGROS');
            };

            // ── Tek mağaza ataması ────────────────────────────────────────────
            // pass: 'first' → sadece birinci denetimler | 'second' → sadece ikinci denetimler
            const tryAssign = (
                auditor: (typeof auditors)[0],
                entry: StoreEntry,
                pass: 'first' | 'second'
            ): boolean => {
                const { store, dist, rdist, isFirstVisit, storeCoords } = entry;
                if (pass === 'first' && !isFirstVisit) return false;
                if (pass === 'second' && isFirstVisit) return false;
                if (assignedStores.has(store.id)) return false;

                const ac = getAuditorCoords(auditor);
                const audName = `${auditor.firstName || ''} ${auditor.lastName || ''}`.trim();

                // Gün sıralama: yakın → tüm günler; uzak → Sal-Per önce
                const orderedDays = rdist <= HOME_DAY_ROAD_LIMIT
                    ? [...planDays]
                    : [...planDays].sort((a, b) =>
                        (HOME_DAYS.has(a.name) ? 1 : 0) - (HOME_DAYS.has(b.name) ? 1 : 0));

                for (const dayObj of orderedDays) {
                    const dayKey = dayObj.name;

                    // §4.2: Pzt ≤150km, Cum ≤250km — ev günü mesafe sınırı
                    const dayRoadLimit = dayKey === 'Cuma' ? FRIDAY_ROAD_LIMIT : HOME_DAY_ROAD_LIMIT;
                    if (HOME_DAYS.has(dayKey) && rdist > dayRoadLimit) continue;

                    if (!auditorDayCount[auditor.uid]) auditorDayCount[auditor.uid] = {};
                    if (!auditorDayLoc[auditor.uid])   auditorDayLoc[auditor.uid] = {};

                    const currentCount = auditorDayCount[auditor.uid][dayKey] || 0;

                    if (currentCount === 0) {
                        // Boş gün: ata
                    } else if (currentCount === 1) {
                        // Bu gün dolu — yalnızca onaylı Migros çifti ise 2. slot açılabilir
                        // KURAL: Şube ise kesinlikle aynı güne 2. atama yapılamaz
                        if (isBranchStore(store)) continue;

                        // Zaten günde bir şube varsa Migros da eklenemez
                        const hasBranchToday = result.some(r =>
                            r.auditorId === auditor.uid &&
                            r.day === dayKey &&
                            isBranchStore(stores.find(s => s.id === r.storeId) || {} as Store)
                        );
                        if (hasBranchToday) continue;

                        // Onaylı çift kontrolü
                        if (!findPairPartner(store.name)) continue;
                        const firstOfDay = result.find(r => r.auditorId === auditor.uid && r.day === dayKey);
                        if (!firstOfDay || !isApprovedPair(store.name, firstOfDay.storeName)) continue;

                        // Çiftler arası ≤65 km yol mesafesi
                        if (auditorDayLoc[auditor.uid][dayKey]) {
                            const leg = haversine(
                                auditorDayLoc[auditor.uid][dayKey][0],
                                auditorDayLoc[auditor.uid][dayKey][1],
                                storeCoords[0], storeCoords[1]
                            );
                            if (roadDist(leg) > 65) continue;
                        }
                    } else {
                        continue; // 2+ dolu: ekleme
                    }

                    // ── Ardışık Gün Geçiş Mesafesi Kontrolü ──────────────────
                    // Önceki günün konumu çok uzaksa bu güne atama YAPMA.
                    // Örnek: Salı Denizli → Çarşamba Bodrum = ~250 km yol → mantıksız.
                    // Kural: önceki günün son konumundan bu güne >200 km yol ise atla.
                    const MAX_CONSECUTIVE_ROAD = 200; // km yol
                    const dayIndex = planDays.findIndex(d => d.name === dayKey);
                    if (dayIndex > 0) {
                        const prevDayName = planDays[dayIndex - 1].name;
                        const prevLoc = auditorDayLoc[auditor.uid]?.[prevDayName];
                        if (prevLoc) {
                            const legKm = haversine(prevLoc[0], prevLoc[1], storeCoords[0], storeCoords[1]);
                            if (roadDist(legKm) > MAX_CONSECUTIVE_ROAD) continue; // çok uzak — bu günü atla
                        }
                    }
                    // ────────────────────────────────────────────────────────────
                    auditorDayCount[auditor.uid][dayKey] = currentCount + 1;
                    auditorDayLoc[auditor.uid][dayKey] = storeCoords;
                    assignedStores.add(store.id);

                    const city = store.city || store.location || "—";
                    const distFromHome = ac ? haversine(ac[0], ac[1], storeCoords[0], storeCoords[1]) : dist;
                    const roadFromHome = roadDist(distFromHome);

                    let accommodation: string | undefined;
                    let accommodationDist: number | undefined;
                    let routeNote: string | undefined;

                    if (dayKey === 'Cuma') {
                        // §4.2: Cuma akşamı eve dönüş zorunlu — lojman asla önerilmez.
                        routeNote = `🏠 Eve dönüş (~${Math.round(roadFromHome)} km yol)`;
                    } else if (roadFromHome <= LOJMAN_ROAD_LIMIT) {
                        // §5.1: Mağaza eve ≤80 km yol → denetmen akşam evine döner, lojman gerekmez.
                        routeNote = `🏠 Eve dönüş (~${Math.round(roadFromHome)} km yol)`;
                    } else {
                        // §5.1: Mağaza evden >80 km → lojman önerilir.
                        const nearest = findNearestLojman(storeCoords[0], storeCoords[1]);
                        if (nearest) {
                            accommodation = nearest.lojman.name;
                            accommodationDist = nearest.dist;
                            routeNote = `${nearest.lojman.name} konaklaması önerilir`;
                        } else {
                            accommodation = `${city} Konaklama`;
                            routeNote = `Lojman tanımlı değil — Lojmanlar sayfasından ekleyiniz`;
                        }
                    }

                    const rdistDisplay = Math.round(rdist);
                    if (rdistDisplay > HOME_DAY_ROAD_LIMIT)
                        notes.push(`⚠️ ${audName} → ${store.name} (yol ~${rdistDisplay} km) 150 km sınırını aşıyor.`);

                    // ── Sevkiyat Günü Kontrolü — HARD BLOCK ─────────────────────
                    // getViolation() ile birebir aynı mantık.
                    // Kural: sevkiyat olan/ertesi gün mağaza yoğundur → ATAMA YAPMA.
                    //   • Gündüz sevkiyatı  (<18:00): aynı gün denetim yasak
                    //   • Gece sevkiyatı   (≥18:00): ertesi gün denetim yasak
                    if (store.shipmentDay && store.shipmentTime) {
                        const normDay = (s: string) =>
                            s.toLocaleLowerCase('tr').trim()
                              .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
                              .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
                        const scheduledTR = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'][dayObj.date.getDay()];
                        const prevTR      = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'][new Date(dayObj.date.getTime() - 86400000).getDay()];
                        const shipHour    = parseInt(store.shipmentTime.split(':')[0]);
                        const normShipDay = normDay(store.shipmentDay);
                        const blocked =
                            (shipHour < 18  && normDay(scheduledTR) === normShipDay) ||  // gündüz → aynı gün yasak
                            (shipHour >= 18 && normDay(prevTR)      === normShipDay);     // gece   → ertesi gün yasak
                        if (blocked) return false; // Bu mağaza bu güne atanamaz
                    }
                    // ────────────────────────────────────────────────────────────

                    result.push({
                        auditorId: auditor.uid, auditorName: audName,
                        day: dayKey, date: dayObj.date,
                        storeId: store.id, storeName: store.name, city,
                        distanceFromHome: Math.round(dist),
                        accommodation, accommodationDist, routeNote,
                        isSecondVisit: !isFirstVisit,
                    });
                    return true;
                }
                return false;
            };

            // ── GEÇİŞ 1: Tüm denetmenler için SADECE birinci denetimler ─────
            // Global öncelik: ay içindeki tüm birinci denetimler önce planlanır.
            for (const auditor of shuffle([...auditors])) {
                const ac = getAuditorCoords(auditor);
                if (!auditorDayCount[auditor.uid]) auditorDayCount[auditor.uid] = {};
                if (!auditorDayLoc[auditor.uid])   auditorDayLoc[auditor.uid] = {};

                const storeList: StoreEntry[] = [];
                for (const store of eligibleStores) {
                    const sc = getStoreCoords(store);
                    if (!sc) continue;
                    const dist = ac ? haversine(ac[0], ac[1], sc[0], sc[1]) : 9999;
                    const isFirstVisit = !audits.some(
                        a => a.storeId === store.id && a.createdAt >= monthStart && a.createdAt <= monthEnd
                    );
                    if (!isFirstVisit) continue; // Bu geçişte yalnızca birinci denetimler
                    storeList.push({ store, dist, rdist: roadDist(dist), isFirstVisit, storeCoords: sc });
                }
                const jitter = () => (Math.random() - 0.5) * 15;
                storeList.sort((a, b) => (a.dist + jitter()) - (b.dist + jitter()));

                for (const entry of storeList) {
                    tryAssign(auditor, entry, 'first');
                }
            }

            // ── GEÇİŞ 2: Her denetmenin TÜM günlerini doldur (5/5 zorunlu) ──
            // Pzt ≤150km | Cum ≤250km | Sal-Per sınırsız
            // Kademeli fallback: (1) ikinci denetim + kısıt tam
            //                   (2) herhangi atanmamış mağaza + kısıt tam
            //                   (3) son çare: ev günü km sınırı kaldırılır
            const getDayLimit = (dk: string) =>
                dk === 'Cuma' ? FRIDAY_ROAD_LIMIT
                : dk === 'Pazartesi' ? HOME_DAY_ROAD_LIMIT
                : Infinity;

            for (const auditor of shuffle([...auditors])) {
                const ac = getAuditorCoords(auditor);
                if (!auditorDayCount[auditor.uid]) auditorDayCount[auditor.uid] = {};
                if (!auditorDayLoc[auditor.uid])   auditorDayLoc[auditor.uid] = {};

                // Bu denetmen için tüm eligible mağaza listesini hazırla (ikinci + birinci)
                const buildList = () => {
                    const list: StoreEntry[] = [];
                    for (const store of eligibleStores) {
                        const sc = getStoreCoords(store);
                        if (!sc) continue;
                        const dist = ac ? haversine(ac[0], ac[1], sc[0], sc[1]) : 9999;
                        const isFirstVisit = !audits.some(
                            a => a.storeId === store.id && a.createdAt >= monthStart && a.createdAt <= monthEnd
                        );
                        list.push({ store, dist, rdist: roadDist(dist), isFirstVisit, storeCoords: sc });
                    }
                    const j = () => (Math.random() - 0.5) * 15;
                    list.sort((a, b) => (a.dist + j()) - (b.dist + j()));
                    return list;
                };
                const allList = buildList();
                const secondList = allList.filter(e => !e.isFirstVisit);

                // Her boş gün için 3 kademeli deneme
                for (const dayObj of planDays) {
                    const dayKey = dayObj.name;
                    if ((auditorDayCount[auditor.uid][dayKey] || 0) > 0) continue; // Zaten dolu
                    const dayLimit = getDayLimit(dayKey);

                    // Kademe 1: İkinci denetim mağazası, tam kısıtlar
                    let filled = false;
                    for (const entry of secondList) {
                        if (assignedStores.has(entry.store.id)) continue;
                        if (entry.rdist > dayLimit) continue;
                        if (tryAssign(auditor, entry, 'second')) { filled = true; break; }
                    }
                    if (filled) continue;

                    // Kademe 2: Herhangi atanmamış eligible mağaza (birinci dahil), tam kısıtlar
                    for (const entry of allList) {
                        if (assignedStores.has(entry.store.id)) continue;
                        if (entry.rdist > dayLimit) continue;
                        const pass = entry.isFirstVisit ? 'first' : 'second';
                        if (tryAssign(auditor, entry, pass)) { filled = true; break; }
                    }
                    if (filled) continue;

                    // Kademe 3: Son çare — ev günü km sınırı kaldırılır
                    // (Gün boş kalmaktansa uzak mağaza atar, uyarı notu eklenir)
                    for (const entry of allList) {
                        if (assignedStores.has(entry.store.id)) continue;
                        const pass = entry.isFirstVisit ? 'first' : 'second';
                        if (tryAssign(auditor, entry, pass)) {
                            const audName = `${auditor.firstName || ''} ${auditor.lastName || ''}`.trim();
                            const limitStr = dayKey === 'Cuma' ? '250km' : '150km';
                            notes.push(`⚠️ ${audName} — ${dayKey} günü ${limitStr} sınırı esnetildi (yakın mağaza kalmadı).`);
                            break;
                        }
                    }
                }

                // Dolu günlere onaylı Migros çifti ekle (opsiyonel)
                for (const entry of allList.filter(e => !e.isFirstVisit)) {
                    tryAssign(auditor, entry, 'second');
                }
            }

            // §6.1: Ortak lojman tespiti — aynı gece aynı lojmanda birden fazla denetmen
            const lojmanNightMap: Record<string, string[]> = {};
            for (const slot of result) {
                if (!slot.accommodation) continue;
                const key = `${slot.accommodation}__${slot.day}`;
                if (!lojmanNightMap[key]) lojmanNightMap[key] = [];
                lojmanNightMap[key].push(slot.auditorName);
            }
            for (const slot of result) {
                if (!slot.accommodation) continue;
                const coStayers = lojmanNightMap[`${slot.accommodation}__${slot.day}`] || [];
                if (coStayers.length > 1) {
                    const others = coStayers.filter(n => n !== slot.auditorName).join(", ");
                    slot.routeNote = (slot.routeNote ? slot.routeNote + " · " : "") + `🤝 Ortak: ${others}`;
                }
            }
            const sharedNights = Object.values(lojmanNightMap).filter(v => v.length > 1).length;

            const firstVisitCount = result.filter(r => !r.isSecondVisit).length;
            const secondVisitCount = result.filter(r => r.isSecondVisit).length;
            notes.push(`✅ ${result.length} denetim: ${firstVisitCount} birinci, ${secondVisitCount} ikinci ziyaret.`);
            notes.push(`🏠 Pzt & Cum: eve ≤150 km yol mesafesi (hav. ×1.3 faktör). Sal–Per: uzak bölge önceliği (§4).`);
            notes.push(`🔄 Günde 1 denetim (§3). İkili: Bodrum bölgesi, Didim/Altınkum, Güzelbahçe/Balçova, Özkanlar/Forum vb. onaylı çiftlerde mümkün.`);
            notes.push(`🎲 Her oluşturmada farklı varyasyon — eşit öncelikli mağazalar rastgele sıralanıyor.`);
            notes.push(lojmanlar.length > 0
                ? `🏨 ${lojmanlar.length} lojman — 80km+ için haversine ile en yakın konaklama seçildi.`
                : `🏨 Kayıtlı lojman yok — Lojmanlar sayfasından ekleyiniz.`);
            if (sharedNights > 0) notes.push(`🤝 ${sharedNights} gece/lojman çiftinde ortak konaklama var — araç paylaşımı fırsatı!`);

            setPlan(result);
            setLogicNotes(notes);
            setGenerating(false);
        }, 1200);
    };

    // ── Group plan by auditor ───────────────────────────────────────────────
    const grouped = useMemo(() => {
        if (!plan) return {};
        return plan.reduce((acc, slot) => {
            if (!acc[slot.auditorId]) acc[slot.auditorId] = { name: slot.auditorName, slots: [] };
            acc[slot.auditorId].slots.push(slot);
            return acc;
        }, {} as Record<string, { name: string; slots: PlannedSlot[] }>);
    }, [plan]);

    const auditorIds = Object.keys(grouped);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[95vh] overflow-hidden flex flex-col p-0" style={{ width: '95vw', maxWidth: '95vw' }}>
                {/* Header */}
                <DialogHeader className="px-6 pt-5 pb-4 border-b bg-gradient-to-r from-indigo-950 to-slate-900 rounded-t-lg shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30">
                            <Brain className="h-5 w-5 text-indigo-300" />
                        </div>
                        <div>
                            <DialogTitle className="text-white text-lg font-bold">Rota Bazlı Haftalık Program</DialogTitle>
                            <p className="text-indigo-300/80 text-xs mt-0.5">
                                {format(addWeeks(currentDate, 1), "'Hafta' w — ", { locale: tr })}
                                {format(startOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 1 }), "d MMM", { locale: tr })}
                                {" – "}
                                {format(addDays(startOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 1 }), 4), "d MMM yyyy", { locale: tr })}
                            </p>
                        </div>
                        <div className="ml-auto">
                            <Button
                                onClick={generatePlan}
                                disabled={generating}
                                className="bg-indigo-500 hover:bg-indigo-400 text-white border-0 shadow-lg shadow-indigo-500/30 gap-2"
                                size="sm"
                            >
                                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
                                {generating ? "Hesaplanıyor..." : plan ? "Yeniden Oluştur" : "Program Oluştur"}
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto">
                    {/* Empty state */}
                    {!plan && !generating && (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                            <div className="p-6 rounded-2xl bg-indigo-50 border border-indigo-100">
                                <Brain className="h-12 w-12 text-indigo-300" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-slate-600">Rota Bazlı Program</p>
                                <p className="text-sm mt-1 max-w-xs text-slate-400">
                                    Son 5 ayın verilerini ve denetmenlerin ev konumlarını analiz ederek en verimli haftalık programı oluşturur.
                                </p>
                            </div>
                            <Button onClick={generatePlan} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 mt-2">
                                <Brain className="h-4 w-4" />
                                Program Oluştur
                            </Button>
                        </div>
                    )}

                    {/* Loading */}
                    {generating && (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
                            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                            <p className="text-sm font-medium">Rota hesaplanıyor...</p>
                            <p className="text-xs text-slate-400">Denetmen konumları ve mağaza mesafeleri analiz ediliyor</p>
                        </div>
                    )}

                    {/* Plan Table — Calendar Grid */}
                    {plan && !generating && (
                        <div className="p-5 space-y-5">
                            {auditorIds.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <p className="font-medium">Uygun mağaza bulunamadı.</p>
                                    <p className="text-sm mt-1">Tüm mağazalar bu hafta için denetim kriterlerini karşılamıyor.</p>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-separate border-spacing-0 text-sm">
                                            <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th className="w-[160px] min-w-[160px] p-4 text-left text-xs font-bold text-slate-700 uppercase tracking-tight bg-slate-50 border-b border-r border-slate-200 sticky left-0 z-20">
                                                        Denetmen
                                                    </th>
                                                    {planDays.map((dayObj, i) => {
                                                        const isHomeDay = dayObj.name === "Pazartesi" || dayObj.name === "Cuma";
                                                        return (
                                                            <th key={i} className={cn(
                                                                "min-w-[160px] p-0 border-b border-r border-slate-200 last:border-r-0",
                                                                isHomeDay ? "bg-emerald-50" : "bg-slate-50"
                                                            )}>
                                                                <div className="flex flex-col items-center justify-center py-3">
                                                                    <span className={cn(
                                                                        "text-[10px] font-bold uppercase tracking-widest",
                                                                        isHomeDay ? "text-emerald-600" : "text-slate-400"
                                                                    )}>
                                                                        {dayObj.name}
                                                                    </span>
                                                                    <span className="text-2xl font-bold text-slate-700 mt-0.5 leading-none">
                                                                        {format(dayObj.date, "d")}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 mt-0.5">
                                                                        {format(dayObj.date, "MMM", { locale: tr })}
                                                                    </span>
                                                                    {dayObj.name === 'Pazartesi' && (
                                                                        <span className="text-[9px] text-emerald-500 font-semibold mt-0.5">≤150km</span>
                                                                    )}
                                                                    {dayObj.name === 'Cuma' && (
                                                                        <span className="text-[9px] text-emerald-500 font-semibold mt-0.5">≤250km</span>
                                                                    )}
                                                                </div>
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {auditorIds.map(audId => {
                                                    const { name, slots } = grouped[audId];
                                                    const aud = auditors.find(a => a.uid === audId);
                                                    const hasCoords = !!aud && !!getAuditorCoords(aud);
                                                    const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                                                    return (
                                                        <tr key={audId} className="group hover:bg-slate-50/30 align-top">
                                                            {/* Sticky auditor cell */}
                                                            <td className="p-3 border-r border-slate-100 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700">
                                                                        {initials}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="font-semibold text-slate-800 text-xs leading-tight truncate">{name}</p>
                                                                        <p className={cn("text-[10px] mt-0.5 flex items-center gap-0.5", hasCoords ? "text-emerald-500" : "text-orange-400")}>
                                                                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                                                                            {hasCoords ? "Konum tanımlı" : "Konum yok"}
                                                                        </p>
                                                                        <p className="text-[10px] text-slate-400">{slots.length} denetim</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            {/* Day cells */}
                                                            {planDays.map((dayObj, i) => {
                                                                const daySlots = slots.filter(s => s.day === dayObj.name);
                                                                const isHomeDay = dayObj.name === "Pazartesi" || dayObj.name === "Cuma";
                                                                return (
                                                                    <td key={i} className={cn(
                                                                        "p-2 border-r border-slate-100 last:border-r-0 align-top",
                                                                        isHomeDay ? "bg-emerald-50/20" : "bg-white"
                                                                    )}>
                                                                        {daySlots.length === 0 ? (
                                                                            <div className="h-14 flex items-center justify-center">
                                                                                <span className="text-[10px] text-slate-200">—</span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="space-y-1.5">
                                                                                {daySlots.map((slot, si) => (
                                                                                    <div key={si} className={cn(
                                                                                        "rounded-lg p-2 border text-[11px] leading-snug",
                                                                                        slot.isSecondVisit ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200"
                                                                                    )}>
                                                                                        <p className={cn("font-semibold truncate", slot.isSecondVisit ? "text-purple-800" : "text-blue-800")}>
                                                                                            {slot.storeName}
                                                                                        </p>
                                                                                        <p className="text-slate-500 mt-0.5 flex items-center gap-1">
                                                                                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                                                                                            <span className="truncate">{slot.city}</span>
                                                                                            <span className={cn("ml-auto font-semibold shrink-0",
                                                                                                slot.distanceFromHome > 150 ? "text-red-500" :
                                                                                                slot.distanceFromHome > 80 ? "text-amber-500" : "text-emerald-600"
                                                                                            )}>
                                                                                                {slot.distanceFromHome === 9999 ? "?" : `~${slot.distanceFromHome}km`}
                                                                                            </span>
                                                                                        </p>
                                                                                        <span className={cn("inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold",
                                                                                            slot.isSecondVisit ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                                                                                        )}>
                                                                                            {slot.isSecondVisit ? "2. Denetim" : "1. Denetim"}
                                                                                        </span>
                                                                                        {/* Konaklama satırı — her durumda tutarlı */}
                                                                                        {slot.routeNote && (
                                                                                            <div className={cn(
                                                                                                "mt-1.5 pt-1.5 border-t flex items-start gap-1",
                                                                                                slot.routeNote.includes("🏠")
                                                                                                    ? "border-emerald-200/60"
                                                                                                    : "border-amber-200/60"
                                                                                            )}>
                                                                                                {slot.routeNote.includes("🏠") ? (
                                                                                                    <Home className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                                                                                                ) : slot.routeNote.includes("🤝") ? (
                                                                                                    <Users className="h-3 w-3 text-indigo-500 shrink-0 mt-0.5" />
                                                                                                ) : (
                                                                                                    <Hotel className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                                                                                                )}
                                                                                                <span className={cn(
                                                                                                    "text-[10px] leading-tight",
                                                                                                    slot.routeNote.includes("🏠") ? "text-emerald-700" :
                                                                                                    slot.routeNote.includes("🤝") ? "text-indigo-600 font-semibold" :
                                                                                                    "text-amber-700"
                                                                                                )}>
                                                                                                    {slot.routeNote.includes("🤝")
                                                                                                        ? slot.routeNote.split("·").pop()?.trim()
                                                                                                        : slot.routeNote}
                                                                                                    {slot.accommodationDist && !slot.routeNote.includes("🏠") && (
                                                                                                        <span className="text-amber-400"> ({slot.accommodationDist}km)</span>
                                                                                                    )}
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Legend */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500 px-1">
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200 inline-block" /> 1. Denetim</span>
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-100 border border-purple-200 inline-block" /> 2. Denetim</span>
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200 inline-block" /> Eve yakın gün (Pzt ≤150km · Cum ≤250km)</span>
                                <span className="flex items-center gap-1.5"><Hotel className="h-3 w-3 text-amber-500" /> Konaklama önerisi</span>
                                <span className="text-emerald-600 font-medium">● ≤80km</span>
                                <span className="text-amber-500 font-medium">● 80–150km</span>
                                <span className="text-red-500 font-medium">● &gt;150km</span>
                            </div>

                            {/* Logic Notes */}
                            {logicNotes.length > 0 && (
                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                    <button
                                        onClick={() => setShowLogic(v => !v)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-semibold text-slate-700"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Info className="h-4 w-4 text-indigo-500" />
                                            Program Nasıl Oluşturuldu?
                                        </span>
                                        {showLogic ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                    </button>
                                    {showLogic && (
                                        <div className="px-4 py-3 space-y-2 bg-white">
                                            {logicNotes.map((note, i) => (
                                                <p key={i} className="text-sm text-slate-600 leading-relaxed">{note}</p>
                                            ))}
                                            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400 space-y-1">
                                                <p><strong>Algoritma:</strong> Haversine formülü · Ev merkezli halka stratejisi</p>
                                                <p><strong>Öncelik:</strong> 1. Birinci denetimler → 2. Eve mesafe → 3. Pzt/Cum ≤150km → 4. Günlük rota ≤200km</p>
                                                <p><strong>Kural:</strong> 12 gün aralık + aylık maks. 2 ziyaret · Günde maks. 2 mağaza/denetmen</p>
                                                <p><strong>Kural dosyası:</strong> docs/ai-schedule-rules.md</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
