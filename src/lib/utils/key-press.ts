import type React from "react";

/**
 * Typing feedback for on-screen keys: the key dips and springs back, and a
 * ripple washes across it. Shared by every custom keypad and keyboard in the
 * app — the PIN pads (staff login, owner PIN, clock-in) and the customer
 * display's number pad and keyboard — so a tap feels the same everywhere.
 *
 * Played on pointerdown rather than styled with `:active`: on iPad Safari a
 * quick tap can end before an `:active` style ever paints, and the point is
 * that every tap shows. The Web Animations API restarts cleanly on each press
 * without touching the className React owns.
 *
 * The key needs `relative overflow-hidden` to hold the ripple (styled by
 * `.key-press-ripple` in globals.css). Its label should be an element, not a
 * bare string child: React replaces a lone text child with `textContent`,
 * which would wipe a ripple still in flight whenever the label changes.
 */
export function playKeyPress(key: HTMLElement): void {
  // jsdom and very old browsers: no animation, nothing else changes.
  if (typeof key.animate !== "function") return;
  if (key instanceof HTMLButtonElement && key.disabled) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  key.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(0.9)", offset: 0.3 },
      { transform: "scale(1)" },
    ],
    { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
  );

  const ripple = document.createElement("span");
  ripple.setAttribute("aria-hidden", "true");
  ripple.className = "key-press-ripple";
  key.appendChild(ripple);
  const wash = ripple.animate(
    [
      { transform: "translate(-50%, -50%) scale(0)", opacity: 0.3 },
      { transform: "translate(-50%, -50%) scale(1)", opacity: 0 },
    ],
    { duration: 400, easing: "ease-out" }
  );
  wash.onfinish = () => ripple.remove();
  wash.oncancel = () => ripple.remove();
}

/** `onPointerDown` for a key: `<button onPointerDown={onKeyPointerDown} …>`. */
export function onKeyPointerDown(event: React.PointerEvent<HTMLElement>): void {
  playKeyPress(event.currentTarget);
}
