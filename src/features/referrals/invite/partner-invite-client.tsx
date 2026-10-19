"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Handshake, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EpidomWordmark } from "@/features/marketing/shared/components/epidom-logo";
import { useI18n } from "@/components/lang/i18n-provider";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { signOut, useUser } from "@/lib/auth-client";
import { PARTNER_PAGE_PATH } from "@/config/admin-sections.config";

interface InviteDetails {
  displayName: string;
  email: string;
  commissionRate: number;
  commissionMonths: number;
  hasReferralLink: boolean;
  customerDiscountPercent: number;
  salesPages: string[];
}

type LookupError = "invalid" | "expired" | "failed";

/**
 * The page behind the emailed "Open my partner page" link. Public (src/proxy.ts):
 * signed out, it shows the deal and sign-up / sign-in with this link kept
 * (`?next=`, which survives email verification and Google sign-up); signed in
 * as another account, it offers to switch; signed in as the invited, verified
 * address, it links the partner at once and opens the partner page.
 */
export function PartnerInviteClient({ token }: { token: string | null }) {
  const { t } = useI18n();
  const { user, loading: sessionLoading } = useUser();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [lookupError, setLookupError] = useState<LookupError | null>(token ? null : "invalid");
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const accepting = useRef(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiClient
      .post<InviteDetails>("/partner-invite/lookup", { token })
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

  const signedInEmail = user?.email?.trim().toLowerCase() ?? null;
  const rightAccount = !!invite && !!signedInEmail && signedInEmail === invite.email;
  const verified = !!user && user.emailVerified !== false;

  // The right account, verified: link it now and open the partner page.
  useEffect(() => {
    if (!token || !rightAccount || !verified || accepting.current) return;
    accepting.current = true;
    apiClient
      .post<{ partnerId: string }>("/partner-invite/accept", { token })
      .then(() => {
        // Full navigation: the account's admin access just changed.
        window.location.href = PARTNER_PAGE_PATH;
      })
      .catch((err: unknown) => {
        accepting.current = false;
        setAcceptError(err instanceof Error ? err.message : t("partnerInvite.acceptFailed"));
      });
  }, [token, rightAccount, verified, t]);

  const next = encodeURIComponent(`/partner-invite?token=${token ?? ""}`);
  const emailParam = invite ? `&email=${encodeURIComponent(invite.email)}` : "";

  let body: React.ReactNode;
  if (lookupError) {
    const message =
      lookupError === "expired"
        ? t("partnerInvite.expired")
        : lookupError === "invalid"
          ? t("partnerInvite.invalid")
          : t("partnerInvite.loadFailed");
    body = (
      <CardContent className="space-y-4">
        <p className="text-muted-foreground flex items-start gap-2 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          {message}
        </p>
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href="/">{t("partnerInvite.home")}</Link>
        </Button>
      </CardContent>
    );
  } else if (!invite || sessionLoading || (rightAccount && verified && !acceptError)) {
    body = (
      <CardContent className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" aria-hidden />
        {rightAccount && verified && (
          <p className="text-muted-foreground text-sm">{t("partnerInvite.settingUp")}</p>
        )}
      </CardContent>
    );
  } else {
    const deal = t(
      invite.commissionMonths === 1 ? "partnerPortal.dealOneMonth" : "partnerPortal.deal"
    )
      .replace("{rate}", String(invite.commissionRate))
      .replace("{months}", String(invite.commissionMonths));
    body = (
      <CardContent className="space-y-5">
        <p className="text-sm">{t("partnerInvite.intro").replace("{name}", invite.displayName)}</p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
          <li>{deal}</li>
          {invite.salesPages.map((page) => (
            <li key={page}>
              {t("partnerInvite.ownsPage").replace("{n}", page.replace("sales-page-", ""))}
            </li>
          ))}
          {invite.hasReferralLink && invite.customerDiscountPercent > 0 && (
            <li>
              {t("partnerPortal.dealDiscount").replace(
                "{discount}",
                String(invite.customerDiscountPercent)
              )}
            </li>
          )}
        </ul>
        <p className="text-muted-foreground text-sm break-words">
          {t("partnerInvite.sentTo").replace("{email}", invite.email)}
        </p>

        {!user ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="h-11 flex-1">
              <Link href={`/register?next=${next}${emailParam}`}>
                {t("partnerInvite.createAccount")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 flex-1">
              <Link href={`/login?next=${next}`}>{t("partnerInvite.signIn")}</Link>
            </Button>
          </div>
        ) : !rightAccount ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-600" role="alert">
              {t("partnerInvite.wrongAccount")
                .replace("{current}", user.email ?? "")
                .replace("{email}", invite.email)}
            </p>
            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={async () => {
                await signOut();
                window.location.href = `/login?next=${next}`;
              }}
            >
              {t("partnerInvite.switchAccount")}
            </Button>
          </div>
        ) : !verified ? (
          <p className="text-sm text-amber-600" role="alert">
            {t("partnerInvite.verifyEmail")}
          </p>
        ) : (
          acceptError && (
            <p className="text-destructive text-sm" role="alert">
              {acceptError}
            </p>
          )
        )}
      </CardContent>
    );
  }

  return (
    <div className="bg-background flex min-h-[calc(100dvh/var(--app-zoom,1))] w-full items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
            <Handshake className="h-6 w-6" aria-hidden />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {t("partnerInvite.title")}
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
