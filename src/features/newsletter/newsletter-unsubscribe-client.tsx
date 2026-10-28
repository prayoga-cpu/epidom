"use client";

import { useState } from "react";
import { CheckCircle2, MailX, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";

export function NewsletterUnsubscribeClient({
  token,
  email,
}: {
  /** Null when the link's token didn't verify. */
  token: string | null;
  email: string | null;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");

  async function unsubscribe() {
    if (!token) return;
    setState("working");
    try {
      const res = await fetch("/api/public/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  const withEmail = (key: string) => t(key).replace("{email}", email ?? "");

  return (
    <div className="flex min-h-[calc(100dvh/var(--app-zoom,1))] items-center justify-center px-4 py-12">
      <div className="bg-card w-full max-w-md space-y-5 rounded-2xl border p-6 text-center shadow-sm sm:p-8">
        <p className="text-lg font-extrabold tracking-[0.2em]">EPIDOM</p>

        {!token ? (
          <>
            <TriangleAlert className="text-muted-foreground mx-auto size-10" />
            <h1 className="text-xl font-semibold">{t("newsletterUnsubscribe.invalidTitle")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("newsletterUnsubscribe.invalidDescription")}
            </p>
          </>
        ) : state === "done" ? (
          <>
            <CheckCircle2 className="mx-auto size-10 text-green-600" />
            <h1 className="text-xl font-semibold">{t("newsletterUnsubscribe.doneTitle")}</h1>
            <p className="text-muted-foreground text-sm break-words">
              {withEmail("newsletterUnsubscribe.doneDescription")}
            </p>
          </>
        ) : (
          <>
            <MailX className="text-muted-foreground mx-auto size-10" />
            <h1 className="text-xl font-semibold">{t("newsletterUnsubscribe.title")}</h1>
            <p className="text-muted-foreground text-sm break-words">
              {withEmail("newsletterUnsubscribe.description")}
            </p>
            {state === "error" && (
              <p className="text-destructive text-sm">{t("newsletterUnsubscribe.error")}</p>
            )}
            <Button
              size="lg"
              className="w-full"
              onClick={unsubscribe}
              disabled={state === "working"}
            >
              {state === "working"
                ? t("newsletterUnsubscribe.working")
                : t("newsletterUnsubscribe.confirm")}
            </Button>
          </>
        )}

        <a
          href="https://epidom.fr"
          className="text-muted-foreground inline-block py-2 text-sm underline"
        >
          {t("newsletterUnsubscribe.backHome")}
        </a>
      </div>
    </div>
  );
}
