"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** One titled block of the Help centre. */
export function HelpSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  /** Sits at the right of the title (a "See all" link). */
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 id={headingId} className="text-foreground text-base font-semibold">
            {title}
          </h2>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A bordered card of rows, split by hairlines. */
export function HelpRowGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="bg-card divide-y overflow-hidden rounded-xl border">
      {children}
    </ul>
  );
}

interface HelpActionRowProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  /** In-app path: rendered as a Link. */
  href?: string;
  /** Outside link (WhatsApp): opens in a new tab. */
  externalHref?: string;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * Icon tile, label, one muted line, chevron. A Link when it goes somewhere, a
 * button when it does something. At least 56px tall: well over the 40px touch
 * floor, with room for the two lines.
 */
export function HelpActionRow({
  icon: Icon,
  label,
  description,
  href,
  externalHref,
  onClick,
  disabled = false,
}: HelpActionRowProps) {
  const className = cn(
    "hover:bg-accent active:bg-accent flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors",
    "disabled:pointer-events-none disabled:opacity-50"
  );
  const content = (
    <>
      <span
        className="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block text-sm font-medium">{label}</span>
        {description && (
          <span className="text-muted-foreground block text-xs leading-snug">{description}</span>
        )}
      </span>
      {externalHref ? (
        <ExternalLink className="text-muted-foreground size-4 shrink-0" aria-hidden />
      ) : (
        <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
      )}
    </>
  );

  if (href) {
    return (
      <li>
        <Link href={href} onClick={onClick} className={className}>
          {content}
        </Link>
      </li>
    );
  }
  if (externalHref) {
    return (
      <li>
        <a href={externalHref} target="_blank" rel="noopener noreferrer" className={className}>
          {content}
        </a>
      </li>
    );
  }
  return (
    <li>
      <button type="button" onClick={onClick} disabled={disabled} className={className}>
        {content}
      </button>
    </li>
  );
}
