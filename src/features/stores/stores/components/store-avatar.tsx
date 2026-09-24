"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  /** On the card, overlapping the bottom of the cover. */
  card: "size-16 text-2xl sm:size-[72px] sm:text-3xl",
  /** In the chooser's header. */
  dialog: "size-12 text-lg",
} as const;

interface StoreAvatarProps {
  logoUrl: string | null;
  /** Shown on the brand colour when there is no logo, or it fails to load. */
  initial: string;
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * The store's round logo, like the storefront header's. Reads the brand from
 * the --store-brand / --store-brand-ink custom properties set by an ancestor
 * (the card root, or the chooser's DialogContent). Decorative: the store name
 * is always printed next to it.
 */
export function StoreAvatar({ logoUrl, initial, size = "card", className }: StoreAvatarProps) {
  // Keyed by URL so a new logo (the overview arriving, or a re-upload) gets
  // its own chance to load.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showLogo = !!logoUrl && failedUrl !== logoUrl;

  return (
    <div
      className={cn(
        "border-card bg-card relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-4 shadow-sm ring-2 ring-[var(--store-brand)]",
        SIZES[size],
        className
      )}
    >
      {showLogo ? (
        // A plain <img>, not next/image: the logo can be a base64 data: URI
        // (onboarding's generated logo), which the optimiser can't take.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          data-testid="store-avatar-logo"
          className="bg-muted size-full object-cover"
          onError={() => setFailedUrl(logoUrl)}
        />
      ) : (
        <span
          aria-hidden="true"
          data-testid="store-avatar-initial"
          className="flex size-full items-center justify-center bg-[var(--store-brand)] leading-none font-bold text-[var(--store-brand-ink)]"
        >
          {initial}
        </span>
      )}
    </div>
  );
}
