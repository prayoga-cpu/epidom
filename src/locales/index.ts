import { en } from "./en";

export type Lang = "en" | "fr" | "id";

/**
 * Locale dictionaries are ~225KB of source EACH. Importing all three from one
 * module put all 687KB into a single client chunk that every page pulled in
 * (measured: 563KB minified / 177KB gzipped, referenced by 126 built routes),
 * to render text in exactly ONE of them. That parse cost is the single
 * biggest thing standing between a request and first paint, and it is felt
 * worst on the Android tills this app runs on.
 *
 * So: `en` is the only static import. It is the synchronous baseline every
 * surface can render with — the (app), (public) and (auth) providers all
 * start at "en" and only switch after hydration — and it is the target of
 * t()'s missing-key fallback, so it must never be async.
 *
 * `fr` and `id` are code-split behind `loadLocale()` and fetched only by a
 * visitor who actually reads them. Nothing is removed: every key in every
 * language is still shipped, just not to people who can't read it.
 *
 * The marketing site is the exception and does NOT go through this path — its
 * locale comes from the URL and must be correct in the server-rendered HTML
 * for SEO. See `i18n-provider-eager.tsx`.
 */
export { en };

/** Seeded synchronously with `en`; `fr`/`id` land here once their chunk loads. */
const registry = new Map<Lang, unknown>([["en", en]]);

/** Registers a dictionary that was imported eagerly elsewhere (marketing). */
export function seedLocale(locale: Lang, messages: unknown): void {
  registry.set(locale, messages);
}

/** The dictionary for `locale`, or undefined if its chunk hasn't loaded yet. */
export function getLocaleMessages(locale: Lang): unknown {
  return registry.get(locale);
}

export function isLocaleLoaded(locale: Lang): boolean {
  return registry.has(locale);
}

/** In-flight loads, so N components asking at once share one network request. */
const pending = new Map<Lang, Promise<unknown>>();

/**
 * Loads `locale`'s dictionary into the registry. Resolves immediately if it is
 * already there. Never rejects — a chunk that fails to load leaves the caller
 * on the English fallback rather than taking the page down with it.
 */
export function loadLocale(locale: Lang): Promise<unknown> {
  const existing = registry.get(locale);
  if (existing) return Promise.resolve(existing);

  const inFlight = pending.get(locale);
  if (inFlight) return inFlight;

  // Explicit per-locale branches, not `import(\`./${locale}\`)`: a template
  // literal makes the bundler emit a context module containing every file in
  // the directory, which would defeat the whole point.
  const load = (locale === "fr" ? import("./fr") : import("./id"))
    .then((mod) => {
      const messages = locale === "fr" ? (mod as { fr: unknown }).fr : (mod as { id: unknown }).id;
      registry.set(locale, messages);
      return messages;
    })
    .catch(() => {
      // Leave it unregistered so a later attempt can retry.
      pending.delete(locale);
      return undefined;
    });

  pending.set(locale, load);
  return load;
}
