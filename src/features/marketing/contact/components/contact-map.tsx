"use client";

/**
 * Contact Map Component
 *
 * Interactive map showing EPIDOM office location using Leaflet.
 * Uses dynamic imports to prevent SSR issues with Leaflet library.
 * Fixes Next.js marker icon issue via useEffect.
 * Includes error handling to prevent conflicts with browser extensions.
 *
 * @component
 */

import dynamic from "next/dynamic";
import { useI18n } from "@/components/lang/i18n-provider";
import { useEffect, useState } from "react";

// Dynamic imports to avoid SSR issues with Leaflet
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-neutral-100">
      <p className="text-sm text-neutral-600">Loading map...</p>
    </div>
  ),
});

const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), {
  ssr: false,
});

const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), {
  ssr: false,
});

const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});

/** Coordinates for EPIDOM office: 1 Av. Marcel Ramolfo Garnier, Massy, 91300, France */
const MAP_POSITION: [number, number] = [48.7311, 2.2678];

export function ContactMap() {
  const { t } = useI18n();
  const [mapError, setMapError] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Mark component as mounted to prevent hydration mismatch
    setIsMounted(true);

    // Fix Leaflet marker icons issue in Next.js
    // Wrap in try-catch to prevent extension conflicts
    try {
      // Use dynamic import instead of require to avoid extension conflicts
      import("leaflet").then((L) => {
        try {
          delete (L.default.Icon.Default.prototype as any)._getIconUrl;
          L.default.Icon.Default.mergeOptions({
            iconRetinaUrl:
              "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
            iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
            shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
          });
        } catch (error) {
          console.warn("[ContactMap] Error setting up Leaflet icons:", error);
          setMapError(true);
        }
      }).catch((error) => {
        console.warn("[ContactMap] Error loading Leaflet:", error);
        setMapError(true);
      });
    } catch (error) {
      console.warn("[ContactMap] Error in useEffect:", error);
      setMapError(true);
    }
  }, []);

  // Error fallback UI
  if (mapError) {
    return (
      <div className="lg:w-full lg:pt-24 lg:pb-8">
        <div className="flex h-80 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-neutral-200 bg-neutral-50 shadow-lg md:aspect-square lg:h-[450px] lg:w-full">
          <div className="text-center px-4">
            <p className="mb-2 text-sm font-semibold text-[var(--color-brand-primary)]">
              {t("contact.map.error") || "Map unavailable"}
            </p>
            <p className="text-xs text-neutral-600">
              {t("contact.map.errorDesc") || "Please refresh the page to load the map"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Prevent hydration mismatch - only render map after client mount
  if (!isMounted) {
    return (
      <div className="lg:w-full lg:pt-24 lg:pb-8">
        <div className="h-80 w-full overflow-hidden rounded-lg shadow-lg md:aspect-square lg:h-[450px] lg:w-full [&_.leaflet-control-attribution]:hidden">
          <div className="flex h-full w-full items-center justify-center bg-neutral-100">
            <p className="text-sm text-neutral-600">Loading map...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:w-full lg:pt-24 lg:pb-8">
      <div className="h-80 w-full overflow-hidden rounded-lg shadow-lg md:aspect-square lg:h-[450px] lg:w-full [&_.leaflet-control-attribution]:hidden">
        {mapError ? (
          <div className="flex h-full w-full items-center justify-center bg-neutral-50 border-2 border-neutral-200">
            <div className="text-center px-4">
              <p className="mb-2 text-sm font-semibold text-[var(--color-brand-primary)]">
                {t("contact.map.error") || "Map unavailable"}
              </p>
              <p className="text-xs text-neutral-600">
                {t("contact.map.errorDesc") || "Please refresh the page to load the map"}
              </p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={MAP_POSITION}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
            zoomControl={true}
          >
            <TileLayer attribution="" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={MAP_POSITION}>
              <Popup>
                <div className="text-center">
                  <h3 className="mb-2 text-lg font-semibold text-brand-primary">
                    EPIDOM
                  </h3>
                  <p className="mb-1 text-sm text-gray-600">{t("contact.info.address.line1")}</p>
                  <p className="text-sm text-gray-600">{t("contact.info.address.line2")}</p>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        )}
      </div>
    </div>
  );
}
