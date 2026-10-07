import { z } from "zod";

/**
 * Store-level receipt branding / WhatsApp auto-send settings validation.
 */
export const updateReceiptSettingsSchema = z.object({
  footerMessage: z.string().max(300, "Footer message is too long").optional(),
  facebookUrl: z.string().max(200, "Facebook handle/URL is too long").optional(),
  showSocialLinks: z.boolean().optional(),
  autoSendWhatsappReceipt: z.boolean().optional(),
  // A WiFi network name is at most 32 bytes and a WPA passphrase at most 63
  // characters; the limits leave a little room for how merchants type them.
  wifiName: z.string().trim().max(64, "WiFi name is too long").optional(),
  wifiPassword: z.string().max(100, "WiFi password is too long").optional(),
  showWifiOnReceipt: z.boolean().optional(),
});

export type UpdateReceiptSettingsInput = z.infer<typeof updateReceiptSettingsSchema>;
