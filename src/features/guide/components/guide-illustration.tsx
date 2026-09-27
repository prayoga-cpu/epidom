import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Where the (up to three) small icons sit around the big one: upper left,
 * upper right, lower right. Offsets from the centre so they stay put whatever
 * the panel's width.
 */
const SATELLITE_POSITIONS = [
  "left-[calc(50%-7rem)] top-[calc(50%-3.25rem)] sm:left-[calc(50%-8rem)]",
  "left-[calc(50%+4.5rem)] top-[calc(50%-3.75rem)] sm:left-[calc(50%+5.5rem)]",
  "left-[calc(50%+3.5rem)] top-[calc(50%+1.25rem)] sm:left-[calc(50%+4.5rem)]",
] as const;

interface GuideIllustrationProps {
  /** The big gold tile in the middle. */
  main: LucideIcon;
  /** Up to three smaller tiles around it. */
  satellites?: readonly LucideIcon[];
  className?: string;
}

/**
 * A composed icon illustration on a navy panel in the brand colours — no
 * image assets, so it themes, scales and costs nothing to load. Decorative
 * (aria-hidden): every card says in words what it shows.
 */
export function GuideIllustration({
  main: Main,
  satellites = [],
  className,
}: GuideIllustrationProps) {
  return (
    <IllustrationPanel className={className}>
      <div className="border-epi-gold-500/30 absolute size-28 rounded-full border border-dashed sm:size-32" />
      <div className="bg-epi-gold-500 text-epi-navy-900 relative flex size-16 items-center justify-center rounded-2xl shadow-lg shadow-black/30 sm:size-20">
        <Main className="size-8 sm:size-10" strokeWidth={1.75} />
      </div>
      {satellites.slice(0, SATELLITE_POSITIONS.length).map((Icon, index) => (
        <div
          key={index}
          className={cn(
            "border-epi-gold-500/40 bg-epi-navy-700 text-epi-gold-300 absolute flex size-10 items-center justify-center rounded-xl border shadow-md shadow-black/20 sm:size-11",
            SATELLITE_POSITIONS[index]
          )}
        >
          <Icon className="size-5" strokeWidth={1.75} />
        </div>
      ))}
    </IllustrationPanel>
  );
}

interface GuideTrioIllustrationProps {
  /** Three tiles in a row; the middle one is raised and gold. */
  icons: readonly [LucideIcon, LucideIcon, LucideIcon];
  className?: string;
}

/** Three tiles on one line — the "three spaces" picture. */
export function GuideTrioIllustration({ icons, className }: GuideTrioIllustrationProps) {
  return (
    <IllustrationPanel className={className}>
      <div className="border-epi-gold-500/35 absolute inset-x-12 top-1/2 border-t border-dashed" />
      <div className="relative flex items-center gap-4 sm:gap-6">
        {icons.map((Icon, index) => {
          const middle = index === 1;
          return (
            <div
              key={index}
              className={cn(
                "flex items-center justify-center rounded-2xl shadow-lg shadow-black/30",
                middle
                  ? "bg-epi-gold-500 text-epi-navy-900 size-16 -translate-y-2 sm:size-20"
                  : "border-epi-gold-500/40 bg-epi-navy-700 text-epi-gold-300 size-14 border sm:size-16"
              )}
            >
              <Icon
                className={middle ? "size-8 sm:size-10" : "size-7 sm:size-8"}
                strokeWidth={1.75}
              />
            </div>
          );
        })}
      </div>
    </IllustrationPanel>
  );
}

function IllustrationPanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "from-epi-navy-800 to-epi-navy-900 relative flex h-36 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br sm:h-44",
        className
      )}
    >
      <div className="bg-epi-gold-500/15 absolute -top-12 -right-10 size-40 rounded-full blur-2xl" />
      <div className="bg-epi-navy-500/30 absolute -bottom-14 -left-10 size-40 rounded-full blur-2xl" />
      {children}
    </div>
  );
}
