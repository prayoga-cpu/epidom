"use client";

/**
 * Hero Section Component
 *
 * "What tf is this?" Edition
 * Goal: Instant understanding & Desire.
 *
 * Features:
 * - Massive Typography for instant focus
 * - "Software" context via abstract UI elements (Overlaying image)
 * - Clear Value Proposition
 * - High-contrast "Try Now" CTA
 *
 * @component
 */

import Image from "next/image";
import { WaitlistDialog } from "./waitlist-dialog";
import { useI18n } from "@/components/lang/i18n-provider";
import React, { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Container } from "./container";
import { LogoWithSkeleton } from "./logo-with-skeleton";
import { ChevronDown, BarChart3, PieChart, Layers } from "lucide-react";

export const Hero = React.memo(function Hero() {
  const { t } = useI18n();
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <section className="relative flex h-full w-full flex-col overflow-hidden bg-white">
      {/* Background Subtle Grid */}
      <div className="absolute inset-0 z-0 bg-[url('/grid-pattern.svg')] opacity-[0.03]" />

      {/* Main Content Wrapper - Centered Vertically */}
      <div className="flex h-full w-full items-center justify-center px-4 pt-20 pb-8 sm:px-6 lg:px-8 lg:pt-32 lg:pb-0">
        <Container maxWidth="7xl" className="h-full w-full">
          <div className="grid h-full w-full grid-cols-1 content-center gap-8 lg:grid-cols-2 lg:gap-16">
            {/* 1. LEFT COLUMN: POWERFUL TEXT */}
            <div className="z-10 flex flex-col justify-center text-center lg:text-left">
              {/* Logo (Mobile Only) */}
              <div className="mb-6 flex justify-center lg:hidden">
                <LogoWithSkeleton
                  src="/images/logo-black.png"
                  alt="EPIDOM"
                  filter="invert(27%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(96%) contrast(80%)"
                  wrapperClassName="relative h-7 w-[110px]"
                />
              </div>

              <div className="space-y-6 lg:space-y-8">
                <h1 className="text-brand-primary text-5xl leading-[1.1] font-extrabold tracking-tight sm:text-6xl md:text-6xl lg:text-[3.5rem] xl:text-[4.25rem]">
                  The{" "}
                  <span className="from-brand-primary bg-gradient-to-r to-gray-500 bg-clip-text pb-2 text-transparent">
                    Secret Ingredient
                  </span>{" "}
                  <br />
                  for Your Business.
                </h1>

                <p className="text-brand-primary/80 mx-auto max-w-xl text-lg leading-relaxed sm:text-xl lg:mx-0 lg:text-lg xl:text-xl">
                  Perfect for <b>cookies bars, bakeries, and cafes</b>. Track every gram of flour,
                  manage your recipes, and auto-restock your inventory in seconds.
                </p>

                <div className="flex flex-col items-center gap-4 pt-2 sm:flex-row lg:justify-start">
                  <div className="scale-100 transform transition-transform duration-300 hover:scale-105">
                    <WaitlistDialog variant="home" />
                  </div>
                  <p className="text-xs font-medium text-gray-400 sm:hidden">
                    No credit card required
                  </p>
                </div>
              </div>
            </div>

            {/* 2. RIGHT COLUMN: DASHBOARD IMAGE */}
            <div className="relative flex h-full w-full flex-col justify-center">
              <div className="animate-in fade-in slide-in-from-right-8 relative w-full duration-1000">
                {/* Browser Window */}
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-gray-200 bg-white/50 shadow-2xl backdrop-blur-sm lg:aspect-[16/10] lg:rounded-2xl">
                  {/* Browser Header */}
                  <div className="flex h-8 shrink-0 items-center gap-2 border-b border-gray-200 bg-gray-50/90 px-3 backdrop-blur-md lg:h-10 lg:px-4">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-400/80 lg:h-3 lg:w-3" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/80 lg:h-3 lg:w-3" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-400/80 lg:h-3 lg:w-3" />
                    <div className="ml-2 h-4 w-full max-w-[200px] rounded bg-gray-200/50 lg:ml-4 lg:h-5 lg:max-w-[300px]" />
                  </div>

                  {/* Dashboard Image */}
                  <div className="relative h-full w-full bg-gray-50">
                    {!imageLoaded && (
                      <Skeleton className="absolute inset-0 z-10 h-full w-full bg-gray-100" />
                    )}
                    <Image
                      src="/images/dashboard.png"
                      alt="Epidom Dashboard"
                      fill
                      className={cn(
                        "object-cover object-left-top transition-opacity duration-700",
                        imageLoaded ? "opacity-100" : "opacity-0"
                      )}
                      onLoad={() => setImageLoaded(true)}
                      priority
                      sizes="(max-width: 768px) 100vw, 800px"
                    />
                  </div>
                </div>

                {/* Decorative Elements */}
                <div className="bg-brand-primary/5 absolute -top-12 -right-12 -z-10 h-64 w-64 rounded-full opacity-50 blur-3xl" />
                <div className="absolute -bottom-12 -left-12 -z-10 h-64 w-64 rounded-full bg-blue-500/5 opacity-50 blur-3xl" />
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute right-0 bottom-6 left-0 z-20 flex justify-center">
        <button
          onClick={() =>
            document.getElementById("pain-gain")?.scrollIntoView({ behavior: "smooth" })
          }
          className="group text-brand-primary/40 hover:text-brand-primary flex flex-col items-center gap-2 text-sm font-medium transition-colors"
        >
          <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            Explore
          </span>
          <ChevronDown className="h-6 w-6 animate-bounce" />
        </button>
      </div>
    </section>
  );
});
