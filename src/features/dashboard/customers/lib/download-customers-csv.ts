import { unwrapApiError } from "@/lib/api/unwrap";

/**
 * The server names the file `customers-<date>.csv` in Content-Disposition; use
 * that so the download matches what the route promised, and fall back to a local
 * name when a proxy stripped the header.
 */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

/**
 * GET /customers/export, then hand the CSV to the browser as a file. Plain
 * `fetch` (not apiClient): the body is text/csv, and apiClient would try to
 * parse it as the JSON envelope. `q` narrows the file exactly as it narrows the
 * list, so "export what I'm looking at" holds.
 *
 * Failures still arrive as the JSON error envelope (manager/owner only, so a
 * cashier persona gets a 403), which is read for its message.
 */
export async function downloadCustomersCsv(storeId: string, q?: string): Promise<void> {
  const query = q ? `?${new URLSearchParams({ q }).toString()}` : "";
  const response = await fetch(`/api/stores/${storeId}/customers/export${query}`);

  if (!response.ok) {
    const raw = await response.json().catch(() => ({}));
    throw new Error(unwrapApiError(raw).message ?? `Export failed (${response.status})`);
  }

  const filename =
    filenameFromContentDisposition(response.headers.get("Content-Disposition")) ??
    `customers-${new Date().toISOString().split("T")[0]}.csv`;

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoked on a later tick, not synchronously: Safari can abort the download
  // if the object URL disappears in the same task as the click.
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
