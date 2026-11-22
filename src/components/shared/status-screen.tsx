import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * StatusScreen: the one look of every "something is off" screen (404, error
 * boundaries, route errors). Presentational only: the caller owns the logic
 * (reset, reload, logging) and the copy (already translated).
 *
 * Two tones, one language (navy, cream, gold; a gold-hairline icon tile; pill
 * buttons at least 44px tall that stack on a phone):
 * - "brand": a navy surface with its own background, for screens that take
 *   over the page (404, a crashed tree). Readable wherever it lands, whatever
 *   the app theme, because it brings its own colours.
 * - "app": a card on the app's themed tokens, for errors shown INSIDE the app
 *   shell (topbar and sidebar still there). Follows light and dark mode.
 *
 * Thai: no letter-spacing and no tight tracking on translated text (tracking
 * splits Thai vowel and tone marks from their consonant). Pass `locale`; only
 * the Latin `code` ("404") keeps its tracking.
 *
 * The offline pages and global-error.tsx cannot import this (static files, no
 * stylesheet): they repeat the same look by hand. Change them together.
 */

export type StatusTone = "brand" | "app";

export interface StatusAction {
  label: string;
  /** A lucide icon element; sized by the button. */
  icon?: ReactNode;
  /** A link when set, a button otherwise. */
  href?: string;
  onClick?: () => void;
  /** Defaults to "primary" for the first action and "secondary" for the rest. */
  variant?: "primary" | "secondary";
}

interface StatusScreenProps {
  tone?: StatusTone;
  /**
   * "page": fills the viewport (zoom-aware) and centres itself.
   * "fill": fills the flex parent it is given (the app shell's content area).
   */
  layout?: "page" | "fill";
  /** Latin-only code set large above the title, e.g. "404". */
  code?: string;
  /** A lucide icon element, shown in the gold-hairline tile. */
  icon?: ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  /** A quieter second line under the description. */
  hint?: string;
  actions?: StatusAction[];
  /** Technical details (development only, as a rule). */
  details?: ReactNode;
  /** A short reference line (an error digest), set in monospace. */
  reference?: string;
  /** A closing line under the actions (a help link). */
  footer?: ReactNode;
  /** The active locale: "th" switches tracking off. */
  locale?: string;
  /** Announce the screen to assistive tech as an error. */
  announce?: boolean;
  /** Heading level of the title; keep one <h1> per page. */
  headingLevel?: "h1" | "h2";
  className?: string;
}

const BUTTON_BASE =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-center text-[15px] leading-tight cursor-pointer transition-[transform,box-shadow,background-color,border-color] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto sm:min-w-40 [&_svg]:size-4 [&_svg]:shrink-0";

const BUTTON: Record<StatusTone, Record<"primary" | "secondary", string>> = {
  brand: {
    primary:
      "border-0 bg-[linear-gradient(180deg,#f4dc90,#d7b54b_55%,#a97c1c)] font-semibold text-[#151004] shadow-[0_0_0_1px_rgba(255,255,255,.28)_inset,0_8px_28px_rgba(217,174,59,.35),0_3px_0_rgba(139,90,10,.85)] hover:shadow-[0_0_0_1px_rgba(255,255,255,.38)_inset,0_14px_36px_rgba(217,174,59,.5),0_3px_0_rgba(139,90,10,.85)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-epi-gold-300",
    secondary:
      "border border-white/20 bg-transparent font-medium text-epi-cream-50 hover:border-white/40 hover:bg-white/[0.04] focus-visible:outline-epi-gold-300",
  },
  app: {
    primary:
      "border-0 bg-epi-gold-500 font-semibold text-epi-navy-950 hover:bg-epi-gold-400 focus-visible:outline-ring",
    secondary:
      "border border-border bg-transparent font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-ring",
  },
};

/** The marketing page background (.epidom-dark-page), without its min-height. */
const BRAND_BACKGROUND =
  "radial-gradient(1200px 600px at 80% -10%, rgba(91,136,178,0.18), transparent 60%), radial-gradient(900px 500px at 10% 110%, rgba(217,174,59,0.1), transparent 60%), var(--epi-navy-900)";

function ActionButton({ action, tone, index }: { action: StatusAction; tone: StatusTone; index: number }) {
  const variant = action.variant ?? (index === 0 ? "primary" : "secondary");
  const className = cn(BUTTON_BASE, BUTTON[tone][variant]);
  const content = (
    <>
      {action.icon ? <span aria-hidden="true">{action.icon}</span> : null}
      <span className="min-w-0 break-words">{action.label}</span>
    </>
  );

  if (action.href) {
    return (
      <Link href={action.href} onClick={action.onClick} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {content}
    </button>
  );
}

export function StatusScreen({
  tone = "brand",
  layout = "page",
  code,
  icon,
  eyebrow,
  title,
  description,
  hint,
  actions,
  details,
  reference,
  footer,
  locale,
  announce = false,
  headingLevel = "h1",
  className,
}: StatusScreenProps) {
  const thai = locale === "th";
  const brand = tone === "brand";
  const Heading = headingLevel;

  const body = (
    <div
      role={announce ? "alert" : undefined}
      className={cn("flex w-full flex-col items-center text-center", brand ? "gap-6" : "gap-5")}
    >
      {code ? (
        // Latin digits only, so the tight tracking is safe in every locale.
        <p
          className={cn(
            "m-0 bg-clip-text text-[clamp(4.5rem,24vw,10.5rem)] leading-[0.85] font-semibold tracking-[-0.05em] text-transparent tabular-nums",
            brand
              ? "bg-[linear-gradient(180deg,#f4dc72,#d9ae3b_60%,#bf8e31)]"
              : "bg-[linear-gradient(180deg,#bf8e31,#8a6420)] dark:bg-[linear-gradient(180deg,#f4dc72,#d9ae3b_60%,#bf8e31)]"
          )}
        >
          {code}
        </p>
      ) : icon ? (
        <div aria-hidden="true" className="epi-logo-tile size-14 shrink-0 [&_svg]:size-6">
          {icon}
        </div>
      ) : null}

      <div className="flex w-full flex-col items-center gap-3">
        {eyebrow ? (
          <p
            className={cn(
              "m-0 font-medium",
              thai ? "text-[13px]" : "text-xs tracking-[0.16em] uppercase",
              brand ? "text-epi-gold-400" : "text-epi-gold-700 dark:text-epi-gold-400"
            )}
          >
            {eyebrow}
          </p>
        ) : null}

        <Heading
          className={cn(
            "m-0 max-w-full font-semibold text-balance break-words",
            brand
              ? "text-epi-cream-50 text-[clamp(1.75rem,6.5vw,3rem)]"
              : "text-foreground text-[clamp(1.25rem,4.5vw,1.625rem)]",
            thai ? "leading-[1.35]" : "leading-[1.12] tracking-[-0.025em]"
          )}
        >
          {title}
        </Heading>

        {description ? (
          <p
            className={cn(
              "m-0 max-w-[34rem] text-pretty",
              thai ? "leading-[1.75]" : "leading-relaxed",
              brand
                ? "text-epi-cream-50/75 text-[clamp(0.9375rem,2.8vw,1.0625rem)]"
                : "text-muted-foreground text-sm sm:text-[15px]"
            )}
          >
            {description}
          </p>
        ) : null}

        {hint ? (
          <p
            className={cn(
              "m-0 max-w-[34rem] text-[13px] text-pretty",
              thai ? "leading-[1.7]" : "leading-relaxed",
              brand ? "text-epi-cream-50/60" : "text-muted-foreground"
            )}
          >
            {hint}
          </p>
        ) : null}
      </div>

      {details ? (
        <div
          className={cn(
            "w-full max-w-[34rem] rounded-xl border p-3 text-left",
            brand
              ? "text-epi-cream-50/80 border-white/10 bg-white/[0.04]"
              : "border-border bg-muted/50 text-muted-foreground"
          )}
        >
          {details}
        </div>
      ) : null}

      {actions?.length ? (
        // Stacked and full width on a phone, side by side from sm. Each button
        // is w-full OR auto, never flex-1 + w-full (that overflows the row).
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
          {actions.map((action, index) => (
            <ActionButton key={action.label} action={action} tone={tone} index={index} />
          ))}
        </div>
      ) : null}

      {reference ? (
        <p
          className={cn(
            "m-0 max-w-full font-mono text-[11px] break-all",
            brand ? "text-epi-cream-50/55" : "text-muted-foreground"
          )}
        >
          {reference}
        </p>
      ) : null}

      {footer ? (
        <div
          className={cn(
            "w-full max-w-[34rem] text-sm",
            thai ? "leading-[1.7]" : "leading-relaxed",
            brand ? "text-epi-cream-50/65" : "text-muted-foreground"
          )}
        >
          {brand ? <div aria-hidden="true" className="epi-gold-rule mx-auto mb-5 w-40" /> : null}
          {footer}
        </div>
      ) : null}
    </div>
  );

  if (!brand) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center",
          layout === "page"
            ? "min-h-[calc(100vh/var(--app-zoom,1))] p-4 supports-[height:100dvh]:min-h-[calc(100dvh/var(--app-zoom,1))]"
            : "min-h-0 flex-1 p-3 sm:p-6",
          className
        )}
      >
        <div className="bg-card text-card-foreground border-border relative w-full max-w-md overflow-hidden rounded-2xl border px-5 py-8 shadow-sm sm:px-8 sm:py-10">
          <div aria-hidden="true" className="epi-gold-rule absolute inset-x-0 top-0" />
          {body}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ background: BRAND_BACKGROUND }}
      className={cn(
        "text-epi-cream-50 relative flex w-full items-center justify-center overflow-hidden antialiased",
        // Safe-area aware gutters: a notch or a home indicator never covers the text.
        "pt-[max(3rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(3rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))]",
        layout === "page"
          ? "min-h-[calc(100vh/var(--app-zoom,1))] supports-[height:100dvh]:min-h-[calc(100dvh/var(--app-zoom,1))]"
          : "min-h-0 flex-1",
        className
      )}
    >
      <div aria-hidden="true" className="epi-hero-pattern" />
      <div className="relative z-[1] w-full max-w-[40rem]">{body}</div>
    </div>
  );
}
