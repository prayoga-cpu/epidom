// Stub for future WhatsApp Business API migration from Fonnte.
// Fonnte uses an unofficial bridge; this will replace it when the
// official API is approved (Meta Partner Program).

export interface WabaMessageRequest {
  to: string;
  templateName: string;
  templateParams: string[];
  languageCode?: string;
}

export function isWabaAvailable(): boolean {
  return (
    !!process.env.WABA_PHONE_NUMBER_ID && !!process.env.WABA_ACCESS_TOKEN
  );
}

export async function sendWabaTemplate(
  _req: WabaMessageRequest
): Promise<void> {
  throw new Error("WhatsApp Business API is not yet active. Use Fonnte provider.");
}
