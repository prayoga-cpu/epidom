import { describe, it, expect } from "vitest";
import * as validation from "@/lib/validation";

// `src/lib/validation.ts` (a single file) used to sit next to this directory. A
// file wins over a directory's index.ts in module resolution, so the specifier
// "@/lib/validation" silently meant the file, never this barrel. The file only
// held the retired waitlist form's helpers; it is gone, and this keeps the
// specifier pointing at the Zod schemas the rest of the codebase expects.
describe("@/lib/validation", () => {
  it("resolves to the schema barrel", () => {
    expect(validation.z).toBeDefined();
    expect(Object.keys(validation).length).toBeGreaterThan(20);
  });

  it("no longer carries the waitlist form helpers", () => {
    const names = Object.keys(validation);
    expect(names).not.toContain("validateWaitlistForm");
    expect(names).not.toContain("waitlistRateLimiter");
  });
});
