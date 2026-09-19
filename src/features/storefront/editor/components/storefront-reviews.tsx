"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Link2Off, Loader2, MapPin, QrCode, Star } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { storefrontApi } from "@/lib/api";
import { ApiClientError } from "@/lib/api/client";
import type { UpdateGoogleReviewInput } from "@/lib/validation/storefront.schemas";
import {
  parseGoogleReviewInput,
  resolveGoogleLinks,
  type GoogleLinkFailure,
} from "@/lib/utils/google-review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/ui/use-confirm";
import { QrCodeDialog } from "@/components/shared/qr-code-dialog";

const PLACE_ID_FINDER_URL =
  "https://developers.google.com/maps/documentation/places/web-service/place-id";

export interface StorefrontReviewsData {
  displayName?: string;
  isPublished?: boolean;
  googleMapsUrl?: string | null;
  googlePlaceId?: string | null;
  googleReviewUrl?: string | null;
  googleReviewEnabled?: boolean;
}

interface StorefrontReviewsProps {
  storeId: string;
  storefront: StorefrontReviewsData | undefined;
  /** Refetch the storefront. Awaited, so the switch never flickers back to stale state. */
  onSaved: () => Promise<unknown> | void;
}

const FAILURE_KEY: Record<GoogleLinkFailure, string> = {
  empty: "storefront.reviews.errors.empty",
  invalid: "storefront.reviews.errors.invalid",
  mapsListing: "storefront.reviews.errors.mapsListing",
};

export function StorefrontReviews({ storeId, storefront, onSaved }: StorefrontReviewsProps) {
  const { t } = useI18n();
  const { confirm, confirmDialog } = useConfirm();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const save = useMutation({
    mutationFn: async (input: UpdateGoogleReviewInput) => {
      const result = await storefrontApi.updateGoogleReview(storeId, input);
      await onSaved();
      return result;
    },
  });

  const source = {
    displayName: storefront?.displayName ?? "",
    googleMapsUrl: storefront?.googleMapsUrl ?? null,
    googlePlaceId: storefront?.googlePlaceId ?? null,
    googleReviewUrl: storefront?.googleReviewUrl ?? null,
    googleReviewEnabled: storefront?.googleReviewEnabled ?? true,
  };
  // The stored link regardless of the pause switch — pausing must never look
  // like disconnecting.
  const reviewUrl = resolveGoogleLinks({ ...source, googleReviewEnabled: true }).reviewUrl;
  const { mapsUrl } = resolveGoogleLinks(source);
  const hasManualMapsUrl = Boolean(source.googleMapsUrl?.trim());
  const isConnected = reviewUrl !== null;

  // Show the value being saved while the request (and refetch) is in flight.
  const enabled =
    save.isPending && save.variables?.enabled !== undefined
      ? save.variables.enabled
      : source.googleReviewEnabled;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    // Instant, translated feedback. The server re-parses the same paste and
    // is the authority — this only saves a round trip.
    const parsed = parseGoogleReviewInput(link);
    if (!parsed.ok) {
      setError(t(FAILURE_KEY[parsed.reason]));
      return;
    }
    setError(null);
    try {
      await save.mutateAsync({ link });
      toast.success(t("storefront.reviews.toast.connected"));
      setLink("");
      setEditing(false);
    } catch (err) {
      const details =
        err instanceof ApiClientError
          ? (err.response.error.details as { reason?: string } | undefined)
          : undefined;
      if (details?.reason === "invalid" || details?.reason === "mapsListing") {
        setError(t(FAILURE_KEY[details.reason]));
      } else {
        toast.error(t("storefront.reviews.toast.saveFailed"));
      }
    }
  };

  const handleToggle = async (checked: boolean) => {
    try {
      await save.mutateAsync({ enabled: checked });
      toast.success(
        t(checked ? "storefront.reviews.toast.promptsOn" : "storefront.reviews.toast.promptsOff")
      );
    } catch {
      toast.error(t("storefront.reviews.toast.saveFailed"));
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: t("storefront.reviews.disconnectTitle"),
      description: t("storefront.reviews.disconnectDesc"),
      confirmText: t("storefront.reviews.disconnect"),
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await save.mutateAsync({ link: "" });
      toast.success(t("storefront.reviews.toast.disconnected"));
      setEditing(false);
    } catch {
      toast.error(t("storefront.reviews.toast.saveFailed"));
    }
  };

  const showForm = !isConnected || editing;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Star className="size-5" />
              {t("storefront.reviews.title")}
            </CardTitle>
            {isConnected && (
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              >
                {t("storefront.reviews.connected")}
              </Badge>
            )}
          </div>
          <CardDescription>{t("storefront.reviews.subtitle")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {isConnected && !editing && reviewUrl && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="google-review-current">{t("storefront.reviews.currentLink")}</Label>
                <Input
                  id="google-review-current"
                  readOnly
                  value={reviewUrl}
                  onClick={(e) => e.currentTarget.select()}
                  className="bg-muted text-muted-foreground min-w-0 cursor-text"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button asChild variant="outline" className="min-h-10">
                  <a href={reviewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" />
                    {t("storefront.reviews.testLink")}
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10"
                  onClick={() => setShowQr(true)}
                >
                  <QrCode className="size-4" />
                  {t("storefront.reviews.showQr")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10"
                  onClick={() => setEditing(true)}
                >
                  {t("storefront.reviews.change")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive min-h-10"
                  disabled={save.isPending}
                  onClick={handleDisconnect}
                >
                  <Link2Off className="size-4" />
                  {t("storefront.reviews.disconnect")}
                </Button>
              </div>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleConnect} className="space-y-3" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="google-review-link">{t("storefront.reviews.linkLabel")}</Label>
                <Input
                  id="google-review-link"
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={t("storefront.reviews.linkPlaceholder")}
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="google-review-link-hint"
                />
                {error ? (
                  <p id="google-review-link-hint" role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                ) : (
                  <p id="google-review-link-hint" className="text-muted-foreground text-sm">
                    {t("storefront.reviews.linkHelp")}
                  </p>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="submit" className="min-h-10" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="size-4 animate-spin" />}
                  {save.isPending
                    ? t("storefront.reviews.connecting")
                    : t("storefront.reviews.connect")}
                </Button>
                {editing && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-10"
                    onClick={() => {
                      setEditing(false);
                      setLink("");
                      setError(null);
                    }}
                  >
                    {t("common.actions.cancel")}
                  </Button>
                )}
              </div>
            </form>
          )}

          {showForm && (
            <div className="bg-muted/40 rounded-lg border p-4 text-sm">
              <p className="font-medium">{t("storefront.reviews.howTitle")}</p>
              <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5">
                <li>{t("storefront.reviews.howStep1")}</li>
                <li>{t("storefront.reviews.howStep2")}</li>
                <li>{t("storefront.reviews.howStep3")}</li>
              </ol>
              <p className="text-muted-foreground mt-3 text-xs">
                {t("storefront.reviews.howAlt")}{" "}
                <a
                  href={PLACE_ID_FINDER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium underline underline-offset-2"
                >
                  {t("storefront.reviews.howPlaceIdLink")}
                </a>
              </p>
            </div>
          )}

          <p className="text-muted-foreground text-xs">{t("storefront.reviews.policyNote")}</p>
        </CardContent>
      </Card>

      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>{t("storefront.reviews.appearsTitle")}</CardTitle>
            <CardDescription>{t("storefront.reviews.appearsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {storefront?.isPublished === false && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                {t("storefront.reviews.unpublishedNote")}
              </p>
            )}

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="google-review-enabled" className="text-base font-semibold">
                  {t("storefront.reviews.showPrompts")}
                </Label>
                <p className="text-muted-foreground text-sm">
                  {t("storefront.reviews.showPromptsDesc")}
                </p>
              </div>
              <Switch
                id="google-review-enabled"
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={save.isPending}
              />
            </div>

            <div className="flex items-start gap-3 border-t pt-4">
              <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold">{t("storefront.reviews.mapsLinkTitle")}</p>
                <p className="text-muted-foreground text-sm">
                  {mapsUrl
                    ? hasManualMapsUrl
                      ? t("storefront.reviews.mapsLinkManual")
                      : t("storefront.reviews.mapsLinkAuto")
                    : t("storefront.reviews.mapsLinkNone")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {reviewUrl && (
        <QrCodeDialog
          open={showQr}
          onOpenChange={setShowQr}
          value={reviewUrl}
          title={t("storefront.reviews.qrTitle")}
          description={t("storefront.reviews.qrDesc")}
          filename="google-review-qr.png"
        />
      )}

      {confirmDialog}
    </div>
  );
}
