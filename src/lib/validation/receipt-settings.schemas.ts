import { z } from "zod";

/**
 * Store-level receipt branding / WhatsApp auto-send settings validation.
 */
export const updateReceiptSettingsSchema = z.object({
  footerMessage: z.string().max(300, "Footer message is too long").optional(),
  facebookUrl: z.string().max(200, "Facebook handle/URL is too long").optional(),
  showSocialLinks: z.boolean().optional(),
  autoSendWhatsappReceipt: z.boolean().optional(),
});

export type UpdateReceiptSettingsInput = z.infer<typeof updateReceiptSettingsSchema>;
