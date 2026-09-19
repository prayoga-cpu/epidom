"use client";

import { createContext, useContext } from "react";

/**
 * A slot inside PosModeStatusBar that a page can portal its own controls into,
 * so /pos shows ONE 44px top row ([store · online][search][filters][view][scan]
 * [printer][switch user]) instead of a status bar plus a toolbar under it.
 *
 * `available` says whether a PosModeShell is providing a slot at all. It lets a
 * page that is rendered outside the shell (or under a test) keep drawing its own
 * toolbar instead of hiding it and waiting for a slot that will never exist.
 * `element` is null until the status bar has mounted the slot's DOM node.
 */
export interface PosModeToolbarSlot {
  available: boolean;
  element: HTMLElement | null;
}

export const PosModeToolbarSlotContext = createContext<PosModeToolbarSlot>({
  available: false,
  element: null,
});

export function usePosModeToolbarSlot(): PosModeToolbarSlot {
  return useContext(PosModeToolbarSlotContext);
}
