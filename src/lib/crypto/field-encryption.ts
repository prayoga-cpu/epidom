import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

/**
 * Encryption for the few database fields that must not be readable in a
 * database copy or backup (a partner's bank details).
 *
 * AES-256-GCM with a key derived (HKDF-SHA256) from BETTER_AUTH_SECRET and a
 * per-purpose label, so no extra secret has to be configured, and each
 * purpose gets its own key. Rotating BETTER_AUTH_SECRET makes stored values
 * unreadable: they then decrypt to null and have to be entered again. A
 * database cloned into another environment (the nightly dev reset) holds
 * values it can't read, for the same reason.
 *
 * Stored as "v1.<iv>.<tag>.<ciphertext>", base64url.
 */

function keyFor(purpose: string): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set: cannot encrypt");
  return Buffer.from(hkdfSync("sha256", secret, "epidom-field-encryption", purpose, 32));
}

export function encryptField(plain: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(purpose), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv, tag, data]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

/** The plain text, or null when the value is malformed or was encrypted with another key. */
export function decryptField(stored: string | null | undefined, purpose: string): string | null {
  if (!stored) return null;
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyFor(purpose), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
