"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EpidomWordmark } from "@/features/marketing/shared/components/epidom-logo";
import { useI18n } from "@/components/lang/i18n-provider";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { signOut, useUser } from "@/lib/auth-client";

interface InviteDetails {
  storeName: string;
  toEmail: string;
  fromName: string | null;
  storeTimezone: string;
  expiresAt: string;
}

type LookupError = "invalid" | "expired" | "failed";

/**
 * The page behind the emailed "Review & Accept Transfer" link. Works in every
 * auth state (it's a public route — see src/proxy.ts): signed out shows what's
 * being offered plus sign-in / sign-up with this link preserved; signed in as
 * the wrong account explains and offers to switch; signed in as the invited
 * address shows the consequences and the Accept button. The token only ever
 * travels in POST bodies from here on.
 */
export function AcceptTransferClient({ token }: { token: string | null }) {
  const { t } = useI18n();
  const { user, loading: sessionLoading } = useUser();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [lookupError, setLookupError] = useState<LookupError | null>(token ? null : "invalid");
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiClient
      .post<InviteDetails>("/transfer-ownership/lookup", { token })
      .then((details) => {
        if (!cancelled) setInvite(details);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 410) setLookupError("expired");
        else if (err instanceof ApiClientError && err.status === 404) setLookupError("invalid");
        else setLookupError("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const acceptPath = `/transfer-ownership/accept?token=${token ?? ""}`;
  const next = encodeURIComponent(acceptPath);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const { storeId } = await apiClient.post<{ storeId: string }>("/transfer-ownership/accept", {
        token,
      });
      toast.success(t("pages.storeTransferAccepted").replace("{store}", invite?.storeName ?? ""));
      // Full navigation, not a client transition: the session's ownership of
      // this store just changed underneath every cached server render.
      window.location.href = `/store/${storeId}/dashboard`;
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : t("pages.storeTransferAcceptFailed"));
      setAccepting(false);
    }
  };

  const handleSwitchAccount = async () => {
    await signOut();
    window.location.href = `/login?next=${next}`;
  };

  const fromName = invite?.fromName || t("pages.storeTransferFromFallback");
  const signedInEmail = user?.email?.trim().toLowerCase() ?? null;
  const wrongAccount = !!invite && !!signedInEmail && signedInEmail !== invite.toEmail;
  const unverified = !!user && user.emailVerified === false;

  let body: React.ReactNode;
  if (lookupError) {
    const message =
      lookupError === "expired"
        ? t("pages.storeTransferExpired")
        : lookupError === "invalid"
          ? t("pages.storeTransferInvalid")
          : t("pages.storeTransferLoadFailed");
    body = (
      <CardContent className="space-y-4">
        <p className="text-muted-foreground flex items-start gap-2 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          {message}
        </p>
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href="/stores">{t("pages.storeTransferGoToStores")}</Link>
        </Button>
      </CardContent>
    );
  } else if (!invite || sessionLoading) {
    body = (
      <CardContent className="flex justify-center py-8">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" aria-label={t("common.loading")} />
      </CardContent>
    );
  } else {
    body = (
      <CardContent className="space-y-5">
        <p className="text-sm">
          {t("pages.storeTransferAcceptIntro")
            .replace("{name}", fromName)
            .replace("{store}", invite.storeName)}
        </p>
        <p className="text-muted-foreground text-sm break-words">
          {t("pages.storeTransferSentTo").replace("{email}", invite.toEmail)}
        </p>

        {!user ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">{t("pages.storeTransferSignInPrompt")}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="h-11 flex-1">
                <Link href={`/login?next=${next}`}>{t("pages.storeTransferSignIn")}</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 flex-1">
                <Link href={`/register?next=${next}`}>{t("pages.storeTransferCreateAccount")}</Link>
              </Button>
            </div>
          </div>
        ) : wrongAccount ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-600" role="alert">
              {t("pages.storeTransferWrongAccount")
                .replace("{current}", user.email ?? "")
                .replace("{email}", invite.toEmail)}
            </p>
            <Button variant="outline" className="h-11 w-full" onClick={handleSwitchAccount}>
              {t("pages.storeTransferSwitchAccount")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("pages.storeTransferWhatHappens")}</p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                <li>{t("pages.storeTransferConsequenceOwner")}</li>
                <li>{t("pages.storeTransferConsequenceOldOwner")}</li>
                <li>{t("pages.storeTransferConsequencePlan")}</li>
                <li>{t("pages.storeTransferConsequencePin")}</li>
              </ul>
            </div>
            {unverified && (
              <p className="text-sm text-amber-600" role="alert">
                {t("pages.storeTransferVerifyEmail")}
              </p>
            )}
            {acceptError && (
              <p className="text-destructive text-sm" role="alert">
                {acceptError}
              </p>
            )}
            <Button className="h-11 w-full" onClick={handleAccept} disabled={accepting || unverified}>
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("pages.storeTransferAccepting")}
                </>
              ) : (
                t("pages.storeTransferAccept")
              )}
            </Button>
          </div>
        )}
      </CardContent>
    );
  }

  return (
    <div className="bg-background flex min-h-[calc(100dvh/var(--app-zoom,1))] w-full items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="bg-primary/10 text-primary mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <ArrowRightLeft className="h-6 w-6" aria-hidden />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {t("pages.storeTransferAcceptTitle")}
          </CardTitle>
          <CardDescription>
            <EpidomWordmark height={14} />
          </CardDescription>
        </CardHeader>
        {body}
      </Card>
    </div>
  );
}
