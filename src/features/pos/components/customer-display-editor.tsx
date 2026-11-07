"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Monitor, Smartphone } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { ImageUpload } from "@/components/shared/image-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_DISPLAY_DEFAULTS,
  CUSTOMER_DISPLAY_FONT_STYLES,
  CUSTOMER_DISPLAY_LIMITS,
  customerDisplaySettingsSchema,
  type CustomerDisplaySettingsValues,
} from "@/lib/validation/customer-display.schemas";
import type { CustomerDisplayConfig } from "@/types/api/customer-display";
import {
  useCustomerDisplayConfig,
  useSaveCustomerDisplayConfig,
} from "../hooks/use-customer-display-config";
import { CustomerDisplayBanners } from "./customer-display-banners";
import {
  CustomerDisplayPreview,
  type CustomerDisplayPreviewOrientation,
  type CustomerDisplayPreviewState,
} from "./customer-display-preview";

const SLIDE_SECONDS = [4, 6, 8, 10, 15, 20, 30, 45, 60];
const THANK_YOU_SECONDS = [5, 8, 12, 15, 20, 30, 45, 60];
const STOREFRONT_FONT = "STOREFRONT";

interface Option<T extends string> {
  value: T;
  label: string;
}

/** A small single-choice button row (a radio group that reads like tabs). */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-muted inline-flex flex-wrap gap-1 rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-10 rounded-md px-3 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SwitchRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-3",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        {description && (
          <span className="text-muted-foreground mt-0.5 block text-xs">{description}</span>
        )}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

/**
 * Store Dashboard → Customer display: the second screen's look, its promo
 * banners and what the thank-you shows, with a live preview of the real
 * screen. Owner-only (see the page). Saved as one; open screens pick it up
 * at their next poll, or at once on this same device.
 */
export function CustomerDisplayEditor({ storeId }: { storeId: string }) {
  const { t } = useI18n();
  const query = useCustomerDisplayConfig(storeId);

  if (query.isError) {
    return (
      <p className="text-destructive text-sm">{t("pos.customerDisplay.editor.loadError")}</p>
    );
  }
  if (!query.data) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }
  return <EditorForm storeId={storeId} config={query.data} />;
}

function EditorForm({ storeId, config }: { storeId: string; config: CustomerDisplayConfig }) {
  const { t } = useI18n();
  const save = useSaveCustomerDisplayConfig(storeId);
  const form = useForm<CustomerDisplaySettingsValues>({
    resolver: zodResolver(customerDisplaySettingsSchema),
    defaultValues: config.settings,
  });
  const values = useWatch({ control: form.control }) as CustomerDisplaySettingsValues;
  const { isDirty } = form.formState;
  const [previewState, setPreviewState] = useState<CustomerDisplayPreviewState>("welcome");
  const [orientation, setOrientation] = useState<CustomerDisplayPreviewOrientation>("landscape");

  // The preview draws whatever is on the form right now, saved or not.
  const previewConfig = useMemo<CustomerDisplayConfig>(
    () => ({ ...config, settings: { ...CUSTOMER_DISPLAY_DEFAULTS, ...values } }),
    [config, values]
  );

  // Unsaved edits: warn before the tab closes.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const onSubmit = form.handleSubmit(
    (data) =>
      save.mutate(data, {
        onSuccess: (saved) => {
          form.reset(saved.settings);
          toast.success(t("pos.customerDisplay.editor.saved"));
        },
        onError: () => toast.error(t("pos.customerDisplay.editor.saveFailed")),
      }),
    () => toast.error(t("pos.customerDisplay.editor.invalid"))
  );

  const { branding } = config;
  const storefrontColor = branding.storefrontThemeColor || "#FF6B35";
  const set = <K extends keyof CustomerDisplaySettingsValues>(
    key: K,
    value: CustomerDisplaySettingsValues[K]
  ) => form.setValue(key, value as never, { shouldDirty: true, shouldValidate: true });

  const previewStates: Option<CustomerDisplayPreviewState>[] = [
    { value: "welcome", label: t("pos.customerDisplay.editor.stateWelcome") },
    { value: "order", label: t("pos.customerDisplay.editor.stateOrder") },
    { value: "qris", label: "QRIS" },
    { value: "thankYou", label: t("pos.customerDisplay.editor.stateThankYou") },
  ];

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("pos.customerDisplay.editor.title")}
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            {t("pos.customerDisplay.editor.subtitle")}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
          {/* ── Preview: first on a phone, a sticky column on desktop ── */}
          <div className="space-y-3 lg:sticky lg:top-4 lg:order-last">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented
                label={t("pos.customerDisplay.editor.previewState")}
                value={previewState}
                options={previewStates}
                onChange={setPreviewState}
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={orientation === "landscape" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setOrientation("landscape")}
                  aria-label={t("pos.customerDisplay.editor.landscape")}
                  aria-pressed={orientation === "landscape"}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={orientation === "portrait" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setOrientation("portrait")}
                  aria-label={t("pos.customerDisplay.editor.portrait")}
                  aria-pressed={orientation === "portrait"}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CustomerDisplayPreview
              config={previewConfig}
              state={previewState}
              orientation={orientation}
            />
            {previewState === "qris" && !values.qrisImageUrl && (
              <p className="text-muted-foreground text-xs">
                {t("pos.customerDisplay.editor.qrisPreviewHint")}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              {t("pos.customerDisplay.editor.liveHint")}
            </p>
          </div>

          {/* ── Settings ── */}
          <div className="min-w-0 space-y-4">
            <Tabs defaultValue="banners">
              <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="banners">{t("pos.customerDisplay.editor.tabBanners")}</TabsTrigger>
                <TabsTrigger value="look">{t("pos.customerDisplay.editor.tabLook")}</TabsTrigger>
                <TabsTrigger value="text">{t("pos.customerDisplay.editor.tabText")}</TabsTrigger>
                <TabsTrigger value="payment">
                  {t("pos.customerDisplay.editor.tabPayment")}
                </TabsTrigger>
              </TabsList>

              {/* ── Banners ── */}
              <TabsContent value="banners" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("pos.customerDisplay.editor.bannersTitle")}</CardTitle>
                    <CardDescription>{t("pos.customerDisplay.editor.bannersDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <SwitchRow
                      title={t("pos.customerDisplay.editor.idleSlideshow")}
                      description={t("pos.customerDisplay.editor.idleSlideshowDesc")}
                      checked={values.idleSlideshow}
                      onChange={(v) => set("idleSlideshow", v)}
                    />
                    <SwitchRow
                      title={t("pos.customerDisplay.editor.bannersDuringOrder")}
                      description={t("pos.customerDisplay.editor.bannersDuringOrderDesc")}
                      checked={values.bannersDuringOrder}
                      onChange={(v) => set("bannersDuringOrder", v)}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                      <span className="text-sm font-medium">
                        {t("pos.customerDisplay.editor.slideSeconds")}
                      </span>
                      <Select
                        value={String(values.slideSeconds)}
                        onValueChange={(v) => set("slideSeconds", Number(v))}
                      >
                        <SelectTrigger className="h-10 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SLIDE_SECONDS.map((s) => (
                            <SelectItem key={s} value={String(s)}>
                              {t("pos.customerDisplay.editor.seconds").replace("{count}", String(s))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <CustomerDisplayBanners />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Look ── */}
              <TabsContent value="look" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("pos.customerDisplay.editor.colourTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <SwitchRow
                      title={t("pos.customerDisplay.editor.useStorefrontColour")}
                      description={t("pos.customerDisplay.editor.useStorefrontColourDesc")}
                      checked={values.themeColor === null}
                      onChange={(useStorefront) =>
                        set("themeColor", useStorefront ? null : storefrontColor)
                      }
                    />
                    {values.themeColor !== null && (
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={values.themeColor}
                          onChange={(e) => set("themeColor", e.target.value)}
                          aria-label={t("pos.customerDisplay.editor.colour")}
                          className="h-11 w-16 cursor-pointer rounded-md border bg-transparent p-1"
                        />
                        <span className="font-mono text-sm uppercase">{values.themeColor}</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {t("pos.customerDisplay.editor.background")}
                      </p>
                      <Segmented
                        label={t("pos.customerDisplay.editor.background")}
                        value={values.backgroundStyle}
                        onChange={(v) => set("backgroundStyle", v)}
                        options={[
                          { value: "GRADIENT", label: t("pos.customerDisplay.editor.bgGradient") },
                          { value: "SOLID", label: t("pos.customerDisplay.editor.bgSolid") },
                          { value: "IMAGE", label: t("pos.customerDisplay.editor.bgImage") },
                        ]}
                      />
                    </div>

                    {values.backgroundStyle === "IMAGE" && (
                      <div className="space-y-4 rounded-lg border p-3">
                        <ImageUpload
                          value={values.backgroundImageUrl ?? undefined}
                          onChange={(url) => set("backgroundImageUrl", url ?? null)}
                          aspectRatio="16/9"
                          maxSize={3}
                          deletePrevious={false}
                        />
                        {!values.backgroundImageUrl && (
                          <p className="text-muted-foreground text-xs">
                            {t("pos.customerDisplay.editor.bgImageEmpty")}
                          </p>
                        )}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">
                              {t("pos.customerDisplay.editor.bgDim")}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {values.backgroundDim}%
                            </span>
                          </div>
                          <Slider
                            value={[values.backgroundDim]}
                            min={CUSTOMER_DISPLAY_LIMITS.backgroundDim.min}
                            max={CUSTOMER_DISPLAY_LIMITS.backgroundDim.max}
                            step={5}
                            onValueChange={([v]) => set("backgroundDim", v)}
                            aria-label={t("pos.customerDisplay.editor.bgDim")}
                          />
                          <p className="text-muted-foreground text-xs">
                            {t("pos.customerDisplay.editor.bgDimHint")}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">
                              {t("pos.customerDisplay.editor.bgBlur")}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {values.backgroundBlur}px
                            </span>
                          </div>
                          <Slider
                            value={[values.backgroundBlur]}
                            min={CUSTOMER_DISPLAY_LIMITS.backgroundBlur.min}
                            max={CUSTOMER_DISPLAY_LIMITS.backgroundBlur.max}
                            step={1}
                            onValueChange={([v]) => set("backgroundBlur", v)}
                            aria-label={t("pos.customerDisplay.editor.bgBlur")}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-sm font-medium">{t("pos.customerDisplay.editor.panels")}</p>
                      <Segmented
                        label={t("pos.customerDisplay.editor.panels")}
                        value={values.panelStyle}
                        onChange={(v) => set("panelStyle", v)}
                        options={[
                          { value: "GLASS", label: t("pos.customerDisplay.editor.panelGlass") },
                          { value: "SOLID", label: t("pos.customerDisplay.editor.panelSolid") },
                        ]}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t("pos.customerDisplay.editor.layoutTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-medium">
                        {t("pos.customerDisplay.editor.font")}
                      </span>
                      <Select
                        value={values.fontStyle ?? STOREFRONT_FONT}
                        onValueChange={(v) =>
                          set(
                            "fontStyle",
                            v === STOREFRONT_FONT
                              ? null
                              : (v as (typeof CUSTOMER_DISPLAY_FONT_STYLES)[number])
                          )
                        }
                      >
                        <SelectTrigger className="h-10 w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={STOREFRONT_FONT}>
                            {t("pos.customerDisplay.editor.fontStorefront")}
                          </SelectItem>
                          {CUSTOMER_DISPLAY_FONT_STYLES.map((font) => (
                            <SelectItem key={font} value={font}>
                              {t(`pos.customerDisplay.editor.font${font}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {t("pos.customerDisplay.editor.orderSide")}
                      </p>
                      <Segmented
                        label={t("pos.customerDisplay.editor.orderSide")}
                        value={values.orderSide}
                        onChange={(v) => set("orderSide", v)}
                        options={[
                          { value: "LEFT", label: t("pos.customerDisplay.editor.sideLeft") },
                          { value: "RIGHT", label: t("pos.customerDisplay.editor.sideRight") },
                        ]}
                      />
                      <p className="text-muted-foreground text-xs">
                        {t("pos.customerDisplay.editor.orderSideHint")}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">{t("pos.customerDisplay.editor.logo")}</p>
                      <div className="max-w-56">
                        <ImageUpload
                          value={values.logoUrl ?? undefined}
                          onChange={(url) => set("logoUrl", url ?? null)}
                          aspectRatio="1/1"
                          deletePrevious={false}
                          compact
                        />
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {t("pos.customerDisplay.editor.logoHint")}
                      </p>
                      <Segmented
                        label={t("pos.customerDisplay.editor.logoSize")}
                        value={values.logoSize}
                        onChange={(v) => set("logoSize", v)}
                        options={[
                          { value: "S", label: t("pos.customerDisplay.editor.sizeS") },
                          { value: "M", label: t("pos.customerDisplay.editor.sizeM") },
                          { value: "L", label: t("pos.customerDisplay.editor.sizeL") },
                        ]}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Text ── */}
              <TabsContent value="text" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("pos.customerDisplay.editor.textTitle")}</CardTitle>
                    <CardDescription>{t("pos.customerDisplay.editor.textDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <TextField
                      name="welcomeTitle"
                      label={t("pos.customerDisplay.editor.welcomeTitle")}
                      placeholder={t("pos.customerDisplay.welcome")}
                      max={CUSTOMER_DISPLAY_LIMITS.titleMax}
                    />
                    <TextField
                      name="welcomeMessage"
                      label={t("pos.customerDisplay.editor.welcomeMessage")}
                      placeholder={t("pos.customerDisplay.welcomeDesc")}
                      max={CUSTOMER_DISPLAY_LIMITS.messageMax}
                      multiline
                    />
                    <TextField
                      name="thankYouTitle"
                      label={t("pos.customerDisplay.editor.thankYouTitle")}
                      placeholder={t("pos.customerDisplay.thankYou")}
                      max={CUSTOMER_DISPLAY_LIMITS.titleMax}
                    />
                    <TextField
                      name="thankYouMessage"
                      label={t("pos.customerDisplay.editor.thankYouMessage")}
                      placeholder={t("pos.customerDisplay.thankYouDesc")}
                      max={CUSTOMER_DISPLAY_LIMITS.messageMax}
                      multiline
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── After payment ── */}
              <TabsContent value="payment" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("pos.customerDisplay.editor.thankYouScreen")}</CardTitle>
                    <CardDescription>
                      {t("pos.customerDisplay.editor.thankYouScreenDesc")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                      <span className="text-sm font-medium">
                        {t("pos.customerDisplay.editor.thankYouSeconds")}
                      </span>
                      <Select
                        value={String(values.thankYouSeconds)}
                        onValueChange={(v) => set("thankYouSeconds", Number(v))}
                      >
                        <SelectTrigger className="h-10 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {THANK_YOU_SECONDS.map((s) => (
                            <SelectItem key={s} value={String(s)}>
                              {t("pos.customerDisplay.editor.seconds").replace("{count}", String(s))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <SwitchRow
                      title={t("pos.customerDisplay.editor.showReviewQr")}
                      description={
                        branding.googleReviewUrl
                          ? t("pos.customerDisplay.editor.showReviewQrDesc")
                          : t("pos.customerDisplay.editor.showReviewQrMissing")
                      }
                      checked={values.showReviewQr && !!branding.googleReviewUrl}
                      disabled={!branding.googleReviewUrl}
                      onChange={(v) => set("showReviewQr", v)}
                    />
                    <SwitchRow
                      title={t("pos.customerDisplay.editor.showInstagramQr")}
                      description={
                        branding.instagramUrl
                          ? t("pos.customerDisplay.editor.showInstagramQrDesc")
                          : t("pos.customerDisplay.editor.showInstagramQrMissing")
                      }
                      checked={values.showInstagramQr && !!branding.instagramUrl}
                      disabled={!branding.instagramUrl}
                      onChange={(v) => set("showInstagramQr", v)}
                    />
                    <SwitchRow
                      title={t("pos.customerDisplay.editor.showWifi")}
                      description={
                        branding.wifiName
                          ? t("pos.customerDisplay.editor.showWifiDesc").replace(
                              "{name}",
                              branding.wifiName
                            )
                          : t("pos.customerDisplay.editor.showWifiMissing")
                      }
                      checked={values.showWifi && !!branding.wifiName}
                      disabled={!branding.wifiName}
                      onChange={(v) => set("showWifi", v)}
                    />
                    <p className="text-muted-foreground text-xs">
                      {t("pos.customerDisplay.editor.changeHint")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t("pos.customerDisplay.editor.qrisTitle")}</CardTitle>
                    <CardDescription>{t("pos.customerDisplay.editor.qrisDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-w-56">
                      <ImageUpload
                        value={values.qrisImageUrl ?? undefined}
                        onChange={(url) => set("qrisImageUrl", url ?? null)}
                        aspectRatio="3/4"
                        maxSize={3}
                        deletePrevious={false}
                        compact
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* ── Save bar ── */}
        <div className="bg-background/95 sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          {isDirty && (
            <span className="text-muted-foreground mr-auto text-sm">
              {t("pos.customerDisplay.editor.unsaved")}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            className="min-h-10"
            disabled={!isDirty || save.isPending}
            onClick={() => form.reset(config.settings)}
          >
            {t("pos.customerDisplay.editor.discard")}
          </Button>
          <Button type="submit" className="min-h-10" disabled={!isDirty || save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("pos.customerDisplay.editor.save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function TextField({
  name,
  label,
  placeholder,
  max,
  multiline,
}: {
  name: "welcomeTitle" | "welcomeMessage" | "thankYouTitle" | "thankYouMessage";
  label: string;
  placeholder: string;
  max: number;
  multiline?: boolean;
}) {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {multiline ? (
              <Textarea
                {...field}
                value={field.value ?? ""}
                placeholder={placeholder}
                maxLength={max}
                rows={2}
              />
            ) : (
              <Input {...field} value={field.value ?? ""} placeholder={placeholder} maxLength={max} />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
