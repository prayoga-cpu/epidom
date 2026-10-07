"use client";

import Image from "next/image";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  TRUSTED_BRANDS,
  getConsentedBrands,
  type TrustedBrand,
} from "@/features/marketing/home/data/trusted-brands";

/**
 * "Already running on Epidom": real merchant logos, and nothing else. Only
 * brands that confirmed in writing render (see trusted-brands.ts); with none,
 * the section renders nothing at all rather than a label over an empty row.
 */
export function TrustBar({ brands = TRUSTED_BRANDS }: { brands?: readonly TrustedBrand[] }) {
  const { t } = useI18n();
  const customers = getConsentedBrands(brands);
  if (customers.length === 0) return null;

  return (
    <section aria-labelledby="trust-title" className="py-10 sm:py-12">
      <div className="epi-container">
        <div
          data-testid="trusted-brands"
          className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-white/[0.01] px-6 py-7 sm:px-8"
        >
          <p
            id="trust-title"
            className="text-epi-cream-50/55 m-0 text-xs tracking-[0.18em] uppercase"
          >
            {t("redesign.landing.trust.label")}
          </p>
          <ul className="m-0 mt-5 flex list-none flex-wrap items-center gap-5 p-0">
            {customers.map((brand) => (
              <li key={brand.slug}>
                {/* One shared circular crop so marks of different shapes and
                    backgrounds read as a set; the white disc keeps dark marks
                    legible on the navy card. */}
                <span className="relative block size-14 overflow-hidden rounded-full bg-white ring-1 ring-white/25">
                  <Image
                    src={brand.logo}
                    alt={brand.name}
                    width={56}
                    height={56}
                    sizes="56px"
                    className="size-full object-cover"
                    style={brand.zoom ? { transform: `scale(${brand.zoom})` } : undefined}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
