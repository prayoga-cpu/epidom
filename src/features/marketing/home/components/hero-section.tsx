"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Shield, Zap, CreditCard } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SSRPlaceholder } from "@/components/shared";

export function HeroSection() {
  const router = useRouter();
  const { t } = useI18n();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleStartFree = () => {
    router.push("/register");
  };

  const handleDemo = () => {
    window.open("https://calendly.com/prayogadevelopment/30min", "_blank");
  };

  if (!mounted) {
    return <SSRPlaceholder height="calc(100vh - 4rem)" className="bg-bg-warm" />;
  }

  return (
    <section className="bg-bg-warm relative flex min-h-[calc(100vh-4rem)] w-full flex-col overflow-hidden">
      {/* Subtle warm gradient blobs */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-amber-100/40 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-[400px] w-[400px] rounded-full bg-orange-50/50 blur-3xl" />
      </div>

      <div className="relative z-10 flex w-full flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8 lg:pt-28 lg:pb-20">
        <Container maxWidth="6xl" className="w-full">
          <div className="grid w-full grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-20">

            {/* Left: Text */}
            <div
              className={`flex flex-col text-center transition-all duration-700 lg:text-left ${
                mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
              }`}
            >
              {/* Badge */}
              <div className="mb-6 flex justify-center lg:justify-start">
                <span className="bg-brand-primary/8 text-brand-primary inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-1.5 text-sm font-medium">
                  ✨ {t("home.hero.badge")}
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-brand-primary mb-6 text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl lg:text-[3rem] xl:text-[3.5rem]">
                {t("home.hero.headlinePart1")}
                <br />
                <span className="font-serif italic">{t("home.hero.headlineHighlight")}</span>
              </h1>

              {/* Description */}
              <p className="text-brand-primary/65 mb-8 text-lg leading-[1.7] sm:text-xl lg:text-lg xl:text-xl">
                {t("home.hero.description")}
              </p>

              {/* CTAs */}
              <div className="mb-6 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <Button
                  onClick={handleStartFree}
                  className="group bg-brand-primary hover:bg-brand-primary/90 w-full cursor-pointer rounded-full px-8 py-6 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl sm:w-auto"
                >
                  {t("home.hero.ctaStartFree")}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
                <Button
                  onClick={handleDemo}
                  variant="outline"
                  className="border-brand-primary/20 text-brand-primary hover:bg-brand-primary/5 w-full cursor-pointer rounded-full border px-8 py-6 text-base font-semibold transition-all duration-200 sm:w-auto"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {t("home.hero.ctaDemo")}
                </Button>
              </div>

              {/* Trust pills */}
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 lg:justify-start">
                {[
                  { icon: CreditCard, text: t("home.hero.trustNoCard") },
                  { icon: Zap, text: t("home.hero.trustSetup") },
                  { icon: Shield, text: t("home.hero.trustQris") },
                ].map(({ icon: Icon, text }) => (
                  <span key={text} className="text-brand-primary/50 flex items-center gap-1.5 text-sm">
                    <Icon className="h-3.5 w-3.5" />
                    {text}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Phone mockup */}
            <div
              className={`relative flex justify-center transition-all delay-200 duration-700 lg:justify-end ${
                mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
              }`}
            >
              {/* Browser/Desktop frame */}
              <div className="relative w-full max-w-lg">
                <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-2xl shadow-neutral-200/50">
                  {/* Browser chrome */}
                  <div className="flex h-9 items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-4">
                    <div className="flex gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                      <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                      <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                    </div>
                    <div className="ml-3 flex h-5 flex-1 max-w-xs items-center rounded-full border border-neutral-200 bg-white px-3">
                      <div className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-[10px] text-neutral-500">{t("home.hero.mockupUrl")}</span>
                    </div>
                  </div>
                  {/* Screenshot */}
                  <div className="relative aspect-[4/3] bg-neutral-50">
                    {!imageLoaded && (
                      <Skeleton className="absolute inset-0 h-full w-full" />
                    )}
                    <Image
                      src="/images/dashboard.png"
                      alt="Epidom — halaman menu dan kasir"
                      fill
                      className="object-cover object-left-top"
                      onLoad={() => setImageLoaded(true)}
                      onError={() => setImageLoaded(true)}
                      priority
                      sizes="(max-width: 768px) 100vw, 600px"
                      unoptimized
                    />
                  </div>
                </div>

                {/* Phone overlay */}
                <div className="absolute -bottom-6 -left-6 hidden w-28 md:block lg:w-32">
                  <div className="overflow-hidden rounded-3xl border-4 border-neutral-900 bg-neutral-900 shadow-2xl">
                    <div className="absolute top-0 left-1/2 z-10 h-4 w-12 -translate-x-1/2 rounded-b-xl bg-neutral-900" />
                    <div className="relative aspect-[9/19] bg-white">
                      <Image
                        src="/images/tracking.png"
                        alt="Epidom mobile — storefront pelanggan"
                        fill
                        className="object-cover object-top"
                        sizes="128px"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>

                {/* Floating order notification */}
                <div className="absolute -top-4 -right-4 hidden rounded-xl border border-neutral-100 bg-white p-3 shadow-xl md:block">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-600 text-sm font-bold">
                      ✓
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-900">{t("home.hero.notificationTitle")}</p>
                      <p className="text-[10px] text-neutral-400">{t("home.hero.notificationDetail")}</p>
                    </div>
                  </div>
                </div>

                {/* Floating stats */}
                <div className="absolute right-4 -bottom-4 hidden rounded-xl border border-neutral-100 bg-white/95 p-3 shadow-xl backdrop-blur-sm md:block">
                  <p className="text-brand-primary text-xl font-bold leading-none">{t("home.hero.statsValue")}</p>
                  <p className="mt-0.5 text-[10px] text-neutral-400">{t("home.hero.statsLabel")}</p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
