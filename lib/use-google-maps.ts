"use client";
import { useLoadScript } from "@react-google-maps/api";

const LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"];

export function useGoogleMapsLoader() {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    return useLoadScript({ googleMapsApiKey: apiKey, libraries: LIBRARIES });
}
