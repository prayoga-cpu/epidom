import type { StaticImageData } from "next/image";
import type { LocalizedText } from "@/features/marketing/home/data/localized-text";

export interface TeamMember {
  slug: string;
  name: string;
  /** A plain string shows in every locale; a per-locale map lets you translate it. */
  role: LocalizedText;
  /**
   * A real photo of this person. Import it from `../assets/` (or give
   * `{ src, width, height }` for a Vercel Blob URL). No stock or generated faces.
   */
  photo: StaticImageData;
}

/**
 * The people shown on the About page. Ships EMPTY on purpose: the page then
 * shows only the "small product team at Prionation" sentence and no cards.
 * Add a member only with their agreement and a real photo.
 */
export const TEAM_MEMBERS: readonly TeamMember[] = [];
