/**
 * Whether a Blob URL is one THIS account's /api/upload produced. That endpoint
 * writes `users/<userId>/images/<ts>-<name>`, so the path is the ownership proof.
 *
 * Validating the HOST alone (`*.public.blob.vercel-storage.com`) is not enough: it
 * is shared by every tenant's uploads and by any other Vercel account's store.
 * Anything that later DELETES the file with the app-wide Blob token must first
 * pass this, or one owner could point at another tenant's file and remove it.
 */
export function isOwnUpload(imageUrl: string, userId: string): boolean {
  try {
    return new URL(imageUrl).pathname.startsWith(`/users/${userId}/images/`);
  } catch {
    return false;
  }
}

/**
 * Whether a URL came from one of our upload hosts (host-only check, no userId).
 * Accepts both Vercel Blob (`*.public.blob.vercel-storage.com`) and
 * Cloudflare R2 media (`media.epidom.fr`) so callers don't need to know
 * which storage provider is currently active.
 *
 * Use this when you only need to prove the URL is from our infrastructure
 * (e.g. schema validation, image optimisation). Use `isOwnUpload` when
 * you need to prove a specific user owns the file (e.g. before deleting it).
 */
export function isOwnUploadUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:") return false;
    return (
      hostname.endsWith(".public.blob.vercel-storage.com") || hostname === "media.epidom.fr"
    );
  } catch {
    return false;
  }
}
