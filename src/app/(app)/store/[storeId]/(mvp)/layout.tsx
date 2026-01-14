/**
 * MVP Layout Component
 *
 * ANTI-GRAVITY MODE: Minimal layout with sidebar and content area.
 * No analytics, no alerts prefetch, no currency provider complexity.
 */

import type React from "react";
import type { Metadata } from "next";
import { MvpSidebar } from "@/features/mvp/shared/mvp-sidebar";

export const metadata: Metadata = {
  title: "Epidom MVP - Demo Mode",
  description: "MVP Demo: Import → POS → Reports",
};

export default function MvpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-muted/30 flex h-screen w-full">
      {/* Sidebar */}
      <div className="p-3">
        <MvpSidebar />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-3">
        <div className="bg-card h-full rounded-xl border p-6 shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
}
