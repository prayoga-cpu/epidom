"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { ClipboardList, Monitor, Smartphone, Tv, type LucideIcon } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { onlinePaymentCopyKey } from "@/config/storefront-ordering.config";
import {
  PRODUCT_SCREENS,
  type ProductScreenKey,
} from "@/features/marketing/shared/content/product-screens";
import { SectionHeading } from "./landing-ui";

type ViewKey = "cashier" | "queue" | "customer" | "online";

const VIEWS: readonly { key: ViewKey; icon: LucideIcon; screens: readonly ProductScreenKey[] }[] = [
  { key: "cashier", icon: Monitor, screens: ["posCashier"] },
  { key: "queue", icon: ClipboardList, screens: ["posOrderQueue"] },
  { key: "customer", icon: Tv, screens: ["posCustomerDisplay"] },
  { key: "online", icon: Smartphone, screens: ["storefrontMenu", "storefrontCheckout"] },
];

const bodyKey = (key: ViewKey) =>
  key === "online"
    ? onlinePaymentCopyKey("redesign.posTour.onlineBody")
    : `redesign.posTour.${key}Body`;

/**
 * POS Mode up close: real screens of the till, the order queue, the customer
 * screen and an order placed from a phone, one at a time behind tabs. Shown on
 * the home page right after the hero and on /services.
 *
 * Every view stays mounted and cross-fades, so a tap never waits on a download;
 * the hidden ones are aria-hidden. Tabs follow the ARIA tabs pattern (arrow
 * keys, Home, End). Below lg the tabs are a 2×2 grid and the active view's
 * text sits under the screenshot instead of inside its tab.
 */
export function PosTourSection() {
  const { t, locale } = useI18n();
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const current = VIEWS[active];

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = VIEWS.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <section aria-labelledby="pos-tour-title" className="epi-section">
      <div className="epi-container">
        <SectionHeading
          id="pos-tour-title"
          eyebrow={t("redesign.posTour.eyebrow")}
          title={t("redesign.posTour.title")}
          sub={t("redesign.posTour.sub")}
        />

        <div className="mt-10 grid gap-5 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] lg:items-center lg:gap-10">
          <div
            role="tablist"
            aria-label={t("redesign.posTour.tabsLabel")}
            className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:gap-3"
          >
            {VIEWS.map(({ key, icon: Icon }, index) => {
              const selected = index === active;
              return (
                <button
                  key={key}
                  ref={(el) => {
                    tabs.current[index] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${key}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(index)}
                  onKeyDown={(event) => onTabKeyDown(event, index)}
                  className={cn(
                    "focus-visible:outline-epi-gold-300 flex min-h-12 flex-col items-start gap-2 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 lg:px-5 lg:py-4",
                    selected
                      ? "border-epi-gold-500/50 bg-epi-gold-500/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/25"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center gap-2.5 text-sm font-medium",
                      selected ? "text-epi-gold-300" : "text-epi-cream-50"
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {t(`redesign.posTour.${key}Tab`)}
                  </span>
                  <span className="text-epi-cream-50/65 hidden text-sm leading-relaxed lg:block">
                    {t(bodyKey(key))}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`${baseId}-panel`}
            aria-labelledby={`${baseId}-tab-${current.key}`}
            className="min-w-0"
          >
            <div className="bg-epi-navy-900 relative aspect-[3/2] overflow-hidden rounded-2xl border border-white/10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] sm:rounded-3xl">
              {VIEWS.map(({ key, screens }, index) => (
                <div
                  key={key}
                  aria-hidden={index !== active}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none",
                    index === active ? "opacity-100" : "pointer-events-none opacity-0"
                  )}
                >
                  {screens.length === 1 && PRODUCT_SCREENS[screens[0]].device === "desktop" ? (
                    <Image
                      src={PRODUCT_SCREENS[screens[0]].src}
                      alt={PRODUCT_SCREENS[screens[0]].alt[locale]}
                      fill
                      sizes="(min-width: 1240px) 800px, (min-width: 1024px) 66vw, 100vw"
                      placeholder={PRODUCT_SCREENS[screens[0]].src.blurDataURL ? "blur" : "empty"}
                      className="object-cover object-top"
                    />
                  ) : (
                    // Phone captures side by side, as phones, on a gold-lit backdrop.
                    <div className="flex h-full items-center justify-center gap-[4%] bg-[radial-gradient(circle_at_50%_0%,rgba(217,174,59,0.18),transparent_60%)]">
                      {screens.map((screen) => (
                        <div
                          key={screen}
                          className="relative aspect-[514/1106] h-[88%] overflow-hidden rounded-xl border border-white/15 shadow-2xl sm:rounded-2xl lg:rounded-[26px]"
                        >
                          <Image
                            src={PRODUCT_SCREENS[screen].src}
                            alt={PRODUCT_SCREENS[screen].alt[locale]}
                            fill
                            sizes="(min-width: 1024px) 240px, 30vw"
                            placeholder={PRODUCT_SCREENS[screen].src.blurDataURL ? "blur" : "empty"}
                            className="object-cover object-top"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-epi-cream-50/70 mt-4 text-[15px] leading-relaxed lg:hidden">
              {t(bodyKey(current.key))}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
