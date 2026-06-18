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
        return { isOpen: false, text: "Closed today" };
      const [openH, openM] = dayHours.open.split(":").map(Number);
      const [closeH, closeM] = dayHours.close.split(":").map(Number);
      const nowMins = now.getHours() * 60 + now.getMinutes();
      if (nowMins >= openH * 60 + openM && nowMins <= closeH * 60 + closeM)
        return { isOpen: true, text: `Open until ${dayHours.close}` };
      return { isOpen: false, text: `Closed. Opens at ${dayHours.open}` };
    } catch {
      return { isOpen: false, text: "Check hours below" };
    }
  };

  const status = checkIfOpenNow();

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
    { label: "GoFood", url: storefront.gofoodUrl, bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { label: "GrabFood", url: storefront.grabfoodUrl, bg: "bg-green-50 text-green-700 border-green-200" },
    { label: "ShopeeFood", url: storefront.shopeefoodUrl, bg: "bg-orange-50 text-orange-700 border-orange-200" },
  ].filter((d) => d.url);

  const formatDayName = (day: string) =>
    ({ monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday" }[day] ?? day);

  const safeTheme = getPremiumTheme(storefront.themeColor || "#FF6B35");
  const themeStyle = {
    fontFamily: storefront.fontFamily === "Mono" ? "monospace" : "var(--font-sans)",
    "--store-theme": safeTheme,
    "--store-theme-light": `color-mix(in srgb, ${safeTheme} 15%, transparent)`,
    "--store-theme-gradient": `linear-gradient(135deg, ${safeTheme}, color-mix(in srgb, ${safeTheme} 40%, black))`,
  } as React.CSSProperties;

  return (
    <div className="flex flex-col min-h-screen" style={themeStyle}>
      {/* Hero banner */}
      <div className="relative h-44 md:h-72 w-full overflow-hidden bg-slate-200">
        {storefront.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={storefront.heroImageUrl} alt={storefront.displayName} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full opacity-80" style={{ background: "var(--store-theme-gradient)" }} />
        )}
      </div>

      {/* Content */}
      <div className="relative flex-1 -mt-16 px-4 sm:px-6 pb-10">
        <div className="max-w-5xl mx-auto">
          <div className="md:grid md:grid-cols-[300px_1fr] md:gap-10 md:items-start">

            {/* ── Left: profile identity ── */}
            <div className="flex flex-col items-center md:items-start">
              <div className="relative size-28 rounded-full border-4 border-white bg-slate-100 shadow-md overflow-hidden flex items-center justify-center shrink-0">
                {storefront.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={storefront.logoUrl} alt={`${storefront.displayName} Logo`} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-slate-400">{storefront.displayName.charAt(0)}</span>
                )}
              </div>

              <h1 className="mt-4 text-2xl font-extrabold text-slate-800 text-center md:text-left tracking-tight">
                {storefront.displayName}
              </h1>
              {storefront.tagline && (
                <p className="mt-1 text-sm font-medium text-slate-500 text-center md:text-left italic">{storefront.tagline}</p>
              )}
              {storefront.description && (
                <p className="mt-3 text-sm text-slate-600 text-center md:text-left max-w-sm">{storefront.description}</p>
              )}

              {/* Open status */}
              <div className="mt-4 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm border border-slate-100 bg-white">
                <span className={`h-2.5 w-2.5 rounded-full ${status.isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-400"}`} />
                <span className={status.isOpen ? "text-emerald-700" : "text-rose-600"}>{status.text}</span>
              </div>

              {/* Social icons */}
              {socials.length > 0 && (
                <div className="flex gap-3 mt-6 justify-center md:justify-start flex-wrap">
                  {socials.map((social, i) => {
                    const Icon = social.icon;
                    return (
                      <a key={i} href={social.url!} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center p-3 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition" title={social.label}>
                        <Icon className="size-5" />
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Mobile CTAs */}
              <div className="w-full mt-6 md:hidden space-y-3">
                <Link href={`/@${storefront.slug}/menu`}
                  className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-[0.98] hover:opacity-90"
                  style={{ backgroundColor: "var(--store-theme)" }}>
                  <MessageSquare className="size-5" />
                  <span>View Menu &amp; Order</span>
                </Link>
                {storefront.acceptsReservations && (
                  <button onClick={() => setShowReservation(true)}
                    className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl font-bold border-2 text-slate-700 bg-white shadow-sm hover:bg-slate-50 transition active:scale-[0.98]"
                    style={{ borderColor: "var(--store-theme)", color: "var(--store-theme)" }}>
                    <CalendarClock className="size-5" />
                    <span>Reserve a Table</span>
                  </button>
                )}
              </div>
            </div>

            {/* ── Right: actions ── */}
            <div className="flex flex-col gap-6 mt-8 md:mt-0 md:pt-[7.5rem]">
              {/* Desktop CTAs */}
              <div className="hidden md:flex flex-col gap-3">
                <Link href={`/@${storefront.slug}/menu`}
                  className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-[0.98] hover:opacity-90"
                  style={{ backgroundColor: "var(--store-theme)" }}>
                  <MessageSquare className="size-5" />
                  <span>View Menu &amp; Order</span>
                </Link>
                {storefront.acceptsReservations && (
                  <button onClick={() => setShowReservation(true)}
                    className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl font-bold border-2 bg-white shadow-sm hover:bg-slate-50 transition active:scale-[0.98]"
                    style={{ borderColor: "var(--store-theme)", color: "var(--store-theme)" }}>
                    <CalendarClock className="size-5" />
                    <span>Reserve a Table</span>
                  </button>
                )}
              </div>

              {/* Delivery apps */}
              {deliveries.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center md:text-left mb-3">Order via Delivery App</h2>
                  <div className="grid grid-cols-3 gap-2">
                    {deliveries.map((del, i) => (
                      <a key={i} href={del.url!} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center justify-center py-3 px-2 border rounded-lg text-xs font-bold transition active:scale-[0.98] hover:opacity-90 ${del.bg}`}>
                        {del.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom links */}
              {customLinksList.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center md:text-left">Links</h2>
                  {customLinksList.map((link, idx) => (
                    <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between w-full p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition active:scale-[0.99]">
                      <span className="font-semibold text-sm">{link.label}</span>
                      <ExternalLink className="size-4 text-slate-400 shrink-0" />
                    </a>
                  ))}
                </div>
              )}

              {/* Opening hours */}
              {Object.keys(hours).length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <button onClick={() => setShowHours(!showHours)}
                    className="flex items-center justify-between w-full p-4 text-slate-700 hover:bg-slate-50 transition">
                    <span className="flex items-center gap-2 font-bold text-sm">
                      <Clock className="size-4 text-slate-400" />
                      <span>Opening Hours</span>
                    </span>
                    {showHours ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
                  </button>
                  {showHours && (
                    <div className="border-t px-4 py-3 bg-slate-50/50 space-y-2 text-xs">
                      {(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as Array<keyof OpeningHours>).map((day) => {
                        const dayHour = hours[day];
                        return (
                          <div key={day} className="flex justify-between text-slate-600">
                            <span className="font-medium">{formatDayName(day)}</span>
                            <span>{dayHour?.isClosed || !dayHour?.open || !dayHour?.close ? "Closed" : `${dayHour.open} – ${dayHour.close}`}</span>
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

      {/* Footer */}
      <div className="py-6 text-center border-t border-slate-100 bg-slate-50/30">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium hover:text-slate-600 transition">
          <span>Powered by</span>
          <span className="font-bold text-slate-700">Epidom</span>
        </Link>
      </div>
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
      setError("Please fill in your name, date, and time.");
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
      if (!res.ok) throw new Error(json.error?.message || "Failed to book");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-bold text-slate-800">Reserve a Table</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition text-xl leading-none">×</button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-lg font-bold text-slate-800">Reservation Requested!</p>
            <p className="text-sm text-slate-500">We'll confirm your booking shortly. Thank you!</p>
            <button onClick={onClose} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700 transition">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
            {/* Guest name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Name *</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Your name"
                value={form.guestName}
                onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                required
              />
            </div>

            {/* Phone + Email row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Phone</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="+62..."
                  type="tel"
                  value={form.guestPhone}
                  onChange={(e) => setForm((f) => ({ ...f, guestPhone: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Email</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="you@email.com"
                  type="email"
                  value={form.guestEmail}
                  onChange={(e) => setForm((f) => ({ ...f, guestEmail: e.target.value }))}
                />
              </div>
            </div>

            {/* Date + Time row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Date *</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  type="date"
                  min={minDate}
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Time *</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Party size */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                <Users className="h-3 w-3" /> Party Size *
              </label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
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
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Table Preference</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                  value={form.tableId}
                  onChange={(e) => setForm((f) => ({ ...f, tableId: e.target.value }))}
                >
                  <option value="">No preference</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} (up to {t.capacity} pax)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Special Requests</label>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                rows={2}
                placeholder="Allergies, birthday setup, high chair, etc."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-60"
              style={{ backgroundColor: "var(--store-theme)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              {loading ? "Booking..." : "Confirm Reservation"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
