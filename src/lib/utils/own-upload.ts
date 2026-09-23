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
