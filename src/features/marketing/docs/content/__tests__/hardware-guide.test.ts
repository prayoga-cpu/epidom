/**
 * The public hardware guide must match what the till does on an iPad. Safari
 * has no Web Bluetooth, and receipts, kitchen/bar tickets and labels only print
 * over Bluetooth (usePrintReceipt / usePrintOrder refuse with a toast). Only the
 * shift report (after a shift ends) and a past receipt's page open the
 * system print dialog.
 */
import { describe, expect, it } from "vitest";
import type { Article } from "@/features/marketing/shared/content/article-types";
import { HELP_GUIDE_SLUGS } from "@/features/guide/lib/help-guides";
import { getDocsGuide } from "../index";

const HARDWARE_SLUGS = HELP_GUIDE_SLUGS["hardware-printers-and-scanner"];

function guideText(article: Article): string {
  return article.blocks
    .map((block) => {
      const b = block as { text?: string; items?: string[] };
      return [b.text ?? "", ...(b.items ?? [])].join("\n");
    })
    .join("\n");
}

describe("hardware guide — what an iPad can print", () => {
  it.each((["en", "fr", "id"] as const).map((locale) => [locale, HARDWARE_SLUGS[locale]] as const))(
    "%s: says receipts, tickets and labels need Bluetooth, and names only the real print-dialog paths",
    (locale, slug) => {
      const article = getDocsGuide(locale, slug);
      expect(article, `${locale} guide ${slug}`).toBeDefined();
      const text = guideText(article!);

      const checks = {
        en: {
          limit: /An iPad can't send receipts, kitchen or bar tickets, or labels to a printer/,
          dialog: /shift report in the print dialog/,
          receipt: /View Receipt/,
          stale: /on an iPad, printing goes through the print dialog/i,
        },
        fr: {
          limit: /Un iPad ne peut pas envoyer les reçus, les bons cuisine et bar ni les étiquettes/,
          dialog: /rapport de quart dans la fenêtre d'impression/,
          receipt: /Journal de la File de commandes/,
          stale: /sur iPad, l'impression passe par la fenêtre d'impression/i,
        },
        id: {
          limit: /iPad tidak bisa mengirim struk, tiket dapur dan bar, maupun label/,
          dialog: /laporan sif di dialog cetak/,
          receipt: /Lihat Struk/,
          stale: /di iPad, cetak lewat dialog cetak/i,
        },
      }[locale];

      expect(text).toMatch(checks.limit);
      expect(text).toMatch(checks.dialog);
      expect(text).toMatch(checks.receipt);
      expect(text).not.toMatch(checks.stale);
    }
  );
});
