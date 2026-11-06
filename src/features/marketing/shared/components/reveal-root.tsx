"use client";

import { useEffect } from "react";

const SELECTOR = "[data-reveal]";
/** How long after "in" the state is dropped, so the element's own transitions come back. */
const SETTLE_MS = 1500;
/** An element whose top is above this share of the screen at load is already seen: never hidden. */
const ON_SCREEN = 0.92;
/** Stagger only the first few of a row; the rest come in together. */
const MAX_STAGGER = 6;

/**
 * The marketing site's scroll reveal (see the "Scroll reveal" rules in
 * globals.css). Mounted once in the marketing layout; any element opts in with
 * `data-reveal` ("fade" or "scale" for the other two styles).
 *
 * Elements that start below the fold are hidden once the page is interactive
 * and fade up as they scroll into view; siblings that both opt in are
 * staggered by their order. What is already on screen is left alone (no blink,
 * no layout shift), so is everything without JS or with reduced motion.
 * Content added later (a client navigation, a tab, streamed data) is picked up
 * by a MutationObserver.
 */
export function RevealRoot() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const timers = new Set<number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          el.dataset.revealState = "in";
          const timer = window.setTimeout(() => {
            timers.delete(timer);
            if (el.dataset.revealState === "in") delete el.dataset.revealState;
          }, SETTLE_MS);
          timers.add(timer);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
    );

    // Per run, not a mark on the element: React runs this effect twice in
    // development (and again on Fast Refresh), and a mark left on the DOM made
    // the second run skip everything the first run's cleanup had just shown.
    const prepared = new WeakSet<Element>();

    const prepare = (el: HTMLElement) => {
      if (prepared.has(el)) return;
      prepared.add(el);
      if (el.getBoundingClientRect().top < window.innerHeight * ON_SCREEN) return;

      // Stagger by order among the siblings that also reveal.
      if (el.parentElement && !el.style.getPropertyValue("--reveal-i")) {
        const index = Array.from(el.parentElement.children)
          .filter((child) => child.hasAttribute("data-reveal"))
          .indexOf(el);
        if (index > 0) el.style.setProperty("--reveal-i", String(Math.min(index, MAX_STAGGER)));
      }
      el.dataset.revealState = "pending";
      observer.observe(el);
    };

    const scan = (root: ParentNode) =>
      root.querySelectorAll<HTMLElement>(SELECTOR).forEach(prepare);

    scan(document);

    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches(SELECTOR)) prepare(node);
          scan(node);
        });
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      // Never leave anything hidden behind (a client navigation out of the site).
      document
        .querySelectorAll<HTMLElement>("[data-reveal-state]")
        .forEach((el) => delete el.dataset.revealState);
    };
  }, []);

  return null;
}
