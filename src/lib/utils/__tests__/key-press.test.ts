/**
 * The shared on-screen key press animation (PIN pads, the customer display's
 * number pad and keyboard). jsdom has no Web Animations API, so `animate` is
 * stubbed per test to watch what gets played.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { playKeyPress } from "../key-press";

type FakeAnimation = { onfinish: (() => void) | null; oncancel: (() => void) | null };

let animations: { el: Element; animation: FakeAnimation }[] = [];
let reducedMotion = false;

beforeEach(() => {
  animations = [];
  reducedMotion = false;
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value(this: Element) {
      const animation: FakeAnimation = { onfinish: null, oncancel: null };
      animations.push({ el: this, animation });
      return animation;
    },
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: reducedMotion && query.includes("reduce") }))
  );
});

afterEach(() => {
  delete (Element.prototype as { animate?: unknown }).animate;
  vi.unstubAllGlobals();
});

const key = () => {
  const button = document.createElement("button");
  button.innerHTML = "<span>7</span>";
  document.body.appendChild(button);
  return button;
};

describe("playKeyPress", () => {
  it("dips the key and washes a ripple across it, then clears the ripple away", () => {
    const button = key();
    playKeyPress(button);

    expect(animations.map((a) => a.el)).toEqual([
      button,
      button.querySelector(".key-press-ripple"),
    ]);
    const ripple = button.querySelector(".key-press-ripple")!;
    expect(ripple.getAttribute("aria-hidden")).toBe("true");

    animations[1].animation.onfinish?.();
    expect(button.querySelector(".key-press-ripple")).toBeNull();
    // The label is untouched.
    expect(button.textContent).toBe("7");
  });

  it("replays on every tap, each with its own ripple", () => {
    const button = key();
    playKeyPress(button);
    playKeyPress(button);
    expect(button.querySelectorAll(".key-press-ripple")).toHaveLength(2);
  });

  it("does nothing on a disabled key", () => {
    const button = key();
    button.disabled = true;
    playKeyPress(button);
    expect(animations).toHaveLength(0);
  });

  it("respects reduced motion", () => {
    reducedMotion = true;
    playKeyPress(key());
    expect(animations).toHaveLength(0);
  });

  it("is a no-op where the Web Animations API is missing", () => {
    delete (Element.prototype as { animate?: unknown }).animate;
    const button = key();
    expect(() => playKeyPress(button)).not.toThrow();
    expect(button.querySelector(".key-press-ripple")).toBeNull();
  });
});
