"use client";

import Link from "next/link";
import {
  Banknote,
  Boxes,
  ChefHat,
  Monitor,
  Printer,
  Smartphone,
  Tv,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { LANDING_GROUPS } from "@/features/marketing/landing/registry";
import { EpidomMark } from "@/features/marketing/shared/components/epidom-logo";
import { trackEvent } from "@/lib/analytics";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { cn } from "@/lib/utils";
import { SECONDARY_BUTTON, SectionHeading } from "./landing-ui";

/**
 * The eight things that hang off the till, as tiles around the Epidom mark.
 * `at` is the tile's centre in a 100 x 100 box; `line` is the connection from
 * the tile's inner edge to a pin on the chip, as points in the same box.
 */
/** Claude's mark (the sunburst), in its own orange. */
function ClaudeMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 -.01 39.5 39.53"
      fill="#d97757"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="m7.75 26.27 7.77-4.36.13-.38-.13-.21h-.38l-1.3-.08-4.44-.12-3.85-.16-3.73-.2-.94-.2-.88-1.16.09-.58.79-.53 1.13.1 2.5.17 3.75.26 2.72.16 4.03.42h.64l.09-.26-.22-.16-.17-.16-3.88-2.63-4.2-2.78-2.2-1.6-1.19-.81-.6-.76-.26-1.66 1.08-1.19 1.45.1.37.1 1.47 1.13 3.14 2.43 4.1 3.02.6.5.24-.17.03-.12-.27-.45-2.23-4.03-2.38-4.1-1.06-1.7-.28-1.02c-.1-.42-.17-.77-.17-1.2l1.23-1.67.68-.22 1.64.22.69.6 1.02 2.33 1.65 3.67 2.56 4.99.75 1.48.4 1.37.15.42h.26v-.24l.21-2.81.39-3.45.38-4.44.13-1.25.62-1.5 1.23-.81.96.46.79 1.13-.11.73-.47 3.05-.92 4.78-.6 3.2h.35l.4-.4 1.62-2.15 2.72-3.4 1.2-1.35 1.4-1.49.9-.71h1.7l1.25 1.86-.56 1.92-1.75 2.22-1.45 1.88-2.08 2.8-1.3 2.24.12.18.31-.03 4.7-1 2.54-.46 3.03-.52 1.37.64.15.65-.54 1.33-3.24.8-3.8.76-5.66 1.34-.07.05.08.1 2.55.24 1.09.06h2.67l4.97.37 1.3.86.78 1.05-.13.8-2 1.02-2.7-.64-6.3-1.5-2.16-.54h-.3v.18l1.8 1.76 3.3 2.98 4.13 3.84.21.95-.53.75-.56-.08-3.63-2.73-1.4-1.23-3.17-2.67h-.21v.28l.73 1.07 3.86 5.8.2 1.78-.28.58-1 .35-1.1-.2-2.26-3.17-2.33-3.57-1.88-3.2-.23.13-1.11 11.95-.52.61-1.2.46-1-.76-.53-1.23.53-2.43.64-3.17.52-2.52.47-3.13.28-1.04-.02-.07-.23.03-2.36 3.24-3.59 4.85-2.84 3.04-.68.27-1.18-.61.11-1.09.66-.97 3.93-5 2.37-3.1 1.53-1.79-.01-.26h-.09l-10.44 6.78-1.86.24-.8-.75.1-1.23.38-.4 3.14-2.16z" />
    </svg>
  );
}

const NODES: readonly {
  key: string;
  icon: LucideIcon | typeof ClaudeMark;
  at: readonly [number, number];
  line: readonly (readonly [number, number])[];
}[] = [
  {
    key: "phone",
    icon: Smartphone,
    at: [30, 10],
    line: [
      [30, 19],
      [30, 25],
      [42, 32],
      [42, 37],
    ],
  },
  {
    key: "kitchen",
    icon: ChefHat,
    at: [70, 10],
    line: [
      [70, 19],
      [70, 25],
      [58, 32],
      [58, 37],
    ],
  },
  {
    key: "cashier",
    icon: Monitor,
    at: [12, 34],
    line: [
      [21, 34],
      [25, 34],
      [31, 44],
      [37, 44],
    ],
  },
  {
    key: "money",
    icon: Banknote,
    at: [88, 34],
    line: [
      [79, 34],
      [75, 34],
      [69, 44],
      [63, 44],
    ],
  },
  {
    key: "staff",
    icon: Users,
    at: [12, 66],
    line: [
      [21, 66],
      [25, 66],
      [31, 56],
      [37, 56],
    ],
  },
  {
    key: "stock",
    icon: Boxes,
    at: [88, 66],
    line: [
      [79, 66],
      [75, 66],
      [69, 56],
      [63, 56],
    ],
  },
  {
    key: "printing",
    icon: Printer,
    at: [20, 90],
    line: [
      [20, 81],
      [20, 75],
      [42, 68],
      [42, 63],
    ],
  },
  // Claude, over MCP, runs the rest: it sits straight under the chip.
  {
    key: "claude",
    icon: ClaudeMark,
    at: [50, 90],
    line: [
      [50, 81],
      [50, 63],
    ],
  },
  {
    key: "customer",
    icon: Tv,
    at: [80, 90],
    line: [
      [80, 81],
      [80, 75],
      [58, 68],
      [58, 63],
    ],
  },
];

/** Pins along the mark's edges, as percentages of its side (the lines end on them). */
const PINS_ACROSS = [19, 50, 81] as const; // top and bottom edges
const PINS_DOWN = [27, 73] as const; // left and right edges

const toPoints = (line: readonly (readonly [number, number])[]) =>
  line.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * "Everything connected": the Epidom mark on a chip in the middle, joined to
 * the staff, the till, the kitchen, phone orders, stock, money, printing and
 * the customer screen. Meant as a picture of one set of data feeding every
 * screen, not of third-party integrations. The lines carry a slow moving dash
 * (no pause control, by request); it never moves with reduced motion.
 */
export function HubSection() {
  const { t, locale } = useI18n();
  // The Claude connector page, in the visitor's language.
  const connectorSlug = LANDING_GROUPS["claude-connector"][locale];

  return (
    <section aria-labelledby="hub-title" className="epi-section">
      <div className="epi-container">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              id="hub-title"
              eyebrow={t("redesign.landing.hub.eyebrow")}
              title={t("redesign.landing.hub.title")}
              sub={t("redesign.landing.hub.sub")}
            />
            <Link
              href={getLocalizedPath(connectorSlug ? `/${connectorSlug}` : "/products", locale)}
              onClick={() =>
                trackEvent("claude_promo_click", {
                  event_category: "claude_connector",
                  surface: "home_hub",
                })
              }
              data-reveal
              className={cn(SECONDARY_BUTTON, "mt-8")}
            >
              {t("redesign.landing.hub.cta")}
            </Link>
          </div>

          <div data-reveal="scale" className="relative mx-auto aspect-square w-full max-w-[540px]">
            {/* Soft glow behind the chip */}
            <div
              aria-hidden="true"
              className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle,rgba(217,174,59,0.22),transparent_70%)]"
            />

            <svg
              viewBox="0 0 100 100"
              aria-hidden="true"
              focusable="false"
              className="absolute inset-0 size-full"
            >
              {NODES.map(({ key, line }) => (
                <g key={key} fill="none" strokeLinejoin="round">
                  <polyline
                    points={toPoints(line)}
                    stroke="rgba(251,249,228,0.14)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    className="hub-flow motion-reduce:hidden"
                    points={toPoints(line)}
                    stroke="rgba(244,220,144,0.9)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeDasharray="2 14"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ))}
            </svg>

            {/* The Epidom mark itself is the chip: it already is a rounded square, so no
                second box goes around it. Pins sit on its edges where the lines end. */}
            <div
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 aspect-square w-[26%] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_40px_rgba(217,174,59,0.35)] [&>svg]:size-full"
            >
              <EpidomMark size={100} />
              {PINS_ACROSS.map((p) => (
                <span key={`h${p}`}>
                  {p !== 50 ? (
                    <span
                      className="bg-epi-gold-400/70 absolute -top-[5px] h-[5px] w-[3px] -translate-x-1/2 rounded-sm"
                      style={{ left: `${p}%` }}
                    />
                  ) : null}
                  <span
                    className="bg-epi-gold-400/70 absolute -bottom-[5px] h-[5px] w-[3px] -translate-x-1/2 rounded-sm"
                    style={{ left: `${p}%` }}
                  />
                </span>
              ))}
              {PINS_DOWN.map((p) => (
                <span key={`v${p}`}>
                  <span
                    className="bg-epi-gold-400/70 absolute -left-[5px] h-[3px] w-[5px] -translate-y-1/2 rounded-sm"
                    style={{ top: `${p}%` }}
                  />
                  <span
                    className="bg-epi-gold-400/70 absolute -right-[5px] h-[3px] w-[5px] -translate-y-1/2 rounded-sm"
                    style={{ top: `${p}%` }}
                  />
                </span>
              ))}
            </div>

            <ul className="m-0 list-none p-0">
              {NODES.map(({ key, icon: Icon, at }) => (
                <li
                  key={key}
                  data-reveal="scale"
                  className="absolute flex aspect-square w-[16%] min-w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-2xl bg-white text-[#0a1020] shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
                  style={{ left: `${at[0]}%`, top: `${at[1]}%` }}
                >
                  <Icon aria-hidden="true" className="text-epi-gold-700 size-[34%]" />
                  <span className="px-1 text-center text-[10px] leading-tight font-medium sm:text-[11px]">
                    {t(`redesign.landing.hub.${key}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
