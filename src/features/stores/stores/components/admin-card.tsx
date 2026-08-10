"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, MessageSquare, TrendingUp, Wrench, Gauge, ArrowRight } from "lucide-react";

const ADMIN_SHORTCUTS = [
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/admin/revenue", label: "Revenue", icon: TrendingUp },
  { href: "/admin/capacity", label: "Usage", icon: Gauge },
  { href: "/admin/custom-development", label: "Custom Dev", icon: Wrench },
];

/**
 * Grid tile for the /stores page — same footprint as a StoreCard, but for
 * the platform-wide admin tools. Only ever rendered for an admin account
 * (see the isAdminEmail check in StoresContainer); replaces the old "Admin"
 * badge that used to sit in the top nav.
 */
export function AdminCard() {
  return (
    <Card className="group border-border relative flex h-full flex-col overflow-hidden border border-red-500/30 bg-red-500/5 p-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-red-500/50 hover:shadow-xl sm:py-0">
      <Link
        href="/admin"
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
              Admin
            </h3>
            <ArrowRight
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400/70 transition-all duration-300 group-hover:translate-x-1 sm:mt-1 sm:h-5 sm:w-5"
              aria-hidden="true"
            />
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">Platform-wide admin tools</p>
        </CardContent>
      </Link>

      <div className="flex items-center gap-1.5 border-t border-red-500/20 px-4 py-3 sm:px-5">
        {ADMIN_SHORTCUTS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/5 px-2 py-1.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/15"
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
