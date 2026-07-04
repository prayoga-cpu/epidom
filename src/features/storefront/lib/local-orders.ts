export interface LocalOrderRef {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  total: number;
  storeSlug: string;
}

const storageKey = (slug: string) => `orders_${slug}`;

export function readLocalOrders(slug: string): LocalOrderRef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalOrders(slug: string, refs: LocalOrderRef[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(refs));
  } catch {
    // Ignore storage failures (private mode, quota exceeded)
  }
}

export function appendLocalOrder(slug: string, ref: LocalOrderRef): void {
  if (typeof window === "undefined") return;
  try {
    const existing = readLocalOrders(slug);
    // Newest first, dedupe by orderId keeping the new entry, cap at 20
    const deduped = [ref, ...existing.filter((r) => r.orderId !== ref.orderId)].slice(0, 20);
    localStorage.setItem(storageKey(slug), JSON.stringify(deduped));
  } catch {
    // Ignore storage failures (private mode, quota exceeded)
  }
}
