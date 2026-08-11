import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDialogSwap } from "../use-dialog-swap";

type Layer = "markPaid" | "refund";

describe("useDialogSwap", () => {
  it("keeps the base open while no layer is showing", () => {
    const { result } = renderHook(() => useDialogSwap<Layer>(true));

    expect(result.current.baseOpen).toBe(true);
    expect(result.current.layer).toBeNull();
    expect(result.current.layerProps("markPaid").open).toBe(false);
  });

  it("swaps the base out for the layer instead of stacking both", () => {
    const { result } = renderHook(() => useDialogSwap<Layer>(true));

    act(() => result.current.open("markPaid"));

    expect(result.current.baseOpen).toBe(false);
    expect(result.current.layerProps("markPaid").open).toBe(true);
    // Only ever one modal on screen — the other layer stays closed too.
    expect(result.current.layerProps("refund").open).toBe(false);
  });

  it("brings the base back when the layer closes, either way it closes", () => {
    const { result } = renderHook(() => useDialogSwap<Layer>(true));

    act(() => result.current.open("refund"));
    act(() => result.current.close());
    expect(result.current.baseOpen).toBe(true);

    // …and via the layer's own onOpenChange (Esc, backdrop, Cancel).
    act(() => result.current.open("refund"));
    act(() => result.current.layerProps("refund").onOpenChange(false));
    expect(result.current.baseOpen).toBe(true);
    expect(result.current.layer).toBeNull();
  });

  it("drops a pending layer when the base closes from the outside", () => {
    const { result, rerender } = renderHook(({ open }) => useDialogSwap<Layer>(open), {
      initialProps: { open: true },
    });

    act(() => result.current.open("markPaid"));
    rerender({ open: false });

    expect(result.current.layer).toBeNull();
    expect(result.current.baseOpen).toBe(false);

    // Reopening the base must not resurrect the abandoned layer.
    rerender({ open: true });
    expect(result.current.baseOpen).toBe(true);
    expect(result.current.layerProps("markPaid").open).toBe(false);
  });

  it("holds the base out for the lifetime of an async layer, then restores it", async () => {
    const { result } = renderHook(() => useDialogSwap<Layer>(true));

    let resolveConfirm: (value: boolean) => void = () => {};
    const confirmed = new Promise<boolean>((resolve) => {
      resolveConfirm = resolve;
    });

    let flow!: Promise<boolean>;
    act(() => {
      flow = result.current.withLayer("markPaid", () => confirmed);
    });
    expect(result.current.baseOpen).toBe(false);

    await act(async () => {
      resolveConfirm(true);
      await flow;
    });

    expect(await flow).toBe(true);
    expect(result.current.baseOpen).toBe(true);
  });

  it("restores the base even when the async layer rejects", async () => {
    const { result } = renderHook(() => useDialogSwap<Layer>(true));

    await act(async () => {
      await expect(
        result.current.withLayer("refund", () => Promise.reject(new Error("boom")))
      ).rejects.toThrow("boom");
    });

    expect(result.current.baseOpen).toBe(true);
  });
});
