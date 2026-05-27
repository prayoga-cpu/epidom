"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  ArrowRight,
  Loader2,
  Building2,
  Image as ImageIcon,
  MenuSquare,
  Palette,
  Rocket,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { storefrontApi } from "@/lib/api";

const CONTAINER_STYLES =
  "flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 md:px-8";
const CONTENT_WRAPPER_STYLES =
  "animate-in fade-in slide-in-from-bottom-4 w-full max-w-2xl duration-700";
const CARD_STYLES =
  "overflow-hidden border border-border shadow-2xl";
const CARD_CONTENT_STYLES = "p-8 md:p-12";
const INPUT_STYLES =
  "h-12 rounded-xl border-border bg-background px-4 text-sm text-foreground transition-all focus:ring-2 focus:ring-[var(--epi-gold-500)]/30";
const BUTTON_PRIMARY =
  "group h-12 w-full rounded-xl text-sm font-semibold shadow-lg transition-all bg-[var(--epi-gold-500)] hover:bg-[var(--epi-gold-600)] text-[var(--epi-navy-900)]";
const BUTTON_SECONDARY =
  "h-12 rounded-xl border border-[var(--epi-gold-500)]/30 text-foreground hover:bg-[var(--epi-gold-500)]/10";

export function OnboardingContent() {
  const { t } = useI18n();
  const router = useRouter();
  const { data: session, isPending: isSessionPending } = useSession();
  const isAuthenticated = !isSessionPending && !!session?.user;

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [themeColor, setThemeColor] = useState("#FF6B35");
  const [menuItems, setMenuItems] = useState([
    { name: "", price: 25000 },
    { name: "", price: 5000 },
    { name: "", price: 3000 },
  ]);

  useEffect(() => {
    async function checkProfile() {
      if (!isAuthenticated) return;
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const { data } = await res.json();
          if (data?.business?.stores?.[0]?.id) {
            setStoreId(data.business.stores[0].id);
          }
          if (data?.business?.storefront?.isPublished) {
            router.push("/stores");
          }
        }
      } catch (_) {}
    }
    checkProfile();
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isSessionPending && !isAuthenticated) {
      router.push("/login?callbackUrl=/onboarding");
    }
  }, [isSessionPending, isAuthenticated, router]);

  const handleCreateBusiness = async () => {
    if (!name.trim()) return toast.error(t("onboarding.storeSetup.step1.nameRequired"));

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/user/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address: "Online" }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setStoreId(data.storeId);

        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "");
        await storefrontApi.updateStorefront(data.storeId, {
          displayName: name,
          tagline,
          slug,
          isPublished: false,
        } as any);

        setStep(2);
      }
    } catch (_) {
      toast.error(t("onboarding.storeSetup.step1.saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateLogo = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/generate-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, themeColor }),
      });
      if (res.ok) {
        const svgContent = await res.text();
        const base64Svg = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
        setLogoUrl(base64Svg);

        fetch("/api/onboarding/suggest-menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, tagline }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d?.data?.length > 0) setMenuItems(d.data);
          })
          .catch(() => {});
      } else {
        toast.error(t("onboarding.storeSetup.step2.generateFailed"));
      }
    } catch (_) {
      toast.error(t("onboarding.storeSetup.step2.generateFailed"));
    } finally {
      setStep(3);
      setIsSubmitting(false);
    }
  };

  const handleSaveMenu = async () => {
    if (!storeId) return;
    setIsSubmitting(true);
    try {
      const categoryRes = await storefrontApi.createCategory(storeId, {
        name: t("onboarding.storeSetup.step3.defaultCategoryName"),
        displayOrder: 0,
      });
      const categoryId = categoryRes.data?.id;

      if (categoryId) {
        for (const item of menuItems) {
          if (!item.name.trim()) continue;
          await storefrontApi.createItem(storeId, {
            name: item.name,
            price: item.price,
            categoryId,
            isAvailable: true,
          } as any);
        }
      }
      setStep(4);
    } catch (_) {
      toast.error(t("onboarding.storeSetup.step3.saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!storeId) return;
    setIsSubmitting(true);
    try {
      await storefrontApi.updateStorefront(storeId, {
        themeColor,
        isPublished: true,
        logoUrl,
      } as any);
      toast.success(t("onboarding.storeSetup.step5.publishSuccess"));
      router.push("/stores");
    } catch (_) {
      toast.error(t("onboarding.storeSetup.step5.publishFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const THEME_COLORS = ["#FF6B35", "#2563EB", "#16A34A", "#E11D48", "#9333EA", "#000000"];

  const Header = ({
    stepNum,
    title,
    subtitle,
    icon: Icon,
  }: {
    stepNum: number;
    title: string;
    subtitle: string;
    icon: React.ElementType;
  }) => (
    <div className="mb-8 text-center">
      <div className="mb-6 flex justify-center">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 w-8 rounded-full transition-all",
                s <= stepNum ? "bg-[var(--epi-gold-500)]" : "bg-slate-200"
              )}
            />
          ))}
        </div>
      </div>
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: "color-mix(in srgb, var(--epi-gold-500) 12%, transparent)",
          color: "var(--epi-gold-500)",
        }}
      >
        <Icon className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );

  if (isSessionPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin" style={{ color: "var(--epi-gold-500)" }} />
      </div>
    );
  }

  const ss = "onboarding.storeSetup" as const;

  return (
    <div className={CONTAINER_STYLES}>
      <div className={CONTENT_WRAPPER_STYLES}>
        <Card className={CARD_STYLES}>
          <CardContent className={CARD_CONTENT_STYLES}>
            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-6">
                <Header
                  stepNum={1}
                  icon={Building2}
                  title={t(`${ss}.step1.title`)}
                  subtitle={t(`${ss}.step1.subtitle`)}
                />
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground">
                      {t(`${ss}.step1.nameLabel`)}
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t(`${ss}.step1.namePlaceholder`)}
                      className={INPUT_STYLES}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground">
                      {t(`${ss}.step1.taglineLabel`)}
                    </label>
                    <Input
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder={t(`${ss}.step1.taglinePlaceholder`)}
                      className={INPUT_STYLES}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleCreateBusiness}
                  disabled={isSubmitting || !name}
                  className={BUTTON_PRIMARY}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 animate-spin" />
                  ) : (
                    t(`${ss}.step1.continue`)
                  )}
                </Button>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-6">
                <Header
                  stepNum={2}
                  icon={ImageIcon}
                  title={t(`${ss}.step2.title`)}
                  subtitle={t(`${ss}.step2.subtitle`)}
                />
                <div className="flex flex-col items-center justify-center py-6">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-32 w-32 rounded-full border-4 border-slate-100 shadow-md"
                    />
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center rounded-full border border-dashed bg-muted text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(3)}
                    className={BUTTON_SECONDARY}
                  >
                    {t(`${ss}.step2.skip`)}
                  </Button>
                  <Button
                    onClick={handleGenerateLogo}
                    disabled={isSubmitting}
                    className="h-12 rounded-xl"
                    style={{
                      background: "var(--epi-navy-800)",
                      color: "var(--epi-gold-400)",
                    }}
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 animate-spin" />
                    ) : (
                      t(`${ss}.step2.generateLogo`)
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="space-y-6">
                <Header
                  stepNum={3}
                  icon={MenuSquare}
                  title={t(`${ss}.step3.title`)}
                  subtitle={t(`${ss}.step3.subtitle`)}
                />
                <div className="space-y-3">
                  {menuItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={item.name}
                        onChange={(e) => {
                          const next = [...menuItems];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setMenuItems(next);
                        }}
                        placeholder={t(`${ss}.step3.namePlaceholder`)}
                        className="flex-1 rounded-lg"
                      />
                      <Input
                        type="number"
                        value={item.price}
                        onChange={(e) => {
                          const next = [...menuItems];
                          next[idx] = { ...next[idx], price: Number(e.target.value) };
                          setMenuItems(next);
                        }}
                        placeholder={t(`${ss}.step3.pricePlaceholder`)}
                        className="w-32 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
                <Button onClick={handleSaveMenu} disabled={isSubmitting} className={BUTTON_PRIMARY}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 animate-spin" />
                  ) : (
                    t(`${ss}.step3.saveMenu`)
                  )}
                </Button>
              </div>
            )}

            {/* STEP 4 */}
            {step === 4 && (
              <div className="space-y-6">
                <Header
                  stepNum={4}
                  icon={Palette}
                  title={t(`${ss}.step4.title`)}
                  subtitle={t(`${ss}.step4.subtitle`)}
                />
                <div className="flex justify-center gap-4 py-4">
                  {THEME_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setThemeColor(color)}
                      className={cn(
                        "h-12 w-12 rounded-full border-2 transition-all",
                        themeColor === color
                          ? "scale-110 border-[var(--epi-navy-900)] shadow-lg"
                          : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={color}
                    />
                  ))}
                </div>
                <Button onClick={() => setStep(5)} className={BUTTON_PRIMARY}>
                  {t(`${ss}.step4.continue`)}
                </Button>
              </div>
            )}

            {/* STEP 5 */}
            {step === 5 && (
              <div className="space-y-6">
                <Header
                  stepNum={5}
                  icon={Rocket}
                  title={t(`${ss}.step5.title`)}
                  subtitle={t(`${ss}.step5.subtitle`)}
                />
                <div className="rounded-2xl border border-dashed bg-slate-50 p-6 text-center">
                  <h3 className="mb-1 text-lg font-bold">{name}</h3>
                  <p className="mb-4 text-sm text-muted-foreground">{tagline}</p>
                  <div
                    className="mb-4 h-32 w-full overflow-hidden rounded-xl"
                    style={{ backgroundColor: themeColor + "20" }}
                  >
                    <div className="h-10 w-full" style={{ backgroundColor: themeColor }} />
                    <div className="flex gap-2 p-4">
                      <div className="h-12 w-12 rounded bg-white shadow-sm" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-2 w-3/4 rounded bg-white" />
                        <div className="h-2 w-1/2 rounded bg-white" />
                      </div>
                    </div>
                  </div>
                </div>
                <Button onClick={handlePublish} disabled={isSubmitting} className={BUTTON_PRIMARY}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 animate-spin" />
                  ) : (
                    <>
                      {t(`${ss}.step5.publishNow`)}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
