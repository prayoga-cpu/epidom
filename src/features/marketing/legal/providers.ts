/**
 * Every outside service that receives personal data from Epidom, in one place so
 * the Privacy Policy and the GDPR page can never list different providers.
 *
 * The names and what each one does live in the locale files under
 * `privacy.processors.<id>.name` / `.purpose`. `href` is the provider's own
 * privacy policy, only set where the URL has been opened and resolves: leave it
 * out rather than guess. Adding a provider means adding it here AND under
 * `privacy.processors` in all three locales.
 *
 * A provider is listed because the code sends it data. Several are switched on
 * per environment or per store (Pusher, MagicBell, Fonnte, the Stripe/Xendit
 * flows, AI features, the Cloudflare R2 backups once the R2_* variables are
 * set), so which ones are live in production is an operator check, see
 * STATUS.md.
 */
export const PROVIDERS = [
  { id: "vercel", href: "https://vercel.com/legal/privacy-notice" },
  { id: "neon", href: "https://neon.com/privacy-policy" },
  // Nightly database backup (src/lib/backup/*): every application table, 90 days.
  { id: "cloudflare", href: "https://www.cloudflare.com/privacypolicy/" },
  { id: "stripe", href: "https://stripe.com/privacy" },
  { id: "xendit" },
  { id: "resend", href: "https://resend.com/legal/privacy-policy" },
  { id: "inngest", href: "https://www.inngest.com/privacy" },
  { id: "google", href: "https://policies.google.com/privacy" },
  { id: "meta", href: "https://www.facebook.com/privacy/policy" },
  { id: "openai", href: "https://openai.com/policies/privacy-policy" },
  { id: "pusher" },
  { id: "magicbell", href: "https://www.magicbell.com/privacy-policy" },
  { id: "webpush" },
  { id: "osm", href: "https://osmfoundation.org/wiki/Privacy_Policy" },
  { id: "ipapi", href: "https://ipapi.co/privacy/" },
  { id: "fonnte" },
] as const satisfies ReadonlyArray<{ id: string; href?: string }>;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

/** Providers' own cookie pages, linked from the Cookie Policy. */
export const COOKIE_LINKS = {
  google: "https://policies.google.com/technologies/cookies",
  meta: "https://www.facebook.com/privacy/policies/cookies",
  vercel: "https://vercel.com/legal/privacy-notice",
  stripe: "https://stripe.com/legal/cookies-policy",
  googleAccount: "https://policies.google.com/privacy",
} as const;

/** The French data protection authority, named in the rights sections. */
export const CNIL_URL = "https://www.cnil.fr/";
