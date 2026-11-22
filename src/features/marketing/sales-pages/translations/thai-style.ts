/**
 * The CSS the Thai copies add after each page's own (SalesPageTranslation.headCss).
 * The designs were drawn for Latin text: tracked and tightened headings, fonts
 * with no Thai letters, lines set close together. Thai is never letter-spaced
 * (it splits a consonant from its vowel and tone marks), needs a font that has
 * its letters, and needs room above and below a line for those marks.
 */

/** System fonts with Thai letters (Android/Linux, Windows, macOS/iOS), put after the page's own font. */
export const THAI_FONTS = '"Noto Sans Thai","Leelawadee UI","Thonburi","Sukhumvit Set",Tahoma';

/**
 * No letter spacing anywhere on the page. `keepTracking` names elements whose
 * text is Latin only and keeps its designed spacing (the EPIDOM wordmark).
 * The language switcher is in a shadow root and is not reached.
 */
function noLetterSpacing(keepTracking: readonly string[]): string {
  const not = keepTracking.map((selector) => `:not(${selector})`).join("");
  return `:lang(th)${not},:lang(th)::before,:lang(th)::after{letter-spacing:0!important}`;
}

export function thaiHeadCss(pageCss: readonly string[], keepTracking: readonly string[] = []): string {
  return [noLetterSpacing(keepTracking), ...pageCss].join("\n");
}
