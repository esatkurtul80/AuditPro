"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  GoogleMap,
  MarkerF,
  InfoWindowF,
  PolylineF,
  DirectionsRenderer,
} from "@react-google-maps/api";
import { useGoogleMapsLoader } from "@/lib/use-google-maps";
import { X, Map as MapIcon, Navigation, Store, Home, Route, AlertCircle, Sun, Moon, Calendar } from "lucide-react";
import { Store as StoreType, UserProfile } from "@/lib/types";
import { startOfWeek, endOfWeek, isWithinInterval, differenceInDays, isSameDay } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduleItem {
  id: string;
  auditorId: string;
  storeId?: string;
  storeName: string;
  date: Date;
  status: "draft" | "published";
  type?: "audit" | "leave" | "blocked";
  accommodationTypeId?: string | null;
}

interface StoreWithCoords extends StoreType {
  lat: number;
  lng: number;
  daysSinceAudit: number | null;
  lastAuditDate: Date | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  stores: StoreType[];
  auditors: UserProfile[];
  schedule: ScheduleItem[];
  audits: any[];
  currentDate: Date;
  accommodationTypes: { id: string; icon: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseLocation(location?: string): { lat: number; lng: number } | null {
  if (!location) return null;
  const parts = location.split(",");
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

/** Haversine distance in km between two coords */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(sin2));
}

/** Road-estimate = bird's-eye * 1.35 */
function estimateRouteKm(stops: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    total += haversineKm(stops[i], stops[i + 1]);
  }
  return Math.round(total * 1.35 * 10) / 10;
}

function getDaysBadgeColor(days: number | null): string {
  if (days === null) return "#6366f1"; // Never audited — blue-purple
  if (days > 60) return "#ef4444"; // Red
  if (days > 30) return "#f97316"; // Orange
  return "#22c55e"; // Green
}

function createNumberedPin(num: number, color = "#3b82f6"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
    <path d="M18 0C8.059 0 0 8.059 0 18c0 13.5 18 28 18 28S36 31.5 36 18C36 8.059 27.941 0 18 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="18" cy="18" r="10" fill="white"/>
    <text x="18" y="23" text-anchor="middle" font-size="11" font-weight="bold" fill="${color}" font-family="sans-serif">${num}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createDotPin(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26S32 28 32 16C32 7.163 24.837 0 16 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="16" cy="16" r="6" fill="white"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createHomePin(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
    <path d="M18 0C8.059 0 0 8.059 0 18c0 13.5 18 28 18 28S36 31.5 36 18C36 8.059 27.941 0 18 0z" fill="#1e40af" stroke="white" stroke-width="2"/>
    <circle cx="18" cy="18" r="10" fill="white"/>
    <text x="18" y="23" text-anchor="middle" font-size="14" fill="#1e40af" font-family="sans-serif">🏠</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const mapContainerStyle = { width: "100%", height: "100%" };
const turkeyCenter = { lat: 39.0, lng: 35.0 };

const DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#1a1f2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1f2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a97b0" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d3548" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212835" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca4b8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3d4a6b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3b4a6b" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1f2535" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6b7a9b" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3651" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a3147" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9eaecf" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#c8d0e8" }] },
];

// ---------------------------------------------------------------------------
// Tab: Pending Stores
// ---------------------------------------------------------------------------

function PendingStoresTab({
  stores,
  audits,
  schedule,
  currentDate,
  mapStyles,
  isDark,
}: {
  stores: StoreType[];
  audits: any[];
  schedule: ScheduleItem[];
  currentDate: Date;
  mapStyles: google.maps.MapTypeStyle[];
  isDark: boolean;
}) {
  const [selectedPin, setSelectedPin] = useState<StoreWithCoords | null>(null);
  const [filterCity, setFilterCity] = useState<string>("all");
  const mapRef = useRef<google.maps.Map | null>(null);

  // Current month boundaries
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

  // Stores audited (completed) this month OR within 12 days
  const auditedThisMonthIds = new Set(
    audits
      .filter((a) => {
        const d: Date = a.completedAt?.toDate?.() || (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt));
        if (a.status !== "tamamlandi") return false;
        const isThisMonth = d >= monthStart && d <= monthEnd;
        const diffDays = Math.abs(differenceInDays(d, currentDate));
        return isThisMonth || diffDays <= 12;
      })
      .map((a) => a.storeId as string)
  );

  // Stores scheduled (any status — incl. draft) this month OR within 12 days
  const scheduledThisMonthIds = new Set(
    schedule
      .filter((item) => {
        if (item.type === "leave" || item.type === "blocked" || !item.storeId) return false;
        const isThisMonth = item.date >= monthStart && item.date <= monthEnd;
        const diffDays = Math.abs(differenceInDays(item.date, currentDate));
        return isThisMonth || diffDays <= 12;
      })
      .map((item) => item.storeId!)
  );

  // Build stores with coords — exclude audited or scheduled this month
  const storesWithCoords = stores
    .filter((store) => !auditedThisMonthIds.has(store.id) && !scheduledThisMonthIds.has(store.id))
    .map((store) => {
      const coords = parseLocation(store.location);
      if (!coords) return null;

      const storeAudits = audits.filter(
        (a) => a.storeId === store.id && a.status === "tamamlandi"
      );
      storeAudits.sort((a, b) => {
        const da = a.completedAt?.toDate?.() || a.createdAt;
        const db_ = b.completedAt?.toDate?.() || b.createdAt;
        return (db_ as Date).getTime() - (da as Date).getTime();
      });

      const lastAudit = storeAudits[0];
      const lastAuditDate = lastAudit
        ? lastAudit.completedAt?.toDate?.() || new Date(lastAudit.createdAt)
        : null;
      const daysSinceAudit = lastAuditDate
        ? differenceInDays(new Date(), lastAuditDate)
        : null;

      return { ...store, ...coords, daysSinceAudit, lastAuditDate } as StoreWithCoords;
    })
    .filter(Boolean) as StoreWithCoords[];

  const cities = Array.from(new Set(storesWithCoords.map((s) => s.city || ""))).filter(Boolean).sort();

  const filteredStores = filterCity === "all"
    ? storesWithCoords
    : storesWithCoords.filter((s) => s.city === filterCity);

  const sortedForSidebar = [...filteredStores].sort((a, b) => {
    if (a.daysSinceAudit === null && b.daysSinceAudit === null) return 0;
    if (a.daysSinceAudit === null) return -1;
    if (b.daysSinceAudit === null) return 1;
    return b.daysSinceAudit - a.daysSinceAudit;
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const sb = isDark
    ? "bg-[#0f172a] border-white/10"
    : "bg-white border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-slate-400" : "text-gray-500";
  const textMuted = isDark ? "text-slate-500" : "text-gray-400";
  const inputCls = isDark
    ? "bg-slate-700 border-white/10 text-white"
    : "bg-gray-100 border-gray-300 text-gray-900";
  const rowHover = isDark ? "hover:bg-white/5 border-white/5" : "hover:bg-gray-50 border-gray-100";
  const rowSelected = isDark ? "bg-blue-500/10 border-l-blue-400" : "bg-blue-50 border-l-blue-500";

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className={`w-72 flex-shrink-0 border-r flex flex-col ${sb}`}>
        {/* Filter */}
        <div className={`p-3 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}>
          <label className={`text-xs mb-1 block font-medium ${textSecondary}`}>İl Filtresi</label>
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputCls}`}
          >
            <option value="all">Tüm İller</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div className={`px-3 py-2 border-b flex flex-wrap gap-2 ${isDark ? "border-white/10" : "border-gray-200"}`}>
          {[
            { color: "#ef4444", label: ">60 gün" },
            { color: "#f97316", label: "30-60 gün" },
            { color: "#22c55e", label: "<30 gün" },
            { color: "#6366f1", label: "Hiç denetlenmedi" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
              <span className={`text-[10px] ${textSecondary}`}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Store List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {sortedForSidebar.map((store) => (
            <div
              key={store.id}
              onClick={() => {
                setSelectedPin(store);
                mapRef.current?.panTo({ lat: store.lat, lng: store.lng });
                mapRef.current?.setZoom(14);
              }}
              className={`px-3 py-2.5 border-b cursor-pointer transition-colors ${
                selectedPin?.id === store.id ? `border-l-2 ${rowSelected}` : rowHover
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`text-xs font-medium truncate ${textPrimary}`}>{store.name}</p>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: getDaysBadgeColor(store.daysSinceAudit) }}
                />
              </div>
              <p className={`text-[10px] mt-0.5 ${textMuted}`}>
                {store.city || "—"}
                {store.daysSinceAudit !== null
                  ? ` · ${store.daysSinceAudit} gün önce`
                  : " · Hiç denetlenmedi"}
              </p>
            </div>
          ))}
        </div>
        <div className={`px-3 py-2 border-t ${isDark ? "border-white/10" : "border-gray-200"}`}>
          <p className={`text-[11px] ${textMuted}`}>{filteredStores.length} mağaza gösteriliyor</p>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={turkeyCenter}
          zoom={6}
          onLoad={onMapLoad}
          options={{ styles: mapStyles, disableDefaultUI: false, fullscreenControl: false, gestureHandling: "greedy" }}
        >
          {filteredStores.map((store) => (
            <MarkerF
              key={store.id}
              position={{ lat: store.lat, lng: store.lng }}
              icon={{
                url: createDotPin(getDaysBadgeColor(store.daysSinceAudit)),
                scaledSize: new window.google.maps.Size(28, 36),
              }}
              onClick={() => setSelectedPin(store)}
            />
          ))}

          {selectedPin && (
            <InfoWindowF
              position={{ lat: selectedPin.lat, lng: selectedPin.lng }}
              onCloseClick={() => setSelectedPin(null)}
            >
              <div className="p-1 min-w-[180px]">
                <p className="font-bold text-slate-900 text-sm">{selectedPin.name}</p>
                <p className="text-slate-600 text-xs mt-0.5">{selectedPin.city} · {selectedPin.type}</p>
                <div
                  className="mt-1.5 px-2 py-1 rounded text-xs font-medium text-white inline-block"
                  style={{ background: getDaysBadgeColor(selectedPin.daysSinceAudit) }}
                >
                  {selectedPin.daysSinceAudit !== null
                    ? `${selectedPin.daysSinceAudit} gün önce denetlendi`
                    : "Hiç denetlenmedi"}
                </div>
                {selectedPin.address && (
                  <p className="text-slate-500 text-[11px] mt-1">{selectedPin.address}</p>
                )}
              </div>
            </InfoWindowF>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Auditor Route
// ---------------------------------------------------------------------------

function AuditorRouteTab({
  auditors,
  stores,
  schedule,
  currentDate,
  mapStyles,
  isDark,
  accommodationTypes,
}: {
  auditors: UserProfile[];
  stores: StoreType[];
  schedule: ScheduleItem[];
  currentDate: Date;
  mapStyles: google.maps.MapTypeStyle[];
  isDark: boolean;
  accommodationTypes: { id: string; icon: string; name: string }[];
}) {
  const [selectedAuditorId, setSelectedAuditorId] = useState<string>("");
  const [showRoute, setShowRoute] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeKm, setRouteKm] = useState<number | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const auditorItems = schedule.filter((item) => {
    if (item.auditorId !== selectedAuditorId) return false;
    if (item.type === "leave" || item.type === "blocked") return false;
    return isWithinInterval(item.date, { start: weekStart, end: weekEnd });
  });

  const sortedItems = [...auditorItems].sort((a, b) => a.date.getTime() - b.date.getTime());

  const routeStops = sortedItems
    .map((item, idx) => {
      const store = stores.find((s) => s.id === item.storeId);
      if (!store) return null;
      const coords = parseLocation(store.location);
      if (!coords) return null;
      return { ...coords, store, item, idx: idx + 1 };
    })
    .filter(Boolean) as { lat: number; lng: number; store: StoreType; item: ScheduleItem; idx: number }[];

  const selectedAuditor = auditors.find((a) => a.uid === selectedAuditorId);
  const homeCoords =
    selectedAuditor?.homeLat && selectedAuditor?.homeLng
      ? { lat: selectedAuditor.homeLat, lng: selectedAuditor.homeLng }
      : null;

  // All stops for polyline fallback (home → stores in order)
  const allStops = homeCoords ? [homeCoords, ...routeStops] : routeStops;
  const polylinePath = allStops.map((s) => ({ lat: s.lat, lng: s.lng }));

  // Haversine estimate (shown before real route loads)
  const estimatedKm = routeStops.length >= 1
    ? estimateRouteKm(homeCoords ? [homeCoords, ...routeStops] : routeStops)
    : null;

  // Reset when auditor changes
  useEffect(() => {
    setShowRoute(false);
    setDirections(null);
    setRouteKm(null);
    setRouteError(null);
    setSelectedPin(null);
  }, [selectedAuditorId]);

  // Build real road route via Directions API
  // For days with "ev" (home icon) accommodation: insert homeCoords after that day's stops (round trip)
  const buildRoute = useCallback(() => {
    if (routeStops.length < 1) return;
    setIsRouting(true);
    setRouteError(null);
    setDirections(null);

    // Helper: does a schedule item have home-icon accommodation?
    const isHomeAcc = (item: ScheduleItem) => {
      if (!item.accommodationTypeId || !homeCoords) return false;
      const acc = accommodationTypes.find(a => a.id === item.accommodationTypeId);
      return acc?.icon === "home";
    };

    // Group stops by day, preserving chronological order
    const dayMap: Record<string, typeof routeStops> = {};
    routeStops.forEach(stop => {
      const key = stop.item.date.toDateString();
      if (!dayMap[key]) dayMap[key] = [];
      dayMap[key].push(stop);
    });

    // Build ordered list of points, inserting homeCoords after home-acc days
    const allPoints: { lat: number; lng: number }[] = [];
    if (homeCoords) allPoints.push(homeCoords);

    let lastDayWasHome = false;
    for (const key of Object.keys(dayMap)) {
      const dayStops = dayMap[key];
      const allDayHome = dayStops.every(s => isHomeAcc(s.item));
      dayStops.forEach(s => allPoints.push({ lat: s.lat, lng: s.lng }));
      if (allDayHome && homeCoords) {
        allPoints.push(homeCoords);
        lastDayWasHome = true;
      } else {
        lastDayWasHome = false;
      }
    }
    // If last day was NOT home, the route just ends at the last store (existing behaviour)

    if (allPoints.length < 2) { setIsRouting(false); return; }

    const origin = allPoints[0];
    const destination = allPoints[allPoints.length - 1];
    const waypoints = allPoints.slice(1, -1).map(p => ({
      location: new window.google.maps.LatLng(p.lat, p.lng),
      stopover: true,
    }));

    const svc = new window.google.maps.DirectionsService();
    svc.route(
      { origin, destination, waypoints: waypoints.slice(0, 23), travelMode: window.google.maps.TravelMode.DRIVING },
      (result, status) => {
        setIsRouting(false);
        if (status === "OK" && result) {
          setDirections(result);
          const meters = result.routes[0].legs.reduce((s, l) => s + (l.distance?.value || 0), 0);
          setRouteKm(Math.round(meters / 100) / 10);
        } else {
          setRouteError("Rota hesaplanamadı — API kısıtlaması devam ediyor olabilir.");
          setShowRoute(true); // fall back to polyline
        }
      }
    );
  }, [routeStops, homeCoords, accommodationTypes]);

  const center = homeCoords || (routeStops[0] ? { lat: routeStops[0].lat, lng: routeStops[0].lng } : turkeyCenter);

  const sb = isDark ? "bg-[#0f172a] border-white/10" : "bg-white border-gray-200";
  const divBorder = isDark ? "border-white/10" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-slate-400" : "text-gray-500";
  const textMuted = isDark ? "text-slate-500" : "text-gray-400";
  const inputCls = isDark ? "bg-slate-700 border-white/10 text-white" : "bg-gray-100 border-gray-300 text-gray-900";
  const statCard = isDark ? "bg-white/5" : "bg-gray-100";
  const rowHover = isDark ? "hover:bg-white/5 border-white/5" : "hover:bg-gray-50 border-gray-100";
  const rowSelected = isDark ? "bg-blue-500/10 border-l-blue-400" : "bg-blue-50 border-l-blue-500";

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className={`w-72 flex-shrink-0 border-r flex flex-col ${sb}`}>
        {/* Auditor selector */}
        <div className={`p-3 border-b ${divBorder}`}>
          <label className={`text-xs mb-1 block font-medium ${textSecondary}`}>Denetmen Seç</label>
          <select
            value={selectedAuditorId}
            onChange={(e) => setSelectedAuditorId(e.target.value)}
            className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputCls}`}
          >
            <option value="">— Denetmen seçin —</option>
            {auditors.map((a) => (
              <option key={a.uid} value={a.uid}>
                {a.firstName} {a.lastName}
              </option>
            ))}
          </select>
        </div>

        {/* Stats */}
        {selectedAuditorId && (
          <div className={`px-3 py-2.5 border-b grid grid-cols-2 gap-2 ${divBorder}`}>
            <div className={`rounded-lg p-2 text-center ${statCard}`}>
              <p className={`text-lg font-bold ${textPrimary}`}>{routeStops.length}</p>
              <p className={`text-[10px] ${textSecondary}`}>Mağaza</p>
            </div>
            <div className={`rounded-lg p-2 text-center ${statCard}`}>
              <p className={`text-lg font-bold ${textPrimary}`}>
                {routeKm !== null ? `${routeKm} km` : estimatedKm !== null ? `~${estimatedKm} km` : "—"}
              </p>
              <p className={`text-[10px] ${textSecondary}`}>{routeKm !== null ? "Gerçek yol" : "Tahmini"}</p>
            </div>
          </div>
        )}

        {/* Home location info */}
        {selectedAuditor && (
          <div className={`px-3 py-2 border-b ${divBorder}`}>
            {homeCoords ? (
              <div className="flex items-center gap-1.5 text-blue-400 text-xs">
                <Home className="h-3 w-3" />
                <span>Ev konumu tanımlı — rotaya dahil</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-400 text-xs">
                <AlertCircle className="h-3 w-3" />
                <span>Ev konumu yok — Kullanıcı ayarlarından ekleyin</span>
              </div>
            )}
          </div>
        )}

        {/* Weekly stops list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {!selectedAuditorId && (
            <div className={`p-4 text-center text-xs mt-4 ${textMuted}`}>Denetmen seçin</div>
          )}
          {selectedAuditorId && routeStops.length === 0 && (
            <div className={`p-4 text-center text-xs mt-4 ${textMuted}`}>
              Bu hafta için program bulunamadı
            </div>
          )}
          {routeStops.map((stop) => (
            <div
              key={stop.item.id}
              onClick={() => {
                setSelectedPin(stop.item.id);
                mapRef.current?.panTo({ lat: stop.lat, lng: stop.lng });
                mapRef.current?.setZoom(14);
              }}
              className={`px-3 py-2.5 border-b cursor-pointer transition-colors flex items-start gap-2 ${
                selectedPin === stop.item.id ? `border-l-2 ${rowSelected}` : rowHover
              }`}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: "#3b82f6" }}
              >
                {stop.idx}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${textPrimary}`}>{stop.store.name}</p>
                <p className={`text-[10px] ${textMuted}`}>
                  {stop.item.date.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" })}
                  {stop.store.city ? ` · ${stop.store.city}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Route button */}
        {selectedAuditorId && routeStops.length >= 1 && (
          <div className={`p-3 border-t ${divBorder}`}>
            <button
              onClick={buildRoute}
              disabled={isRouting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Route className="h-4 w-4" />
              {isRouting ? "Hesaplanıyor..." : "Rotayı Hesapla"}
            </button>
            {routeError && (
              <p className="text-amber-400 text-[11px] mt-1.5 text-center">{routeError}</p>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={routeStops.length > 0 ? 8 : 6}
          onLoad={onMapLoad}
          options={{ styles: mapStyles, disableDefaultUI: false, fullscreenControl: false, gestureHandling: "greedy" }}
        >
          {/* Home pin */}
          {homeCoords && (
            <MarkerF
              position={homeCoords}
              icon={{ url: createHomePin(), scaledSize: new window.google.maps.Size(36, 46) }}
            />
          )}

          {/* Store pins */}
          {routeStops.map((stop) => (
            <MarkerF
              key={stop.item.id}
              position={{ lat: stop.lat, lng: stop.lng }}
              icon={{ url: createNumberedPin(stop.idx), scaledSize: new window.google.maps.Size(36, 46) }}
              onClick={() => setSelectedPin(stop.item.id)}
            >
              {selectedPin === stop.item.id && (
                <InfoWindowF
                  position={{ lat: stop.lat, lng: stop.lng }}
                  onCloseClick={() => setSelectedPin(null)}
                >
                  <div className="p-1 min-w-[160px]">
                    <p className="font-bold text-slate-900 text-sm">{stop.store.name}</p>
                    <p className="text-slate-600 text-xs mt-0.5">{stop.store.city}</p>
                    <p className="text-blue-600 text-xs mt-1">
                      {stop.item.date.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                  </div>
                </InfoWindowF>
              )}
            </MarkerF>
          ))}

          {/* Real road route — per-leg coloured segments */}
          {directions
            ? directions.routes[0].legs.map((leg, legIdx) => {
                const LEG_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];
                const color = LEG_COLORS[legIdx % LEG_COLORS.length];
                const path = leg.steps.flatMap((step) =>
                  step.path
                    ? step.path.map((p) => ({ lat: p.lat(), lng: p.lng() }))
                    : [{ lat: step.start_location.lat(), lng: step.start_location.lng() }, { lat: step.end_location.lat(), lng: step.end_location.lng() }]
                );
                return (
                  <PolylineF
                    key={legIdx}
                    path={path}
                    options={{ strokeColor: color, strokeWeight: 5, strokeOpacity: 0.9, geodesic: true }}
                  />
                );
              })
            : showRoute && polylinePath.length >= 2
            ? polylinePath.slice(0, -1).map((_, i) => {
                const LEG_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];
                return (
                  <PolylineF
                    key={i}
                    path={[polylinePath[i], polylinePath[i + 1]]}
                    options={{ strokeColor: LEG_COLORS[i % LEG_COLORS.length], strokeWeight: 4, strokeOpacity: 0.75, geodesic: true }}
                  />
                );
              })
            : null}
        </GoogleMap>

        {selectedAuditorId && routeStops.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
            <div className={`border rounded-xl px-6 py-4 text-center ${isDark ? "bg-[#1e293b] border-white/10" : "bg-white border-gray-200"}`}>
              <p className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Bu hafta için program yok</p>
              <p className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Seçilen denetmenin harita pini oluşturulamadı</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bölge Rota Tab — unaudited stores within 150 km of auditor home
// ---------------------------------------------------------------------------

function BolgeRotaTab({
  auditors,
  stores,
  audits,
  schedule,
  currentDate,
  mapStyles,
  isDark,
}: {
  auditors: UserProfile[];
  stores: StoreType[];
  audits: any[];
  schedule: ScheduleItem[];
  currentDate: Date;
  mapStyles: google.maps.MapTypeStyle[];
  isDark: boolean;
}) {
  const [selectedAuditorId, setSelectedAuditorId] = useState<string>("");
  const [selectedPin, setSelectedPin] = useState<StoreWithCoords | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const RADIUS_KM = 150;

  const selectedAuditor = auditors.find((a) => a.uid === selectedAuditorId);
  const homeCoords =
    selectedAuditor?.homeLat && selectedAuditor?.homeLng
      ? { lat: selectedAuditor.homeLat, lng: selectedAuditor.homeLng }
      : null;

  // Stores audited this month
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
  const auditedThisMonthIds = new Set(
    audits
      .filter((a) => {
        const d: Date = a.completedAt?.toDate?.() || (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt));
        return a.status === "tamamlandi" && d >= monthStart && d <= monthEnd;
      })
      .map((a) => a.storeId as string)
  );

  // Stores scheduled this month (taslak dahil) — exclude these too
  const scheduledThisMonthIds = new Set(
    schedule
      .filter((item) => item.type !== "leave" && item.type !== "blocked" && item.storeId &&
        item.date >= monthStart && item.date <= monthEnd)
      .map((item) => item.storeId!)
  );

  // Nearby unaudited AND unscheduled stores (within 150 km)
  const nearbyStores = (homeCoords
    ? stores
        .filter((s) => !auditedThisMonthIds.has(s.id) && !scheduledThisMonthIds.has(s.id))
        .map((s) => {
          const coords = parseLocation(s.location);
          if (!coords) return null;
          const dist = haversineKm(homeCoords, coords);
          if (dist > RADIUS_KM) return null;
          return { ...s, ...coords, distKm: Math.round(dist * 10) / 10 } as StoreWithCoords & { distKm: number };
        })
        .filter(Boolean) as (StoreWithCoords & { distKm: number })[]
    : []
  ).sort((a, b) => a.distKm - b.distKm);

  const center = homeCoords || turkeyCenter;

  const sb = isDark ? "bg-[#0f172a] border-white/10" : "bg-white border-gray-200";
  const divBorder = isDark ? "border-white/10" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-slate-400" : "text-gray-500";
  const textMuted = isDark ? "text-slate-500" : "text-gray-400";
  const inputCls = isDark ? "bg-slate-700 border-white/10 text-white" : "bg-gray-100 border-gray-300 text-gray-900";
  const statCard = isDark ? "bg-white/5" : "bg-gray-100";
  const rowHover = isDark ? "hover:bg-white/5 border-white/5" : "hover:bg-gray-50 border-gray-100";
  const rowSelected = isDark ? "bg-blue-500/10 border-l-blue-400" : "bg-blue-50 border-l-blue-500";

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className={`w-72 flex-shrink-0 border-r flex flex-col ${sb}`}>
        {/* Auditor selector */}
        <div className={`p-3 border-b ${divBorder}`}>
          <label className={`text-xs mb-1 block font-medium ${textSecondary}`}>Denetmen Seç</label>
          <select
            value={selectedAuditorId}
            onChange={(e) => { setSelectedAuditorId(e.target.value); setSelectedPin(null); }}
            className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputCls}`}
          >
            <option value="">— Denetmen seçin —</option>
            {auditors.map((a) => (
              <option key={a.uid} value={a.uid}>{a.firstName} {a.lastName}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        {selectedAuditorId && homeCoords && (
          <div className={`px-3 py-2.5 border-b grid grid-cols-2 gap-2 ${divBorder}`}>
            <div className={`rounded-lg p-2 text-center ${statCard}`}>
              <p className={`text-lg font-bold ${textPrimary}`}>{nearbyStores.length}</p>
              <p className={`text-[10px] ${textSecondary}`}>Bekleyen</p>
            </div>
            <div className={`rounded-lg p-2 text-center ${statCard}`}>
              <p className={`text-lg font-bold ${textPrimary}`}>{RADIUS_KM} km</p>
              <p className={`text-[10px] ${textSecondary}`}>Yarıçap</p>
            </div>
          </div>
        )}

        {/* Home location status */}
        {selectedAuditor && (
          <div className={`px-3 py-2 border-b ${divBorder}`}>
            {homeCoords ? (
              <div className="flex items-center gap-1.5 text-blue-400 text-xs">
                <Home className="h-3 w-3" />
                <span>Ev konumu merkez, {RADIUS_KM} km içi gösteriliyor</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-400 text-xs">
                <AlertCircle className="h-3 w-3" />
                <span>Ev konumu tanımlı değil — Kullanıcı ayarlarından ekleyin</span>
              </div>
            )}
          </div>
        )}

        {/* Stores list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {!selectedAuditorId && (
            <div className={`p-4 text-center text-xs mt-4 ${textMuted}`}>Denetmen seçin</div>
          )}
          {selectedAuditorId && !homeCoords && (
            <div className={`p-4 text-center text-xs mt-4 ${textMuted}`}>Ev konumu gerekli</div>
          )}
          {selectedAuditorId && homeCoords && nearbyStores.length === 0 && (
            <div className={`p-4 text-center text-xs mt-4 ${textMuted}`}>{RADIUS_KM} km içinde bekleyen mağaza yok</div>
          )}
          {nearbyStores.map((store, i) => (
            <div
              key={store.id}
              onClick={() => {
                setSelectedPin(store);
                mapRef.current?.panTo({ lat: store.lat, lng: store.lng });
                mapRef.current?.setZoom(12);
              }}
              className={`px-3 py-2.5 border-b cursor-pointer transition-colors flex items-start gap-2 ${
                selectedPin?.id === store.id ? `border-l-2 ${rowSelected}` : rowHover
              }`}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5 bg-emerald-600">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium truncate ${textPrimary}`}>{store.name}</p>
                <p className={`text-[10px] ${textMuted}`}>{store.city}{store.type ? ` · ${store.type}` : ""}</p>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold flex-shrink-0 mt-0.5">{store.distKm} km</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={homeCoords ? 8 : 6}
          onLoad={onMapLoad}
          options={{ styles: mapStyles, disableDefaultUI: false, fullscreenControl: false, gestureHandling: "greedy" }}
        >
          {/* Home pin */}
          {homeCoords && (
            <MarkerF
              position={homeCoords}
              icon={{ url: createHomePin(), scaledSize: new window.google.maps.Size(40, 50) }}
            />
          )}

          {/* 150km radius — visual circle via many polyline points */}
          {homeCoords && (() => {
            const pts: { lat: number; lng: number }[] = [];
            for (let i = 0; i <= 64; i++) {
              const angle = (i / 64) * 2 * Math.PI;
              const dLat = (RADIUS_KM / 6371) * (180 / Math.PI);
              const dLng = (RADIUS_KM / 6371) * (180 / Math.PI) / Math.cos(homeCoords.lat * Math.PI / 180);
              pts.push({ lat: homeCoords.lat + dLat * Math.sin(angle), lng: homeCoords.lng + dLng * Math.cos(angle) });
            }
            return (
              <PolylineF
                path={pts}
                options={{ strokeColor: "#3b82f6", strokeWeight: 1.5, strokeOpacity: 0.4, geodesic: false }}
              />
            );
          })()}

          {/* Store pins */}
          {nearbyStores.map((store) => (
            <MarkerF
              key={store.id}
              position={{ lat: store.lat, lng: store.lng }}
              icon={{ url: createDotPin("#10b981"), scaledSize: new window.google.maps.Size(28, 36) }}
              onClick={() => setSelectedPin(store)}
            >
              {selectedPin?.id === store.id && (
                <InfoWindowF
                  position={{ lat: store.lat, lng: store.lng }}
                  onCloseClick={() => setSelectedPin(null)}
                >
                  <div className="p-1 min-w-[160px]">
                    <p className="font-bold text-slate-900 text-sm">{store.name}</p>
                    <p className="text-slate-600 text-xs mt-0.5">{store.city} · {store.type}</p>
                    <p className="text-emerald-600 text-xs mt-1 font-semibold">{store.distKm} km uzakta</p>
                  </div>
                </InfoWindowF>
              )}
            </MarkerF>
          ))}
        </GoogleMap>

        {!selectedAuditorId && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
            <div className={`border rounded-xl px-6 py-4 text-center ${isDark ? "bg-[#1e293b] border-white/10" : "bg-white border-gray-200"}`}>
              <p className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Denetmen seçin</p>
              <p className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Bölge haritasını görüntülemek için bir denetmen seçin</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Monthly Route (denetmenin ay içi tüm mağazaları, taslak dahil)
// ---------------------------------------------------------------------------

function AylikRotaTab({
  auditors,
  stores,
  schedule,
  currentDate,
  mapStyles,
  isDark,
  accommodationTypes,
}: {
  auditors: UserProfile[];
  stores: StoreType[];
  schedule: ScheduleItem[];
  currentDate: Date;
  mapStyles: google.maps.MapTypeStyle[];
  isDark: boolean;
  accommodationTypes: { id: string; icon: string; name: string }[];
}) {
  const [selectedAuditorId, setSelectedAuditorId] = useState<string>("");
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [directionsResults, setDirectionsResults] = useState<google.maps.DirectionsResult[]>([]);
  const [showRoute, setShowRoute] = useState(false);
  const [routeKm, setRouteKm] = useState<number | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const defaultMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const mapRef = useRef<google.maps.Map | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const [selYear, selMonthIdx] = selectedMonth.split("-").map(Number);
  const monthStart = new Date(selYear, selMonthIdx - 1, 1);
  const monthEnd = new Date(selYear, selMonthIdx, 0, 23, 59, 59);

  // All scheduled items for the selected auditor this month (draft incl.)
  const monthItems = schedule
    .filter((item) =>
      item.auditorId === selectedAuditorId &&
      item.type !== "leave" &&
      item.type !== "blocked" &&
      item.storeId &&
      item.date >= monthStart &&
      item.date <= monthEnd
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const monthStops = monthItems
    .map((item, idx) => {
      const store = stores.find((s) => s.id === item.storeId);
      if (!store) return null;
      const coords = parseLocation(store.location);
      if (!coords) return null;
      return { ...coords, store, item, idx: idx + 1 };
    })
    .filter(Boolean) as { lat: number; lng: number; store: StoreType; item: ScheduleItem; idx: number }[];

  const selectedAuditor = auditors.find((a) => a.uid === selectedAuditorId);
  const homeCoords =
    selectedAuditor?.homeLat && selectedAuditor?.homeLng
      ? { lat: selectedAuditor.homeLat, lng: selectedAuditor.homeLng }
      : null;

  // Group stops by week (ISO week starting Monday)
  const weeksMap = monthStops.reduce((acc, stop) => {
    const ws = startOfWeek(stop.item.date, { weekStartsOn: 1 }).getTime();
    if (!acc[ws]) acc[ws] = [];
    acc[ws].push(stop);
    return acc;
  }, {} as Record<number, typeof monthStops>);
  const weekGroups = Object.values(weeksMap);

  // Fallback polylines: for each week, draw a line from home (if any) through week's stops
  const fallbackPolylines = weekGroups.map((weekStops) => {
    const pts = homeCoords ? [homeCoords, ...weekStops] : weekStops;
    return pts.map((p) => ({ lat: p.lat, lng: p.lng }));
  });

  // Haversine estimate sum across weeks
  const estimatedKm = weekGroups.reduce((total, weekStops) => {
    const pts = homeCoords ? [homeCoords, ...weekStops] : weekStops;
    return pts.length >= 2 ? total + estimateRouteKm(pts.map((s) => ({ lat: s.lat, lng: s.lng }))) : total;
  }, 0);

  const center = homeCoords || (monthStops[0] ? { lat: monthStops[0].lat, lng: monthStops[0].lng } : turkeyCenter);

  useEffect(() => {
    setDirectionsResults([]);
    setShowRoute(false);
    setRouteKm(null);
    setRouteError(null);
    setSelectedPin(null);
  }, [selectedAuditorId, selectedMonth]);

  const buildRoute = useCallback(async () => {
    if (weekGroups.length === 0) return;
    setIsRouting(true);
    setRouteError(null);
    setDirectionsResults([]);

    const svc = new window.google.maps.DirectionsService();

    // Helper: does a schedule item have "ev" (home icon) accommodation?
    const isHomeAcc = (item: ScheduleItem) => {
      if (!item.accommodationTypeId || !homeCoords) return false;
      const acc = accommodationTypes.find((a) => a.id === item.accommodationTypeId);
      return acc?.icon === "home";
    };

    let totalMeters = 0;
    const results: google.maps.DirectionsResult[] = [];
    let hasError = false;

    // Calculate directions parallel per week with round-trip logic for "ev" days
    const promises = weekGroups.map((weekStops) => {
      return new Promise<void>((resolve) => {
        // Group week's stops by day
        const dayMap: Record<string, typeof weekStops> = {};
        weekStops.forEach((stop) => {
          const key = stop.item.date.toDateString();
          if (!dayMap[key]) dayMap[key] = [];
          dayMap[key].push(stop);
        });

        // Build ordered points for this week, inserting homeCoords after home-acc days
        const allPoints: { lat: number; lng: number }[] = [];
        if (homeCoords) allPoints.push(homeCoords);

        for (const key of Object.keys(dayMap)) {
          const dayStops = dayMap[key];
          const allDayHome = dayStops.every((s) => isHomeAcc(s.item));
          dayStops.forEach((s) => allPoints.push({ lat: s.lat, lng: s.lng }));
          if (allDayHome && homeCoords) {
            allPoints.push(homeCoords); // Return home after this day
          }
        }

        if (allPoints.length < 2) { resolve(); return; }

        const origin = allPoints[0];
        const destination = allPoints[allPoints.length - 1];
        const waypoints = allPoints.slice(1, -1).map((s) => ({
          location: new window.google.maps.LatLng(s.lat, s.lng),
          stopover: true,
        }));

        svc.route(
          { origin, destination, waypoints: waypoints.slice(0, 23), travelMode: window.google.maps.TravelMode.DRIVING },
          (res, status) => {
            if (status === "OK" && res) {
              results.push(res);
              totalMeters += res.routes[0].legs.reduce((s, l) => s + (l.distance?.value || 0), 0);
            } else {
              hasError = true;
            }
            resolve();
          }
        );
      });
    });

    await Promise.all(promises);

    setIsRouting(false);
    if (results.length > 0) {
      setDirectionsResults(results);
      setRouteKm(Math.round(totalMeters / 100) / 10);
    }
    if (hasError) {
      setRouteError("Bazı haftaların rotası hesaplanamadı — API kısıtlaması olabilir.");
      setShowRoute(true);
    }
  }, [weekGroups, homeCoords, accommodationTypes]);

  const sb = isDark ? "bg-[#0f172a] border-white/10" : "bg-white border-gray-200";
  const divBorder = isDark ? "border-white/10" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-slate-400" : "text-gray-500";
  const textMuted = isDark ? "text-slate-500" : "text-gray-400";
  const inputCls = isDark ? "bg-slate-700 border-white/10 text-white" : "bg-gray-100 border-gray-300 text-gray-900";
  const statCard = isDark ? "bg-white/5" : "bg-gray-100";
  const rowHover = isDark ? "hover:bg-white/5 border-white/5" : "hover:bg-gray-50 border-gray-100";
  const rowSelected = isDark ? "bg-purple-500/10 border-l-purple-400" : "bg-purple-50 border-l-purple-500";
  const LEG_COLORS = ["#7c3aed","#10b981","#f59e0b","#ef4444","#3b82f6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className={`w-72 flex-shrink-0 border-r flex flex-col ${sb}`}>
        {/* Auditor selector */}
        <div className={`p-3 border-b ${divBorder}`}>
          <label className={`text-xs mb-1 block font-medium ${textSecondary}`}>Denetmen Seç</label>
          <select
            value={selectedAuditorId}
            onChange={(e) => { setSelectedAuditorId(e.target.value); setSelectedPin(null); }}
            className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 ${inputCls}`}
          >
            <option value="">— Denetmen seçin —</option>
            {auditors.map((a) => (
              <option key={a.uid} value={a.uid}>{a.firstName} {a.lastName}</option>
            ))}
          </select>
        </div>

        {/* Month selector */}
        <div className={`p-3 border-b ${divBorder}`}>
          <label className={`text-xs mb-1 block font-medium ${textSecondary}`}>Ay Seç</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 ${inputCls}`}
          />
        </div>
        {/* Stats */}
        {selectedAuditorId && (
          <div className={`px-3 py-2.5 border-b grid grid-cols-2 gap-2 ${divBorder}`}>
            <div className={`rounded-lg p-2 text-center ${statCard}`}>
              <p className={`text-lg font-bold ${textPrimary}`}>{monthStops.length}</p>
              <p className={`text-[10px] ${textSecondary}`}>Mağaza</p>
            </div>
            <div className={`rounded-lg p-2 text-center ${statCard}`}>
              <p className={`text-lg font-bold ${textPrimary}`}>
                {routeKm !== null ? `${routeKm} km` : estimatedKm !== null ? `~${estimatedKm} km` : "—"}
              </p>
              <p className={`text-[10px] ${textSecondary}`}>{routeKm !== null ? "Gerçek yol" : "Tahmini"}</p>
            </div>
          </div>
        )}

        {/* Stops list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {!selectedAuditorId && (
            <div className={`p-4 text-center text-xs mt-4 ${textMuted}`}>Denetmen seçin</div>
          )}
          {selectedAuditorId && monthStops.length === 0 && (
            <div className={`p-4 text-center text-xs mt-4 ${textMuted}`}>Bu ay için program bulunamadı</div>
          )}
          {monthStops.map((stop) => (
            <div
              key={stop.item.id}
              onClick={() => {
                setSelectedPin(stop.item.id);
                mapRef.current?.panTo({ lat: stop.lat, lng: stop.lng });
                mapRef.current?.setZoom(13);
              }}
              className={`px-3 py-2.5 border-b cursor-pointer transition-colors flex items-start gap-2 ${
                selectedPin === stop.item.id ? `border-l-2 ${rowSelected}` : rowHover
              }`}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: "#7c3aed" }}
              >
                {stop.idx}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium truncate ${textPrimary}`}>{stop.store.name}</p>
                <p className={`text-[10px] ${textMuted}`}>
                  {stop.item.date.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" })}
                  {stop.item.status === "draft" && <span className="ml-1 text-amber-500">· Taslak</span>}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Route button */}
        {selectedAuditorId && monthStops.length >= 2 && (
          <div className={`p-3 border-t ${divBorder}`}>
            <button
              onClick={buildRoute}
              disabled={isRouting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Route className="h-4 w-4" />
              {isRouting ? "Hesaplanıyor..." : "Rotayı Hesapla"}
            </button>
            {routeError && (
              <p className="text-amber-400 text-[11px] mt-1.5 text-center">{routeError}</p>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={monthStops.length > 0 ? 7 : 6}
          onLoad={onMapLoad}
          options={{ styles: mapStyles, disableDefaultUI: false, fullscreenControl: false, gestureHandling: "greedy" }}
        >
          {/* Home pin */}
          {homeCoords && (
            <MarkerF
              position={homeCoords}
              icon={{ url: createHomePin(), scaledSize: new window.google.maps.Size(36, 46) }}
            />
          )}

          {monthStops.map((stop) => (
            <MarkerF
              key={stop.item.id}
              position={{ lat: stop.lat, lng: stop.lng }}
              icon={{ url: createNumberedPin(stop.idx, "#7c3aed"), scaledSize: new window.google.maps.Size(36, 46) }}
              onClick={() => setSelectedPin(stop.item.id)}
            >
              {selectedPin === stop.item.id && (
                <InfoWindowF
                  position={{ lat: stop.lat, lng: stop.lng }}
                  onCloseClick={() => setSelectedPin(null)}
                >
                  <div className="p-1 min-w-[160px]">
                    <p className="font-bold text-slate-900 text-sm">{stop.store.name}</p>
                    <p className="text-slate-600 text-xs mt-0.5">{stop.store.city}</p>
                    <p className="text-purple-600 text-xs mt-1">
                      {stop.item.date.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    {stop.item.status === "draft" && (
                      <span className="text-[10px] text-amber-600 font-medium">Taslak</span>
                    )}
                  </div>
                </InfoWindowF>
              )}
            </MarkerF>
          ))}

          {/* Real road route or straight-line fallback per week */}
          {directionsResults.length > 0
            ? directionsResults.map((directions, weekIdx) => {
                const LEG_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];
                return directions.routes[0].legs.map((leg, legIdx) => {
                  const color = LEG_COLORS[(weekIdx * 3 + legIdx) % LEG_COLORS.length];
                  const path = leg.steps.flatMap((step) =>
                    step.path
                      ? step.path.map((p) => ({ lat: p.lat(), lng: p.lng() }))
                      : [
                          { lat: step.start_location.lat(), lng: step.start_location.lng() },
                          { lat: step.end_location.lat(), lng: step.end_location.lng() },
                        ]
                  );
                  return (
                    <PolylineF
                      key={`dir-${weekIdx}-${legIdx}`}
                      path={path}
                      options={{ strokeColor: color, strokeWeight: 5, strokeOpacity: 0.9, geodesic: true }}
                    />
                  );
                });
              })
            : showRoute
            ? fallbackPolylines.map((path, weekIdx) => {
                const LEG_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];
                return path.length >= 2
                  ? path.slice(0, -1).map((_, legIdx) => {
                      const color = LEG_COLORS[(weekIdx * 3 + legIdx) % LEG_COLORS.length];
                      return (
                        <PolylineF
                          key={`fb-${weekIdx}-${legIdx}`}
                          path={[path[legIdx], path[legIdx + 1]]}
                          options={{ strokeColor: color, strokeWeight: 4, strokeOpacity: 0.75, geodesic: true }}
                        />
                      );
                    })
                  : null;
              })
            : null}
        </GoogleMap>

        {!selectedAuditorId && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
            <div className={`border rounded-xl px-6 py-4 text-center ${isDark ? "bg-[#1e293b] border-white/10" : "bg-white border-gray-200"}`}>
              <p className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Denetmen seçin</p>
              <p className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Aylık rotayı görüntülemek için bir denetmen seçin</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Modal Component
// ---------------------------------------------------------------------------

export function ScheduleMapModal({ open, onClose, stores, auditors, schedule, audits, currentDate, accommodationTypes }: Props) {
  const { isLoaded } = useGoogleMapsLoader();
  const [activeTab, setActiveTab] = useState<"pending" | "route" | "monthly" | "region">("pending");
  const [isDark, setIsDark] = useState(false);
  const mapStyles = isDark ? DARK_MAP_STYLES : [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className={`relative w-full h-full max-w-[1400px] max-h-[90vh] mx-4 rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-colors duration-300 ${
        isDark ? "bg-[#0d1117] border border-white/10" : "bg-gray-50 border border-gray-200"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 transition-colors duration-300 ${
          isDark ? "bg-[#0f172a] border-white/10" : "bg-white border-gray-200"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <MapIcon className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className={`font-bold text-base leading-tight ${isDark ? "text-white" : "text-gray-900"}`}>Denetim Haritası</h2>
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                {currentDate.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className={`flex items-center rounded-xl p-1 gap-1 ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "pending"
                  ? "bg-blue-600 text-white shadow-lg"
                  : isDark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Store className="h-3.5 w-3.5" />
              Bekleyen Mağazalar
            </button>
            <button
              onClick={() => setActiveTab("route")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "route"
                  ? "bg-blue-600 text-white shadow-lg"
                  : isDark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Navigation className="h-3.5 w-3.5" />
              Haftalık Rota
            </button>
            <button
              onClick={() => setActiveTab("monthly")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "monthly"
                  ? "bg-purple-600 text-white shadow-lg"
                  : isDark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Aylık Rota
            </button>
            <button
              onClick={() => setActiveTab("region")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "region"
                  ? "bg-emerald-600 text-white shadow-lg"
                  : isDark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Home className="h-3.5 w-3.5" />
              Bölge Rota
            </button>
          </div>

          {/* Theme toggle + close */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsDark((v) => !v)}
              title={isDark ? "Açık haritaya geç" : "Karanlık haritaya geç"}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                isDark ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                isDark ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0">
          {!isLoaded ? (
            <div className={`flex items-center justify-center h-full gap-3 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>Harita yükleniyor...</span>
            </div>
          ) : (
            <>
              {activeTab === "pending" && (
                <PendingStoresTab stores={stores} audits={audits} schedule={schedule} currentDate={currentDate} mapStyles={mapStyles} isDark={isDark} />
              )}
              {activeTab === "route" && (
                <AuditorRouteTab auditors={auditors} stores={stores} schedule={schedule} currentDate={currentDate} mapStyles={mapStyles} isDark={isDark} accommodationTypes={accommodationTypes} />
              )}
              {activeTab === "monthly" && (
                <AylikRotaTab auditors={auditors} stores={stores} schedule={schedule} currentDate={currentDate} mapStyles={mapStyles} isDark={isDark} accommodationTypes={accommodationTypes} />
              )}
              {activeTab === "region" && (
                <BolgeRotaTab auditors={auditors} stores={stores} audits={audits} schedule={schedule} currentDate={currentDate} mapStyles={mapStyles} isDark={isDark} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
