"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Check, TrendingUp, Bell } from "lucide-react";
import Image from "next/image";

export function AuthVisual() {
  const { t } = useI18n();

  return (
    <div className="relative hidden h-full w-full flex-col justify-between overflow-hidden bg-zinc-950 p-12 text-white md:flex lg:p-16">
      {/* Background Gradients & Effects */}
      <div className="absolute inset-0 z-0">
        {/* Main Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-zinc-950 to-zinc-950" />

        {/* Animated Blobs */}
        <div className="absolute top-1/4 right-0 h-[500px] w-[500px] rounded-full bg-orange-500/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px"
          }}
        />
      </div>

      {/* Top Content */}
      <div className="relative z-10 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-2 text-white/90">
          <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
          <span className="text-sm font-medium tracking-wide uppercase">System Operational</span>
        </div>
      </div>

      {/* Center Visual Showcase - Dashboard Mockup */}
      <div className="relative z-10 flex flex-1 items-center justify-center py-12">
        <div className="relative w-full max-w-[600px] perspective-[2000px]">
           {/* Main Dashboard Image */}
           <div
             className="relative rounded-xl border border-white/10 bg-zinc-900/50 p-2 shadow-2xl backdrop-blur-xl transition-transform duration-700 hover:scale-[1.02] animate-in fade-in zoom-in-95 duration-1000"
             style={{
               transform: "rotateY(-12deg) rotateX(5deg)",
               transformStyle: "preserve-3d",
             }}
           >
              <div className="relative overflow-hidden rounded-lg bg-zinc-800 aspect-[16/10]">
                {/* Fallback color/skeleton if image fails, but we assume it loads */}
                <Image
                  src="/images/dashboard.png"
                  alt="Epidom Dashboard"
                  fill
                  className="object-cover object-left-top"
                  sizes="(max-width: 768px) 100vw, 600px"
                  quality={90}
                  priority
                />

                {/* Overlay Gradient for depth */}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none" />
              </div>

              {/* Reflection effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent rounded-xl pointer-events-none" />
           </div>

           {/* Floating Notification Card 1 */}
           <div
             className="absolute -right-12 top-10 w-64 rounded-xl border border-white/10 bg-zinc-800/90 p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-left-8 duration-1000 delay-300 fill-mode-forwards opacity-0"
             style={{
                animationFillMode: 'forwards',
                transform: "translateZ(40px)"
             }}
           >
              <div className="flex items-start gap-4">
                 <div className="rounded-full bg-green-500/20 p-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                 </div>
                 <div>
                    <h4 className="font-semibold text-white text-sm">Revenue Up 24%</h4>
                    <p className="text-xs text-white/50 mt-1">Compared to last month</p>
                 </div>
              </div>
           </div>

           {/* Floating Notification Card 2 */}
           <div
             className="absolute -left-12 bottom-20 w-fit rounded-xl border border-white/10 bg-zinc-800/90 p-3 pr-6 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-8 duration-1000 delay-500 fill-mode-forwards opacity-0"
             style={{
                animationFillMode: 'forwards',
                transform: "translateZ(60px)"
             }}
           >
              <div className="flex items-center gap-3">
                 <div className="relative">
                    <div className="rounded-full bg-orange-500/20 p-2">
                       <Bell className="h-4 w-4 text-orange-500" />
                    </div>
                    <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-400 shadow-sm" />
                 </div>
                 <div>
                    <p className="text-xs font-medium text-white">Low Stock Alert: Flour</p>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Bottom Content */}
      <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500 fill-mode-forwards opacity-0" style={{ animationFillMode: 'forwards' }}>
        <h2 className="text-3xl font-bold leading-tight md:text-3xl lg:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 mb-6">
          Manage your bakery<br />like a pro.
        </h2>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
           <div>
              <div className="text-2xl font-bold text-white mb-1">2.4k+</div>
              <div className="text-sm text-white/50">Bakeries Trusted</div>
           </div>
           <div>
              <div className="text-2xl font-bold text-white mb-1">1M+</div>
              <div className="text-sm text-white/50">Orders Processed</div>
           </div>
        </div>
      </div>
    </div>
  );
}
