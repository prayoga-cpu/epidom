import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const analytics = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/analytics", () => analytics);

import { ArticleCta } from "@/features/marketing/shared/components/article-cta";

/** Click an anchor without letting jsdom attempt (and log) a real navigation. */
function clickWithoutNavigating(el: HTMLElement) {
  el.addEventListener("click", (e) => e.preventDefault(), { once: true });
  fireEvent.click(el);
}

describe("ArticleCta", () => {
  it("card variant: a labelled aside with the title, no heading, and a /register link", () => {
    const { container } = render(
      <ArticleCta
        variant="card"
        title="Ready to try this yourself?"
        button="Start free →"
        trackLabel="x"
      />
    );

    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside?.getAttribute("aria-label")).toBe("Ready to try this yourself?");
    expect(screen.getByText("Ready to try this yourself?")).toBeInTheDocument();
    // Not a heading: the card must not show up as another section of the article outline.
    expect(container.querySelector("h1, h2, h3")).toBeNull();

    const link = screen.getByRole("link", { name: "Start free →" });
    expect(link.getAttribute("href")).toBe("/register");
  });

  it("card variant: the button is at least 48px tall and body is optional", () => {
    const { container, rerender } = render(
      <ArticleCta variant="card" title="Title" button="Go" trackLabel="x" />
    );
    expect(screen.getByRole("link", { name: "Go" }).className).toContain("min-h-12");
    // Title only: a single <p>.
    expect(container.querySelectorAll("aside p")).toHaveLength(1);

    rerender(
      <ArticleCta variant="card" title="Title" body="Supporting line" button="Go" trackLabel="x" />
    );
    expect(container.querySelectorAll("aside p")).toHaveLength(2);
    expect(screen.getByText("Supporting line")).toBeInTheDocument();
  });

  it("section variant: the blog band with an h2, a body line and the link", () => {
    const { container } = render(
      <ArticleCta
        variant="section"
        title="Ready?"
        body="No card."
        button="Start free →"
        trackLabel="x"
      />
    );

    expect(container.querySelector("section")).not.toBeNull();
    expect(container.querySelector("aside")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Ready?" })).toBeInTheDocument();
    expect(screen.getByText("No card.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start free →" }).getAttribute("href")).toBe(
      "/register"
    );
  });

  it("honours a custom href", () => {
    render(<ArticleCta variant="card" title="T" button="Go" trackLabel="x" href="/pricing" />);
    expect(screen.getByRole("link", { name: "Go" }).getAttribute("href")).toBe("/pricing");
  });

  it.each(["card", "section"] as const)(
    "%s variant: a click sends cta_click with the caller's label",
    (variant) => {
      render(
        <ArticleCta variant={variant} title="T" body="B" button="Go" trackLabel="some_label" />
      );

      clickWithoutNavigating(screen.getByRole("link", { name: "Go" }));

      expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
      expect(analytics.trackEvent).toHaveBeenCalledWith("cta_click", {
        event_category: "engagement",
        event_label: "some_label",
      });
    }
  );

  it("does not track anything until the link is clicked", () => {
    render(<ArticleCta variant="card" title="T" button="Go" trackLabel="some_label" />);
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });
});
