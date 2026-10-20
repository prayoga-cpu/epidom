import { z } from "zod";

export const newsletterSubscribeSchema = z.object({
  email: z.string().email().max(200).trim().toLowerCase(),
  source: z.enum(["footer", "sales_page_footer"]),
  page: z.string().max(40).optional(),
  locale: z.enum(["fr", "en", "id"]).default("fr"),
});

export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;
