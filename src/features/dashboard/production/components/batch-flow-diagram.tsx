"use client";

import { useI18n } from "@/components/lang/i18n-provider";

/**
 * The batch-production model, drawn as the bakery it was designed around:
 * sacks of flour become a tray of loaves at dawn, the loaves sit on a shelf,
 * and each sale takes one off that shelf.
 *
 * Why a diagram and not a list: the thing people get wrong is WHERE the
 * ingredients leave. In batch mode they leave once, at the bake — not again at
 * the till. Two arrows with different labels say that in a way three paragraphs
 * of copy do not.
 *
 * Inline SVG, no asset fetch, and every colour comes from a design token via
 * `currentColor` on themed wrappers, so it reads correctly in both themes.
 */
export function BatchFlowDiagram() {
  const { t } = useI18n();

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  return (
    <figure className="m-0 w-full">
      {/* Wide but scrollable rather than squashed: below ~420px the three
          stages would compress into illegibility, so the figure scrolls
          inside its own container and the page never moves sideways. */}
      <div className="-mx-2 overflow-x-auto px-2 sm:mx-0 sm:px-0">
        <svg
          viewBox="0 0 640 160"
          role="img"
          aria-label={tr(
            "production.diagram.alt",
            "Flour and butter become a batch of loaves, the loaves sit in stock, and each sale takes one loaf."
          )}
          className="text-muted-foreground h-auto w-full min-w-[520px]"
        >
          <defs>
            {/* One arrowhead, recoloured per-use via the marker's context. */}
            <marker
              id="bfd-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>

          {/* ── Stage 1: raw materials ─────────────────────────────────── */}
          <g className="text-amber-600 dark:text-amber-400">
            <rect
              x="6"
              y="34"
              width="140"
              height="82"
              rx="10"
              fill="currentColor"
              fillOpacity="0.08"
              stroke="currentColor"
              strokeOpacity="0.35"
            />
            {/* Wheat sheaf */}
            <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
              <path d="M70 84 V58" />
              <path d="M70 62 q-9 -5 -11 -13 q9 1 11 9" />
              <path d="M70 62 q9 -5 11 -13 q-9 1 -11 9" />
              <path d="M70 72 q-9 -5 -11 -13 q9 1 11 9" />
              <path d="M70 72 q9 -5 11 -13 q-9 1 -11 9" />
            </g>
            {/* Sack */}
            <path
              d="M56 84 h28 l4 16 a6 6 0 0 1 -6 6 h-24 a6 6 0 0 1 -6 -6 z"
              fill="currentColor"
              fillOpacity="0.25"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <text
              x="70"
              y="126"
              textAnchor="middle"
              className="fill-current text-[11px] font-medium"
            >
              {tr("production.diagram.rawMaterials", "Flour, butter, yeast")}
            </text>
          </g>

          {/* ── Arrow 1: the bake — this is where ingredients leave ─────── */}
          <g className="text-amber-600 dark:text-amber-400">
            <line
              x1="154"
              y1="75"
              x2="222"
              y2="75"
              stroke="currentColor"
              strokeWidth="2"
              markerEnd="url(#bfd-arrow)"
            />
            <text x="188" y="60" textAnchor="middle" className="fill-current text-[10px]">
              {tr("production.diagram.bake", "You bake")}
            </text>
            <text
              x="188"
              y="96"
              textAnchor="middle"
              className="fill-current text-[9px] font-semibold"
            >
              {tr("production.diagram.ingredientsOut", "ingredients out")}
            </text>
          </g>

          {/* ── Stage 2: finished goods on the shelf ───────────────────── */}
          <g className="text-emerald-600 dark:text-emerald-400">
            <rect
              x="230"
              y="34"
              width="152"
              height="82"
              rx="10"
              fill="currentColor"
              fillOpacity="0.08"
              stroke="currentColor"
              strokeOpacity="0.35"
            />
            {/* Three loaves on a shelf, centred in the widened box (230..382) */}
            <g fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5">
              <path d="M260 78 q0 -14 15 -14 q15 0 15 14 z" />
              <path d="M291 78 q0 -14 15 -14 q15 0 15 14 z" />
              <path d="M322 78 q0 -14 15 -14 q15 0 15 14 z" />
            </g>
            <line x1="252" y1="78" x2="360" y2="78" stroke="currentColor" strokeWidth="2" />
            <text
              x="306"
              y="97"
              textAnchor="middle"
              className="fill-current text-[11px] font-semibold"
            >
              {tr("production.diagram.counted", "20 loaves counted")}
            </text>
            <text x="306" y="126" textAnchor="middle" className="fill-current text-[11px]">
              {tr("production.diagram.inStock", "In stock")}
            </text>
          </g>

          {/* ── Arrow 2: the sale — the shelf drops, ingredients do NOT ── */}
          <g className="text-emerald-600 dark:text-emerald-400">
            <line
              x1="390"
              y1="75"
              x2="458"
              y2="75"
              stroke="currentColor"
              strokeWidth="2"
              markerEnd="url(#bfd-arrow)"
            />
            <text x="424" y="60" textAnchor="middle" className="fill-current text-[10px]">
              {tr("production.diagram.sell", "You sell")}
            </text>
            <text x="424" y="96" textAnchor="middle" className="fill-current text-[9px]">
              {tr("production.diagram.oneOffShelf", "−1 loaf")}
            </text>
          </g>

          {/* ── Stage 3: the sale ──────────────────────────────────────── */}
          <g className="text-foreground/70">
            <rect
              x="466"
              y="34"
              width="140"
              height="82"
              rx="10"
              fill="currentColor"
              fillOpacity="0.06"
              stroke="currentColor"
              strokeOpacity="0.25"
            />
            {/* Receipt, centred in the widened box (466..606) */}
            <path
              d="M514 50 h44 v46 l-7 -5 l-7 5 l-7 -5 l-7 5 l-7 -5 l-9 5 z"
              fill="currentColor"
              fillOpacity="0.15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.8">
              <path d="M522 62 h28" />
              <path d="M522 72 h28" />
              <path d="M522 82 h18" />
            </g>
            <text x="536" y="126" textAnchor="middle" className="fill-current text-[11px]">
              {tr("production.diagram.sale", "Sold at the till")}
            </text>
          </g>
        </svg>
      </div>

      <figcaption className="text-muted-foreground mt-3 text-center text-xs leading-relaxed">
        {tr(
          "production.diagram.caption",
          "Ingredients leave once — when you bake. A sale just takes a loaf off the shelf. Sell more than you baked and we take the ingredients for those at the till instead, so nothing is counted twice."
        )}
      </figcaption>
    </figure>
  );
}
