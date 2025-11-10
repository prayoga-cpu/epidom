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
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-4">
        {/* Profile Link */}
        <Button
          variant={pathname === "/profile" ? "default" : "ghost"}
          size="sm"
          className="gap-2"
          asChild
        >
          <Link href="/profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </Link>
        </Button>

        {/* Stores Link */}
        <Button
          variant={pathname === "/stores" ? "default" : "ghost"}
          size="sm"
          className="gap-2"
          asChild
        >
          <Link href="/stores" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            My Stores
          </Link>
        </Button>
      </div>
    </div>
  );
}
