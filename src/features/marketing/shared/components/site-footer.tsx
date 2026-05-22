"use client";

import { memo } from "react";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "./container";
import { EpidomLogo } from "./epidom-logo";
import { PrionationMark } from "./prionation-mark";

const SOCIAL = [
  {
    label: "Instagram",
    href: "https://instagram.com/epidom.id",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@epidom",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.95a8.23 8.23 0 004.83 1.54V7.07a4.85 4.85 0 01-1.06-.38z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/company/epidom",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  {
    label: "X / Twitter",
    href: "https://x.com/epidomid",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
] as const;

export const SiteFooter = memo(function SiteFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "80px 0 40px",
        background: "linear-gradient(180deg, var(--epi-navy-900) 0%, var(--epi-navy-950) 100%)",
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--epi-font-body)",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          left: "50%",
          bottom: "-600px",
          transform: "translateX(-50%)",
          background: "radial-gradient(circle, rgba(217,174,59,0.12), transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="7xl" className="relative z-10 px-4 sm:px-6 lg:px-8">
        {/* Top grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr repeat(4, 1fr)",
            gap: "40px 32px",
            paddingBottom: 64,
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid!"
        >
          {/* Brand */}
          <div>
            <EpidomLogo size={34} />
            <p
              style={{
                color: "rgba(251,249,228,0.52)",
                fontSize: 14,
                maxWidth: 240,
                lineHeight: 1.65,
                marginTop: 18,
                marginBottom: 28,
              }}
            >
              {t("footer.tagline")}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {SOCIAL.map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  style={{
                    display: "flex",
                    width: 36,
                    height: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(251,249,228,0.42)",
                    transition: "all 0.15s ease",
                    textDecoration: "none",
                  }}
                  className="hover:border-white/25 hover:bg-white/5 hover:text-white/80"
                >
                  {s.icon}
                </Link>
              ))}
            </div>
          </div>

          {/* Product */}
          <FooterCol
            heading={t("footer.colProduct")}
            links={[
              { label: t("footer.linkHome"), href: "/" },
              { label: t("footer.linkFeatures"), href: "/services" },
              { label: t("footer.linkPricing"), href: "/pricing" },
              { label: t("footer.linkContact"), href: "/contact" },
              { label: t("footer.linkChangelog"), href: "/changelog" },
              { label: t("footer.linkStatus"), href: "/status" },
            ]}
          />

          {/* Company */}
          <FooterCol
            heading={t("footer.colCompany")}
            links={[
              { label: t("footer.linkAbout"), href: "/about" },
              { label: t("footer.linkBlog"), href: "/blog" },
              { label: t("footer.linkCareers"), href: "/careers" },
              { label: t("footer.linkPress"), href: "/press" },
              { label: t("footer.linkPartners"), href: "/partners" },
            ]}
          />

          {/* Legal */}
          <FooterCol
            heading={t("footer.colLegal")}
            links={[
              { label: t("footer.linkTerms"), href: "/terms" },
              { label: t("footer.linkPrivacy"), href: "/privacy" },
              { label: t("footer.linkRefunds"), href: "/refund-policy" },
              { label: t("footer.linkCookies"), href: "/cookie-policy" },
              { label: t("footer.linkGdpr"), href: "/gdpr" },
            ]}
          />

          {/* Contact */}
          <div>
            <h4
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--epi-gold-500)",
                fontWeight: 700,
                marginBottom: 20,
              }}
            >
              {t("footer.contact")}
            </h4>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <li>
                <ContactRow icon={<MailIcon />}>
                  <Link
                    href="mailto:support@epidom.id"
                    style={linkStyle}
                    className="hover:text-[rgba(251,249,228,0.9)]"
                  >
                    support@epidom.id
                  </Link>
                </ContactRow>
              </li>
              <li>
                <ContactRow icon={<WaIcon />}>
                  <Link
                    href="https://wa.me/6281234567890"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkStyle}
                    className="hover:text-[rgba(251,249,228,0.9)]"
                  >
                    WhatsApp
                  </Link>
                </ContactRow>
              </li>
              <li>
                <ContactRow icon={<PinIcon />}>
                  <span style={{ fontSize: 14, color: "rgba(251,249,228,0.5)" }}>
                    {t("footer.address")}
                  </span>
                </ContactRow>
              </li>
            </ul>
          </div>
        </div>

        {/* Big wordmark */}
        <div
          className="hidden select-none sm:block"
          style={{
            fontFamily: "var(--epi-font-display)",
            fontSize: "clamp(64px, 13vw, 195px)",
            letterSpacing: "0.04em",
            lineHeight: 0.85,
            color: "transparent",
            WebkitTextStroke: "1px rgba(245,244,220,0.08)",
            textAlign: "center",
            marginTop: 52,
            marginBottom: 24,
            userSelect: "none",
          }}
        >
          ÉPIDOM
        </div>

        {/* PRIONATION credit */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              padding: "8px 16px",
            }}
          >
            <span style={{ fontSize: 11, letterSpacing: "0.1em", color: "rgba(255,255,255,0.32)" }}>
              Infrastructured by
            </span>
            <Link
              href="https://prionation.io"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "var(--epi-gold-400)",
                textDecoration: "none",
              }}
              className="transition-opacity hover:opacity-75"
            >
              <PrionationMark size={13} />
              <span>PRIONATION.io</span>
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px 24px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingTop: 20,
            fontSize: 12,
            letterSpacing: "0.04em",
            color: "rgba(255,255,255,0.28)",
          }}
        >
          <span>{`© ${year} Epidom. All rights reserved.`}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
            {[
              { label: t("footer.linkTerms"), href: "/terms" },
              { label: t("footer.linkPrivacy"), href: "/privacy" },
              { label: t("footer.linkRefunds"), href: "/refund-policy" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                style={{ color: "inherit", textDecoration: "none" }}
                className="hover:text-white/55"
              >
                {l.label}
              </Link>
            ))}
            <span>epidom.id</span>
          </div>
        </div>
      </Container>
    </footer>
  );
});

const linkStyle: React.CSSProperties = {
  fontSize: 14,
  color: "rgba(251,249,228,0.5)",
  textDecoration: "none",
  transition: "color 0.12s",
};

function FooterCol({
  heading,
  links,
}: {
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--epi-gold-500)",
          fontWeight: 700,
          marginBottom: 20,
        }}
      >
        {heading}
      </h4>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} style={linkStyle} className="hover:text-[rgba(251,249,228,0.9)]">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ marginTop: 2, color: "rgba(217,174,59,0.65)", flexShrink: 0 }}>{icon}</span>
      {children}
    </div>
  );
}

function MailIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
  );
}

function WaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.552 4.122 1.523 5.854L0 24l6.335-1.492A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.882 0-3.659-.5-5.2-1.378l-.372-.215-3.758.884.934-3.65-.236-.389A10 10 0 012 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
