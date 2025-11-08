"use client";
import type React from "react";
import { Sidebar } from "@/features/dashboard/shared/sidebar";
import { Topbar } from "@/features/dashboard/shared/topbar";

/**
 * PageShell Component
 *
 * Provides the layout structure for dashboard pages.
 * Includes Topbar, Sidebar, and main content area.
 *
 * Note: SessionProvider is now in root layout (app/layout.tsx)
 */
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-transition-container flex h-screen w-full flex-col overflow-hidden">
      {/* Topbar - Fixed at top */}
      <Topbar />

      {/* Main content area - Fixed height container with padding for topbar */}
      <div className="flex min-h-0 flex-1 overflow-hidden pt-14">
        <div className="mx-auto flex w-full max-w-[1600px] gap-4 p-3 md:gap-6 md:p-6 lg:px-8">
          {/* Sidebar column (desktop only) */}
          <Sidebar mode="desktop" />

          {/* Content - Fixed height box with scrollable content inside */}
          <main className="bg-card/80 page-content flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-lg backdrop-blur-md">
            {/* Scrollable content area */}
            <div className="scrollbar-thin flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
