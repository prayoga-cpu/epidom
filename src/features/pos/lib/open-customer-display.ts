import { customerDisplayPath } from "./customer-display";

/** Named so a second tap reuses the existing display window rather than
 * opening a second one, and so the browser remembers where the operator
 * dragged it. Note this *navigates* (reloads) that window rather than merely
 * focusing it — harmless here, since the display rebuilds its state from the
 * localStorage mirror on mount. */
export const CUSTOMER_DISPLAY_WINDOW_NAME = "epidom-customer-display";

interface ScreenDetail {
  left: number;
  top: number;
  availWidth: number;
  availHeight: number;
  isPrimary: boolean;
}

/**
 * Best-effort placement onto the till's second monitor via the Window
 * Management API (Chrome/Edge). Purely an enhancement: the API is absent on
 * Safari/Firefox and the permission can be denied, in which case the popup
 * simply stays where it opened and the operator drags it across once.
 */
async function placeOnSecondaryScreen(target: Window): Promise<void> {
  try {
    const getScreenDetails = (
      window as Window & {
        getScreenDetails?: () => Promise<{ screens: ScreenDetail[] }>;
      }
    ).getScreenDetails;
    if (typeof getScreenDetails !== "function") return;

    const details = await getScreenDetails.call(window);
    const secondary = details.screens?.find((screen) => !screen.isPrimary);
    if (!secondary) return;

    target.moveTo(secondary.left, secondary.top);
    target.resizeTo(secondary.availWidth, secondary.availHeight);
  } catch {
    // Unsupported, denied, or the window was closed before we got here.
  }
}

/**
 * Opens the customer-facing display for a store.
 *
 * The window is opened synchronously — awaiting the screen lookup first would
 * spend the click's user activation and get the popup blocked — and only then
 * nudged onto the second screen.
 */
export function openCustomerDisplay(storeId: string): Window | null {
  if (typeof window === "undefined") return null;

  const target = window.open(
    customerDisplayPath(storeId),
    CUSTOMER_DISPLAY_WINDOW_NAME,
    "popup=yes,width=1280,height=800"
  );
  if (!target) return null;

  void placeOnSecondaryScreen(target);
  target.focus();
  return target;
}
