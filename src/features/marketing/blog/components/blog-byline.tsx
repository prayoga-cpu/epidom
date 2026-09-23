import type { Locale } from "@/components/lang/i18n-provider";
import { EpidomMark } from "@/features/marketing/shared/components/epidom-logo";
import type { BlogAuthor } from "@/features/marketing/blog/content/types";

const COPY: Record<Locale, { team: string; readLabel: (m: number) => string }> = {
  fr: { team: "Équipe Epidom", readLabel: (m) => `${m} min de lecture` },
  id: { team: "Tim Epidom", readLabel: (m) => `${m} menit baca` },
  en: { team: "Epidom Team", readLabel: (m) => `${m} min read` },
};

function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "id" ? "id-ID" : locale === "fr" ? "fr-FR" : "en-US", {
    // Post dates are date-only ISO strings (parsed as UTC midnight); formatting in UTC keeps the day stable in any server timezone.
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const AVATAR_SIZE = 44;

/**
 * "Who wrote this, and when": the author (the localized Epidom team unless the
 * post names a real one), the role if given, the publication date and the
 * reading time. Without a `photoSrc` the avatar is the brand mark, never a
 * stand-in portrait.
 */
export function BlogByline({
  locale,
  author,
  date,
  readMinutes,
}: {
  locale: Locale;
  author?: BlogAuthor;
  date: string;
  readMinutes: number;
}) {
  const copy = COPY[locale];
  const name = author?.name ?? copy.team;

  return (
    <div className="mt-7 flex items-center gap-3.5">
      {author?.photoSrc ? (
        // Author photos are plain URLs (no next/image remotePatterns coupling), as elsewhere in the site.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={author.photoSrc}
          alt={name}
          width={AVATAR_SIZE}
          height={AVATAR_SIZE}
          loading="lazy"
          decoding="async"
          className="size-11 shrink-0 rounded-full border border-[rgba(217,174,59,0.35)] object-cover"
        />
      ) : (
        <EpidomMark size={AVATAR_SIZE} />
      )}
      <div className="min-w-0">
        <div className="text-[15px] leading-tight font-semibold text-[var(--epi-cream-50)]">
          {name}
        </div>
        <div className="mt-1 text-[13px] leading-snug text-[rgba(251,249,228,0.55)]">
          {author?.role ? <span>{author.role} · </span> : null}
          <time dateTime={date}>{formatDate(date, locale)}</time> · {copy.readLabel(readMinutes)}
        </div>
      </div>
    </div>
  );
}
