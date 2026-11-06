import { Banknote, ChefHat, Smartphone, Wine, type LucideIcon } from "lucide-react";
import { EpidomWordmark } from "./epidom-logo";

/** One frond of a palm leaf, drawn from its stem at the origin. */
const FROND = "M0 0 Q 90 -46 196 14 Q 104 -12 0 0Z";
const FROND_ANGLES = [-62, -32, -2, 28, 58] as const;

/** A floating glass card: an icon and two grey lines, like a slide in the Gamma footer. */
function GlassCard({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <div
      className={`absolute w-[26%] max-w-[210px] min-w-[104px] rounded-xl border border-white/25 bg-white/[0.14] p-3 shadow-[0_12px_40px_rgba(10,16,32,0.35)] backdrop-blur-md ${className}`}
    >
      <Icon className="size-5 text-white/90" strokeWidth={1.6} />
      <div className="mt-3 h-1.5 w-4/5 rounded-full bg-white/35" />
      <div className="mt-1.5 h-1.5 w-3/5 rounded-full bg-white/22" />
    </div>
  );
}

function Palm({ mirrored }: { mirrored?: boolean }) {
  return (
    <g transform={mirrored ? "translate(1210 -14) scale(-1 1)" : "translate(-10 -14)"}>
      {FROND_ANGLES.map((angle, i) => (
        <path
          key={angle}
          d={FROND}
          transform={`rotate(${angle + 40})`}
          fill={`url(#leaf${i % 2})`}
          opacity={0.96}
        />
      ))}
    </g>
  );
}

/**
 * The footer's illustration, after the Gamma reference: a dusk sky over the sea
 * (Epidom is from Canggu), palm leaves in the corners and, on a counter, the
 * things the product runs: coffee, a croissant, a cocktail and cash, with
 * glass cards floating behind them. Under it, the wordmark set large on a
 * night sky, as the reference's, with the tagline under it. The drawing and
 * the wordmark are decoration, hidden from assistive tech and drawn in code (no
 * image to download); the tagline is real text.
 *
 * Its colours are the one exception to the site's navy / gold / aurora palette
 * (see `aurora` in home/components/landing-ui.tsx): the owner kept the sunset.
 */
export function FooterScene({ tagline }: { tagline: string }) {
  return (
    <div className="relative mt-12 overflow-hidden select-none">
      <div aria-hidden="true" className="relative aspect-[12/5] min-h-[250px] w-full">
        <svg
          viewBox="0 0 1200 400"
          preserveAspectRatio="xMidYMax slice"
          className="absolute inset-0 size-full"
          focusable="false"
        >
          <defs>
            <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#17214d" />
              <stop offset="0.35" stopColor="#4b3a8f" />
              <stop offset="0.62" stopColor="#c8559d" />
              <stop offset="0.86" stopColor="#f2706b" />
              <stop offset="1" stopColor="#ffa05c" />
            </linearGradient>
            <radialGradient id="fs-sun" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fff0b8" />
              <stop offset="0.45" stopColor="#ffb347" stopOpacity="0.85" />
              <stop offset="1" stopColor="#ff7a59" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="fs-sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff9a62" />
              <stop offset="1" stopColor="#d9467f" />
            </linearGradient>
            <linearGradient id="fs-counter" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1a2547" />
              <stop offset="1" stopColor="#0a1020" />
            </linearGradient>
            <linearGradient id="leaf0" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#0d4d2e" />
              <stop offset="1" stopColor="#2aa05c" />
            </linearGradient>
            <linearGradient id="leaf1" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#0a3b25" />
              <stop offset="1" stopColor="#1f8a4c" />
            </linearGradient>
            <linearGradient id="fs-cup" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#e9e4d6" />
              <stop offset="0.5" stopColor="#ffffff" />
              <stop offset="1" stopColor="#d8d2c2" />
            </linearGradient>
            <linearGradient id="fs-croissant" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffd77a" />
              <stop offset="1" stopColor="#c9822b" />
            </linearGradient>
            <linearGradient id="fs-drink" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff6fa8" />
              <stop offset="1" stopColor="#ff9d5c" />
            </linearGradient>
            <linearGradient id="fs-bill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4fbf80" />
              <stop offset="1" stopColor="#1f6f4a" />
            </linearGradient>
            <linearGradient id="fs-coin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe08a" />
              <stop offset="1" stopColor="#c8932a" />
            </linearGradient>
          </defs>

          <rect width="1200" height="400" fill="url(#fs-sky)" />
          {/* A few stars high up, a few soft clouds low down */}
          {[
            [90, 40],
            [210, 70],
            [340, 28],
            [470, 62],
            [760, 34],
            [880, 76],
            [1010, 30],
            [1120, 66],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="#fff" opacity="0.7" />
          ))}
          <ellipse cx="250" cy="230" rx="150" ry="14" fill="#fff" opacity="0.14" />
          <ellipse cx="960" cy="214" rx="180" ry="16" fill="#fff" opacity="0.12" />

          {/* The sun on the horizon, and the sea under it */}
          <circle cx="600" cy="300" r="170" fill="url(#fs-sun)" />
          <rect y="296" width="1200" height="60" fill="url(#fs-sea)" />
          {[310, 322, 334].map((y, i) => (
            <rect
              key={y}
              x={380 + i * 30}
              y={y}
              width={440 - i * 60}
              height="2"
              rx="1"
              fill="#fff"
              opacity={0.28 - i * 0.06}
            />
          ))}

          <Palm />
          <Palm mirrored />

          {/* The counter */}
          <rect y="338" width="1200" height="62" fill="url(#fs-counter)" />
          <rect y="338" width="1200" height="1.5" fill="#fff" opacity="0.14" />

          {/* Croissant */}
          <g transform="translate(404 336) scale(1.15)">
            <path
              d="M-58 0 C-72 -14 -66 -40 -44 -52 C-30 -60 -14 -52 0 -54 C14 -52 30 -60 44 -52 C66 -40 72 -14 58 0 C40 -8 20 -12 0 -12 C-20 -12 -40 -8 -58 0Z"
              fill="url(#fs-croissant)"
            />
            <path
              d="M-22 -50 C-18 -34 -20 -22 -24 -10"
              stroke="#a8641c"
              strokeWidth="2"
              fill="none"
              opacity="0.7"
            />
            <path
              d="M0 -54 C2 -36 2 -22 0 -12"
              stroke="#a8641c"
              strokeWidth="2"
              fill="none"
              opacity="0.7"
            />
            <path
              d="M22 -50 C18 -34 20 -22 24 -10"
              stroke="#a8641c"
              strokeWidth="2"
              fill="none"
              opacity="0.7"
            />
          </g>

          {/* Coffee cup */}
          <g>
            <ellipse cx="528" cy="338" rx="54" ry="8" fill="#e9e4d6" />
            <path
              d="M493 284 L563 284 C563 320 546 336 528 336 C510 336 493 320 493 284Z"
              fill="url(#fs-cup)"
            />
            <path
              d="M563 294 C592 294 592 322 558 322"
              stroke="#f3efe3"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
            />
            <ellipse cx="528" cy="284" rx="35" ry="7" fill="#6b3f22" />
            <ellipse cx="528" cy="283" rx="26" ry="4" fill="#9a6338" opacity="0.7" />
            {[512, 528, 544].map((x, i) => (
              <path
                key={x}
                d={`M${x} 270 C${x - 8} 258 ${x + 8} 250 ${x} 238`}
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                opacity={0.5 - i * 0.08}
              />
            ))}
          </g>

          {/* Cocktail */}
          <g>
            <path
              d="M608 252 L692 252 L650 306Z"
              fill="#ffffff"
              fillOpacity="0.16"
              stroke="#fff"
              strokeOpacity="0.7"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M619 262 L681 262 L650 300Z" fill="url(#fs-drink)" />
            <path d="M650 306 L650 334" stroke="#fff" strokeOpacity="0.75" strokeWidth="3" />
            <ellipse cx="650" cy="337" rx="26" ry="5" fill="#fff" fillOpacity="0.5" />
            <path d="M638 240 L670 276" stroke="#e9e4d6" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="666" cy="272" r="6" fill="#86b84a" />
            <circle cx="667" cy="271" r="2" fill="#d24b4b" />
          </g>

          {/* Banknote and a stack of coins */}
          <g transform="rotate(-8 776 326)">
            <rect x="730" y="302" width="92" height="46" rx="5" fill="url(#fs-bill)" />
            <rect
              x="737"
              y="309"
              width="78"
              height="32"
              rx="3"
              fill="none"
              stroke="#fff"
              strokeOpacity="0.5"
              strokeWidth="1.5"
            />
            <circle cx="776" cy="325" r="10" fill="#fff" fillOpacity="0.55" />
            <rect x="744" y="320" width="14" height="3" rx="1.5" fill="#fff" fillOpacity="0.6" />
            <rect x="794" y="327" width="14" height="3" rx="1.5" fill="#fff" fillOpacity="0.6" />
          </g>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x="842" y={324 - i * 9} width="48" height="11" fill="#b9801f" />
              <ellipse cx="866" cy={335 - i * 9} rx="24" ry="6" fill="#b9801f" />
              <ellipse cx="866" cy={329 - i * 9} rx="24" ry="6" fill="url(#fs-coin)" />
            </g>
          ))}
        </svg>

        <GlassCard icon={Smartphone} className="top-[10%] left-[5%]" />
        <GlassCard icon={ChefHat} className="top-[42%] left-[17%] hidden opacity-70 sm:block" />
        <GlassCard icon={Banknote} className="top-[8%] right-[6%]" />
        <GlassCard icon={Wine} className="top-[40%] right-[16%] hidden opacity-70 sm:block" />
      </div>

      {/* The wordmark, large, on a night sky, and the tagline under it */}
      <div
        className="relative flex flex-col items-center overflow-hidden px-4 pt-10 pb-6"
        style={{
          background:
            "linear-gradient(180deg, #121c42 0%, #0b1330 55%, var(--epi-navy-950, #070b14) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(1.5px 1.5px at 20px 30px, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 90px 84px, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 156px 22px, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 62px 152px, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 174px 128px, rgba(255,255,255,0.65), transparent)",
            backgroundSize: "200px 200px",
          }}
        />
        <div
          aria-hidden="true"
          className="relative"
          style={{
            color: "rgba(214,222,255,0.2)",
            maskImage: "linear-gradient(180deg, #000 30%, rgba(0,0,0,0.25) 100%)",
            WebkitMaskImage: "linear-gradient(180deg, #000 30%, rgba(0,0,0,0.25) 100%)",
          }}
        >
          <EpidomWordmark
            style={{ display: "block", width: "clamp(260px, 78vw, 1000px)", height: "auto" }}
          />
        </div>
        <p className="epi-display-light text-epi-cream-50/75 relative m-0 mt-4 text-center text-[clamp(20px,2.6vw,32px)] leading-tight text-balance">
          {tagline}
        </p>
      </div>
    </div>
  );
}
