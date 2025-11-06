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
    <div className="page-transition-container w-full">
      <Topbar />
      <div className="mx-auto max-w-[1600px] p-3 md:p-6 lg:px-8">
        <div className="grid items-start gap-4 md:grid-cols-[230px_1fr] md:gap-6">
          {/* Sidebar column (desktop only) */}
          <Sidebar mode="desktop" />

          {/* Content */}
          <main className="bg-card/80 page-content mt-14 w-full min-w-0 rounded-xl border p-4 shadow-lg backdrop-blur-md sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
