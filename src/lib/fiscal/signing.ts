import {
  createHash,
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  sign,
  verify,
  type KeyObject,
} from "crypto";

/**
 * The fiscal journal's signing key: Ed25519.
 *
 * FISCAL_SIGNING_KEY (32 random bytes, base64) when set; otherwise the key is
 * derived (HKDF-SHA256) from BETTER_AUTH_SECRET under its own label, the same
 * way field-encryption.ts gets its keys, so the journal is signed from the
 * first deploy with nothing new to configure. Rotating either secret changes
 * the key: entries already written keep verifying, because every entry names
 * its keyId and the public key is recorded in fiscal_signing_keys the first
 * time it signs anything.
 *
 * With neither secret (tests, a broken environment) records are still hashed
 * and chained, just not signed, and verification reports them as unsigned. A
 * sale is never refused for want of a signature.
 */

// PKCS#8 wrapper for a raw 32-byte Ed25519 seed (RFC 8410).
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export interface FiscalSigner {
  keyId: string;
  publicKeyPem: string;
  sign(payload: string): string;
}

function seedFromEnv(): Buffer | null {
  const explicit = process.env.FISCAL_SIGNING_KEY?.trim();
  if (explicit) {
    const seed = Buffer.from(explicit, "base64");
    if (seed.length !== 32) {
      throw new Error("FISCAL_SIGNING_KEY must be 32 bytes, base64-encoded");
    }
    return seed;
  }
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return null;
  return Buffer.from(hkdfSync("sha256", secret, "epidom-fiscal-signing", "ed25519-v1", 32));
}

export function keyIdOf(publicKey: KeyObject): string {
  const der = publicKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("hex").slice(0, 16);
}

export function signerFromSeed(seed: Buffer): FiscalSigner {
  const privateKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
  const publicKey = createPublicKey(privateKey);
  return {
    keyId: keyIdOf(publicKey),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    sign: (payload) => sign(null, Buffer.from(payload, "utf8"), privateKey).toString("base64url"),
  };
}

let cached: { signer: FiscalSigner | null } | null = null;

/** The current signer, or null when no secret is configured. */
export function getFiscalSigner(): FiscalSigner | null {
  if (!cached) {
    const seed = seedFromEnv();
    cached = { signer: seed ? signerFromSeed(seed) : null };
  }
  return cached.signer;
}

/** Tests only: forget the cached key so a changed env is picked up. */
export function resetFiscalSignerForTests(): void {
  cached = null;
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function verifySignature(payload: string, signature: string, publicKeyPem: string): boolean {
  try {
    return verify(
      null,
      Buffer.from(payload, "utf8"),
      createPublicKey(publicKeyPem),
      Buffer.from(signature, "base64url")
    );
  } catch {
    return false;
  }
}
