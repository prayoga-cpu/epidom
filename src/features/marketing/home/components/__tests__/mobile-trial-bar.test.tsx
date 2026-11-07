import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: "en" }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("../../lib/use-pos-trial-href", () => ({ usePosTrialHref: () => "/register?plan=POS" }));

import { MobileTrialBar } from "../mobile-trial-bar";

/** A controllable IntersectionObserver: the test decides what is on screen. */
let report: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void = () => {};
beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void) {
        report = cb;
      }
      observe() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function page() {
  const hero = document.createElement("section");
  hero.setAttribute("aria-labelledby", "hero-title");
  const finalCta = document.createElement("section");
  finalCta.setAttribute("aria-labelledby", "final-cta-title");
  document.body.append(hero, finalCta);
  return { hero, finalCta };
}

describe("MobileTrialBar", () => {
  it("stays hidden while the hero or the closing call to action is on screen", () => {
    const { hero, finalCta } = page();
    const { container } = render(<MobileTrialBar />);
    const bar = container.firstElementChild!;
    expect(bar).toHaveAttribute("aria-hidden", "true");

    act(() =>
      report([
        { target: hero, isIntersecting: false },
        { target: finalCta, isIntersecting: false },
      ])
    );
    expect(bar).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("link", { name: "redesign.landing.hero.trialCta" })).toHaveAttribute(
      "href",
      "/register?plan=POS"
    );
    expect(screen.getByText("redesign.landing.hero.noCard")).toBeInTheDocument();

    act(() => report([{ target: finalCta, isIntersecting: true }]));
    expect(bar).toHaveAttribute("aria-hidden", "true");
  });

  it("is for phones and tablets only: a wide screen keeps the header's button", () => {
    page();
    const { container } = render(<MobileTrialBar />);
    expect(container.firstElementChild!.className).toMatch(/\blg:hidden\b/);
  });
});
