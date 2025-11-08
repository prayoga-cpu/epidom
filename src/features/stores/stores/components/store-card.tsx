"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MapPin, ArrowRight, MoreVertical, Pencil, Trash2, Store } from "lucide-react";
import { Store as StoreType } from "../hooks/use-stores";
import { EditStoreDialog } from "./edit-store-dialog";
import { DeleteStoreDialog } from "./delete-store-dialog";

interface StoreCardProps {
  store: StoreType;
}

export function StoreCard({ store }: StoreCardProps) {
  const { t } = useI18n();
  const [imageError, setImageError] = useState(false);
  const hasImage = store.image && !imageError;

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden border border-neutral-200/80 bg-white p-0 shadow-sm transition-all duration-300 hover:border-[var(--color-brand-primary)]/30 hover:shadow-xl hover:-translate-y-1">
      {/* Actions Dropdown - Positioned absolutely */}
      <div className="absolute top-3 right-3 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 bg-white/95 p-0 shadow-md backdrop-blur-sm hover:bg-white transition-all"
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

      {/* Clickable Link Area */}
      <Link
        href={`/store/${store.id}/dashboard`}
        className="flex h-full flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] focus-visible:ring-offset-2"
      >
        {/* Store Image Container - Enhanced with overlay on hover */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200">
          {hasImage ? (
            <Image
              src={store.image!}
              alt={store.name}
              fill
              className="object-cover transition-all duration-500 ease-out group-hover:scale-110"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              priority={false}
              unoptimized={store.image?.includes('blob.vercel-storage.com') ? false : true}
              onError={() => setImageError(true)}
            />
          ) : (
            // Attractive placeholder when no image
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200 p-6">
              {/* Decorative Pattern - Subtle grid */}
              <div className="absolute inset-0 opacity-[0.03]">
                <svg className="h-full w-full" fill="none" viewBox="0 0 400 300">
                  <defs>
                    <pattern id={`grid-${store.id}`} width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill={`url(#grid-${store.id})`} className="text-[var(--color-brand-primary)]" />
                </svg>
              </div>

              {/* Store Icon with Gradient Background */}
              <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-brand-primary)]/20 via-[var(--color-brand-primary)]/15 to-[var(--color-brand-primary)]/10 backdrop-blur-sm shadow-sm sm:h-24 sm:w-24">
                <Store className="h-10 w-10 text-[var(--color-brand-primary)]/80 sm:h-12 sm:w-12" />
              </div>
            </div>
          )}
          {/* Subtle overlay on hover */}
          <div className="absolute inset-0 bg-[var(--color-brand-primary)]/0 transition-all duration-300 group-hover:bg-[var(--color-brand-primary)]/5" />
        </div>

        {/* Store Info Section - Enhanced */}
        <CardContent className="flex flex-1 flex-col gap-3 bg-white p-5 sm:p-6">
          {/* Store Name */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 flex-1 text-lg leading-tight font-semibold text-[var(--color-brand-primary)] transition-colors group-hover:text-[var(--color-brand-primary)]/80 sm:text-xl">
              {store.name}
            </h3>
            {/* Arrow indicator for clickable action */}
            <ArrowRight
              className="mt-1 h-5 w-5 flex-shrink-0 text-neutral-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--color-brand-primary)]"
              aria-hidden="true"
            />
          </div>

          {/* Location Info - Enhanced */}
          {store.city && (
            <div className="flex items-start gap-2.5">
              <MapPin
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-500"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase mb-0.5">
                  {t("stores.city")}
                </p>
                <p className="truncate text-sm font-medium text-neutral-700 sm:text-base">
                  {store.city}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Link>
    </Card>
  );
}
