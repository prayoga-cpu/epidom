"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { useDefaultLanding } from "@/features/dashboard/profile/hooks/use-default-landing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MapPin, ArrowRight, MoreVertical, Pencil, Trash2, Store, Lock } from "lucide-react";
import { Store as StoreType } from "../hooks/use-stores";
import { EditStoreDialog } from "./edit-store-dialog";
import { DeleteStoreDialog } from "./delete-store-dialog";
import { useRouter } from "next/navigation";

interface StoreCardProps {
  store: StoreType;
  isBlocked?: boolean; // True if subscription is not active
}

export function StoreCard({ store, isBlocked = false }: StoreCardProps) {
  const { t } = useI18n();
  const router = useRouter();
  const defaultLanding = useDefaultLanding();
  const [imageError, setImageError] = useState(false);
  const hasImage = store.image && !imageError;

  const handleCardClick = (e: React.MouseEvent) => {
    if (isBlocked) {
      e.preventDefault();
      e.stopPropagation();
      router.push("/pricing?reason=subscription_required");
    }
  };

  return (
    <Card
      className={`group border-border bg-card relative flex h-full flex-col overflow-hidden border p-0 shadow-sm transition-all duration-300 ${
        isBlocked
          ? "cursor-not-allowed opacity-75"
          : "hover:-translate-y-1 hover:border-[var(--color-brand-primary)]/30 hover:shadow-xl"
      }`}
    >
      {/* Actions Dropdown - Positioned absolutely */}
      {/* Hide dropdown when store is blocked */}
      {!isBlocked && (
        <div className="absolute top-3 right-3 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="bg-card/95 hover:bg-card h-8 w-8 p-0 shadow-md backdrop-blur-sm transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <EditStoreDialog
                store={store}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Pencil className="mr-2 h-4 w-4" />
                    <span>Edit</span>
                  </DropdownMenuItem>
                }
              />
              <DropdownMenuSeparator />
              <DeleteStoreDialog
                store={store}
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Blocked Overlay - Branded Design */}
      {isBlocked && (
        <div className="from-card/95 via-card/90 to-muted/95 absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg border-2 border-[var(--color-brand-primary)]/20 bg-gradient-to-br shadow-lg backdrop-blur-md">
          {/* Decorative Pattern Background */}
          <div className="absolute inset-0 overflow-hidden rounded-lg opacity-[0.03]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, var(--color-brand-primary) 0px, var(--color-brand-primary) 1px, transparent 1px, transparent 20px)`,
              }}
            />
          </div>

          <div className="relative px-4 py-6 text-center">
            {/* Icon with Brand Color */}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--color-brand-primary)]/30 bg-gradient-to-br from-[var(--color-brand-primary)]/10 via-[var(--color-brand-primary)]/15 to-[var(--color-brand-primary)]/20 shadow-sm">
              <Lock className="h-7 w-7 text-[var(--color-brand-primary)]" strokeWidth={2.5} />
            </div>

            {/* Title */}
            <p className="mb-2 text-base font-bold tracking-tight text-[var(--color-brand-primary)] sm:text-lg">
              {t("stores.subscriptionRequired") || "Subscription Required"}
            </p>

            {/* Description */}
            <p className="text-muted-foreground mx-auto max-w-[200px] text-xs leading-relaxed sm:text-sm">
              {t("stores.renewSubscription") || "Renew your subscription to access this store"}
            </p>

            {/* Subtle CTA Hint */}
            <div className="mt-4 border-t border-[var(--color-brand-primary)]/10 pt-3">
              <p className="text-[10px] font-medium tracking-wider text-[var(--color-brand-primary)]/70 uppercase">
                {t("stores.clickToSubscribe") || "Click to Subscribe"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clickable Link Area */}
      {isBlocked ? (
        <div onClick={handleCardClick} className="flex h-full cursor-not-allowed flex-col">
          {/* Store Image Container - Enhanced with overlay on hover */}
          <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
            {hasImage ? (
              <Image
                src={store.image!}
                alt={store.name}
                fill
                className="object-cover transition-all duration-500 ease-out group-hover:scale-110"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                priority={false}
                unoptimized={store.image?.includes("blob.vercel-storage.com") ? false : true}
                onError={() => setImageError(true)}
              />
            ) : (
              // Attractive placeholder when no image
              <div className="bg-muted absolute inset-0 flex flex-col items-center justify-center p-6">
                {/* Decorative Pattern - Subtle grid */}
                <div className="absolute inset-0 opacity-[0.03]">
                  <svg className="h-full w-full" fill="none" viewBox="0 0 400 300">
                    <defs>
                      <pattern
                        id={`grid-${store.id}`}
                        width="40"
                        height="40"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 40 0 L 0 0 0 40"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                        />
                      </pattern>
                    </defs>
                    <rect
                      width="100%"
                      height="100%"
                      fill={`url(#grid-${store.id})`}
                      className="text-[var(--color-brand-primary)]"
                    />
                  </svg>
                </div>

                {/* Store Icon with Gradient Background */}
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-brand-primary)]/20 via-[var(--color-brand-primary)]/15 to-[var(--color-brand-primary)]/10 shadow-sm backdrop-blur-sm sm:h-24 sm:w-24">
                  <Store className="h-10 w-10 text-[var(--color-brand-primary)]/80 sm:h-12 sm:w-12" />
                </div>
              </div>
            )}
            {/* Subtle overlay on hover */}
            <div className="absolute inset-0 bg-[var(--color-brand-primary)]/0 transition-all duration-300 group-hover:bg-[var(--color-brand-primary)]/5" />
          </div>

          {/* Store Info Section - Enhanced */}
          <CardContent className="bg-card flex flex-1 flex-col gap-2.5 p-4 sm:gap-3 sm:p-5 md:p-6">
            {/* Store Name */}
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <h3 className="text-foreground group-hover:text-foreground/80 line-clamp-2 flex-1 text-base leading-tight font-semibold transition-colors sm:text-lg md:text-xl">
                {store.name}
              </h3>
              {/* Arrow indicator for clickable action */}
              <ArrowRight
                className="text-muted-foreground group-hover:text-foreground mt-0.5 h-4 w-4 flex-shrink-0 transition-all duration-300 group-hover:translate-x-1 sm:mt-1 sm:h-5 sm:w-5"
                aria-hidden="true"
              />
            </div>

            {/* Location Info - Enhanced */}
            {store.city && (
              <div className="flex items-start gap-2 sm:gap-2.5">
                <MapPin
                  className="text-muted-foreground mt-0.5 h-3.5 w-3.5 flex-shrink-0 sm:h-4 sm:w-4"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground mb-0.5 text-xs font-medium tracking-wide uppercase">
                    {t("stores.city")}
                  </p>
                  <p className="text-foreground truncate text-xs font-medium sm:text-sm md:text-base">
                    {store.city}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </div>
      ) : (
        <Link
          href={`/store/${store.id}/${defaultLanding}`}
          prefetch={true}
          className="flex h-full flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] focus-visible:ring-offset-2"
        >
          {/* Store Image Container - Enhanced with overlay on hover */}
          <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
            {hasImage ? (
              <Image
                src={store.image!}
                alt={store.name}
                fill
                className="object-cover transition-all duration-500 ease-out group-hover:scale-110"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                priority={false}
                unoptimized={store.image?.includes("blob.vercel-storage.com") ? false : true}
                onError={() => setImageError(true)}
              />
            ) : (
              // Attractive placeholder when no image
              <div className="bg-muted absolute inset-0 flex flex-col items-center justify-center p-6">
                {/* Decorative Pattern - Subtle grid */}
                <div className="absolute inset-0 opacity-[0.03]">
                  <svg className="h-full w-full" fill="none" viewBox="0 0 400 300">
                    <defs>
                      <pattern
                        id={`grid-${store.id}`}
                        width="40"
                        height="40"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 40 0 L 0 0 0 40"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                        />
                      </pattern>
                    </defs>
                    <rect
                      width="100%"
                      height="100%"
                      fill={`url(#grid-${store.id})`}
                      className="text-[var(--color-brand-primary)]"
                    />
                  </svg>
                </div>

                {/* Store Icon with Gradient Background */}
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-brand-primary)]/20 via-[var(--color-brand-primary)]/15 to-[var(--color-brand-primary)]/10 shadow-sm backdrop-blur-sm sm:h-24 sm:w-24">
                  <Store className="h-10 w-10 text-[var(--color-brand-primary)]/80 sm:h-12 sm:w-12" />
                </div>
              </div>
            )}
            {/* Subtle overlay on hover */}
            <div className="absolute inset-0 bg-[var(--color-brand-primary)]/0 transition-all duration-300 group-hover:bg-[var(--color-brand-primary)]/5" />
          </div>

          {/* Store Info Section - Enhanced */}
          <CardContent className="bg-card flex flex-1 flex-col gap-2.5 p-4 sm:gap-3 sm:p-5 md:p-6">
            {/* Store Name */}
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <h3 className="text-foreground group-hover:text-foreground/80 line-clamp-2 flex-1 text-base leading-tight font-semibold transition-colors sm:text-lg md:text-xl">
                {store.name}
              </h3>
              {/* Arrow indicator for clickable action */}
              <ArrowRight
                className="text-muted-foreground group-hover:text-foreground mt-0.5 h-4 w-4 flex-shrink-0 transition-all duration-300 group-hover:translate-x-1 sm:mt-1 sm:h-5 sm:w-5"
                aria-hidden="true"
              />
            </div>

            {/* Location Info - Enhanced */}
            {store.city && (
              <div className="flex items-start gap-2 sm:gap-2.5">
                <MapPin
                  className="text-muted-foreground mt-0.5 h-3.5 w-3.5 flex-shrink-0 sm:h-4 sm:w-4"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground mb-0.5 text-xs font-medium tracking-wide uppercase">
                    {t("stores.city")}
                  </p>
                  <p className="text-foreground truncate text-xs font-medium sm:text-sm md:text-base">
                    {store.city}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Link>
      )}
    </Card>
  );
}
