"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

interface ThemeToggleProps {
  /**
   * "topbar" (default) keeps the cream-on-navy styling used in the dark topbar.
   * "surface" uses default ghost/foreground styling for light card surfaces
   * such as the mobile drawer footer.
   */
  tone?: "topbar" | "surface";
}

export function ThemeToggle({ tone = "topbar" }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-9 w-9 shrink-0", tone === "topbar" && "hover:bg-white/10")}
      style={tone === "topbar" ? { color: "var(--epi-cream-50)" } : undefined}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
