/**
 * Best-effort reverse geocoding for attendance clock-in/out. Runs server-side
 * (not in the client bundle) so it's the one place that has to respect the
 * provider's usage policy, and so a slow/failed lookup can never block a
 * clock-in — every failure mode here silently resolves to `null`.
 *
 * No map-rendering library is used anywhere in this feature (see AGENTS.md
 * §7) — this only produces a short text label, never a rendered map.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

/** Reverse-geocodes a lat/lng into a short human-readable label, or `null` on any failure. */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", "18");

    const response = await fetch(url.toString(), {
      headers: {
        // Required by Nominatim's usage policy — identifies the caller.
        "User-Agent": "epidom-app/1.0 (attendance-clock-in; contact: support@epidom.fr)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { display_name?: string };
    return data.display_name?.trim() || null;
  } catch {
    return null;
  }
}
