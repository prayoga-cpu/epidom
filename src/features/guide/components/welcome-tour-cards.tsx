"use client";

import {
  BarChart3,
  Boxes,
  CalendarClock,
  CalendarDays,
  ChefHat,
  Grid2X2,
  KeyRound,
  LayoutDashboard,
  MenuSquare,
  MessageCircle,
  Monitor,
  MonitorSmartphone,
  Navigation,
  QrCode,
  Store,
  Truck,
  UtensilsCrossed,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/components/lang/i18n-provider";
import { GuideIllustration, GuideTrioIllustration } from "./guide-illustration";
import { GuidePlanBadge, type GuidePlan } from "./guide-plan-badge";

/**
 * The welcome tour's four cards. Every claim here is checked against the code
 * it describes — re-check these when any of them moves:
 *  - the three spaces: Storefront and Back Office (the sidebar) and POS
 *    Mode's shell (src/features/pos-mode);
 *  - Storefront is free, online orders on it are POS (FEATURE_MIN_PLAN.
 *    onlineOrders, enforced in POST /api/public/orders);
 *  - POS System = POS_TABS (pos-mode-tab-bar.tsx), Operational =
 *    OPERATIONAL_TABS (pos-mode/lib/operational-tabs.ts); the schedule tabs
 *    and the Clock tab need staff (hasClockableStaff / a staff persona), and
 *    rosters, attendance and the Staff page are FEATURE_MIN_PLAN.
 *    staffOperations (Operations); the POS trial is 14 days
 *    (subscription.service.ts);
 *  - the way in: /stores' StoreLaunchDialog (POS System | Back Office) and the
 *    Epidom button at the right of POS Mode's status bar (the More drawer);
 *  - Back Office: Menu is Storefront's Menu tab (free); Data, Stock, Staff,
 *    Schedule, Shifts and Finance are all OPERATIONS in navigation.config.ts.
 */
export const TOUR_CARD_IDS = ["spaces", "storefront", "pos", "backOffice"] as const;
export type TourCardId = (typeof TOUR_CARD_IDS)[number];

export const TOUR_CARD_COUNT = TOUR_CARD_IDS.length;

interface TourCardBodyProps {
  card: TourCardId;
}

/** One card: illustration, plan badge, title (the dialog's title) and a few short lines. */
export function TourCardBody({ card }: TourCardBodyProps) {
  switch (card) {
    case "spaces":
      return <SpacesCard />;
    case "storefront":
      return <StorefrontCard />;
    case "pos":
      return <PosCard />;
    case "backOffice":
      return <BackOfficeCard />;
  }
}

function CardHeading({ title, plan }: { title: string; plan?: GuidePlan }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <DialogTitle className="text-xl leading-tight font-bold">{title}</DialogTitle>
      {plan && <GuidePlanBadge plan={plan} />}
    </div>
  );
}

/** A muted "where to find it" line with a pointer icon. */
function WhereLine({ children }: { children: string }) {
  return (
    <p className="bg-muted/60 text-foreground mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm leading-snug">
      <Navigation className="text-epi-gold-600 mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function SpacesCard() {
  const { t } = useI18n();
  const spaces: { icon: LucideIcon; name: string; line: string }[] = [
    {
      icon: Store,
      name: t("setupGuide.tour.storefront.title"),
      line: t("setupGuide.tour.spaces.storefront"),
    },
    {
      icon: MonitorSmartphone,
      name: t("setupGuide.tour.pos.title"),
      line: t("setupGuide.tour.spaces.pos"),
    },
    {
      icon: LayoutDashboard,
      name: t("setupGuide.tour.backOffice.title"),
      line: t("setupGuide.tour.spaces.backOffice"),
    },
  ];
  return (
    <>
      <GuideTrioIllustration icons={[Store, MonitorSmartphone, LayoutDashboard]} />
      <CardHeading title={t("setupGuide.tour.spaces.title")} />
      <DialogDescription className="mt-1.5 text-sm">
        {t("setupGuide.tour.spaces.intro")}
      </DialogDescription>
      <ul className="mt-3 space-y-2">
        {spaces.map(({ icon: Icon, name, line }) => (
          <li key={name} className="flex items-start gap-3">
            <span className="bg-epi-gold-500/15 text-epi-gold-700 dark:text-epi-gold-300 flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-4.5" aria-hidden />
            </span>
            <span className="min-w-0 text-sm leading-snug">
              <span className="block font-semibold">{name}</span>
              <span className="text-muted-foreground">{line}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function StorefrontCard() {
  const { t } = useI18n();
  return (
    <>
      <GuideIllustration main={Store} satellites={[MenuSquare, QrCode, MessageCircle]} />
      <CardHeading title={t("setupGuide.tour.storefront.title")} plan="FREE" />
      <DialogDescription className="text-foreground mt-1.5 text-sm leading-snug">
        {t("setupGuide.tour.storefront.line1")}
      </DialogDescription>
      <p className="text-muted-foreground mt-2 text-sm leading-snug">
        {t("setupGuide.tour.storefront.line2")}
      </p>
      <WhereLine>{t("setupGuide.tour.storefront.where")}</WhereLine>
    </>
  );
}

function Chip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <li className="bg-background inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
      <Icon className="text-epi-gold-600 size-3.5 shrink-0" aria-hidden />
      {label}
    </li>
  );
}

function PosCard() {
  const { t } = useI18n();
  return (
    <>
      <GuideIllustration main={MonitorSmartphone} satellites={[UtensilsCrossed, ChefHat, Wallet]} />
      <CardHeading title={t("setupGuide.tour.pos.title")} plan="POS_TRIAL" />
      <DialogDescription className="mt-1.5 text-sm">
        {t("setupGuide.tour.pos.intro")}
      </DialogDescription>

      <div className="mt-3 space-y-3">
        <div>
          <p className="text-sm font-semibold">{t("nav.posSystem")}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            <Chip icon={Monitor} label={t("nav.pos")} />
            <Chip icon={UtensilsCrossed} label={t("nav.posOrders")} />
            <Chip icon={ChefHat} label={t("nav.posKds")} />
            <Chip icon={Grid2X2} label={t("nav.posTables")} />
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">{t("nav.posOperational")}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            <Chip icon={Wallet} label={t("pos.shift.title")} />
            <Chip icon={CalendarClock} label={t("pages.scheduleMyScheduleTitle")} />
            <Chip icon={CalendarDays} label={t("pos.operational.rosterTab")} />
            <Chip icon={KeyRound} label={t("clockInOut.dialogTitle")} />
          </ul>
          <p className="text-muted-foreground mt-1.5 text-xs leading-snug">
            {t("setupGuide.tour.pos.opsNote")}
          </p>
        </div>
      </div>

      <WhereLine>{t("setupGuide.tour.pos.getThere")}</WhereLine>
    </>
  );
}

function BackOfficeCard() {
  const { t } = useI18n();
  const rows: { icon: LucideIcon; label: string; plan: GuidePlan }[] = [
    { icon: MenuSquare, label: t("setupGuide.tour.backOffice.menu"), plan: "FREE" },
    { icon: Boxes, label: t("setupGuide.tour.backOffice.stock"), plan: "OPERATIONS" },
    { icon: Users, label: t("setupGuide.tour.backOffice.team"), plan: "OPERATIONS" },
    { icon: BarChart3, label: t("setupGuide.tour.backOffice.reports"), plan: "OPERATIONS" },
  ];
  return (
    <>
      <GuideIllustration main={LayoutDashboard} satellites={[Boxes, Truck, BarChart3]} />
      <CardHeading title={t("setupGuide.tour.backOffice.title")} />
      <DialogDescription className="mt-1.5 text-sm">
        {t("setupGuide.tour.backOffice.intro")}
      </DialogDescription>
      <ul className="mt-3 divide-y rounded-lg border">
        {rows.map(({ icon: Icon, label, plan }) => (
          <li key={label} className="flex items-center gap-3 px-3 py-2">
            <Icon className="text-epi-gold-600 size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 text-sm">{label}</span>
            <GuidePlanBadge plan={plan} />
          </li>
        ))}
      </ul>
      <p className="text-foreground mt-3 text-sm leading-snug font-medium">
        {t("setupGuide.tour.backOffice.footer")}
      </p>
    </>
  );
}
