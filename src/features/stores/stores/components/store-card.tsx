"use client";

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
import { MapPin, ArrowRight, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Store } from "../hooks/use-stores";
import { EditStoreDialog } from "./edit-store-dialog";
import { DeleteStoreDialog } from "./delete-store-dialog";

interface StoreCardProps {
  store: Store;
}

export function StoreCard({ store }: StoreCardProps) {
  const { t } = useI18n();

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden border border-neutral-200/60 bg-white p-0 shadow-sm transition-all duration-300 hover:border-neutral-300 hover:shadow-lg">
      {/* Actions Dropdown - Positioned absolutely */}
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 bg-white/90 p-0 shadow-sm backdrop-blur-sm hover:bg-white"
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
        className="flex h-full flex-col rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] focus-visible:ring-offset-2"
      >
        {/* Store Image Container - Full width, no padding, rounded top corners */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-gradient-to-br from-neutral-100 to-neutral-200">
          <Image
            src={store.image || "/images/placeholder-store.png"}
            alt={store.name}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={false}
            unoptimized={store.image?.includes('blob.vercel-storage.com') ? false : true}
            onError={(e) => {
              console.error('Image load error for store:', store.name, store.image);
              // Fallback to placeholder on error
              const target = e.target as HTMLImageElement;
              target.src = '/images/placeholder-store.png';
            }}
          />
        </div>

        {/* Store Info Section */}
        <CardContent className="flex flex-1 flex-col gap-3 bg-white p-4">
          {/* Store Name */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 flex-1 text-base leading-snug font-semibold text-[var(--color-brand-primary)] transition-colors group-hover:text-[var(--color-brand-primary)]/90 sm:text-lg">
              {store.name}
            </h3>
            {/* Arrow indicator for clickable action */}
            <ArrowRight
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--color-brand-primary)] sm:h-5 sm:w-5"
              aria-hidden="true"
            />
          </div>

          {/* Location Info */}
          <div className="flex items-center gap-2">
            <MapPin
              className="h-3.5 w-3.5 flex-shrink-0 text-neutral-500 sm:h-4 sm:w-4"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
                {t("stores.city")}
              </p>
              <p className="truncate text-sm font-medium text-neutral-700 sm:text-base">
                {store.city || "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
