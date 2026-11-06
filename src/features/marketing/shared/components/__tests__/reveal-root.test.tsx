import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { RevealRoot } from "../reveal-root";

type Callback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void;

const io = vi.hoisted(() => ({ callback: null as Callback | null, observed: [] as Element[] }));

/** Lays an element out at `top` px from the top of the screen (jsdom has no layout). */
function at(top: number, attrs: Record<string, string> = {}) {
  const el = document.createElement("div");
  el.setAttribute("data-reveal", attrs["data-reveal"] ?? "");
  el.getBoundingClientRect = () => ({ top, bottom: top + 100 }) as DOMRect;
  return el;
}

beforeEach(() => {
  io.callback = null;
  io.observed = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: Callback) {
        io.callback = callback;
      }
      observe(el: Element) {
        io.observed.push(el);
      }
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("RevealRoot", () => {
  it("never hides what is already on screen; hides what is below and reveals it in view", () => {
    const seen = at(100);
    const below = at(1600);
    document.body.append(seen, below);
    render(<RevealRoot />);

    expect(seen.dataset.revealState).toBeUndefined();
    expect(below.dataset.revealState).toBe("pending");
    expect(io.observed).toEqual([below]);

    act(() => io.callback!([{ isIntersecting: true, target: below }]));
    expect(below.dataset.revealState).toBe("in");
  });

  it("staggers siblings that reveal by their order", () => {
    const list = document.createElement("ul");
    const items = [at(1600), at(1600), at(1600)];
    list.append(...items);
    document.body.append(list);
    render(<RevealRoot />);
    expect(items.map((el) => el.style.getPropertyValue("--reveal-i"))).toEqual(["", "1", "2"]);
  });

  it("picks up content added later (a tab, a client navigation)", async () => {
    render(<RevealRoot />);
    const late = at(2000);
    await act(async () => {
      document.body.append(late);
      await Promise.resolve();
    });
    expect(late.dataset.revealState).toBe("pending");
  });

  it("does nothing with reduced motion: nothing is ever hidden", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
    }));
    const below = at(1600);
    document.body.append(below);
    render(<RevealRoot />);
    expect(below.dataset.revealState).toBeUndefined();
  });

  it("a second run (React's development double effect, Fast Refresh) hides below-fold content again", () => {
    const below = at(1600);
    document.body.append(below);
    const first = render(<RevealRoot />);
    first.unmount();
    expect(below.dataset.revealState).toBeUndefined();
    render(<RevealRoot />);
    expect(below.dataset.revealState).toBe("pending");
  });

  it("leaves nothing hidden when it goes away", () => {
    const below = at(1600);
    document.body.append(below);
    const { unmount } = render(<RevealRoot />);
    expect(below.dataset.revealState).toBe("pending");
    unmount();
    expect(below.dataset.revealState).toBeUndefined();
  });
});
