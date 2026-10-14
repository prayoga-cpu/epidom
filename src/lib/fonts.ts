import localFont from "next/font/local";

/**
 * `geist/font/mono` with `preload: false`: same file, CSS variable and
 * fallbacks as the package's own declaration. Import this one, never the
 * package's: a font declared with preload in any layout is preloaded on every
 * page that layout covers (the package's also leaked onto marketing pages),
 * and monospace text (codes, IDs) is never what a page paints first. Its 57 KB
 * only competed with the render-blocking stylesheet on slow connections.
 */
export const geistMono = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  adjustFontFallback: false,
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Roboto Mono",
    "Menlo",
    "Monaco",
    "Liberation Mono",
    "DejaVu Sans Mono",
    "Courier New",
    "monospace",
  ],
  weight: "100 900",
  preload: false,
});
