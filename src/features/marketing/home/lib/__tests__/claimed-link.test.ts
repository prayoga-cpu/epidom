import { afterEach, describe, expect, it } from "vitest";
import { CLAIMED_LINK_STORAGE_KEY, stashClaimedLink, takeClaimedLink } from "../claimed-link";

const DAY = 24 * 60 * 60 * 1000;

afterEach(() => window.localStorage.clear());

describe("claimed link hand-over", () => {
  it("hands the claimed link to the wizard once", () => {
    stashClaimedLink("cafe-du-port", 1_000);
    expect(takeClaimedLink(2_000)).toBe("cafe-du-port");
    expect(takeClaimedLink(3_000)).toBeNull();
  });

  it("forgets a link after two days", () => {
    stashClaimedLink("cafe-du-port", 0);
    expect(takeClaimedLink(2 * DAY + 1)).toBeNull();
  });

  it("never stores or returns something that is not a valid link", () => {
    stashClaimedLink("ab", 0);
    expect(window.localStorage.getItem(CLAIMED_LINK_STORAGE_KEY)).toBeNull();
    window.localStorage.setItem(
      CLAIMED_LINK_STORAGE_KEY,
      JSON.stringify({ slug: "<script>", at: 0 })
    );
    expect(takeClaimedLink(1)).toBeNull();
    window.localStorage.setItem(CLAIMED_LINK_STORAGE_KEY, "not json");
    expect(takeClaimedLink(1)).toBeNull();
  });
});
