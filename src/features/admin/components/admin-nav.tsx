"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminSection, AdminSectionGroup } from "@/config/admin-sections.config";
import { ADMIN_NAV_GROUPS } from "@/config/admin-sections.config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_SECTION_ICONS } from "./admin-section-icons";

function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

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

type SectionPick = Pick<AdminSection, "key" | "href" | "label" | "icon" | "group">;

function GroupDropdown({
  groupKey,
  label,
  sections,
  pathname,
  counts,
}: {
  groupKey: AdminSectionGroup;
  label: string;
  sections: SectionPick[];
  pathname: string;
  counts: { feedback: number | null; customDevelopment: number | null } | undefined;
}) {
  const groupSections = sections.filter((s) => s.group === groupKey);
  if (groupSections.length === 0) return null;
  const anyActive = groupSections.some((s) => isActive(s.href, pathname));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1 rounded-md px-3 text-xs font-semibold whitespace-nowrap transition-colors",
          anyActive
            ? "bg-red-500/15 text-red-400"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {groupSections.map((s) => {
          const Icon = ADMIN_SECTION_ICONS[s.icon];
          const active = isActive(s.href, pathname);
          return (
            <DropdownMenuItem key={s.key} asChild>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 text-xs",
                  active && "text-red-400 font-semibold"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
                {s.key === "feedback" && <NavBadge count={counts?.feedback} />}
                {s.key === "custom-development" && (
                  <NavBadge count={counts?.customDevelopment} />
                )}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminNav({
  sections,
}: {
  sections: SectionPick[];
}) {
  const pathname = usePathname() ?? "";
  const hasCounted = sections.some((s) => s.key === "feedback" || s.key === "custom-development");
  const { data: counts } = useQuery<{ feedback: number | null; customDevelopment: number | null }>({
    queryKey: ["admin-pending-counts"],
    queryFn: () => fetch("/api/admin/pending-counts").then((r) => r.json()),
    refetchInterval: 60 * 1000,
    enabled: hasCounted,
  });

  const ungrouped = sections.filter((s) => !s.group);

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

        {/* Ungrouped sections (Users, Activity, my-referrals) as plain links */}
        {ungrouped.map((s) => {
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
            </Link>
          );
        })}

        {/* Grouped dropdowns */}
        {ADMIN_NAV_GROUPS.map((g) => (
          <GroupDropdown
            key={g.key}
            groupKey={g.key}
            label={g.label}
            sections={sections}
            pathname={pathname}
            counts={counts}
          />
        ))}
      </div>
    </nav>
  );
}
