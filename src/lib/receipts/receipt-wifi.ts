import type { ReceiptData } from "@/lib/pwa/thermal-printer";

interface WifiSettings {
  wifiName?: string | null;
  wifiPassword?: string | null;
  showWifiOnReceipt?: boolean | null;
}

/**
 * The guest-WiFi lines of a CUSTOMER receipt: nothing unless the store has
 * filled in a network name and left "show on receipt" on. One function so the
 * POS checkout (client-built receipt), the server builder (reprints, the
 * /r/[orderId] link, WhatsApp/email) and the settings preview can never
 * disagree about when WiFi prints. The renderers themselves leave it off a
 * pre-payment bill.
 */
export function receiptWifiFields(
  settings: WifiSettings | null | undefined
): Pick<ReceiptData, "wifiName" | "wifiPassword"> {
  const wifiName = settings?.wifiName?.trim();
  if (!wifiName || settings?.showWifiOnReceipt === false) return {};
  const wifiPassword = settings?.wifiPassword?.trim();
  return wifiPassword ? { wifiName, wifiPassword } : { wifiName };
}
