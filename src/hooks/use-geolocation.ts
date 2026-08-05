"use client";

import { useCallback, useState } from "react";

export type GeolocationStatus = "idle" | "locating" | "success" | "denied" | "unavailable";

interface GeolocationResult {
  latitude: number;
  longitude: number;
}

/**
 * Best-effort geolocation capture for attendance clock-in/out. Permission
 * denial, timeout, or an unsupported browser must never block the action
 * this is used for — callers just get `coords: null` and submit without
 * location, they never see an error that stops the flow.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [coords, setCoords] = useState<GeolocationResult | null>(null);

  const locate = useCallback((): Promise<GeolocationResult | null> => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return Promise.resolve(null);
    }

    setStatus("locating");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const result = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          setCoords(result);
          setStatus("success");
          resolve(result);
        },
        (error) => {
          setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }, []);

  return { status, coords, locate };
}
