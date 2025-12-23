"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Check, TrendingUp, Bell, PieChart, Package, Receipt, Truck } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    id: "dashboard",
    image: "/images/dashboard.png",
    title: "Manage your bakery\nlike a pro.",
    description:
      "Get a bird's eye view of your bakery's performance with our comprehensive dashboard.",
    icon: PieChart,
    notification: {
      title: "Revenue Up 24%",
      subtitle: "Compared to last month",
      icon: TrendingUp,
      color: "green",
    },
  },
  {
    id: "recipe",
    image: "/images/data-recipe.png",
    title: "Precision Recipe\nCosting.",
    description: "Calculate exact production costs based on real-time material prices and labor.",
    icon: Receipt,
    notification: {
      title: "Recipe Updated",
      subtitle: "Croissant margins improved by 5%",
      icon: Check,
      color: "blue",
    },
  },
  {
    id: "inventory",
    image: "/images/data-product.png",
    title: "Smart Inventory\nManagement.",
    description: "Track stock levels, set alerts, and never run out of key ingredients again.",
    icon: Package,
    notification: {
      title: "Low Stock Alert",
      subtitle: "Flour stock below minimum level",
      icon: Bell,
      color: "orange",
    },
  },
  {
    id: "tracking",
    image: "/images/tracking.png",
    title: "Real-time Order\nTracking.",
    description: "Monitor production batches and delivery status in real-time.",
    icon: Truck,
    notification: {
      title: "Batch Completed",
      subtitle: "Sour Dough Batch #420 is ready",
      icon: Check,
      color: "green",
    },
  },
];

export function AuthVisual() {
  const { t } = useI18n();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative hidden h-full w-full overflow-hidden bg-zinc-950 text-white md:flex md:flex-col">
      {/* Background Gradients & Effects */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-zinc-950 to-zinc-950" />

        {/* Animated Blobs */}
        <div className="absolute top-1/4 right-0 h-[500px] w-[500px] animate-pulse rounded-full bg-orange-500/10 blur-[120px]" />
        <div
          className="absolute bottom-0 left-0 h-[500px] w-[500px] animate-pulse rounded-full bg-purple-500/10 blur-[100px]"
          style={{ animationDelay: "2s" }}
        />

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Top Status - Absolute Positioned */}
      <div className="animate-in fade-in slide-in-from-top-4 absolute top-12 left-12 z-20 duration-700">
        <div className="flex items-center gap-2 text-white/90">
          <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
          <span className="text-sm font-medium tracking-wide uppercase">System Operational</span>
        </div>
      </div>

      {/* Main Content Area - Perfectly Centered */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-12">
        <div className="flex w-full max-w-[550px] flex-col items-center gap-10">
          {/* 3D Image Carousel */}
          <div className="relative aspect-[16/10] w-full perspective-[2000px]">
            {SLIDES.map((slide, index) => (
              <div
                key={slide.id}
                className={cn(
                  "absolute inset-0 transform transition-all duration-1000 ease-in-out",
                  index === currentSlide
                    ? "z-10 translate-x-0 scale-100 rotate-x-[5deg] rotate-y-[-12deg] opacity-100"
                    : index < currentSlide
                      ? "z-0 -translate-x-10 scale-95 rotate-x-[5deg] rotate-y-[-12deg] opacity-0"
                      : "z-0 translate-x-10 scale-95 rotate-x-[5deg] rotate-y-[-12deg] opacity-0"
                )}
                style={{
                  transformStyle: "preserve-3d",
                }}
              >
                {/* Main Image Card */}
                <div className="relative h-full w-full rounded-xl border border-white/10 bg-zinc-900/50 p-2 shadow-2xl backdrop-blur-xl">
                  <div className="relative h-full w-full overflow-hidden rounded-lg bg-zinc-800">
                    <Image
                      src={slide.image}
                      alt={slide.title}
                      fill
                      className="object-cover object-left-top"
                      sizes="(max-width: 768px) 100vw, 600px"
                      quality={90}
                      priority={index === 0}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
                  </div>
                  {/* Reflection effect */}
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-tr from-white/5 to-transparent" />
                </div>

                {/* Sliding Notification Card */}
                <div
                  className={cn(
                    "absolute top-8 -right-8 w-64 rounded-xl border border-white/10 bg-zinc-800/90 p-4 shadow-xl backdrop-blur-md transition-all delay-300 duration-700",
                    index === currentSlide
                      ? "translate-x-0 translate-z-[40px] opacity-100"
                      : "translate-x-4 translate-z-[40px] opacity-0"
                  )}
                  style={{ transform: "translateZ(40px)" }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "rounded-full p-2",
                        slide.notification.color === "green" && "bg-green-500/20",
                        slide.notification.color === "blue" && "bg-blue-500/20",
                        slide.notification.color === "orange" && "bg-orange-500/20"
                      )}
                    >
                      <slide.notification.icon
                        className={cn(
                          "h-5 w-5",
                          slide.notification.color === "green" && "text-green-400",
                          slide.notification.color === "blue" && "text-blue-400",
                          slide.notification.color === "orange" && "text-orange-400"
                        )}
                      />
                    </div>
                    <div>
                      <h4 className="text-left text-sm font-semibold text-white">
                        {slide.notification.title}
                      </h4>
                      <p className="mt-1 text-left text-xs text-white/50">
                        {slide.notification.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Text & Controls - Centered */}
          <div className="w-full text-center">
            <div className="relative h-[120px] w-full">
              {SLIDES.map((slide, index) => (
                <div
                  key={slide.id}
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-out",
                    index === currentSlide ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                  )}
                >
                  <h2 className="mb-3 bg-gradient-to-r from-white to-white/60 bg-clip-text text-3xl leading-tight font-bold whitespace-pre-line text-transparent md:text-3xl lg:text-4xl">
                    {slide.title}
                  </h2>
                  <p className="max-w-md text-lg leading-relaxed text-white/60">
                    {slide.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
