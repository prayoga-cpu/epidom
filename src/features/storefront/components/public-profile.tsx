"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Phone,
  Instagram,
  MapPin,
  ExternalLink,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Globe,
  CalendarClock,
  Users,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { getPremiumTheme } from "@/lib/utils/color";
import { EpidomMark } from "@/features/marketing/shared/components/epidom-logo";
import { useI18n } from "@/components/lang/i18n-provider";
import { StorefrontControls } from "@/features/storefront/components/storefront-controls";

interface CustomLink {
  label: string;
  url: string;
}

interface OpeningHoursDay {
  open?: string;
  close?: string;
  isClosed?: boolean;
}

interface OpeningHours {
  monday?: OpeningHoursDay;
  tuesday?: OpeningHoursDay;
  wednesday?: OpeningHoursDay;
  thursday?: OpeningHoursDay;
  friday?: OpeningHoursDay;
  saturday?: OpeningHoursDay;
  sunday?: OpeningHoursDay;
}

interface ReservableTable {
  id: string;
  label: string;
  capacity: number;
}

interface PublicProfileProps {
  storefront: {
    id: string;
    slug: string;
    displayName: string;
    tagline: string | null;
    description: string | null;
    logoUrl: string | null;
    heroImageUrl: string | null;
    themeColor: string;
    fontFamily: string;
    whatsappNumber: string | null;
    instagramUrl: string | null;
    tiktokUrl: string | null;
    gofoodUrl: string | null;
    grabfoodUrl: string | null;
    shopeefoodUrl: string | null;
    googleMapsUrl: string | null;
    customLinks: any;
    openingHours: any;
    acceptsOrders: boolean;
    acceptsReservations: boolean;
    reservableTables: ReservableTable[];
  };
}

export function PublicProfile({ storefront }: PublicProfileProps) {
  const { t, locale } = useI18n();
  const [showHours, setShowHours] = useState(false);
  const [showReservation, setShowReservation] = useState(false);

  const customLinksList = (storefront.customLinks as CustomLink[]) || [];
  const hours = (storefront.openingHours as OpeningHours) || {};

  const checkIfOpenNow = (): { isOpen: boolean; text: string } => {
    try {
      const now = new Date();
      const currentDay = now
        .toLocaleDateString("en-US", { weekday: "long" })
        .toLowerCase() as keyof OpeningHours;
      const dayHours = hours[currentDay];
      if (!dayHours || dayHours.isClosed || !dayHours.open || !dayHours.close)
        return { isOpen: false, text: t("publicProfile.closedToday") };
      const [openH, openM] = dayHours.open.split(":").map(Number);
      const [closeH, closeM] = dayHours.close.split(":").map(Number);
      const nowMins = now.getHours() * 60 + now.getMinutes();
      if (nowMins >= openH * 60 + openM && nowMins <= closeH * 60 + closeM)
        return {
          isOpen: true,
          text: t("publicProfile.openUntil").replace("{time}", dayHours.close),
        };
      return {
        isOpen: false,
        text: t("publicProfile.closedOpensAt").replace("{time}", dayHours.open),
      };
    } catch {
      return { isOpen: false, text: t("publicProfile.checkHours") };
    }
  };

  // Compute the time-based open/closed status on the client only. Doing it during
  // render would diverge between the server and client clocks/timezone and trip a
  // React hydration mismatch.
  const [status, setStatus] = useState<{ isOpen: boolean; text: string } | null>(null);
  React.useEffect(() => {
    const compute = () => setStatus(checkIfOpenNow());
    compute();
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const socials = [
    {
      icon: Phone,
      url: storefront.whatsappNumber
        ? `https://wa.me/${storefront.whatsappNumber.replace(/[^0-9]/g, "")}`
        : null,
      label: "WhatsApp",
    },
    { icon: Instagram, url: storefront.instagramUrl, label: "Instagram" },
    { icon: Globe, url: storefront.tiktokUrl, label: "TikTok" },
    { icon: MapPin, url: storefront.googleMapsUrl, label: "Google Maps" },
  ].filter((s) => s.url);

  const deliveries = [
    {
      label: "GoFood",
      url: storefront.gofoodUrl,
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      label: "GrabFood",
      url: storefront.grabfoodUrl,
      bg: "bg-green-50 text-green-700 border-green-200",
    },
    {
      label: "ShopeeFood",
      url: storefront.shopeefoodUrl,
      bg: "bg-orange-50 text-orange-700 border-orange-200",
    },
  ].filter((d) => d.url);

  const formatDayName = (day: string) => t("publicProfile.days." + day);

  const safeTheme = getPremiumTheme(storefront.themeColor || "#FF6B35");
  const themeStyle = {
    fontFamily: storefront.fontFamily === "Mono" ? "monospace" : "var(--font-sans)",
    "--store-theme": safeTheme,
    "--store-theme-light": `color-mix(in srgb, ${safeTheme} 15%, transparent)`,
    "--store-theme-gradient": `linear-gradient(135deg, ${safeTheme}, color-mix(in srgb, ${safeTheme} 40%, black))`,
  } as React.CSSProperties;

  return (
    <div className="flex min-h-screen flex-col" style={themeStyle}>
      {/* Hero banner */}
      <div className="bg-muted relative h-44 w-full overflow-hidden md:h-72">
        {storefront.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={storefront.heroImageUrl}
            alt={storefront.displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full opacity-80"
            style={{ background: "var(--store-theme-gradient)" }}
          />
        )}
        <div className="absolute top-3 right-3 z-10">
          <StorefrontControls />
        </div>
      </div>

      {/* Content */}
      <div className="relative -mt-16 flex-1 px-4 pb-6 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="md:grid md:grid-cols-[300px_1fr] md:items-start md:gap-10">
            {/* ── Left: profile identity ── */}
            <div className="flex flex-col items-center md:items-start">
              <div className="border-card bg-muted relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 shadow-md">
                {storefront.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={storefront.logoUrl}
                    alt={`${storefront.displayName} Logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground text-3xl font-bold">
                    {storefront.displayName.charAt(0)}
                  </span>
                )}
              </div>

              <h1 className="text-foreground mt-4 text-center text-2xl font-extrabold tracking-tight md:text-left">
                {storefront.displayName}
              </h1>
              {storefront.tagline && (
                <p className="text-muted-foreground mt-1 text-center text-sm font-medium italic md:text-left">
                  {storefront.tagline}
                </p>
              )}
              {storefront.description && (
                <p className="text-muted-foreground mt-3 max-w-sm text-center text-sm md:text-left">
                  {storefront.description}
                </p>
              )}

              {/* Open status (client-computed) */}
              {status && (
                <div className="border-border bg-card mt-4 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${status.isOpen ? "animate-pulse bg-emerald-500" : "bg-destructive"}`}
                  />
                  <span
                    className={
                      status.isOpen ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
                    }
                  >
                    {status.text}
                  </span>
                </div>
              )}

              {/* Social icons */}
              {socials.length > 0 && (
                <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
                  {socials.map((social, i) => {
                    const Icon = social.icon;
                    return (
                      <a
                        key={i}
                        href={social.url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-muted hover:bg-muted border-border text-foreground flex items-center justify-center rounded-full border p-3 transition"
                        title={social.label}
                      >
                        <Icon className="size-5" />
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Mobile CTAs */}
              <div className="mt-6 w-full space-y-3 md:hidden">
                <Link
                  href={`/@${storefront.slug}/menu`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 font-bold text-white shadow-lg transition-transform hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: "var(--store-theme)" }}
                >
                  <MessageSquare className="size-5" />
                  <span>{t("publicProfile.viewMenu")}</span>
                </Link>
                {storefront.acceptsReservations && (
                  <button
                    onClick={() => setShowReservation(true)}
                    className="text-foreground bg-card hover:bg-muted flex w-full items-center justify-center gap-2 rounded-xl border-2 px-6 py-4 font-bold shadow-sm transition active:scale-[0.98]"
                    style={{ borderColor: "var(--store-theme)", color: "var(--store-theme)" }}
                  >
                    <CalendarClock className="size-5" />
                    <span>{t("publicProfile.reserveTable")}</span>
                  </button>
                )}
              </div>
            </div>

            {/* ── Right: actions ── */}
            <div className="mt-8 flex flex-col gap-6 md:mt-0 md:pt-[7.5rem]">
              {/* Desktop CTAs */}
              <div className="hidden flex-col gap-3 md:flex">
                <Link
                  href={`/@${storefront.slug}/menu`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 font-bold text-white shadow-lg transition-transform hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: "var(--store-theme)" }}
                >
                  <MessageSquare className="size-5" />
                  <span>{t("publicProfile.viewMenu")}</span>
                </Link>
                {storefront.acceptsReservations && (
                  <button
                    onClick={() => setShowReservation(true)}
                    className="bg-card hover:bg-muted flex w-full items-center justify-center gap-2 rounded-xl border-2 px-6 py-4 font-bold shadow-sm transition active:scale-[0.98]"
                    style={{ borderColor: "var(--store-theme)", color: "var(--store-theme)" }}
                  >
                    <CalendarClock className="size-5" />
                    <span>{t("publicProfile.reserveTable")}</span>
                  </button>
                )}
              </div>

              {/* Delivery apps */}
              {deliveries.length > 0 && (
                <div>
                  <h2 className="text-muted-foreground mb-3 text-center text-xs font-bold tracking-wider uppercase md:text-left">
                    {t("publicProfile.deliveryApps")}
                  </h2>
                  <div className="grid grid-cols-3 gap-2">
                    {deliveries.map((del, i) => (
                      <a
                        key={i}
                        href={del.url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-center rounded-lg border px-2 py-3 text-xs font-bold transition hover:opacity-90 active:scale-[0.98] ${del.bg}`}
                      >
                        {del.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom links */}
              {customLinksList.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-muted-foreground text-center text-xs font-bold tracking-wider uppercase md:text-left">
                    {t("publicProfile.links")}
                  </h2>
                  {customLinksList.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-border bg-card hover:bg-muted text-foreground flex w-full items-center justify-between rounded-xl border p-4 shadow-sm transition active:scale-[0.99]"
                    >
                      <span className="text-sm font-semibold">{link.label}</span>
                      <ExternalLink className="text-muted-foreground size-4 shrink-0" />
                    </a>
                  ))}
                </div>
              )}

              {/* Opening hours */}
              {Object.keys(hours).length > 0 && (
                <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
                  <button
                    onClick={() => setShowHours(!showHours)}
                    className="text-foreground hover:bg-muted flex w-full items-center justify-between p-4 transition"
                  >
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <Clock className="text-muted-foreground size-4" />
                      <span>{t("publicProfile.openingHours")}</span>
                    </span>
                    {showHours ? (
                      <ChevronUp className="text-muted-foreground size-4" />
                    ) : (
                      <ChevronDown className="text-muted-foreground size-4" />
                    )}
                  </button>
                  {showHours && (
                    <div className="bg-muted/50 space-y-2 border-t px-4 py-3 text-xs">
                      {(
                        [
                          "monday",
                          "tuesday",
                          "wednesday",
                          "thursday",
                          "friday",
                          "saturday",
                          "sunday",
                        ] as Array<keyof OpeningHours>
                      ).map((day) => {
                        const dayHour = hours[day];
                        return (
                          <div key={day} className="text-muted-foreground flex justify-between">
                            <span className="font-medium">{formatDayName(day)}</span>
                            <span>
                              {dayHour?.isClosed || !dayHour?.open || !dayHour?.close
                                ? t("publicProfile.closed")
                                : `${dayHour.open} – ${dayHour.close}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reservation modal */}
      {showReservation && (
        <ReservationModal
          slug={storefront.slug}
          tables={storefront.reservableTables}
          onClose={() => setShowReservation(false)}
        />
      )}

      {/* Footer — compact, brand-marked */}
      <footer className="border-border/60 mt-auto border-t py-3 text-center">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition"
        >
          <span className="text-[11px] font-medium">{t("publicProfile.poweredBy")}</span>
          <EpidomMark size={15} />
          <span className="epi-display text-foreground text-sm leading-none tracking-[0.12em]">
            EPIDOM
          </span>
        </Link>
      </footer>
    </div>
  );
}

// ── Reservation modal ──────────────────────────────────────────────────────────

interface ReservationModalProps {
  slug: string;
  tables: ReservableTable[];
  onClose: () => void;
}

function ReservationModal({ slug, tables, onClose }: ReservationModalProps) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    guestName: "",
    guestPhone: "",
    guestEmail: "",
    partySize: 2,
    tableId: "",
    date: "",
    time: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minDate = new Date().toISOString().split("T")[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.guestName.trim() || !form.date || !form.time) {
      setError(t("publicProfile.reservation.fillRequired"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}:00Z`).toISOString();
      const body: Record<string, unknown> = {
        storefrontSlug: slug,
        guestName: form.guestName.trim(),
        partySize: form.partySize,
        scheduledAt,
      };
      if (form.guestPhone.trim()) body.guestPhone = form.guestPhone.trim();
      if (form.guestEmail.trim()) body.guestEmail = form.guestEmail.trim();
      if (form.tableId) body.tableId = form.tableId;
      if (form.notes.trim()) body.notes = form.notes.trim();

      const res = await fetch("/api/public/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message || t("publicProfile.reservation.bookFailed"));
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("publicProfile.reservation.genericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-card max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl shadow-2xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card border-border sticky top-0 flex items-center justify-between rounded-t-2xl border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="text-muted-foreground h-5 w-5" />
            <h2 className="text-foreground text-base font-bold">
              {t("publicProfile.reservation.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none transition"
          >
            ×
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-foreground text-lg font-bold">
              {t("publicProfile.reservation.requested")}
            </p>
            <p className="text-muted-foreground text-sm">
              {t("publicProfile.reservation.confirmSoon")}
            </p>
            <button
              onClick={onClose}
              className="bg-foreground text-background hover:bg-foreground/80 mt-4 rounded-xl px-6 py-2.5 text-sm font-semibold transition"
            >
              {t("publicProfile.reservation.close")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
            {/* Guest name */}
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {t("publicProfile.reservation.nameLabel")} *
              </label>
              <input
                className="border-border focus:ring-ring w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                placeholder={t("publicProfile.reservation.namePlaceholder")}
                value={form.guestName}
                onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                required
              />
            </div>

            {/* Phone + Email row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t("publicProfile.reservation.phoneLabel")}
                </label>
                <input
                  className="border-border focus:ring-ring w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                  placeholder={t("publicProfile.reservation.phonePlaceholder")}
                  type="tel"
                  value={form.guestPhone}
                  onChange={(e) => setForm((f) => ({ ...f, guestPhone: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t("publicProfile.reservation.emailLabel")}
                </label>
                <input
                  className="border-border focus:ring-ring w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                  placeholder={t("publicProfile.reservation.emailPlaceholder")}
                  type="email"
                  value={form.guestEmail}
                  onChange={(e) => setForm((f) => ({ ...f, guestEmail: e.target.value }))}
                />
              </div>
            </div>

            {/* Date + Time row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t("publicProfile.reservation.dateLabel")} *
                </label>
                <input
                  className="border-border focus:ring-ring w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                  type="date"
                  min={minDate}
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t("publicProfile.reservation.timeLabel")} *
                </label>
                <input
                  className="border-border focus:ring-ring w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Party size */}
            <div className="space-y-1">
              <label className="text-muted-foreground flex items-center gap-1 text-xs font-semibold tracking-wide uppercase">
                <Users className="h-3 w-3" /> {t("publicProfile.reservation.partySize")} *
              </label>
              <input
                className="border-border focus:ring-ring w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                type="number"
                min={1}
                max={50}
                value={form.partySize}
                onChange={(e) => setForm((f) => ({ ...f, partySize: Number(e.target.value) }))}
                required
              />
            </div>

            {/* Table preference */}
            {tables.length > 0 && (
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t("publicProfile.reservation.tablePreference")}
                </label>
                <select
                  className="border-border focus:ring-ring bg-card w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                  value={form.tableId}
                  onChange={(e) => setForm((f) => ({ ...f, tableId: e.target.value }))}
                >
                  <option value="">{t("publicProfile.reservation.noPreference")}</option>
                  {tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.label}{" "}
                      {"(" +
                        t("publicProfile.reservation.upToPax").replace(
                          "{n}",
                          String(table.capacity)
                        ) +
                        ")"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {t("publicProfile.reservation.specialRequests")}
              </label>
              <textarea
                className="border-border focus:ring-ring w-full resize-none rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                rows={2}
                placeholder={t("publicProfile.reservation.specialRequestsPlaceholder")}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {error && (
              <p className="text-destructive bg-destructive/10 border-destructive/30 rounded-lg border px-3 py-2 text-xs">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition disabled:opacity-60"
              style={{ backgroundColor: "var(--store-theme)" }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="h-4 w-4" />
              )}
              {loading
                ? t("publicProfile.reservation.booking")
                : t("publicProfile.reservation.confirm")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
