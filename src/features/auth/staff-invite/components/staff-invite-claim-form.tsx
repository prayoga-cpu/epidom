"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EpidomWordmark } from "@/features/marketing/shared/components/epidom-logo";
import { useI18n } from "@/components/lang/i18n-provider";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { authClient, signOut, useUser } from "@/lib/auth-client";

type LookupResult =
  | {
      state: "valid";
      staffName: string;
      storeName: string;
      maskedEmail: string;
      hasExistingAccount: boolean;
    }
  | { state: "not_found" | "expired" | "consumed" | "unavailable" };

/** Where a freshly linked staffer lands; /go resolves their store and first allowed POS page. */
const AFTER_CLAIM_PATH = "/go/pos";

const MIN_PASSWORD_LENGTH = 8;

function claimFailureReason(err: unknown): { reason?: string; maskedEmail?: string } {
  if (!(err instanceof ApiClientError)) return {};
  const details = err.response.error.details;
  if (!details || Array.isArray(details)) return {};
  return {
    reason: typeof details.reason === "string" ? details.reason : undefined,
    maskedEmail: typeof details.maskedEmail === "string" ? details.maskedEmail : undefined,
  };
}

/** A failure that means the link itself is dead, mapped to the state the page shows for it. */
function deadLinkState(reason: string | undefined): "not_found" | "expired" | "consumed" | "unavailable" | null {
  switch (reason) {
    case "invalid":
      return "not_found";
    case "expired":
    case "consumed":
    case "unavailable":
      return reason;
    case "already_linked":
      return "consumed";
    default:
      return null;
  }
}

/**
 * The page behind the emailed staff sign-in link. Public (see src/proxy.ts) and
 * works in every auth state:
 *  - the invited email has no account yet -> choose a password, we create it
 *    (the link click is the email verification) and sign you straight in;
 *  - it already has one -> sign in with THAT account, then explicitly link it.
 *    The server refuses a signed-in account whose email isn't the invited one,
 *    so a link that reaches the wrong person can't be used to attach their
 *    account to someone else's staff profile.
 * The token only ever travels in POST bodies from here on.
 */
export function StaffInviteClaimForm({ token }: { token: string | null }) {
  const { t } = useI18n();
  const { user, loading: sessionLoading } = useUser();

  const [lookup, setLookup] = useState<LookupResult | null>(token ? null : { state: "not_found" });
  const [lookupFailed, setLookupFailed] = useState(false);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [busy, setBusy] = useState<"creating" | "signing-in" | "linking" | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [wrongAccountFor, setWrongAccountFor] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiClient
      .post<LookupResult>("/staff-invite/lookup", { token })
      .then((result) => {
        if (cancelled) return;
        setLookup(result);
        if (result.state === "valid") setName((prev) => prev || result.staffName);
      })
      .catch(() => {
        if (!cancelled) setLookupFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const claimPath = `/staff-invite?token=${encodeURIComponent(token ?? "")}`;
  const loginHref = `/login?next=${encodeURIComponent(claimPath)}`;

  const goToStaffHome = () => {
    // Full navigation: the session and the store's access rules both just changed.
    window.location.href = AFTER_CLAIM_PATH;
  };

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || lookup?.state !== "valid") return;
    setClaimError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(t("pages.staffInvitePasswordHint"));
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError(t("pages.staffInvitePasswordMismatch"));
      return;
    }
    setPasswordError(null);

    setBusy("creating");
    try {
      const { email } = await apiClient.post<{ linked: true; email: string }>(
        "/staff-invite/complete",
        { token, password, name: name.trim() || undefined }
      );

      setBusy("signing-in");
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        // The account exists and is linked; only the automatic sign-in failed.
        toast.error(error.message || t("pages.staffInviteClaimFailed"));
        window.location.href = "/login";
        return;
      }
      toast.success(t("pages.staffInviteLinkedToast"));
      goToStaffHome();
    } catch (err) {
      const { reason } = claimFailureReason(err);
      const dead = deadLinkState(reason);
      if (reason === "account_exists") {
        // An account for this email appeared after the page loaded — fall back
        // to the sign-in-and-link path instead of showing a dead end.
        setLookup((prev) => (prev?.state === "valid" ? { ...prev, hasExistingAccount: true } : prev));
      } else if (dead) {
        setLookup({ state: dead });
      } else {
        setClaimError(err instanceof Error ? err.message : t("pages.staffInviteClaimFailed"));
      }
      setBusy(null);
    }
  };

  const handleLinkAccount = async () => {
    if (!token) return;
    setBusy("linking");
    setClaimError(null);
    setWrongAccountFor(null);
    try {
      await apiClient.post("/staff-invite/complete", { token });
      toast.success(t("pages.staffInviteLinkedToast"));
      goToStaffHome();
    } catch (err) {
      const { reason, maskedEmail } = claimFailureReason(err);
      const dead = deadLinkState(reason);
      if (reason === "email_mismatch") {
        setWrongAccountFor(maskedEmail ?? "");
      } else if (dead) {
        setLookup({ state: dead });
      } else {
        setClaimError(err instanceof Error ? err.message : t("pages.staffInviteClaimFailed"));
      }
      setBusy(null);
    }
  };

  const handleSwitchAccount = async () => {
    await signOut();
    window.location.href = loginHref;
  };

  const invite = lookup?.state === "valid" ? lookup : null;

  let body: React.ReactNode;
  if (lookupFailed) {
    body = (
      <InvalidBody
        message={t("pages.staffInviteLoadFailed")}
        cta={t("pages.staffInviteContinueToEpidom")}
      />
    );
  } else if (lookup && !invite) {
    const messages = {
      not_found: t("pages.staffInviteInvalid"),
      expired: t("pages.staffInviteExpired"),
      consumed: t("pages.staffInviteConsumed"),
      unavailable: t("pages.staffInviteUnavailable"),
    } as const;
    body = (
      <InvalidBody
        message={messages[lookup.state as keyof typeof messages]}
        cta={t("pages.staffInviteContinueToEpidom")}
      />
    );
  } else if (!invite || sessionLoading) {
    body = (
      <CardContent className="flex justify-center py-8">
        <Loader2
          className="text-muted-foreground h-8 w-8 animate-spin"
          aria-label={t("common.loading")}
        />
      </CardContent>
    );
  } else {
    body = (
      <CardContent className="space-y-5">
        <p className="text-sm">
          {t("pages.staffInviteClaimIntro")
            .replace("{name}", invite.staffName)
            .replace("{store}", invite.storeName)}
        </p>
        <p className="text-muted-foreground text-sm break-words">
          {t("pages.staffInviteSentTo").replace("{email}", invite.maskedEmail)}
        </p>

        {!invite.hasExistingAccount ? (
          <form onSubmit={handleCreateAccount} className="space-y-4" noValidate>
            <p className="text-muted-foreground text-sm">{t("pages.staffInviteCreatePrompt")}</p>
            {user && (
              <p className="text-sm text-amber-600" role="status">
                {t("pages.staffInviteSessionSwitchNote").replace("{current}", user.email ?? "")}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="staff-invite-name">{t("pages.staffInviteNameLabel")}</Label>
              <Input
                id="staff-invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                disabled={busy !== null}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-invite-password">{t("pages.staffInvitePasswordLabel")}</Label>
              <Input
                id="staff-invite-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={busy !== null}
                className="h-11"
              />
              <p className="text-muted-foreground text-xs">{t("pages.staffInvitePasswordHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-invite-confirm">
                {t("pages.staffInviteConfirmPasswordLabel")}
              </Label>
              <Input
                id="staff-invite-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={busy !== null}
                className="h-11"
              />
            </div>
            {passwordError && (
              <p className="text-destructive text-sm" role="alert">
                {passwordError}
              </p>
            )}
            {claimError && (
              <p className="text-destructive text-sm" role="alert">
                {claimError}
              </p>
            )}
            <Button type="submit" className="h-11 w-full" disabled={busy !== null}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {busy === "signing-in"
                    ? t("pages.staffInviteSigningIn")
                    : t("pages.staffInviteCreating")}
                </>
              ) : (
                t("pages.staffInviteCreateAccount")
              )}
            </Button>
          </form>
        ) : !user ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {t("pages.staffInviteExistingPrompt").replace("{email}", invite.maskedEmail)}
            </p>
            <Button asChild className="h-11 w-full">
              <Link href={loginHref}>{t("pages.staffInviteSignInToLink")}</Link>
            </Button>
          </div>
        ) : wrongAccountFor !== null ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-600" role="alert">
              {t("pages.staffInviteWrongAccount")
                .replace("{current}", user.email ?? "")
                .replace("{email}", wrongAccountFor || invite.maskedEmail)}
            </p>
            <Button variant="outline" className="h-11 w-full" onClick={handleSwitchAccount}>
              {t("pages.staffInviteSwitchAccount")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              {t("pages.staffInviteLinkPrompt")
                .replace("{current}", user.email ?? "")
                .replace("{store}", invite.storeName)}
            </p>
            {user.emailVerified === false && (
              <p className="text-sm text-amber-600" role="alert">
                {t("pages.staffInviteUnverified")}
              </p>
            )}
            {claimError && (
              <p className="text-destructive text-sm" role="alert">
                {claimError}
              </p>
            )}
            <Button
              className="h-11 w-full"
              onClick={handleLinkAccount}
              disabled={busy !== null || user.emailVerified === false}
            >
              {busy === "linking" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("pages.staffInviteLinking")}
                </>
              ) : (
                t("pages.staffInviteLinkAccount")
              )}
            </Button>
            <Button
              variant="ghost"
              className="h-10 w-full"
              onClick={handleSwitchAccount}
              disabled={busy !== null}
            >
              {t("pages.staffInviteSwitchAccount")}
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
            <UserCheck className="h-6 w-6" aria-hidden />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {t("pages.staffInviteClaimTitle")}
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

function InvalidBody({ message, cta }: { message: string; cta: string }) {
  return (
    <CardContent className="space-y-4">
      <p className="text-muted-foreground flex items-start gap-2 text-sm" role="alert">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        {message}
      </p>
      <Button asChild variant="outline" className="h-11 w-full">
        <Link href="/login">{cta}</Link>
      </Button>
    </CardContent>
  );
}
