"use client";

import { useMemo, useCallback, useRef } from "react";
import {
    GoogleMap,
    MarkerF,
    InfoWindowF,
} from "@react-google-maps/api";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { useGoogleMapsLoader } from "@/lib/use-google-maps";

interface StoreMapPin {
    id: string;
    name: string;
    city: string;
    lat: number;
    lng: number;
    managerName: string;
    type?: string;
    address?: string;
}

interface StoreMapProps {
    pins: StoreMapPin[];
}

const mapContainerStyle = { width: "100%", height: "100%" };
const turkeyCenter = { lat: 39.0, lng: 35.0 };

const CITY_COLORS = [
    "#e53e3e", "#dd6b20", "#d69e2e", "#38a169", "#3182ce",
    "#805ad5", "#d53f8c", "#00b5d8", "#667eea", "#f6ad55",
    "#68d391", "#76e4f7", "#b794f4", "#fbb6ce", "#fc8181",
];

function getCityColor(city: string, cityList: string[]): string {
    const index = cityList.indexOf(city);
    return CITY_COLORS[index % CITY_COLORS.length] ?? "#3182ce";
}

function createColoredPin(color: string): string {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24S32 28 32 16C32 7.163 24.837 0 16 0z" fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function StoreMap({ pins }: StoreMapProps) {
    const { isLoaded, loadError } = useGoogleMapsLoader();

    const [selectedPin, setSelectedPin] = useState<StoreMapPin | null>(null);
    const mapRef = useRef<google.maps.Map | null>(null);

    const cities = useMemo(
        () => Array.from(new Set(pins.map(p => p.city).filter(Boolean))).sort(),
        [pins]
    );

    const mapOptions = useMemo(() => ({
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        ],
    }), []);

    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
    }, []);

    if (loadError) {
        return (
            <div className="flex h-full items-center justify-center text-destructive">
                <div className="text-center space-y-2">
                    <MapPin className="h-10 w-10 mx-auto opacity-50" />
                    <p className="text-sm font-medium">Harita yüklenemedi</p>
                    <p className="text-xs text-muted-foreground">API anahtarı geçersiz veya internet bağlantısı yok</p>
                </div>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-3">
                    <div className="relative mx-auto h-12 w-12">
                        <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                        <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
                    </div>
                    <p className="text-sm text-muted-foreground">Harita yükleniyor...</p>
                </div>
            </div>
        );
    }

    const validPins = pins.filter(p => !isNaN(p.lat) && !isNaN(p.lng));

    const defaultCenter = validPins.length > 0
        ? {
            lat: validPins.reduce((s, p) => s + p.lat, 0) / validPins.length,
            lng: validPins.reduce((s, p) => s + p.lng, 0) / validPins.length,
        }
        : turkeyCenter;

    return (
        <GoogleMap
            mapContainerStyle={mapContainerStyle}
            zoom={validPins.length === 1 ? 14 : 6}
            center={defaultCenter}
            options={mapOptions}
            onClick={() => setSelectedPin(null)}
            onLoad={onMapLoad}
        >
            {validPins.map((pin) => {
                const color = getCityColor(pin.city, cities);
                const icon = {
                    url: createColoredPin(color),
                    scaledSize: new window.google.maps.Size(32, 40),
                    anchor: new window.google.maps.Point(16, 40),
                };
                return (
                    <MarkerF
                        key={pin.id}
                        position={{ lat: pin.lat, lng: pin.lng }}
                        icon={icon}
                        title={pin.name}
                        onClick={() => setSelectedPin(pin)}
                    />
                );
            })}

            {selectedPin && (
                <InfoWindowF
                    position={{ lat: selectedPin.lat, lng: selectedPin.lng }}
                    onCloseClick={() => setSelectedPin(null)}
                    options={{ pixelOffset: new window.google.maps.Size(0, -40) }}
                >
                    <div className="min-w-[180px] space-y-1.5 p-1">
                        <p className="font-semibold text-sm text-gray-900 border-b pb-1">{selectedPin.name}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                            <span className="font-medium">İl:</span>
                            <span>{selectedPin.city || "—"}</span>
                        </div>
                        {selectedPin.type && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                                <span className="font-medium">Tür:</span>
                                <span>{selectedPin.type}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                            <span className="font-medium">Bölge Müdürü:</span>
                            <span>{selectedPin.managerName}</span>
                        </div>
                        {selectedPin.address && (
                            <div className="flex items-start gap-1 text-xs text-gray-500 pt-0.5 border-t">
                                <span>{selectedPin.address}</span>
                            </div>
                        )}
                        <a
                            href={`https://www.google.com/maps?q=${selectedPin.lat},${selectedPin.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-blue-600 hover:underline pt-1"
                        >
                            Google Maps'te aç →
                        </a>
                    </div>
                </InfoWindowF>
            )}
        </GoogleMap>
    );
}
