"use client";

import type { CSSProperties } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  TRUSTED_BRANDS,
  getConsentedBrands,
  logoHeight,
  type TrustedBrand,
} from "@/features/marketing/home/data/trusted-brands";

/** From this many logos the strip scrolls; fewer would repeat or leave gaps, so they stand still. */
const MARQUEE_FROM = 8;

/**
 * "Trusted by N cafés, bakeries & restaurants": the clients' white logos in a
 * slow marquee under the hero (a still, centred row when there are few). Only
 * consented brands count and show (see trusted-brands.ts); with none, nothing
 * renders. The marks are sized by visual weight, not to a common height. The
 * marquee stops on hover and for reduced motion, where it wraps into a still
 * row; its repeated copy is hidden from assistive technology.
 */
export function TrustBar({ brands = TRUSTED_BRANDS }: { brands?: readonly TrustedBrand[] }) {
  const { t } = useI18n();
  const customers = getConsentedBrands(brands);
  if (customers.length === 0) return null;
  const scrolling = customers.length >= MARQUEE_FROM;

  const logo = (brand: TrustedBrand, decorative: boolean) => (
    <li key={`${brand.slug}${decorative ? "-copy" : ""}`} className="shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- small static SVGs */}
      <img
        src={brand.logo}
        alt={decorative ? "" : brand.name}
        height={logoHeight(brand.aspect)}
        width={Math.round(logoHeight(brand.aspect) * brand.aspect)}
        loading="eager"
        decoding="sync"
        draggable={false}
        style={{ "--h": logoHeight(brand.aspect) } as CSSProperties}
        className="h-[calc(var(--h)*0.72px)] w-auto opacity-60 transition-opacity duration-300 hover:opacity-100 sm:h-[calc(var(--h)*1px)]"
      />
    </li>
  );

  return (
    <section aria-labelledby="trust-title" className="py-10 sm:py-14">
      <div className="epi-container">
        <p
          id="trust-title"
          className="text-epi-cream-50/60 m-0 text-center text-xs tracking-[0.18em] uppercase"
        >
          {t("redesign.landing.trust.label").replace("{count}", String(customers.length))}
        </p>

        <div
          data-testid="trusted-brands"
          className={
            scrolling
              ? "epi-marquee mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
              : "mt-8"
          }
        >
          <div
            className={
              scrolling
                ? "epi-marquee-track flex w-max items-center motion-reduce:w-full motion-reduce:justify-center"
                : "flex flex-wrap items-center justify-center gap-x-12 gap-y-6"
            }
          >
            <ul
              className={
                "m-0 flex list-none items-center gap-14 p-0 sm:gap-20 motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:pr-0 " +
                (scrolling ? "pr-14 sm:pr-20" : "flex-wrap justify-center")
              }
            >
              {customers.map((brand) => logo(brand, false))}
            </ul>
            {scrolling ? (
              <ul
                aria-hidden="true"
                className="epi-marquee-copy m-0 flex list-none items-center gap-14 p-0 pr-14 sm:gap-20 sm:pr-20 motion-reduce:hidden"
              >
                {customers.map((brand) => logo(brand, true))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
