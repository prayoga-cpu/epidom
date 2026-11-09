import { cookies } from "next/headers";
import { sessionCookieNames } from "@/lib/auth/cookies";
import { DEMO_TOKEN_PREFIX } from "./demo-constants";

/**
 * Whether this request carries the public demo's session (see demo-session.ts).
 * Server only. The demo skips the "Who's using this device?" staff picker: a
 * visitor has no PIN, and every write is refused anyway (src/proxy.ts).
 */
export async function isDemoSession(): Promise<boolean> {
  const store = await cookies();
  const [plain, secure] = sessionCookieNames(process.env.VERCEL_ENV);
  const raw = store.get(plain)?.value ?? store.get(secure)?.value;
  if (!raw) return false;
  try {
    return decodeURIComponent(raw).startsWith(DEMO_TOKEN_PREFIX);
  } catch {
    return false;
  }
}
