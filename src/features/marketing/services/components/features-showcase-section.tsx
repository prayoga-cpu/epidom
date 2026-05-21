"use client";

import Link from "next/link";
import {
  Smartphone,
  QrCode,
  ShoppingCart,
  CreditCard,
  Package,
  LayoutDashboard,
  Monitor,
  ChefHat,
  LayoutGrid,
  Printer,
  ListOrdered,
  WifiOff,
  Users,
  FlaskConical,
  Boxes,
  Bell,
  Truck,
  BarChart2,
  Building2,
  TrendingUp,
  ShieldCheck,
  Headphones,
  Plug,
  Check,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";

// ─── Tier Overview ───────────────────────────────────────────────────────────

const TIER_CLASSES = {
  free: "border-brand-primary/20 bg-white",
  pos: "border-brand-primary/20 bg-white",
  operations: "border-brand-primary bg-brand-primary text-white",
  enterprise: "border-brand-primary/20 bg-white",
} as const;

const TIER_LABEL_CLASSES = {
  free: "bg-brand-primary/10 text-brand-primary",
  pos: "bg-brand-primary/10 text-brand-primary",
  operations: "bg-white/20 text-white",
  enterprise: "bg-brand-primary/10 text-brand-primary",
} as const;

const TIER_TEXT_CLASSES = {
  free: "text-brand-primary/60",
  pos: "text-brand-primary/60",
  operations: "text-white/80",
  enterprise: "text-brand-primary/60",
} as const;

const TIER_PRICE_CLASSES = {
  free: "text-brand-primary",
  pos: "text-brand-primary",
  operations: "text-white",
  enterprise: "text-brand-primary",
} as const;

const TIER_CTA_CLASSES = {
  free: "bg-brand-primary text-white hover:bg-brand-primary/90",
  pos: "bg-brand-primary text-white hover:bg-brand-primary/90",
  operations: "bg-white text-brand-primary hover:bg-white/90",
  enterprise: "border border-brand-primary text-brand-primary hover:bg-brand-primary/5",
} as const;

type TierKey = "free" | "pos" | "operations" | "enterprise";

function TierOverviewSection() {
  const { t } = useI18n();
  const tiers: TierKey[] = ["free", "pos", "operations", "enterprise"];

  return (
    <section className="py-16 md:py-24 bg-bg-warm">
      <Container maxWidth="7xl">
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-semibold uppercase tracking-widest text-brand-primary/60 mb-3">
            {t("services.tiers.badge")}
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-brand-primary leading-tight mb-3">
            {t("services.tiers.title")}
          </h2>
          <p className="text-brand-primary/60 text-lg">
            {t("services.tiers.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((tier) => (
            <div
              key={tier}
              className={`rounded-2xl border-2 p-6 flex flex-col gap-4 ${TIER_CLASSES[tier]}`}
            >
              <div className="flex flex-col gap-2">
                <span className={`inline-block self-start text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${TIER_LABEL_CLASSES[tier]}`}>
                  {t(`services.tiers.${tier}.name`)}
                </span>
                <p className={`text-sm ${TIER_TEXT_CLASSES[tier]}`}>
                  {t(`services.tiers.${tier}.tagline`)}
                </p>
              </div>
              <div className={`text-2xl font-extrabold ${TIER_PRICE_CLASSES[tier]}`}>
                {t(`services.tiers.${tier}.price`)}
              </div>
              <Link
                href={tier === "enterprise" ? "/contact" : "/register"}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${TIER_CTA_CLASSES[tier]}`}
              >
                {t(`services.tiers.${tier}.cta`)}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ─── Feature Cards ────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  inverted?: boolean;
}

function FeatureCard({ icon, title, desc, inverted }: FeatureCardProps) {
  return (
    <div className={`rounded-2xl p-5 flex flex-col gap-3 ${inverted ? "bg-white/10" : "bg-bg-warm"}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${inverted ? "bg-white/20 text-white" : "bg-brand-primary/10 text-brand-primary"}`}>
        {icon}
      </div>
      <div>
        <h4 className={`font-semibold text-sm mb-1 ${inverted ? "text-white" : "text-brand-primary"}`}>
          {title}
        </h4>
        <p className={`text-sm leading-relaxed ${inverted ? "text-white/70" : "text-brand-primary/60"}`}>
          {desc}
        </p>
      </div>
    </div>
  );
}

// ─── Tier Detail Section ──────────────────────────────────────────────────────

interface TierDetailProps {
  badge: string;
  title: string;
  desc: string;
  features: { icon: React.ReactNode; title: string; desc: string }[];
  highlights?: string[];
  ctaHref: string;
  ctaLabel: string;
  inverted?: boolean;
}

function TierDetailSection({
  badge,
  title,
  desc,
  features,
  highlights,
  ctaHref,
  ctaLabel,
  inverted,
}: TierDetailProps) {
  return (
    <section className={`py-16 md:py-24 ${inverted ? "bg-brand-primary" : "bg-white"}`}>
      <Container maxWidth="7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Left: text */}
          <div className="flex flex-col gap-6">
            <span className={`inline-block self-start text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${inverted ? "bg-white/20 text-white" : "bg-brand-primary/10 text-brand-primary"}`}>
              {badge}
            </span>
            <h2 className={`text-3xl md:text-4xl font-extrabold leading-tight ${inverted ? "text-white" : "text-brand-primary"}`}>
              {title}
            </h2>
            <p className={`text-lg leading-relaxed ${inverted ? "text-white/70" : "text-brand-primary/60"}`}>
              {desc}
            </p>
            {highlights && (
              <ul className="flex flex-col gap-2">
                {highlights.map((h, i) => (
                  <li key={i} className={`flex items-center gap-2 text-sm font-medium ${inverted ? "text-white/90" : "text-brand-primary"}`}>
                    <Check className={`w-4 h-4 flex-shrink-0 ${inverted ? "text-white" : "text-brand-primary"}`} />
                    {h}
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={ctaHref}
              className={`inline-flex items-center gap-2 self-start rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${inverted ? "bg-white text-brand-primary hover:bg-white/90" : "bg-brand-primary text-white hover:bg-brand-primary/90"}`}
            >
              {ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Right: feature cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((feat, i) => (
              <FeatureCard
                key={i}
                icon={feat.icon}
                title={feat.title}
                desc={feat.desc}
                inverted={inverted}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

// ─── Services CTA ─────────────────────────────────────────────────────────────

function ServicesCta() {
  const { t } = useI18n();
  return (
    <section className="py-16 md:py-24 bg-bg-warm">
      <Container maxWidth="4xl">
        <div className="text-center flex flex-col items-center gap-6">
          <h2 className="text-3xl md:text-4xl font-extrabold text-brand-primary leading-tight">
            {t("services.serviceCta.title")}
          </h2>
          <p className="text-brand-primary/60 text-lg max-w-xl">
            {t("services.serviceCta.desc")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary text-white px-6 py-3 text-sm font-semibold hover:bg-brand-primary/90 transition-colors"
            >
              {t("services.serviceCta.primary")}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://wa.me/6281234567890"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-primary text-brand-primary px-6 py-3 text-sm font-semibold hover:bg-brand-primary/5 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              {t("services.serviceCta.secondary")}
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function FeaturesShowcaseSection() {
  const { t } = useI18n();

  const freeTierFeatures = [
    { icon: <Smartphone className="w-5 h-5" />, title: t("services.freeTier.feat1.title"), desc: t("services.freeTier.feat1.desc") },
    { icon: <QrCode className="w-5 h-5" />, title: t("services.freeTier.feat2.title"), desc: t("services.freeTier.feat2.desc") },
    { icon: <ShoppingCart className="w-5 h-5" />, title: t("services.freeTier.feat3.title"), desc: t("services.freeTier.feat3.desc") },
    { icon: <CreditCard className="w-5 h-5" />, title: t("services.freeTier.feat4.title"), desc: t("services.freeTier.feat4.desc") },
    { icon: <Package className="w-5 h-5" />, title: t("services.freeTier.feat5.title"), desc: t("services.freeTier.feat5.desc") },
    { icon: <LayoutDashboard className="w-5 h-5" />, title: t("services.freeTier.feat6.title"), desc: t("services.freeTier.feat6.desc") },
  ];

  const posTierFeatures = [
    { icon: <Monitor className="w-5 h-5" />, title: t("services.posTier.feat1.title"), desc: t("services.posTier.feat1.desc") },
    { icon: <ChefHat className="w-5 h-5" />, title: t("services.posTier.feat2.title"), desc: t("services.posTier.feat2.desc") },
    { icon: <LayoutGrid className="w-5 h-5" />, title: t("services.posTier.feat3.title"), desc: t("services.posTier.feat3.desc") },
    { icon: <Printer className="w-5 h-5" />, title: t("services.posTier.feat4.title"), desc: t("services.posTier.feat4.desc") },
    { icon: <ListOrdered className="w-5 h-5" />, title: t("services.posTier.feat5.title"), desc: t("services.posTier.feat5.desc") },
    { icon: <WifiOff className="w-5 h-5" />, title: t("services.posTier.feat6.title"), desc: t("services.posTier.feat6.desc") },
  ];

  const operationsTierFeatures = [
    { icon: <Users className="w-5 h-5" />, title: t("services.operationsTier.feat1.title"), desc: t("services.operationsTier.feat1.desc") },
    { icon: <FlaskConical className="w-5 h-5" />, title: t("services.operationsTier.feat2.title"), desc: t("services.operationsTier.feat2.desc") },
    { icon: <Boxes className="w-5 h-5" />, title: t("services.operationsTier.feat3.title"), desc: t("services.operationsTier.feat3.desc") },
    { icon: <Bell className="w-5 h-5" />, title: t("services.operationsTier.feat4.title"), desc: t("services.operationsTier.feat4.desc") },
    { icon: <Truck className="w-5 h-5" />, title: t("services.operationsTier.feat5.title"), desc: t("services.operationsTier.feat5.desc") },
    { icon: <BarChart2 className="w-5 h-5" />, title: t("services.operationsTier.feat6.title"), desc: t("services.operationsTier.feat6.desc") },
  ];

  const enterpriseTierFeatures = [
    { icon: <Building2 className="w-5 h-5" />, title: t("services.enterpriseTier.feat1.title"), desc: t("services.enterpriseTier.feat1.desc") },
    { icon: <TrendingUp className="w-5 h-5" />, title: t("services.enterpriseTier.feat2.title"), desc: t("services.enterpriseTier.feat2.desc") },
    { icon: <LayoutDashboard className="w-5 h-5" />, title: t("services.enterpriseTier.feat3.title"), desc: t("services.enterpriseTier.feat3.desc") },
    { icon: <ShieldCheck className="w-5 h-5" />, title: t("services.enterpriseTier.feat4.title"), desc: t("services.enterpriseTier.feat4.desc") },
    { icon: <Headphones className="w-5 h-5" />, title: t("services.enterpriseTier.feat5.title"), desc: t("services.enterpriseTier.feat5.desc") },
    { icon: <Plug className="w-5 h-5" />, title: t("services.enterpriseTier.feat6.title"), desc: t("services.enterpriseTier.feat6.desc") },
  ];

  return (
    <>
      <TierOverviewSection />

      <TierDetailSection
        badge={t("services.freeTier.badge")}
        title={t("services.freeTier.title")}
        desc={t("services.freeTier.desc")}
        features={freeTierFeatures}
        ctaHref="/register"
        ctaLabel={t("services.tiers.free.cta")}
      />

      <TierDetailSection
        badge={t("services.posTier.badge")}
        title={t("services.posTier.title")}
        desc={t("services.posTier.desc")}
        features={posTierFeatures}
        ctaHref="/register"
        ctaLabel={t("services.tiers.pos.cta")}
        inverted
      />

      <TierDetailSection
        badge={t("services.operationsTier.badge")}
        title={t("services.operationsTier.title")}
        desc={t("services.operationsTier.desc")}
        features={operationsTierFeatures}
        ctaHref="/register"
        ctaLabel={t("services.tiers.operations.cta")}
      />

      <TierDetailSection
        badge={t("services.enterpriseTier.badge")}
        title={t("services.enterpriseTier.title")}
        desc={t("services.enterpriseTier.desc")}
        features={enterpriseTierFeatures}
        ctaHref="/contact"
        ctaLabel={t("services.tiers.enterprise.cta")}
        inverted
      />

      <ServicesCta />
    </>
  );
}
