"use client";

import React, { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateStorefrontSchema, UpdateStorefrontInput } from "@/lib/validation/storefront.schemas";
import { storefrontApi } from "@/lib/api";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  QrCode,
} from "lucide-react";
import { ImageUpload } from "@/components/shared/image-upload";
import { QrCodeDialog } from "@/components/shared/qr-code-dialog";
import { getPremiumTheme } from "@/lib/utils/color";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { useUpgradeGate } from "@/features/billing/upgrade/upgrade-modal";
import { planHasFeature, type PlanTier } from "@/lib/plans/entitlements";

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid_chars" | "too_short";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const emptyDayHours = { open: "", close: "", isClosed: false };

interface StorefrontSettingsProps {
  storeId: string;
  initialData: any;
  onSuccess: () => void;
}

function PosLockBadge() {
  return (
    <span className="bg-primary/10 text-primary ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[10px] font-semibold tracking-wide uppercase">
      <Lock className="h-2.5 w-2.5" /> POS
    </span>
  );
}

function PosUpgradeButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick} className="shrink-0">
      Upgrade to POS
    </Button>
  );
}

export function StorefrontSettings({ storeId, initialData, onSuccess }: StorefrontSettingsProps) {
  const { t } = useI18n();
  const { data: subData } = useSubscriptionStatus();
  const { openUpgrade } = useUpgradeGate();
  const currentPlan = (subData?.subscription?.plan as PlanTier) ?? "FREE";
  const hasPosFeatures = planHasFeature(currentPlan, "onlineOrders");
  const [isSaving, setIsSaving] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const slugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSlug = useRef<string>(initialData?.slug || "");

  const form = useForm<any>({
    resolver: zodResolver(updateStorefrontSchema),
    defaultValues: {
      slug: initialData?.slug || "",
      displayName: initialData?.displayName || "",
      tagline: initialData?.tagline || "",
      description: initialData?.description || "",
      logoUrl: initialData?.logoUrl || "",
      heroImageUrl: initialData?.heroImageUrl || "",
      themeColor: initialData?.themeColor || "#FF6B35",
      fontFamily: initialData?.fontFamily || "Inter",
      whatsappNumber: initialData?.whatsappNumber || "",
      instagramUrl: initialData?.instagramUrl || "",
      tiktokUrl: initialData?.tiktokUrl || "",
      gofoodUrl: initialData?.gofoodUrl || "",
      grabfoodUrl: initialData?.grabfoodUrl || "",
      shopeefoodUrl: initialData?.shopeefoodUrl || "",
      googleMapsUrl: initialData?.googleMapsUrl || "",
      customLinks: Array.isArray(initialData?.customLinks) ? initialData.customLinks : [],
      isPublished: initialData?.isPublished ?? false,
      acceptsOrders: initialData?.acceptsOrders ?? true,
      acceptsReservations: initialData?.acceptsReservations ?? false,
      openingHours: DAYS.reduce(
        (acc, day) => {
          acc[day] = { ...emptyDayHours, ...(initialData?.openingHours?.[day] ?? {}) };
          return acc;
        },
        {} as Record<(typeof DAYS)[number], typeof emptyDayHours>
      ),
    },
  });

  const {
    fields: linkFields,
    append: appendLink,
    remove: removeLink,
  } = useFieldArray({
    control: form.control,
    name: "customLinks",
  });

  const onSubmit = async (data: UpdateStorefrontInput) => {
    // Block save if the slug is known to be unavailable
    if (slugStatus === "taken" || slugStatus === "invalid_chars" || slugStatus === "too_short") {
      form.setError("slug", { message: t("storefront.settings.urlTaken") });
      toast.error(t("storefront.settings.urlUnavailable"));
      return;
    }
    setIsSaving(true);
    try {
      await storefrontApi.updateStorefront(storeId, data);
      toast.success(t("storefront.settings.saveSuccess"));
      initialSlug.current = (data.slug || "").trim().toLowerCase();
      setSlugStatus("idle");
      onSuccess();
    } catch (error: any) {
      if (error.response?.status === 409) {
        form.setError("slug", { message: t("storefront.settings.urlTaken") });
        toast.error(t("storefront.settings.urlUnavailable"));
        setSlugStatus("taken");
      } else {
        toast.error(t("storefront.settings.saveFailed"));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const checkSlug = (value: string) => {
    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current);
    const slug = value.trim().toLowerCase();

    // Same as the saved slug — no need to check
    if (slug === initialSlug.current) {
      setSlugStatus("idle");
      return;
    }
    if (slug.length < 3) {
      setSlugStatus("too_short");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setSlugStatus("invalid_chars");
      return;
    }

    setSlugStatus("checking");
    slugDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/stores/${storeId}/storefront/check-slug?slug=${encodeURIComponent(slug)}`
        );
        const json = await res.json();
        setSlugStatus(json.data?.available ? "available" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 500);
  };

  const domain = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${domain}/@${form.watch("slug")}`;

  const slugStatusIcon = () => {
    if (slugStatus === "checking")
      return <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />;
    if (slugStatus === "available") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (slugStatus === "taken" || slugStatus === "invalid_chars" || slugStatus === "too_short")
      return <XCircle className="text-destructive h-4 w-4" />;
    return null;
  };

  const slugStatusText = () => {
    if (slugStatus === "checking") return t("storefront.settings.slugChecking");
    if (slugStatus === "available") return t("storefront.settings.slugAvailable");
    if (slugStatus === "taken") return t("storefront.settings.slugTaken");
    if (slugStatus === "invalid_chars") return t("storefront.settings.slugInvalidChars");
    if (slugStatus === "too_short") return t("storefront.settings.slugTooShort");
    return t("storefront.settings.slugDesc");
  };

  const slugStatusColor = () => {
    if (slugStatus === "available") return "text-green-600 dark:text-green-400";
    if (slugStatus === "taken" || slugStatus === "invalid_chars" || slugStatus === "too_short")
      return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Status / Publish Card */}
          <Card className="border-orange-200 bg-orange-50/30">
            <CardContent className="flex flex-col items-start justify-between gap-3 pt-0 sm:gap-6 sm:pt-6 md:flex-row md:items-center">
              <div>
                <h3 className="text-lg font-semibold">{t("storefront.settings.publishStatus")}</h3>
                <p className="text-muted-foreground mt-1 max-w-[500px] text-sm">
                  {form.watch("isPublished")
                    ? t("storefront.settings.storeActive")
                    : t("storefront.settings.storeHidden")}
                </p>
                {form.watch("isPublished") && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4 sm:gap-3">
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                    >
                      {publicUrl}
                      <ExternalLink className="size-3" />
                    </a>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowQr(true)}
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      {t("storefront.settings.showQr")}
                    </Button>
                  </div>
                )}
              </div>
              <FormField
                control={form.control}
                name="isPublished"
                render={({ field }) => (
                  <FormItem className="border-border bg-card flex items-center gap-2 space-y-0 rounded-lg border p-2 shadow-sm sm:gap-3 sm:p-4">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-semibold">
                        {t("storefront.settings.storeActiveLabel")}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Profile & Branding */}
          <Card>
            <CardHeader>
              <CardTitle>{t("storefront.settings.profileSection")}</CardTitle>
              <CardDescription>{t("storefront.settings.profileDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("storefront.settings.slugLabel")}</FormLabel>
                    <FormControl>
                      <div
                        className={`focus-within:ring-ring flex rounded-md border shadow-sm transition-colors focus-within:ring-1 ${
                          slugStatus === "taken" ||
                          slugStatus === "invalid_chars" ||
                          slugStatus === "too_short"
                            ? "border-destructive"
                            : slugStatus === "available"
                              ? "border-green-500"
                              : "border-input"
                        }`}
                      >
                        <div className="bg-muted text-muted-foreground flex items-center border-r px-3 py-2 text-sm select-none">
                          epidom.fr/@
                        </div>
                        <input
                          {...field}
                          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                          placeholder={t("storefront.settings.slugPlaceholder")}
                          onChange={(e) => {
                            field.onChange(e);
                            checkSlug(e.target.value);
                          }}
                        />
                        {slugStatus !== "idle" && (
                          <div className="flex items-center pr-3">{slugStatusIcon()}</div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription className={slugStatusColor()}>
                      {slugStatusText()}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("storefront.settings.displayName")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("storefront.settings.displayNamePlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tagline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("storefront.settings.tagline")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("storefront.settings.taglinePlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("storefront.settings.description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("storefront.settings.descriptionPlaceholder")}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Visual & Theme */}
          <Card>
            <CardHeader>
              <CardTitle>{t("storefront.settings.visualSection")}</CardTitle>
              <CardDescription>{t("storefront.settings.visualDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("storefront.settings.logoUrl")}</FormLabel>
                      <FormControl>
                        <ImageUpload
                          value={field.value || undefined}
                          onChange={(url) => field.onChange(url ?? "")}
                          aspectRatio="1/1"
                          maxSize={2}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("storefront.settings.logoGuide") ||
                          "Square · 400×400 px min, 1:1 ratio · max 2 MB · PNG or WebP recommended"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="heroImageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("storefront.settings.heroImageUrl")}</FormLabel>
                      <FormControl>
                        <ImageUpload
                          value={field.value || undefined}
                          onChange={(url) => field.onChange(url ?? "")}
                          aspectRatio="16/9"
                          maxSize={5}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("storefront.settings.heroGuide") ||
                          "Banner · 1920×1080 px ideal (16:9) · min 1200×675 px · max 5 MB · JPEG or WebP"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="themeColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("storefront.settings.themeColor")}</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          {...field}
                          onChange={(e) => field.onChange(getPremiumTheme(e.target.value))}
                          className="h-10 w-16 cursor-pointer rounded-md border p-1"
                        />
                        <Input
                          {...field}
                          onChange={(e) => field.onChange(getPremiumTheme(e.target.value))}
                          className="w-32 font-mono"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Contact & Orders */}
          <Card>
            <CardHeader>
              <CardTitle>{t("storefront.settings.contactSection")}</CardTitle>
              <CardDescription>{t("storefront.settings.contactDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="whatsappNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("storefront.settings.whatsappNumber")}</FormLabel>
                    <FormControl>
                      <div className="border-input focus-within:ring-ring flex rounded-md border shadow-sm focus-within:ring-1">
                        <div className="bg-muted text-muted-foreground flex items-center border-r px-3 py-2 text-sm select-none">
                          +
                        </div>
                        <input
                          {...field}
                          inputMode="numeric"
                          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                          placeholder="628123456789"
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Include country code without +. Example: 628123456789 (Indonesia)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="instagramUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instagram URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://instagram.com/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="googleMapsUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Google Maps URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://maps.app.goo.gl/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 pt-2 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="gofoodUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("storefront.settings.gofoodUrl")}</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="grabfoodUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("storefront.settings.grabfoodUrl")}</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shopeefoodUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("storefront.settings.shopeefoodUrl")}</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Storefront Features */}
          <Card>
            <CardHeader>
              <CardTitle>Storefront Features</CardTitle>
              <CardDescription>
                Control what customers can do on your public storefront page.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-border space-y-0 divide-y sm:space-y-4 sm:divide-y-0">
              <FormField
                control={form.control}
                name="acceptsOrders"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-3 py-3 first:pt-0 sm:gap-4 sm:rounded-lg sm:border sm:p-4 sm:first:pt-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-semibold">
                        Online Orders
                        {!hasPosFeatures && <PosLockBadge />}
                      </FormLabel>
                      <FormDescription>
                        Let customers place orders directly from your storefront.
                      </FormDescription>
                    </div>
                    <FormControl>
                      {hasPosFeatures ? (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      ) : (
                        <PosUpgradeButton
                          onClick={() => openUpgrade("POS", "Online ordering is a POS feature.")}
                        />
                      )}
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="acceptsReservations"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-3 py-3 last:pb-0 sm:gap-4 sm:rounded-lg sm:border sm:p-4 sm:last:pb-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-semibold">
                        Table Reservations
                        {!hasPosFeatures && <PosLockBadge />}
                      </FormLabel>
                      <FormDescription>
                        Let customers book a table from your storefront. Enable reservation
                        per-table in <strong>Operations → Tables</strong>.
                      </FormDescription>
                    </div>
                    <FormControl>
                      {hasPosFeatures ? (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      ) : (
                        <PosUpgradeButton
                          onClick={() =>
                            openUpgrade("POS", "Table reservations are a POS feature.")
                          }
                        />
                      )}
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Opening Hours */}
          <Card>
            <CardHeader>
              <CardTitle>{t("storefront.settings.hoursSection")}</CardTitle>
              <CardDescription>{t("storefront.settings.hoursDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 px-0 sm:space-y-2 sm:px-6">
              {DAYS.map((day) => {
                const isClosed = form.watch(`openingHours.${day}.isClosed`);
                return (
                  <div
                    key={day}
                    // Flush to the screen edge on mobile (no card box, no
                    // horizontal padding at all — just a bottom divider
                    // between days); the bordered/rounded/padded card look
                    // returns at sm: and up.
                    className="flex flex-col gap-3 border-b px-0 py-3 sm:flex-row sm:items-center sm:rounded-lg sm:border sm:p-3"
                  >
                    <span className="w-full px-3 text-sm font-medium sm:w-28 sm:shrink-0 sm:px-0">
                      {t(`publicProfile.days.${day}`)}
                    </span>
                    <div className="flex flex-1 flex-wrap items-center gap-3 px-3 sm:px-0">
                      <FormField
                        control={form.control}
                        name={`openingHours.${day}.open`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="time" disabled={isClosed} className="w-32" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <span className="text-muted-foreground text-sm">–</span>
                      <FormField
                        control={form.control}
                        name={`openingHours.${day}.close`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="time" disabled={isClosed} className="w-32" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name={`openingHours.${day}.isClosed`}
                      render={({ field }) => (
                        <FormItem className="flex shrink-0 items-center gap-2 space-y-0 px-3 sm:px-0">
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="text-muted-foreground text-sm font-normal">
                            {t("publicProfile.closed")}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Custom Links */}
          <Card>
            <CardHeader>
              <CardTitle>{t("storefront.settings.customLinksSection")}</CardTitle>
              <CardDescription>{t("storefront.settings.customLinksDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {linkFields.map((field, index) => (
                <div
                  key={field.id}
                  className="bg-muted/30 flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="grid flex-1 gap-3 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`customLinks.${index}.label`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder={t("storefront.settings.linkTitlePlaceholder")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`customLinks.${index}.url`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="url" placeholder="https://..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLink(index)}
                    className="text-red-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => appendLink({ label: "", url: "" })}
                className="w-full border-dashed"
              >
                <Plus className="mr-2 size-4" />
                {t("storefront.settings.addLink")}
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pb-12">
            <Button type="button" variant="outline" onClick={() => form.reset()}>
              {t("storefront.settings.cancelButton")}
            </Button>
            <Button
              type="submit"
              disabled={
                isSaving ||
                slugStatus === "checking" ||
                slugStatus === "taken" ||
                slugStatus === "invalid_chars" ||
                slugStatus === "too_short"
              }
            >
              {isSaving
                ? t("storefront.settings.savingButton")
                : t("storefront.settings.saveButton")}
            </Button>
          </div>
        </form>
      </Form>
      <QrCodeDialog
        open={showQr}
        onOpenChange={setShowQr}
        value={publicUrl}
        title={t("storefront.settings.qrDialogTitle")}
        description={t("storefront.settings.qrDialogDesc")}
        filename="storefront-qr.png"
      />
    </>
  );
}
