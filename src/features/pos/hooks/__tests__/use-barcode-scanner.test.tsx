import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { isEditableTarget, useBarcodeScanner } from "../use-barcode-scanner";

/** A keydown with a controlled `timeStamp` (the hook times bursts by it, not by the wall clock). */
function key(
  k: string,
  at: number,
  target: EventTarget = document.body,
  init: KeyboardEventInit = {}
) {
  const ev = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(ev, "timeStamp", { value: at });
  target.dispatchEvent(ev);
  return ev;
}

/** Types `code` like a wedge scanner (10ms between keys) and presses Enter; returns that Enter event. */
function scan(code: string, target: EventTarget = document.body, start = 1000, gap = 10) {
  [...code].forEach((c, i) => key(c, start + i * gap, target));
  return key("Enter", start + code.length * gap, target);
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useBarcodeScanner", () => {
  it("reports a fast burst that ends in Enter, and swallows that Enter", () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan }));
    const enter = scan("5901234123457");
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith("5901234123457");
    // A focused tile button must not be "clicked" by the scanner's Enter.
    expect(enter.defaultPrevented).toBe(true);
  });

  it("works while a button has focus — the case Enter-swallowing exists for", () => {
    const onScan = vi.fn();
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    renderHook(() => useBarcodeScanner({ onScan }));
    const enter = scan("12345678", button);
    expect(onScan).toHaveBeenCalledWith("12345678");
    expect(enter.defaultPrevented).toBe(true);
  });

  it("does not treat slow, human typing as a scan, and leaves Enter alone", () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan }));
    const enter = scan("12345678", document.body, 1000, 200);
    expect(onScan).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(false);
  });

  it("ignores a burst too short to be a code", () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan }));
    const enter = scan("123");
    expect(onScan).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(false);
  });

  it("ignores keystrokes aimed at editable elements — the search box handles its own Enter", () => {
    const onScan = vi.fn();
    const input = document.createElement("input");
    input.type = "search";
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    // jsdom doesn't compute isContentEditable from the attribute.
    Object.defineProperty(editable, "isContentEditable", { value: true });
    document.body.append(input, textarea, select, editable);
    renderHook(() => useBarcodeScanner({ onScan }));

    for (const el of [input, textarea, select, editable]) {
      const enter = scan("5901234123457", el);
      expect(enter.defaultPrevented).toBe(false);
    }
    expect(onScan).not.toHaveBeenCalled();
  });

  it("characters typed into a field never leak into a later scan", () => {
    const onScan = vi.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);
    renderHook(() => useBarcodeScanner({ onScan }));
    key("a", 1000, input);
    key("b", 1010, input);
    key("c", 1020);
    key("d", 1030);
    key("Enter", 1040);
    // "abcd" would have been a 4-character code had the input's keys been buffered.
    expect(onScan).not.toHaveBeenCalled();
  });

  it("a checkbox or button is not an editable target", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const button = document.createElement("button");
    expect(isEditableTarget(checkbox)).toBe(false);
    expect(isEditableTarget(button)).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it("ignores shortcuts with a modifier held", () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan }));
    [..."12345678"].forEach((c, i) => key(c, 1000 + i * 10, document.body, { ctrlKey: true }));
    key("Enter", 1100);
    expect(onScan).not.toHaveBeenCalled();
  });

  it("does not add to a cart the cashier can't see while a dialog is open", () => {
    const onScan = vi.fn();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    renderHook(() => useBarcodeScanner({ onScan }));
    const enter = scan("5901234123457");
    expect(onScan).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(false);
  });

  it("stops listening when disabled and when unmounted", () => {
    const onScan = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useBarcodeScanner({ onScan, enabled }),
      {
        initialProps: { enabled: false },
      }
    );
    scan("11112222");
    expect(onScan).not.toHaveBeenCalled();

    rerender({ enabled: true });
    scan("11112222");
    expect(onScan).toHaveBeenCalledTimes(1);

    unmount();
    scan("33334444");
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it("calls the latest onScan without re-attaching the listener", () => {
    const first = vi.fn();
    const second = vi.fn();
    const add = vi.spyOn(window, "addEventListener");
    const { rerender } = renderHook(({ cb }) => useBarcodeScanner({ onScan: cb }), {
      initialProps: { cb: first },
    });
    const attachedOnce = add.mock.calls.filter(([type]) => type === "keydown").length;
    rerender({ cb: second });
    expect(add.mock.calls.filter(([type]) => type === "keydown").length).toBe(attachedOnce);
    scan("55556666");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("55556666");
    add.mockRestore();
  });
});
