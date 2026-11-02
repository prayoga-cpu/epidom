/**
 * The one way a fiscal record becomes text. The string this returns is what
 * gets hashed and signed, and it is stored exactly as returned
 * (FiscalEntry.payload), so verification never depends on re-serialising.
 *
 * Keys are sorted at every depth, there is no whitespace, and money is never a
 * JS number: every amount is already a fixed-decimal string by the time it
 * gets here (see money() in entry-payload.ts).
 */
export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue | undefined };

function normalise(value: CanonicalValue | undefined): CanonicalValue {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(normalise);
  if (value !== null && typeof value === "object") {
    const out: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(value).sort()) {
      // An absent field and a null one must hash the same.
      out[key] = normalise(value[key]);
    }
    return out;
  }
  if (typeof value === "number" && !Number.isInteger(value)) {
    throw new Error("Fiscal payloads carry amounts as strings, never fractional numbers");
  }
  return value;
}

export function canonicalJson(value: CanonicalValue): string {
  return JSON.stringify(normalise(value));
}
