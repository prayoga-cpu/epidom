"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, ArrowRight } from "lucide-react";

interface StoreCardProps {
  store: {
    id: string;
    name: string;
    city: string;
    image: string;
  };
}

export function StoreCard({ store }: StoreCardProps) {
  const { t } = useI18n();

  return (
    <Link
      href={`/dashboard?storeId=${store.id}`}
      className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] focus-visible:ring-offset-2 rounded-xl"
    >
      <Card className="flex h-full flex-col overflow-hidden border border-neutral-200/60 bg-white p-0 shadow-sm transition-all duration-300 hover:border-neutral-300 hover:shadow-lg group-hover:shadow-xl">
        {/* Store Image Container - Full width, no padding, rounded top corners */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-gradient-to-br from-neutral-100 to-neutral-200">
          <Image
            src={store.image}
            alt={store.name}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={false}
          />
        </div>

        {/* Store Info Section */}
        <CardContent className="-mt-px flex flex-1 flex-col gap-3 bg-white px-4 pb-4 pt-0">
          {/* Store Name */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 flex-1 text-base font-semibold leading-snug text-[var(--color-brand-primary)] transition-colors group-hover:text-[var(--color-brand-primary)]/90 sm:text-lg">
              {store.name}
            </h3>
            {/* Arrow indicator for clickable action */}
            <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--color-brand-primary)] sm:h-5 sm:w-5" aria-hidden="true" />
          </div>

          {/* Location Info */}
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-neutral-500 sm:h-4 sm:w-4" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {t("stores.city")}
              </p>
              <p className="truncate text-sm font-medium text-neutral-700 sm:text-base">
                {store.city}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
