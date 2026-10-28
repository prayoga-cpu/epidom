"use client";

import { useMemo } from "react";
import { renderNewsletterEmail, type NewsletterContentMode } from "@/lib/newsletter/render";

/**
 * The email exactly as the send renders it, in a sandboxed frame: no scripts
 * run and its styles can't leak into the admin page. The sandbox matters
 * because the HTML comes from whoever has the Newsletter page, and a full
 * admin may open it.
 */
export function NewsletterEmailPreview({
  subject,
  previewText,
  contentMode,
  contentHtml,
  locale,
}: {
  subject: string;
  previewText: string | null;
  contentMode: NewsletterContentMode;
  contentHtml: string;
  locale: string;
}) {
  const html = useMemo(
    () =>
      renderNewsletterEmail({
        subject,
        previewText,
        contentMode,
        contentHtml: contentHtml || "<p><em>Nothing written yet.</em></p>",
        locale,
        unsubscribeUrl: "#unsubscribe",
      }),
    [subject, previewText, contentMode, contentHtml, locale]
  );

  return (
    <div className="space-y-2">
      <div className="bg-muted/50 rounded-md border px-3 py-2 text-sm">
        <p className="truncate font-semibold">{subject || "(No subject)"}</p>
        {previewText && <p className="text-muted-foreground truncate text-xs">{previewText}</p>}
      </div>
      <iframe
        title="Email preview"
        sandbox=""
        srcDoc={html}
        className="h-[calc(70dvh/var(--app-zoom,1))] min-h-96 w-full rounded-md border bg-white"
      />
    </div>
  );
}
