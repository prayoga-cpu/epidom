"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { MarketFlag, marketName } from "@/components/market-flag";
import { trackConversion, trackMetaPixelEvent } from "@/lib/analytics";
import {
  CONTACT_EMAIL_DISPLAY,
  CONTACT_MAILTO,
  SUPPORT_EMAIL_DISPLAY,
  SUPPORT_MAILTO,
  getWhatsAppOptions,
  whatsappHref,
} from "@/lib/constants/contact";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { cn } from "@/lib/utils";
import {
  OnlineDot,
  WhatsAppSupportMenu,
} from "@/features/marketing/shared/components/whatsapp-support-menu";
import { PRIMARY_BUTTON } from "@/features/marketing/home/components/landing-ui";

/**
 * There is deliberately no form here. The old one only faked a send (a timer,
 * then a "sent" screen) and kept nothing, so every lead who used it was lost.
 * WhatsApp is the primary action; email and the docs are the secondary paths.
 * Nothing on this page needs a backend of its own.
 *
 * No average-response-time figure and no support hours are shown: neither is
 * measured or fixed today. The only commitment is the "reply within 24 hours"
 * line (contact.page.script), the same one Press and Status use.
 */

/** Every WhatsApp link on this page counts as the same conversion. */
function trackWhatsAppClick() {
  trackConversion("contact_whatsapp", { event_label: "contact_page" });
  trackMetaPixelEvent("Contact", { content_name: "contact_page" });
}

type Channel = {
  key: string;
  title: string;
  market?: "fr" | "id";
  body: string;
  cta: string;
  href: string;
  external?: boolean;
  gold?: boolean;
  onClick?: () => void;
};

export function ContactPageClient() {
  const { t, locale } = useI18n();

  // fr and id show their own market's number; en shows both, France first.
  const waOptions = getWhatsAppOptions(locale);
  const hasSeveralMarkets = waOptions.length > 1;
  const waMessage = t("contact.page.whatsappMessage");

  const channels: Channel[] = [
    {
      key: "email",
      title: t("contact.page.channel1title"),
      body: t("contact.page.channel1body"),
      cta: SUPPORT_EMAIL_DISPLAY,
      href: SUPPORT_MAILTO,
    },
    {
      key: "contact-email",
      title: t("contact.page.channel4title"),
      body: t("contact.page.channel4body"),
      cta: CONTACT_EMAIL_DISPLAY,
      href: CONTACT_MAILTO,
    },
    ...waOptions.map((opt, i) => ({
      key: `whatsapp-${opt.number}`,
      title: t("contact.page.channel2title"),
      market: hasSeveralMarkets ? opt.market : undefined,
      body: t("contact.page.channel2body"),
      cta: t("contact.page.whatsappCta"),
      href: whatsappHref(opt.number, waMessage),
      external: true,
      gold: i === 0,
      onClick: trackWhatsAppClick,
    })),
    {
      key: "docs",
      title: t("contact.page.channel3title"),
      body: t("contact.page.channel3body"),
      cta: t("contact.page.channel3cta"),
      href: getLocalizedPath("/docs", locale),
    },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Hero + primary action */}
      <section className="relative pt-[140px] pb-14 text-center sm:pb-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,color-mix(in_srgb,var(--epi-gold-500)_18%,transparent),transparent_60%)]"
        />
        <div className="relative mx-auto w-full max-w-[1120px] px-5 sm:px-6">
          <div className="epi-eyebrow mb-4">{t("contact.page.eyebrow")}</div>
          <h1 className="epi-display text-epi-cream-50 m-0 text-[clamp(52px,9vw,120px)]">
            {t("contact.page.title1")}{" "}
            <span className="text-epi-gold-400">{t("contact.page.titleAccent")}</span>{" "}
            {t("contact.page.title2")}
          </h1>
          <p className="epi-script text-epi-cream-100 mt-5 text-[clamp(17px,2vw,22px)] opacity-70">
            {t("contact.page.script")}
          </p>

          {/* One button, "24h online support", with the online light; it opens
              both markets' WhatsApp numbers (the visitor's own first). */}
          <div className="mx-auto mt-9 flex w-full max-w-md justify-center sm:max-w-none">
            <WhatsAppSupportMenu
              side="bottom"
              align="center"
              message={waMessage}
              onPick={trackWhatsAppClick}
            >
              <button
                type="button"
                className={cn(PRIMARY_BUTTON, "group min-h-[52px] w-full gap-3 sm:w-auto")}
              >
                <OnlineDot onGold />
                {t("contact.page.supportButton")}
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
                />
              </button>
            </WhatsAppSupportMenu>
          </div>
        </div>
      </section>

      {/* Secondary channels */}
      <section className="pb-24 sm:pb-28">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-6">
          <h2 className="epi-display text-epi-cream-50 m-0 mb-6 text-[clamp(28px,4vw,40px)]">
            {t("contact.page.orTitle")}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {channels.map(({ key, ...channel }, i) => (
              <li key={key}>
                <ChannelCard index={String(i + 1).padStart(2, "0")} {...channel} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function ChannelCard({
  index,
  title,
  market,
  body,
  cta,
  href,
  external,
  gold,
  onClick,
}: Omit<Channel, "key"> & { index: string }) {
  const { locale } = useI18n();
  // The link is stretched over the whole card (after:inset-0) so the tap target
  // is the card, not a 13px line of text. The title stays in the accessible
  // name because two WhatsApp cards share the same "Open chat" label on en.
  const linkClass = [
    "inline-flex min-h-11 items-center text-[13px] font-semibold tracking-[0.04em] [overflow-wrap:anywhere]",
    "after:absolute after:inset-0 after:rounded-2xl",
    "focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-epi-gold-400",
    gold ? "text-epi-gold-400" : "text-epi-cream-50/60",
  ].join(" ");

  const linkContent = (
    <>
      <span className="sr-only">
        {title}
        {market ? ` (${marketName(market, locale)})` : ""}:{" "}
      </span>
      {cta}
    </>
  );

  return (
    <div
      className={[
        "relative flex items-start gap-[18px] rounded-2xl border px-5 py-5 transition-colors sm:px-6",
        gold
          ? "border-epi-gold-500/20 bg-epi-gold-500/[0.04] hover:border-epi-gold-500/40"
          : "border-white/[0.07] bg-white/[0.02] hover:border-white/20",
      ].join(" ")}
    >
      <div
        aria-hidden="true"
        className={[
          "epi-script w-10 shrink-0 text-[28px] leading-none opacity-85",
          gold ? "text-epi-gold-400" : "text-epi-cream-50/40",
        ].join(" ")}
      >
        {index}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-epi-cream-50 m-0 mb-1.5 text-[15px] font-bold">
          {title}
          {market ? (
            <>
              {" "}
              <MarketFlag market={market} />
            </>
          ) : null}
        </h3>
        <p className="text-epi-cream-50/60 m-0 mb-1 text-[13px] leading-normal">{body}</p>
        {href.startsWith("/") ? (
          <Link href={href} className={linkClass}>
            {linkContent}
          </Link>
        ) : (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            onClick={onClick}
            className={linkClass}
          >
            {linkContent}
          </a>
        )}
      </div>
    </div>
  );
}
