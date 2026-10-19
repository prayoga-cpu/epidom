"use client";

import { useEffect, useState } from "react";
import { Gift, X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { SOURCE_COOKIE, normalizeRefCode, parseSource } from "@/lib/attribution/cookies";

const DISMISS_KEY = "epidom-referral-banner-dismissed";

interface Banner {
  code: string;
  displayName: string;
  discountPercent: number;
}

/** The referral code this visit came with: the link's ?ref=, else the last referral link opened. */
function currentReferralCode(): string | null {
  try {
    const fromUrl = normalizeRefCode(new URLSearchParams(window.location.search).get("ref"));
    if (fromUrl) return fromUrl;
    const raw = document.cookie.match(new RegExp(`(?:^|; )${SOURCE_COOKIE}=([^;]+)`))?.[1];
    const source = parseSource(raw ? decodeURIComponent(raw) : null);
    return source?.kind === "ref" ? source.code : null;
  } catch {
    return null;
  }
}

/**
 * "Bob's referral: 10% off your first payment", on the sign-up page and the
 * home page for a visitor who came through a partner's link (and still on
 * the pages they visit next, while the referral is the last thing they
 * opened). Floating at the bottom, so the page doesn't move when it appears;
 * under the cookie bar while that one is open. Dismissible for the session.
 */
export function ReferralBanner() {
  const { t } = useI18n();
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    const code = currentReferralCode();
    if (!code) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === code) return;
    } catch {
      // Storage blocked: show it anyway.
    }
    let cancelled = false;
    fetch(`/api/public/referrals/${encodeURIComponent(code)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: { displayName: string; discountPercent: number } } | null) => {
        if (!cancelled && body?.data) setBanner({ code, ...body.data });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!banner) return null;

  const text =
    banner.discountPercent > 0
      ? t("referralBanner.withDiscount")
          .replace("{name}", banner.displayName)
          .replace("{discount}", String(banner.discountPercent))
      : t("referralBanner.withoutDiscount").replace("{name}", banner.displayName);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 flex justify-center px-4">
      <div
        role="status"
        className="bg-background/95 text-foreground pointer-events-auto flex max-w-md items-center gap-2 rounded-full border border-amber-500/40 py-1.5 pr-1.5 pl-4 text-sm shadow-lg backdrop-blur"
      >
        <Gift className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
        <span className="min-w-0 font-medium">{text}</span>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, banner.code);
            } catch {
              // ignore
            }
            setBanner(null);
          }}
          className="text-muted-foreground hover:text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-amber-500/15"
          aria-label={t("referralBanner.dismiss")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
