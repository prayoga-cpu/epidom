"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Keeps a base dialog and every dialog opened from inside it down to ONE
 * modal on screen at a time.
 *
 * Radix mounts each Dialog/AlertDialog root in its own portal with its own
 * overlay and focus trap, so opening a second dialog from inside an open one
 * stacks them: two dimmed backdrops (the page goes near-black), the outer
 * dialog still visible around the edges of the inner one, and two competing
 * focus traps. This hook swaps instead of stacking — opening a layer hides the
 * base, closing the layer brings the base back exactly where the user left it.
 *
 * ```tsx
 * const swap = useDialogSwap<"markPaid" | "refund">(!!order);
 *
 * <Dialog open={swap.baseOpen} onOpenChange={onOpenChange}>
 *   <DialogContent>
 *     <Button onClick={() => swap.open("markPaid")}>Mark as Paid</Button>
 *   </DialogContent>
 * </Dialog>
 * <MarkPaidDialog {...swap.layerProps("markPaid")} onConfirm={…} />
 * ```
 *
 * Render layers as siblings of the base `<Dialog>`, never inside its
 * `<DialogContent>`: that content unmounts while the base is swapped out, and
 * a layer mounted in there would unmount with it and never appear.
 *
 * @param open whether the base dialog wants to be open, ignoring any layer
 */
export function useDialogSwap<K extends string = string>(open: boolean) {
  const [layer, setLayer] = useState<K | null>(null);

  // The base can also close from the outside (Esc, backdrop, a parent clearing
  // its selection). Drop the layer with it, so a half-finished sub-flow never
  // pops back up on its own the next time the base opens.
  useEffect(() => {
    if (!open) setLayer(null);
  }, [open]);

  const openLayer = useCallback((key: K) => setLayer(key), []);
  const closeLayer = useCallback(() => setLayer(null), []);

  const layerProps = useCallback(
    (key: K) => ({
      open: layer === key,
      onOpenChange: (next: boolean) => setLayer(next ? key : null),
    }),
    [layer]
  );

  /**
   * Swaps the base out for the whole lifetime of an async flow that owns its
   * own modal — `useConfirm`'s `confirm()`, say, which resolves when the user
   * answers. The base comes back as soon as the promise settles.
   */
  const withLayer = useCallback(async <T>(key: K, run: () => Promise<T>): Promise<T> => {
    setLayer(key);
    try {
      return await run();
    } finally {
      setLayer(null);
    }
  }, []);

  return {
    /** Pass to the base `<Dialog open={…}>` — false while a layer is showing. */
    baseOpen: open && layer === null,
    /** The layer currently showing, or null when the base has the screen. */
    layer,
    /** Swap the base out for `key`. */
    open: openLayer,
    /** Close the current layer and bring the base back. */
    close: closeLayer,
    /** Spread onto a layer dialog: `<Foo {...swap.layerProps("delete")} />`. */
    layerProps,
    withLayer,
  };
}
