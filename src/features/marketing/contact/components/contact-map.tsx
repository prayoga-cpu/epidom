"use client";

/**
 * Contact Map Component
 *
 * Interactive map showing EPIDOM office location using Leaflet.
 * Uses dynamic imports to prevent SSR issues with Leaflet library.
 * Fixes Next.js marker icon issue via useEffect.
 *
 * @component
 */

import dynamic from "next/dynamic";
import { useI18n } from "@/components/lang/i18n-provider";
import { useEffect } from "react";

// Dynamic imports to avoid SSR issues with Leaflet
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), {
  ssr: false,
});

const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), {
  ssr: false,
});

const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });

const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

/** Coordinates for EPIDOM office: 1 Av. Marcel Ramolfo Garnier, Massy, 91300, France */
const MAP_POSITION: [number, number] = [48.7311, 2.2678];

export function ContactMap() {
  const { t } = useI18n();

  useEffect(() => {
    // Fix Leaflet marker icons issue in Next.js
    if (typeof window !== "undefined") {
      const L = require("leaflet");

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });
    }
  }, []);

  return (
    <div className="lg:w-full lg:pt-24 lg:pb-8">
      <div className="h-80 w-full overflow-hidden rounded-lg shadow-lg md:aspect-square lg:h-[450px] lg:w-full [&_.leaflet-control-attribution]:hidden">
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
      </div>
    </div>
  );
}
