"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, ArrowRight } from "lucide-react";
import {
  visibleSections,
  type AdminAccessSummary,
} from "@/config/admin-sections.config";
import { ADMIN_SECTION_ICONS } from "@/features/admin/components/admin-section-icons";

/** At most this many page shortcuts fit along the card's bottom edge. */
const MAX_SHORTCUTS = 5;

/**
 * Grid tile for the /stores page — same footprint as a StoreCard, but for
 * the admin panel. Rendered for any account that may open an admin page: a
 * full admin, an account given some pages, or a partner (their own page).
 * The shortcuts are the pages this account may open.
 */
export function AdminCard({ access }: { access: AdminAccessSummary }) {
  const sections = visibleSections(access);
  const home = sections[0]?.href ?? "/admin";
  const shortcuts = sections.filter((s) => s.key !== "users").slice(0, MAX_SHORTCUTS);
  const partnerOnly = !access.full && access.sections.length === 0;

  return (
    <Card className="group border-border relative flex h-full flex-col overflow-hidden border border-red-500/30 bg-red-500/5 p-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-red-500/50 hover:shadow-xl sm:py-0">
      <Link
        href={home}
        className="flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
      >
        <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-red-500/10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/15 shadow-sm sm:h-24 sm:w-24">
            <Shield className="h-10 w-10 text-red-400 sm:h-12 sm:w-12" />
          </div>
        </div>

        <CardContent className="flex flex-1 flex-col gap-2.5 p-4 sm:gap-3 sm:p-5 md:p-6">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <h3 className="line-clamp-2 flex-1 text-base leading-tight font-semibold text-red-400 sm:text-lg md:text-xl">
              {partnerOnly ? "Partner" : "Admin"}
            </h3>
            <ArrowRight
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400/70 transition-all duration-300 group-hover:translate-x-1 sm:mt-1 sm:h-5 sm:w-5"
              aria-hidden="true"
            />
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {partnerOnly
              ? "Your referral links and commission"
              : access.full
                ? "Platform-wide admin tools"
                : "The admin pages you were given"}
          </p>
        </CardContent>
      </Link>

      {shortcuts.length > 0 && (
        <div className="flex items-center gap-1.5 border-t border-red-500/20 px-4 py-3 sm:px-5">
          {shortcuts.map(({ href, label, icon }) => {
            const Icon = ADMIN_SECTION_ICONS[icon];
            return (
              <Link
                key={href}
                href={href}
                className="flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/5 px-2 py-1.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/15"
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
