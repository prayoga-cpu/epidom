"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Bell, Check, MessageCircle, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  PRODUCT_SCREENS,
  type ProductScreenKey,
} from "@/features/marketing/shared/content/product-screens";

// One slide per real screenshot (see product-screens.ts); the copy lives under
// auth.visual.<key>Title / Body / Toast / ToastSub. The toast is an example of
// what that screen does, not a live event.
const SLIDES: readonly {
  key: "cashier" | "queue" | "customer" | "stock";
  screen: ProductScreenKey;
  notification: { icon: LucideIcon; color: "green" | "blue" | "orange" };
}[] = [
  { key: "cashier", screen: "posCashier", notification: { icon: Check, color: "green" } },
  { key: "queue", screen: "posOrderQueue", notification: { icon: Bell, color: "blue" } },
  {
    key: "customer",
    screen: "posCustomerDisplay",
    notification: { icon: MessageCircle, color: "green" },
  },
  { key: "stock", screen: "backOfficeStock", notification: { icon: Bell, color: "orange" } },
];

export function AuthVisual() {
  const { t, locale } = useI18n();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="relative hidden h-full w-full overflow-hidden text-white md:flex md:flex-col"
      style={{ background: "var(--epi-navy-900)" }}
    >
      {/* Background Gradients & Effects */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(217,174,59,0.08) 0%, var(--epi-navy-900) 50%, var(--epi-navy-950) 100%)",
          }}
        />

        {/* Animated Blobs */}
        <div
          className="absolute top-1/4 right-0 h-[500px] w-[500px] animate-pulse rounded-full blur-[120px]"
          style={{ background: "rgba(217,174,59,0.1)" }}
        />
        <div
          className="absolute bottom-0 left-0 h-[500px] w-[500px] animate-pulse rounded-full blur-[100px]"
          style={{ background: "rgba(6,26,57,0.7)", animationDelay: "2s" }}
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
                key={slide.key}
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
                <div
                  className="relative h-full w-full rounded-xl border p-2 shadow-2xl backdrop-blur-xl"
                  style={{ borderColor: "rgba(217,174,59,0.18)", background: "rgba(10,22,40,0.6)" }}
                >
                  <div
                    className="relative h-full w-full overflow-hidden rounded-lg"
                    style={{ background: "var(--epi-navy-800)" }}
                  >
                    <Image
                      src={PRODUCT_SCREENS[slide.screen].src}
                      alt={PRODUCT_SCREENS[slide.screen].alt[locale]}
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
                    "absolute top-8 -right-8 w-64 rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all delay-300 duration-700",
                    index === currentSlide
                      ? "translate-x-0 translate-z-[40px] opacity-100"
                      : "translate-x-4 translate-z-[40px] opacity-0"
                  )}
                  style={{
                    transform: "translateZ(40px)",
                    background: "rgba(10,22,40,0.92)",
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
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
                        {t(`auth.visual.${slide.key}Toast`)}
                      </h4>
                      <p className="mt-1 text-left text-xs text-white/50">
                        {t(`auth.visual.${slide.key}ToastSub`)}
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
                  key={slide.key}
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-out",
                    index === currentSlide ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                  )}
                >
                  <h2 className="mb-3 bg-gradient-to-r from-white to-white/60 bg-clip-text text-3xl leading-tight font-bold whitespace-pre-line text-transparent md:text-3xl lg:text-4xl">
                    {t(`auth.visual.${slide.key}Title`)}
                  </h2>
                  <p className="max-w-md text-lg leading-relaxed text-white/60">
                    {t(`auth.visual.${slide.key}Body`)}
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
