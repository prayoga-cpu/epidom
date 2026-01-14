/**
 * MVP Sidebar Component
 *
 * ANTI-GRAVITY MODE: Simplified sidebar with only 3 navigation items.
 * No badges, no alerts, no search - just navigation.
 */

"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { mvpNavigation } from "@/config/mvp-navigation.config";

export function MvpSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const storeId = params.storeId as string;

  return (
    <aside className="hidden h-full w-[200px] shrink-0 md:block">
      <div className="bg-card flex h-full w-full flex-col rounded-xl border shadow-sm">
        {/* Logo / Title */}
        <div className="border-b p-4">
          <h1 className="text-lg font-bold tracking-tight">MVP Demo</h1>
          <p className="text-muted-foreground text-xs">Anti-Gravity Mode</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3">
          <ul className="space-y-1">
            {mvpNavigation.map((item) => {
              const fullHref = `/store/${storeId}${item.href}`;
              const active = pathname === fullHref;
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={fullHref}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t p-3">
          <p className="text-muted-foreground text-center text-[10px]">
            Speed &gt; Design
          </p>
        </div>
      </div>
    </aside>
  );
}
