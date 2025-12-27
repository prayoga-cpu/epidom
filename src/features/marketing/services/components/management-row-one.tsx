

"use client";

/**
 * Management Row One Section
 *
 * Displays management features with sophisticated card layout.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import Image from "next/image";
import { Container } from "@/features/marketing/shared/components/container";

export function ManagementRowOne() {
  const { t } = useI18n();

  return (
    <section className="bg-gray-50/50 py-16 md:py-24">
      <Container maxWidth="7xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20 items-center">
          {/* Left: Text Content */}
          <div className="space-y-8 order-2 lg:order-1">
             <div className="space-y-4">
                <span className="text-sm font-bold uppercase tracking-widest text-brand-primary/60">
                  {t("services.management.title")}
                </span>
                <h2 className="text-3xl font-extrabold tracking-tight text-brand-primary sm:text-4xl">
                  {t("services.management.subtitle")}
                </h2>
                <p className="text-lg leading-relaxed text-brand-primary/80">
                   {t("services.management.description")}
                </p>
             </div>

             {/* Functional Feature Preview */}
             <div className="rounded-2xl bg-white p-6 shadow-xl shadow-gray-200/50 border border-gray-100 max-w-md">
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4">
                   <div className="flex items-center gap-3">
                       <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                         </svg>
                       </span>
                       <div>
                          <h4 className="font-semibold text-gray-900 text-sm">Stock Update Success</h4>
                          <p className="text-xs text-gray-500">Updated just now</p>
                       </div>
                   </div>
                   <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Completed</span>
                </div>
                <div className="aspect-video relative overflow-hidden rounded-lg bg-gray-50 border border-gray-100">
                    <Image
                       src="/images/management-history.png"
                       alt="Management History"
                       fill
                       className="object-cover"
                    />
                </div>
             </div>
          </div>

          {/* Right: Main Visual */}
          <div className="relative order-1 lg:order-2">
            <div className="relative z-10 aspect-video w-full overflow-hidden rounded-2xl shadow-2xl shadow-brand-primary/20 border border-gray-100 bg-white">
              <Image
                src="/images/management-editstock.png"
                alt="Edit stock interface"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                quality={90}
              />
            </div>
            {/* Background decorative elements */}
            <div className="absolute -right-4 -bottom-4 h-full w-full rounded-2xl border border-brand-primary/10 bg-transparent -z-10" />
          </div>
        </div>
      </Container>
    </section>
  );
}
