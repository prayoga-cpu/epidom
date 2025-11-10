"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User, Store } from "lucide-react";

/**
 * Profile Navigation Component
 *
 * Navigation for profile and stores pages
 * Allows quick navigation between profile management sections
 */
export function ProfileNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-10 border-b bg-white">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-1 overflow-x-auto px-4 py-3 sm:gap-2 sm:px-6 sm:py-4 md:px-8">
        {/* Profile Link */}
        <Button
          variant={pathname === "/profile" ? "default" : "ghost"}
          size="sm"
          className="gap-1.5 shrink-0 sm:gap-2"
          asChild
        >
          <Link href="/profile" className="flex items-center gap-1.5 sm:gap-2">
            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="text-xs sm:text-sm">Profile</span>
          </Link>
        </Button>

        {/* Stores Link */}
        <Button
          variant={pathname === "/stores" ? "default" : "ghost"}
          size="sm"
          className="gap-1.5 shrink-0 sm:gap-2"
          asChild
        >
          <Link href="/stores" className="flex items-center gap-1.5 sm:gap-2">
            <Store className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="text-xs sm:text-sm">My Stores</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
