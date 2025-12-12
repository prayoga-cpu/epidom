"use client";

/**
 * Contact Map Component
 *
 * Interactive map showing EPIDOM office location using MapLibre GL JS.
 * Uses OpenFreeMap tiles with custom Epidom brand styling.
 * Features dark land, light water, and brand-colored roads.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/** Coordinates for EPIDOM office: 1 Av. Marcel Ramolfo Garnier, Massy, 91300, France */
const MAP_POSITION: [number, number] = [2.2678, 48.7311]; // [lng, lat] for MapLibre

export function ContactMap() {
  const { t } = useI18n();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: "/map-styles/epidom-contact-style.json",
        center: MAP_POSITION,
        zoom: 15,
        attributionControl: false,
      });

      // Add navigation controls
      map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      // Handle map load
      map.current.on("load", () => {
        setIsLoading(false);
      });

      // Handle map error - only for critical errors, not font warnings
      map.current.on("error", (e) => {
        // Log error for debugging
        console.warn("MapLibre error:", e);

        // Only set error state for critical errors (source loading failures)
        // Font/glyph warnings are non-fatal and map can still render
        if (
          e.error &&
          e.error.message &&
          (e.error.message.includes("Failed to fetch") ||
            e.error.message.includes("Source") ||
            e.error.message.includes("style"))
        ) {
          setMapError(true);
          setIsLoading(false);
        }
      });

      // Create custom teardrop marker element - more slender design
      const markerEl = document.createElement("div");
      markerEl.className = "custom-marker";
      markerEl.innerHTML = `
        <svg width="28" height="42" viewBox="0 0 28 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Slender teardrop shape -->
          <path
            d="M14 0C6.268 0 0 6.268 0 14c0 7.732 12.5 26.5 13.25 27.5 0.375 0.5 1.125 0.5 1.5 0C15.5 40.5 28 21.732 28 14 28 6.268 21.732 0 14 0z"
            fill="#444444"
            stroke="white"
            stroke-width="2"
          />
          <!-- Inner circle highlight -->
          <circle cx="14" cy="13" r="6" fill="white" fill-opacity="0.95"/>
          <!-- Center dot -->
          <circle cx="14" cy="13" r="2.5" fill="#444444"/>
        </svg>
      `;
      markerEl.style.cursor = "pointer";
      markerEl.style.width = "28px";
      markerEl.style.height = "42px";
      markerEl.style.filter = "drop-shadow(0 3px 6px rgba(0, 0, 0, 0.35))";

      // Create popup
      const popup = new maplibregl.Popup({
        offset: [0, -42], // Offset above the marker
        closeButton: true,
        closeOnClick: false,
        className: "epidom-popup",
      }).setHTML(`
        <div style="padding: 8px; text-align: center;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #444444;">
            EPIDOM
          </h3>
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #666666;">
            1 Av. Marcel Ramolfo Garnier
          </p>
          <p style="margin: 0; font-size: 13px; color: #666666;">
            91300 Massy, France
          </p>
        </div>
      `);

      // Add marker to map - anchor at bottom center (tip of teardrop)
      new maplibregl.Marker({ element: markerEl, anchor: "bottom" })
        .setLngLat(MAP_POSITION)
        .setPopup(popup)
        .addTo(map.current);
    } catch (error) {
      console.error("Error initializing map:", error);
      setMapError(true);
      setIsLoading(false);
    }

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Error fallback UI
  if (mapError) {
    return (
      <div className="lg:w-full lg:pt-24 lg:pb-8">
        <div className="flex h-80 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-neutral-200 bg-neutral-50 shadow-lg md:aspect-square lg:h-[450px] lg:w-full">
          <div className="px-4 text-center">
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

  return (
    <div className="lg:w-full lg:pt-24 lg:pb-8">
      <div className="relative h-80 w-full overflow-hidden rounded-lg shadow-lg md:aspect-square lg:h-[450px] lg:w-full">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-100">
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-[var(--color-brand-primary)]" />
              <p className="text-sm text-neutral-600">Loading map...</p>
            </div>
          </div>
        )}
        <div
          ref={mapContainer}
          className="h-full w-full"
          style={{ opacity: isLoading ? 0 : 1, transition: "opacity 0.3s ease" }}
        />
        {/* OpenStreetMap Attribution */}
        <div className="absolute right-1 bottom-1 z-10 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-neutral-600 backdrop-blur-sm">
          ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-700 hover:underline"
          >
            OpenStreetMap
          </a>{" "}
          contributors
        </div>
      </div>
      <style jsx global>{`
        .maplibregl-ctrl-attrib {
          display: none !important;
        }
        .maplibregl-popup-content {
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 0;
        }
        .maplibregl-popup-close-button {
          font-size: 18px;
          color: #666;
          padding: 4px 8px;
        }
        .maplibregl-popup-close-button:hover {
          color: #444;
          background-color: #f5f5f5;
          border-radius: 0 8px 0 0;
        }
        .maplibregl-ctrl-group {
          background: rgba(255, 255, 255, 0.95) !important;
          border-radius: 8px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        }
        .maplibregl-ctrl-group button {
          width: 32px !important;
          height: 32px !important;
        }
      `}</style>
    </div>
  );
}
