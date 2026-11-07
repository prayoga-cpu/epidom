// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  searchPublished: vi.fn(),
  isSlugTaken: vi.fn(),
}));

vi.mock("@/lib/services", () => ({
  storefrontService: { searchPublished: h.searchPublished, isSlugTaken: h.isSlugTaken },
}));
vi.mock("@/lib/middleware/rate-limit", () => ({
  rateLimitMiddleware: vi.fn(async () => ({ success: true })),
}));

import { GET } from "../route";

const get = async (q: string) => {
  const res = await GET(
    new Request(`http://localhost/api/public/storefront-search?q=${encodeURIComponent(q)}`)
  );
  return (await res.json()).data as {
    stores: unknown[];
    link: { slug: string; available: boolean } | null;
  };
};

beforeEach(() => {
  h.searchPublished.mockReset().mockResolvedValue([]);
  h.isSlugTaken.mockReset().mockResolvedValue(false);
});

describe("GET /api/public/storefront-search: claim your link", () => {
  it("turns the query into the link the setup wizard would make, and says whether it is free", async () => {
    const data = await get("@Crêperie du Port");
    expect(h.isSlugTaken).toHaveBeenCalledWith("creperie-du-port");
    expect(data.link).toEqual({ slug: "creperie-du-port", available: true });
  });

  it("a link held by any storefront, published or not, is not free", async () => {
    h.isSlugTaken.mockResolvedValue(true);
    expect((await get("bob")).link).toEqual({ slug: "bob", available: false });
  });

  it("no link when the query cannot make one (too short), and no lookup either", async () => {
    expect((await get("zq")).link).toBeNull();
    expect(h.isSlugTaken).not.toHaveBeenCalled();
  });

  it("still lists the published stores that match", async () => {
    h.searchPublished.mockResolvedValue([{ slug: "bobs-cafe", displayName: "Bob's Café" }]);
    expect((await get("Bob")).stores).toEqual([{ slug: "bobs-cafe", displayName: "Bob's Café" }]);
  });
});
