/** Lightweight User-Agent parsing for a "connected devices" display — not a full UA database, just enough to label a session sensibly. */
export interface ParsedUserAgent {
  device: "Mobile" | "Tablet" | "Desktop";
  os: string;
  browser: string;
}

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua) return { device: "Desktop", os: "Unknown", browser: "Unknown" };

  const isTablet = /iPad|Tablet/i.test(ua);
  const isMobile = !isTablet && /Mobile|Android|iPhone/i.test(ua);
  const device = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";

  let os = "Unknown";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/CriOS/i.test(ua)) browser = "Chrome";
  else if (/FxiOS|Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome|CriOS|Chromium/i.test(ua)) browser = "Safari";

  return { device, os, browser };
}

const PRIVATE_IP_PATTERNS = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./];

/**
 * Loopback/private addresses come in several equivalent textual forms
 * depending on how the request reached Node (::1, the IPv4-mapped
 * ::ffff:127.0.0.1, or the fully expanded 0000:...:0001) — normalize before
 * matching so none of them slip through to a pointless geolocation call
 * that shows up as a raw, ugly IP in the UI when it fails.
 */
function isLocalIp(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "0000:0000:0000:0000:0000:0000:0000:0001") {
    return true;
  }
  return PRIVATE_IP_PATTERNS.some((p) => p.test(normalized));
}

/**
 * Best-effort city/country lookup for a session's IP, via ipapi.co (free
 * tier, no key). Never throws — returns null on any failure/timeout so a
 * flaky third party can't break the account settings page. Local/loopback
 * addresses (dev environment, same-network access) resolve to a plain
 * label instead of attempting a lookup that could never succeed.
 */
export async function geolocateIp(ip: string | null | undefined): Promise<string | null> {
  if (!ip) return null;
  if (isLocalIp(ip)) return "Local device";
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error) return null;
    return [data.city, data.country_name].filter(Boolean).join(", ") || null;
  } catch {
    return null;
  }
}
