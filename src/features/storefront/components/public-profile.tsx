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
} from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";

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
  };
}

export function PublicProfile({ storefront }: PublicProfileProps) {
  const { t } = useI18n();
  const [showHours, setShowHours] = useState(false);

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

  const formatDayName = (day: string) =>
    ({
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
      sunday: "Sunday",
    }[day] ?? day);

  const themeStyle = {
    fontFamily:
      storefront.fontFamily === "Mono" ? "monospace" : "var(--font-sans)",
    "--store-theme": storefront.themeColor,
  } as React.CSSProperties;

  return (
    <div className="flex flex-col min-h-screen" style={themeStyle}>
      {/* Hero banner — taller on desktop */}
      <div className="relative h-44 md:h-72 w-full overflow-hidden bg-slate-200">
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
            style={{
              background: `linear-gradient(135deg, var(--store-theme) 0%, #1e293b 100%)`,
            }}
          />
        )}
      </div>

      {/* Content — single column mobile, two-column desktop */}
      <div className="relative flex-1 -mt-16 px-4 sm:px-6 pb-10">
        <div className="max-w-5xl mx-auto">
          <div className="md:grid md:grid-cols-[300px_1fr] md:gap-10 md:items-start">

            {/* ── Left: profile identity ── */}
            <div className="flex flex-col items-center md:items-start">
              {/* Logo */}
              <div className="relative size-28 rounded-full border-4 border-white bg-slate-100 shadow-md overflow-hidden flex items-center justify-center shrink-0">
                {storefront.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={storefront.logoUrl}
                    alt={`${storefront.displayName} Logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-slate-400">
                    {storefront.displayName.charAt(0)}
                  </span>
                )}
              </div>

              <h1 className="mt-4 text-2xl font-extrabold text-slate-800 text-center md:text-left tracking-tight">
                {storefront.displayName}
              </h1>

              {storefront.tagline && (
                <p className="mt-1 text-sm font-medium text-slate-500 text-center md:text-left italic">
                  {storefront.tagline}
                </p>
              )}

              {storefront.description && (
                <p className="mt-3 text-sm text-slate-600 text-center md:text-left max-w-sm">
                  {storefront.description}
                </p>
              )}

              {/* Open status */}
              <div className="mt-4 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm border border-slate-100 bg-white">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    status.isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-400"
                  }`}
                />
                <span className={status.isOpen ? "text-emerald-700" : "text-rose-600"}>
                  {status.text}
                </span>
              </div>

              {/* Social icons */}
              {socials.length > 0 && (
                <div className="flex gap-3 mt-6 justify-center md:justify-start flex-wrap">
                  {socials.map((social, i) => {
                    const Icon = social.icon;
                    return (
                      <a
                        key={i}
                        href={social.url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center p-3 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition"
                        title={social.label}
                      >
                        <Icon className="size-5" />
                      </a>
                    );
                  })}
                </div>
              )}

              {/* On mobile: primary CTA lives here (below socials) */}
              <div className="w-full mt-6 md:hidden">
                <Link
                  href={`/@${storefront.slug}/menu`}
                  className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-[0.98] hover:opacity-90"
                  style={{ backgroundColor: "var(--store-theme)" }}
                >
                  <MessageSquare className="size-5" />
                  <span>Lihat Menu &amp; Pesan</span>
                </Link>
              </div>
            </div>

            {/* ── Right: actions ── */}
            {/* pt aligns with the bottom of the logo (112px logo + 16px border ≈ 7.5rem) */}
            <div className="flex flex-col gap-6 mt-8 md:mt-0 md:pt-[7.5rem]">
              {/* Primary CTA — desktop only */}
              <Link
                href={`/@${storefront.slug}/menu`}
                className="hidden md:flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-[0.98] hover:opacity-90"
                style={{ backgroundColor: "var(--store-theme)" }}
              >
                <MessageSquare className="size-5" />
                <span>Lihat Menu &amp; Pesan</span>
              </Link>

              {/* Delivery apps */}
              {deliveries.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center md:text-left mb-3">
                    Order via Delivery App
                  </h2>
                  <div className="grid grid-cols-3 gap-2">
                    {deliveries.map((del, i) => (
                      <a
                        key={i}
                        href={del.url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-center py-3 px-2 border rounded-lg text-xs font-bold transition active:scale-[0.98] hover:opacity-90 ${del.bg}`}
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
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center md:text-left">
                    Links
                  </h2>
                  {customLinksList.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between w-full p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition active:scale-[0.99]"
                    >
                      <span className="font-semibold text-sm">{link.label}</span>
                      <ExternalLink className="size-4 text-slate-400 shrink-0" />
                    </a>
                  ))}
                </div>
              )}

              {/* Opening hours accordion */}
              {Object.keys(hours).length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <button
                    onClick={() => setShowHours(!showHours)}
                    className="flex items-center justify-between w-full p-4 text-slate-700 hover:bg-slate-50 transition"
                  >
                    <span className="flex items-center gap-2 font-bold text-sm">
                      <Clock className="size-4 text-slate-400" />
                      <span>Opening Hours</span>
                    </span>
                    {showHours ? (
                      <ChevronUp className="size-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="size-4 text-slate-400" />
                    )}
                  </button>
                  {showHours && (
                    <div className="border-t px-4 py-3 bg-slate-50/50 space-y-2 text-xs">
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
                          <div key={day} className="flex justify-between text-slate-600">
                            <span className="font-medium">{formatDayName(day)}</span>
                            <span>
                              {dayHour?.isClosed || !dayHour?.open || !dayHour?.close
                                ? "Closed"
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

      {/* Footer */}
      <div className="py-6 text-center border-t border-slate-100 bg-slate-50/30">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium hover:text-slate-600 transition"
        >
          <span>Powered by</span>
          <span className="font-bold text-slate-700">Epidom</span>
        </Link>
      </div>
    </div>
  );
}
