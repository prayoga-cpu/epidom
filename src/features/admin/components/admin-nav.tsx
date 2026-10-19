"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminSection } from "@/config/admin-sections.config";
import { ADMIN_SECTION_ICONS } from "./admin-section-icons";

/** Whether `pathname` is this section's page (or one below it, like /admin/partners/abc). */
function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Count pill on a page link: open feedback, new custom development requests. */
function NavBadge({ count }: { count: number | null | undefined }) {
  if (!count) return null;
  return (
    <span
      className="flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white"
      aria-label={`${count} pending`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * The admin panel's page row: only the pages this account may open
 * (src/config/admin-sections.config.ts). Scrolls sideways on a phone.
 */
export function AdminNav({
  sections,
}: {
  sections: Pick<AdminSection, "key" | "href" | "label" | "icon">[];
}) {
  const pathname = usePathname() ?? "";
  const hasCounted = sections.some((s) => s.key === "feedback" || s.key === "custom-development");
  const { data: counts } = useQuery<{ feedback: number | null; customDevelopment: number | null }>({
    queryKey: ["admin-pending-counts"],
    queryFn: () => fetch("/api/admin/pending-counts").then((r) => r.json()),
    refetchInterval: 60 * 1000,
    enabled: hasCounted,
  });
  return (
    <nav aria-label="Admin pages" className="border-border bg-background border-b">
      <div className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto px-4 py-2 sm:px-6">
        <Link
          href="/stores"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Stores</span>
        </Link>
        {sections.map((s) => {
          const Icon = ADMIN_SECTION_ICONS[s.icon];
          const active = isActive(s.href, pathname);
          return (
            <Link
              key={s.key}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-semibold whitespace-nowrap transition-colors",
                active
                  ? "bg-red-500/15 text-red-400"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
              {s.key === "feedback" && <NavBadge count={counts?.feedback} />}
              {s.key === "custom-development" && <NavBadge count={counts?.customDevelopment} />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
